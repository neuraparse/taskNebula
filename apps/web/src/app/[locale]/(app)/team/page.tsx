import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { db, organizationMembers, users as usersTable } from '@tasknebula/db';
import { eq, inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hasPermission } from '@/lib/auth/permissions';
import { TeamPageClient } from './team-page-client';
import type { TeamMemberRow } from './team-members-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pagesWork');
  return {
    title: t('team.metaTitle'),
    description: t('team.metaDescription'),
  };
}

export default async function TeamPage() {
  const t = await getTranslations('pagesWork');
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
        <div className="bg-background border-b px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight">{t('team.title')}</h1>
        </div>
        <div className="min-h-0 flex-1 p-6">
          <div className="surface-card space-y-3 p-8 text-center">
            <Users className="text-muted-foreground mx-auto h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t('team.noOrganization')}</p>
            <Link href="/settings?tab=organization">
              <Button size="sm">{t('team.createOrganization')}</Button>
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

  const users =
    userIds.length > 0
      ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
      : [];

  const membersWithUsers = allMembers
    .map((member) => {
      const user = users.find((u) => u.id === member.userId);
      return { ...member, user };
    })
    .filter((m) => m.user);

  const plainMembers: TeamMemberRow[] = membersWithUsers.map((m) => ({
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

  const canManageTeamspaces = await hasPermission(primaryOrg.organizationId, 'org:settings');

  return (
    <TeamPageClient
      organizationId={primaryOrg.organizationId}
      canManageTeamspaces={canManageTeamspaces}
      initialMembers={plainMembers}
    />
  );
}
