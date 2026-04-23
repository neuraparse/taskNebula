/**
 * Super-admin-only email preview endpoint.
 *
 * GET /api/admin/email-preview?template=<name>
 *
 * Returns the rendered HTML body for the requested template, with sample
 * variables substituted via the same helpers the runtime uses. Diagnostic
 * only — no emails are sent, no DB writes.
 *
 * Supported template keys:
 *   - verify_email          (from lib/auth/email-verification.ts)
 *   - password_reset        (from api/auth/forgot-password/route.ts)
 *   - invitation            (from api/organizations/.../members/route.ts)
 *   - issue_assigned, issue_mentioned, issue_commented,
 *     sprint_started, daily_digest, weekly_digest
 *     (from BUILTIN_TEMPLATES in packages/db/src/utils/email-service.ts)
 */
import { NextRequest, NextResponse } from 'next/server';
import { BUILTIN_TEMPLATES, replaceVariables } from '@tasknebula/db';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { renderVerifyEmailMessage } from '@/lib/auth/email-verification';
import {
  renderInvitationMessage,
  renderPasswordResetMessage,
} from '@/lib/email/templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Sample variables used when rendering the template library previews. */
const SAMPLE_VARS: Record<string, string> = {
  // Generic / shell
  actorName: 'Ada Lovelace',
  recipientName: 'Grace Hopper',
  userName: 'grace',
  organizationName: 'TaskNebula Demo',
  appUrl: 'https://tasknebula.example.com',
  unsubscribeUrl: 'https://tasknebula.example.com/settings/notifications',
  // Issue context
  issueKey: 'DEMO-142',
  issueTitle: 'Flaky login redirect on Safari iOS',
  issueUrl: 'https://tasknebula.example.com/issues/DEMO-142',
  projectName: 'Demo Web',
  projectKey: 'DEMO',
  projectUrl: 'https://tasknebula.example.com/projects/DEMO',
  projectDescription: 'Customer-facing marketing site and sign-up flow.',
  priority: 'High',
  newStatus: 'In Review',
  commentBody:
    'Could you double-check the redirect target? On Safari iOS it seems to land on /login instead of /dashboard after SSO.',
  // Sprint context
  sprintName: 'Sprint 42',
  sprintGoal: 'Ship the new onboarding flow and fix the top 5 Sentry issues.',
  sprintStartDate: '2025-04-21',
  sprintEndDate: '2025-05-02',
  issueCount: '23',
  completedCount: '18',
  carriedOverCount: '5',
  commentCount: '47',
  // Digest context
  period: 'Apr 22, 2025',
  activityList:
    '• 8 issues moved to In Review\n• 3 issues merged\n• 2 sprints started',
  issuesSummary: 'Top priority: DEMO-142 remains blocked on design sign-off.',
  // Project lifecycle (used by a couple of templates sharing vars)
  archivedAt: '2025-04-20',
};

/** Render one of the BUILTIN_TEMPLATES with SAMPLE_VARS substituted. */
function renderBuiltin(key: string): string | null {
  const tpl = BUILTIN_TEMPLATES[key];
  if (!tpl) return null;
  return replaceVariables(tpl.html, SAMPLE_VARS);
}

/** Render one of the bespoke ad-hoc emails (verify / reset / invite). */
function renderBespoke(key: string): string | null {
  switch (key) {
    case 'verify_email': {
      const { html } = renderVerifyEmailMessage({
        displayName: 'Grace Hopper',
        verifyUrl:
          'https://tasknebula.example.com/auth/verify-email?token=preview-sample-token',
      });
      return html;
    }
    case 'password_reset': {
      const { html } = renderPasswordResetMessage({
        resetUrl:
          'https://tasknebula.example.com/auth/reset-password?token=preview-sample-token',
        ip: '203.0.113.42',
        requestedAt: 'Wed, 23 Apr 2025 14:30:00 GMT',
      });
      return html;
    }
    case 'invitation': {
      const { html } = renderInvitationMessage({
        inviteeEmail: 'grace@example.com',
        inviterName: 'Ada Lovelace',
        orgName: 'TaskNebula Demo',
        role: 'member',
        addedProjectNames: ['Demo Web', 'Platform API'],
        signupUrl:
          'https://tasknebula.example.com/auth/signup?email=grace%40example.com',
      });
      return html;
    }
    default:
      return null;
  }
}

const BESPOKE_KEYS = ['verify_email', 'password_reset', 'invitation'] as const;
const BUILTIN_KEYS = [
  'issue_assigned',
  'issue_mentioned',
  'issue_commented',
  'sprint_started',
  'daily_digest',
  'weekly_digest',
] as const;

const SUPPORTED_KEYS: readonly string[] = [...BESPOKE_KEYS, ...BUILTIN_KEYS];

export async function GET(request: NextRequest) {
  const admin = await isSuperAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'Super admin access required' },
      { status: 403 }
    );
  }

  const template = request.nextUrl.searchParams.get('template') || '';
  if (!template) {
    return NextResponse.json(
      { error: 'Missing ?template query param', supported: SUPPORTED_KEYS },
      { status: 400 }
    );
  }

  if (!SUPPORTED_KEYS.includes(template)) {
    return NextResponse.json(
      { error: `Unknown template: ${template}`, supported: SUPPORTED_KEYS },
      { status: 404 }
    );
  }

  const html =
    renderBespoke(template) ?? renderBuiltin(template) ?? null;

  if (!html) {
    // Should not happen given the whitelist above, but guard just in case.
    return NextResponse.json(
      { error: 'Failed to render template', supported: SUPPORTED_KEYS },
      { status: 500 }
    );
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Prevent any caching of diagnostic output.
      'Cache-Control': 'no-store, max-age=0',
      // Hardening: this is admin-only HTML but still renders in an iframe.
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
