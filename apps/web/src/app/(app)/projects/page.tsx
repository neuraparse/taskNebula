import { Metadata } from 'next';
import { auth } from '@/auth';
import { db } from '@tasknebula/db';
import { redirect } from 'next/navigation';
import { ProjectsClient } from './projects-client';

export const metadata: Metadata = {
  title: 'Projects | TaskNebula',
  description: 'View and manage all your projects',
};

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  // Use raw query to avoid Drizzle type issues
  const userId = session.user.id;

  const orgRows = await db.execute<{ organization_id: string }>(
    `SELECT organization_id FROM organization_members WHERE user_id = '${userId}'`
  ) as unknown as { organization_id: string }[];

  if (!orgRows || orgRows.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b bg-background px-6 py-4">
          <h1 className="text-2xl font-bold">Projects</h1>
        </div>
        <div className="flex-1 p-6">
          <div className="rounded-lg border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold">No Organization</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You are not a member of any organization yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const orgIds = orgRows.map((r: { organization_id: string }) => `'${r.organization_id}'`).join(',');

  const projectRows = await db.execute(
    `SELECT p.id, p.key, p.name, p.description, p.status, p.organization_id, o.name as org_name
     FROM projects p
     LEFT JOIN organizations o ON o.id = p.organization_id
     WHERE p.status = 'active' AND p.organization_id IN (${orgIds})
     ORDER BY p.updated_at DESC`
  ) as unknown as { id: string; key: string; name: string; description: string | null; status: string; org_name: string }[];

  const userProjects = (projectRows || []).map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    status: p.status,
    organizationName: p.org_name || '',
  }));

  return <ProjectsClient projects={userProjects} />;
}
