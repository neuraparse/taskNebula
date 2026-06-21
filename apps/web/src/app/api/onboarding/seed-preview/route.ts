/**
 * POST /api/onboarding/seed-preview
 *
 * Generates a workspace seed (project + teams + labels + cycles + issues)
 * from a free-text project description plus team-size and role hints.
 *
 * Returns the seed JSON only — nothing is written to the database. The
 * admin reviews and (optionally) edits the seed in the wizard before
 * calling /api/onboarding/seed-apply to commit it.
 *
 * Auth: requires an authenticated user with organization settings permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, hasPermission as roleHasPermission, organizationMembers, users } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import {
  generateWorkspaceSeed,
  BootstrapperError,
  ONBOARDING_ROLES,
  TEAM_SIZE_BUCKETS,
  type OnboardingRole,
  type TeamSizeBucket,
} from '@/lib/onboarding/bootstrapper';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodyObj = (body && typeof body === 'object' ? body : {}) as {
    projectDescription?: unknown;
    teamSize?: unknown;
    role?: unknown;
  };
  const projectDescription =
    typeof bodyObj.projectDescription === 'string' ? bodyObj.projectDescription.trim() : '';
  const teamSize =
    typeof bodyObj.teamSize === 'string' ? (bodyObj.teamSize as TeamSizeBucket) : undefined;
  const role = typeof bodyObj.role === 'string' ? (bodyObj.role as OnboardingRole) : undefined;

  if (!projectDescription) {
    return NextResponse.json({ error: 'projectDescription is required' }, { status: 400 });
  }
  if (!teamSize || !TEAM_SIZE_BUCKETS.includes(teamSize)) {
    return NextResponse.json(
      { error: `teamSize must be one of ${TEAM_SIZE_BUCKETS.join(', ')}` },
      { status: 400 }
    );
  }
  if (!role || !ONBOARDING_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `role must be one of ${ONBOARDING_ROLES.join(', ')}` },
      { status: 400 }
    );
  }

  // Authz: super admin or org:settings in any active org.
  const [actor] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!actor?.isSuperAdmin) {
    const memberships = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, 'active')));
    const canManageSettings = memberships.some((membership) =>
      roleHasPermission(membership.role || '', 'org:settings')
    );
    if (!canManageSettings) {
      return NextResponse.json(
        { error: 'Generating a workspace seed requires organization settings permission.' },
        { status: 403 }
      );
    }
  }

  try {
    const seed = await generateWorkspaceSeed({
      projectDescription,
      teamSize,
      role,
    });
    return NextResponse.json({ seed });
  } catch (err) {
    if (err instanceof BootstrapperError) {
      const status =
        err.code === 'invalid_input'
          ? 400
          : err.code === 'missing_credential'
            ? 412
            : err.code === 'schema_violation' || err.code === 'invalid_json'
              ? 502
              : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error('seed-preview error', err);
    return NextResponse.json({ error: 'Failed to generate workspace seed.' }, { status: 500 });
  }
}

// Block other methods cleanly.
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
