import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { db, projects, organizationMembers, organizations } from '@tasknebula/db';
import { eq, and, inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Projects | TaskNebula',
  description: 'View and manage all your projects',
};

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  // Get user's organization memberships
  const userOrgMemberships = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, session.user.id));

  if (userOrgMemberships.length === 0) {
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

  const orgIds = userOrgMemberships.map((m) => m.organizationId);

  // Get all active projects from user's organizations
  const allProjects = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.status, 'active'),
        inArray(projects.organizationId, orgIds)
      )
    )
    .orderBy(projects.updatedAt);

  // Get organization details
  const orgs = await db
    .select()
    .from(organizations)
    .where(inArray(organizations.id, orgIds));

  // Map projects with organization details
  const userProjects = allProjects.map((project) => {
    const org = orgs.find((o) => o.id === project.organizationId);
    return { ...project, organization: org };
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-sm text-muted-foreground">
              {userProjects.length} active project{userProjects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button>Create Project</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {userProjects.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-8 text-center">
            <h2 className="text-lg font-semibold">No Projects Yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first project to get started
            </p>
            <Button className="mt-4">Create Project</Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {userProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.key.toLowerCase()}`}
                className="group rounded-lg border bg-card p-6 transition-colors hover:border-primary"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold group-hover:text-primary">
                        {project.key}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {project.status}
                      </Badge>
                    </div>
                    <p className="mt-1 font-medium">{project.name}</p>
                    {project.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{project.organization.name}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

