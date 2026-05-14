/**
 * Settings → Security → Audit log streaming.
 *
 * Lets workspace admins configure SIEM destinations for audit_logs and run a
 * one-shot connectivity test against each.
 *
 * Page is a server component that does auth/perm gating; the actual list/
 * editor is the client component below.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, organizationMembers, eq } from '@tasknebula/db';
import { requirePermission } from '@/lib/auth/permissions';
import { AuditLogStreamingClient } from './audit-log-streaming-client';

export const metadata = { title: 'Audit log streaming · TaskNebula' };
export const dynamic = 'force-dynamic';

export default async function AuditLogStreamingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/settings/security/audit-log-streaming');
  }

  const [primaryOrg] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, session.user.id))
    .limit(1);

  if (!primaryOrg) {
    redirect('/dashboard?error=insufficient-permission');
  }

  await requirePermission(primaryOrg.organizationId, 'org:settings');

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Audit log streaming
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Forward every audit event to your SIEM. Supports HMAC-signed webhooks,
          Splunk HEC, Datadog Logs, and S3 (JSONL).
        </p>
      </header>
      <AuditLogStreamingClient organizationId={primaryOrg.organizationId} />
    </div>
  );
}
