'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Building2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamMembersList, type TeamMemberRow } from './team-members-list';
import { TeamspaceManager } from '@/components/organization/teamspace-manager';
import { useOrganizationMembers } from '@/lib/hooks/use-members';

const TAB_VALUES = ['members', 'teamspaces', 'invites'] as const;
type TabValue = (typeof TAB_VALUES)[number];

const TAB_ITEMS: { value: TabValue; labelKey: string; icon: typeof Users }[] = [
  { value: 'members', labelKey: 'team.tabs.members', icon: Users },
  { value: 'teamspaces', labelKey: 'team.tabs.teamspaces', icon: Building2 },
  { value: 'invites', labelKey: 'team.tabs.invites', icon: UserPlus },
];

export interface TeamPageClientProps {
  organizationId: string;
  canManageTeamspaces: boolean;
  initialMembers: TeamMemberRow[];
}

function isTabValue(value: string | null): value is TabValue {
  return value !== null && (TAB_VALUES as readonly string[]).includes(value);
}

export function TeamPageClient({
  organizationId,
  canManageTeamspaces,
  initialMembers,
}: TeamPageClientProps) {
  const t = useTranslations('pagesWork');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedTab = searchParams?.get('tab') ?? null;
  const initialTab: TabValue = isTabValue(requestedTab) ? requestedTab : 'members';
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  function handleTabChange(nextTab: TabValue) {
    setActiveTab(nextTab);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (nextTab === 'members') {
      params.delete('tab');
    } else {
      params.set('tab', nextTab);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const { data: membersData } = useOrganizationMembers(organizationId);

  const liveMembers: TeamMemberRow[] = useMemo(() => {
    if (!membersData?.members) {
      return initialMembers;
    }
    return membersData.members.map((m) => ({
      id: m.id,
      role: m.role,
      user: {
        id: m.id,
        name: m.name ?? null,
        email: m.email ?? null,
        image: m.image ?? null,
        status: m.status ?? null,
      },
    }));
  }, [initialMembers, membersData]);

  const pendingInvites = useMemo(() => {
    if (!membersData?.members) {
      return [];
    }
    return membersData.members.filter((m) => m.memberStatus === 'invited');
  }, [membersData]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="bg-background border-b px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t('team.title')}</h1>
            <p className="text-muted-foreground text-sm">
              {t('team.memberCount', { count: liveMembers.length })}
            </p>
          </div>
          <Link href="/settings?tab=members">
            <Button size="sm">{t('team.inviteMember')}</Button>
          </Link>
        </div>
        <div
          role="tablist"
          aria-label={t('team.sectionsLabel')}
          className="mt-3 flex gap-1 overflow-x-auto"
        >
          {TAB_ITEMS.map(({ value, labelKey, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              onClick={() => handleTabChange(value)}
              data-active={activeTab === value ? 'true' : undefined}
              className="row-interactive shrink-0 gap-1.5 px-3 py-1.5 text-sm"
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {activeTab === 'members' && <TeamMembersList members={liveMembers} />}
        {activeTab === 'teamspaces' && (
          <TeamspaceManager organizationId={organizationId} canManage={canManageTeamspaces} />
        )}
        {activeTab === 'invites' && <InvitesPanel invites={pendingInvites} />}
      </div>
    </div>
  );
}

interface InvitesPanelProps {
  invites: Array<{
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    joinedAt: string;
  }>;
}

function InvitesPanel({ invites }: InvitesPanelProps) {
  const t = useTranslations('pagesWork');
  if (invites.length === 0) {
    return (
      <div className="surface-card animate-fade-up space-y-3 p-8 text-center">
        <UserPlus className="text-muted-foreground mx-auto h-8 w-8" />
        <p className="text-muted-foreground text-sm">{t('team.invites.empty')}</p>
        <Link href="/settings?tab=members">
          <Button size="sm" variant="outline">
            {t('team.inviteMember')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {invites.map((invite) => (
        <div key={invite.id} className="surface-card flex items-center gap-3 rounded-lg px-4 py-3">
          <UserPlus className="text-muted-foreground h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-medium">
              {invite.email || invite.name || t('team.invites.invitedUser')}
            </p>
            <p className="text-muted-foreground truncate text-xs capitalize">
              {t('team.invites.rolePending', { role: invite.role })}
            </p>
          </div>
          <span className="chip">{t('team.invites.invited')}</span>
        </div>
      ))}
    </div>
  );
}
