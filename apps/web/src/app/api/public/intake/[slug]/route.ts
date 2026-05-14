import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createId } from '@paralleldrive/cuid2';
import {
  db,
  intakeForms,
  intakeSubmissions,
  issues,
  projects,
  workflows,
  workflowStatuses,
} from '@tasknebula/db';
import { and, desc, eq } from 'drizzle-orm';
import { getClientIp } from '@/lib/auth/rate-limit';
import { checkIntakeRateLimit } from '@/lib/intake/rate-limit';
import { isCaptchaConfigured, verifyCaptcha } from '@/lib/intake/captcha';
import {
  buildIssueDescription,
  deriveIssueTitle,
  validateSubmission,
} from '@/lib/intake/schema';
import type { IntakeFieldDefinition } from '@tasknebula/db';

export const dynamic = 'force-dynamic';

// Default knobs — could be promoted to per-form settings later but
// these numbers comfortably stop scripted abuse without inconveniencing
// legitimate submitters.
const RATE_LIMIT = { limit: 5, windowMs: 60_000 };

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

/**
 * POST /api/public/intake/[slug]
 *
 * Public, no-auth submission endpoint. Validates against the form's
 * stored field definitions, rate-limits by (form, ip-hash) via Redis,
 * optionally verifies Turnstile / reCAPTCHA, persists an
 * `intake_submission`, and auto-creates a corresponding issue using
 * the project's default workflow.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    const [form] = await db
      .select()
      .from(intakeForms)
      .where(eq(intakeForms.slug, slug))
      .limit(1);

    if (!form || !form.isPublic) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    const ip = getClientIp(request);
    const ipHash = hashIp(ip);

    // Rate limit before parsing/captcha — cheapest way to shed abuse.
    const rl = await checkIntakeRateLimit(`${form.id}:${ipHash}`, RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)),
          },
        },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Captcha verification: only meaningful when the form requires it
    // AND a provider is configured at the env level. Otherwise we skip
    // (returns true) so deployments without Turnstile/reCAPTCHA aren't
    // hard-broken — the rate limiter is still doing real work.
    if (form.requiresCaptcha && isCaptchaConfigured()) {
      const token = typeof body.captchaToken === 'string' ? body.captchaToken : null;
      const verified = await verifyCaptcha({ token, remoteIp: ip });
      if (!verified) {
        return NextResponse.json({ error: 'Captcha verification failed' }, { status: 400 });
      }
    }

    const submissionPayload = (body.payload && typeof body.payload === 'object')
      ? (body.payload as Record<string, unknown>)
      : body;

    const fields = (form.fields as IntakeFieldDefinition[]) ?? [];
    const result = validateSubmission(fields, submissionPayload);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Validation failed', issues: result.issues },
        { status: 400 },
      );
    }

    // Pull the submitter email from the first `email` field that the
    // form declares and that was filled in. Keeps "who submitted this"
    // queryable without parsing the JSONB payload at read time.
    const emailField = fields.find((f) => f.type === 'email');
    const submittedByEmail = emailField
      ? (result.value[emailField.name] as string | undefined) ?? null
      : null;

    const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

    // Resolve the project + default workflow so we can drop the new
    // issue directly into the right backlog status. We deliberately
    // mirror /api/issues' workflow lookup to stay consistent with how
    // authenticated callers create issues.
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, form.projectId))
      .limit(1);
    if (!project) {
      return NextResponse.json({ error: 'Form is misconfigured' }, { status: 500 });
    }

    let workflowId = project.defaultWorkflowId ?? null;
    if (!workflowId) {
      const [defaultWorkflow] = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.organizationId, project.organizationId),
            eq(workflows.isDefault, true),
          ),
        )
        .limit(1);
      workflowId = defaultWorkflow?.id ?? null;
    }
    if (!workflowId) {
      return NextResponse.json({ error: 'Form is misconfigured' }, { status: 500 });
    }

    const allStatuses = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.workflowId, workflowId));

    // Match on category first (the form stores e.g. "triage" or
    // "backlog"), then fall back to the first backlog status. Triage
    // isn't a workflow_status_category value, so it always falls back —
    // intentional: we want "triage" to mean "lands in the backlog
    // pending review", not "needs a separate column".
    const targetCategory = form.targetStatus?.toLowerCase();
    const byCategory = allStatuses
      .filter((s) => s.category === targetCategory)
      .sort((a, b) => a.position - b.position)[0];
    const fallback = allStatuses
      .filter((s) => s.category === 'backlog')
      .sort((a, b) => a.position - b.position)[0];
    const statusRow = byCategory ?? fallback ?? allStatuses[0];
    if (!statusRow) {
      return NextResponse.json({ error: 'Form is misconfigured' }, { status: 500 });
    }

    // Allocate the next issue number for the project. Done via a fresh
    // SELECT rather than a sequence so we stay consistent with the
    // authenticated /api/issues path (which also does max+1).
    const [lastIssue] = await db
      .select()
      .from(issues)
      .where(eq(issues.projectId, project.id))
      .orderBy(desc(issues.number))
      .limit(1);
    const nextNumber = (lastIssue?.number ?? 0) + 1;
    const issueKey = `${project.key}-${nextNumber}`;

    // Issues require a non-null reporter user. For public intake we
    // attribute to the auto-assign user when set, otherwise the project
    // lead, otherwise the project creator. None of these are perfect,
    // but they keep the schema honest without needing a synthetic
    // "system" user.
    const reporterId =
      form.autoAssignUserId ?? project.leadId ?? project.createdBy;

    const submissionId = createId();
    const issueId = createId();

    const issueTitle = deriveIssueTitle(fields, result.value, form.title);
    const issueDescription = buildIssueDescription(fields, result.value, {
      formTitle: form.title,
      submittedByEmail,
    });

    await db.insert(issues).values({
      id: issueId,
      organizationId: project.organizationId,
      projectId: project.id,
      key: issueKey,
      number: nextNumber,
      title: issueTitle,
      description: issueDescription,
      statusId: statusRow.id,
      priority: 'medium',
      type: 'task',
      reporterId,
      assigneeId: form.autoAssignUserId ?? null,
      labels: ['intake'],
      customFields: {},
      metadata: { source: 'intake', intakeFormId: form.id, intakeSlug: form.slug },
      createdBy: reporterId,
      updatedBy: reporterId,
    });

    await db.insert(intakeSubmissions).values({
      id: submissionId,
      intakeFormId: form.id,
      submittedByEmail,
      submittedPayload: result.value,
      status: 'converted',
      createdIssueId: issueId,
      ipHash,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        submissionId,
        issueKey,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Public intake submit error:', error);
    return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 });
  }
}

/**
 * GET — return the public-safe form definition for the renderer. We
 * intentionally strip workspace/project ids and internal metadata.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const [form] = await db
      .select({
        id: intakeForms.id,
        slug: intakeForms.slug,
        title: intakeForms.title,
        description: intakeForms.description,
        fields: intakeForms.fields,
        isPublic: intakeForms.isPublic,
        requiresCaptcha: intakeForms.requiresCaptcha,
        customStyling: intakeForms.customStyling,
      })
      .from(intakeForms)
      .where(eq(intakeForms.slug, slug))
      .limit(1);

    if (!form || !form.isPublic) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json({
      form,
      captchaConfigured: isCaptchaConfigured(),
    });
  } catch (error) {
    console.error('Get public intake form error:', error);
    return NextResponse.json({ error: 'Failed to load form' }, { status: 500 });
  }
}
