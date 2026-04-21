import { Metadata } from 'next';
import { auth } from '@/auth';
import { db, organizationMembers, users as usersTable } from '@tasknebula/db';
import { eq, inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Team | TaskNebula',
  description: 'Manage your team members and settings',
};

export default async function TeamPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const userOrgs = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, session.user.id));

  const primaryOrg = userOrgs[0];
  if (!primaryOrg) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b bg-background px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight">Team</h1>
        </div>
        <div className="flex-1 p-6">
          <div className="surface-card p-8 text-center">
            <p className="text-sm font-medium">No organization</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You are not a member of any organization yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const allMembers = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, primaryOrg.organizationId));

  const userIds = allMembers.map((m) => m.userId);

  const users = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));

  const membersWithUsers = allMembers
    .map((member) => {
      const user = users.find((u) => u.id === member.userId);
      return { ...member, user };
    })
    .filter((m) => m.user);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Team</h1>
            <p className="text-sm text-muted-foreground">
              {membersWithUsers.length} member{membersWithUsers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <a href="/settings/members">
            <Button size="sm">Invite member</Button>
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {membersWithUsers.length === 0 ? (
          <div className="surface-card p-8 text-center">
            <p className="text-sm font-medium">No members yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Invite team members to collaborate on projects.
            </p>
            <a href="/settings/members">
              <Button size="sm" className="mt-4">Invite member</Button>
            </a>
          </div>
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {membersWithUsers.map((member) =>
              member.user ? (
                <div
                  key={member.id}
                  className="surface-card surface-card-hover animate-fade-up p-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 shrink-0 rounded-full">
                      <AvatarImage src={member.user.image || undefined} alt={member.user.name || 'Member'} />
                      <AvatarFallback className="rounded-full text-sm font-medium">
                        {member.user.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {member.user.name || member.user.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground capitalize">
                        {member.role}
                      </p>
                      {member.user.status === 'active' && (
                        <span className="inline-flex items-center gap-1">
                          <span className="status-dot status-live" />
                          <span className="text-xs text-muted-foreground">Active</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </div>
  );
}
