import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { db, organizationMembers, users as usersTable } from '@tasknebula/db';
import { eq, inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamMembersList } from './team-members-list';

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
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b bg-background px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight">Team</h1>
        </div>
        <div className="min-h-0 flex-1 p-6">
          <div className="surface-card p-8 text-center space-y-3">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You are not a member of any organization yet.
            </p>
            <Link href="/settings?tab=organization">
              <Button size="sm">Create organization</Button>
            </Link>
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

  const plainMembers = membersWithUsers.map((m) => ({
    id: m.id,
    role: m.role,
    user: {
      id: m.user!.id,
      name: m.user!.name ?? null,
      email: m.user!.email ?? null,
      image: m.user!.image ?? null,
      status: (m.user as any).status ?? null,
    },
  }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Team</h1>
            <p className="text-sm text-muted-foreground">
              {plainMembers.length} member{plainMembers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link href="/settings?tab=members">
            <Button size="sm">Invite member</Button>
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        <TeamMembersList members={plainMembers} />
      </div>
    </div>
  );
}
