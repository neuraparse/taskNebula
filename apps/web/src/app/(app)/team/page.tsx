import { Metadata } from 'next';
import { auth } from '@/auth';
import { db, organizationMembers, users as usersTable } from '@tasknebula/db';
import { eq, inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  // Get user's organizations using raw SQL-like query
  const userOrgs = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, session.user.id));

  const primaryOrg = userOrgs[0];
  if (!primaryOrg) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b bg-background px-6 py-4">
          <h1 className="text-2xl font-bold">Team</h1>
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

  // Get all organization members
  const allMembers = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, primaryOrg.organizationId));

  // Get user IDs
  const userIds = allMembers.map((m) => m.userId);

  // Get all users for these members
  const users = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));

  // Map members with their user details
  const membersWithUsers = allMembers.map((member) => {
    const user = users.find((u) => u.id === member.userId);
    return { ...member, user };
  }).filter((m) => m.user);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team</h1>
            <p className="text-sm text-muted-foreground">
              {membersWithUsers.length} team member{membersWithUsers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <a href="/settings/members">
            <Button>Invite Member</Button>
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {membersWithUsers.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold">No Team Members</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Invite team members to collaborate on projects
            </p>
            <a href="/settings/members">
              <Button className="mt-4">Invite Member</Button>
            </a>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {membersWithUsers.map((member) => (
              member.user && (
                <Card key={member.id}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <Avatar>
                        <AvatarImage src={member.user.image || undefined} />
                        <AvatarFallback>
                          {member.user.name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-base">{member.user.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{member.user.email}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{member.role}</Badge>
                      <Badge
                        variant={member.user.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {member.user.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

