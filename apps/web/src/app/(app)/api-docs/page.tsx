/**
 * Swagger UI for the TaskNebula HTTP API.
 *
 * Auth-gated to workspace admins:
 *   - super admins (`users.isSuperAdmin = true`), or
 *   - any user with role `owner` or `admin` in at least one organization.
 *
 * Anyone else is redirected to /dashboard. Unauthenticated users hit the
 * sign-in flow via the `(app)` segment's auth wiring.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, users, organizationMembers } from '@tasknebula/db';
import { eq, and, inArray } from 'drizzle-orm';
import { ApiDocsClient } from './api-docs-client';

export const dynamic = 'force-dynamic';

async function isWorkspaceAdmin(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.isSuperAdmin) return true;

  const [adminMembership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        inArray(organizationMembers.role, ['owner', 'admin'])
      )
    )
    .limit(1);

  return !!adminMembership;
}

export default async function ApiDocsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const allowed = await isWorkspaceAdmin(session.user.id);
  if (!allowed) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-full bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-2xl font-semibold">API Reference</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          OpenAPI 3.1 documentation for the TaskNebula HTTP API. Spec source:{' '}
          <a href="/openapi.json" className="underline" target="_blank" rel="noreferrer">
            /openapi.json
          </a>
        </p>
      </div>
      <ApiDocsClient specUrl="/openapi.json" />
    </div>
  );
}
