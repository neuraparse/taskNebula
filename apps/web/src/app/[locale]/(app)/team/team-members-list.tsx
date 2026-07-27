'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Search, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface TeamMemberRow {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    status: string | null;
  };
}

interface TeamMembersListProps {
  canInviteMembers: boolean;
  members: TeamMemberRow[];
}

export function TeamMembersList({ canInviteMembers, members }: TeamMembersListProps) {
  const t = useTranslations('pagesWork');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<string>('all');

  const roles = useMemo(() => {
    const s = new Set<string>();
    members.forEach((m) => s.add(m.role));
    return Array.from(s);
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (role !== 'all' && m.role !== role) return false;
      if (!q) return true;
      const name = (m.user.name || '').toLowerCase();
      const email = (m.user.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [members, query, role]);

  if (members.length === 0) {
    return (
      <div className="surface-card animate-fade-up space-y-3 p-8 text-center">
        <Users className="text-muted-foreground mx-auto h-8 w-8" />
        <p className="text-muted-foreground text-sm">{t('team.members.emptyDescription')}</p>
        {canInviteMembers ? (
          <Button asChild size="sm">
            <Link href="/settings?tab=members">{t('team.inviteMember')}</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs sm:flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('team.members.searchPlaceholder')}
            className="ease-snap h-9 rounded-md pl-8 transition-[border-color,box-shadow] duration-150"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="ease-snap h-9 w-full rounded-md transition-[border-color,box-shadow] duration-150 sm:w-40">
            <SelectValue placeholder={t('team.members.rolePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('team.members.allRoles')}</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r} value={r} className="capitalize">
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card space-y-3 p-8 text-center">
          <Search className="text-muted-foreground mx-auto h-8 w-8" />
          <p className="text-muted-foreground text-sm">{t('team.members.noMatches')}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setQuery('');
              setRole('all');
            }}
          >
            {t('team.members.clearFilters')}
          </Button>
        </div>
      ) : (
        <ul className="surface-card stagger divide-border divide-y overflow-hidden shadow-none">
          {filtered.map((member) => {
            const isActive = member.user.status === 'active';
            return (
              <li key={member.id} className="hover:bg-surface/60 transition-colors duration-150">
                <div className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(7rem,auto)_auto]">
                  <Avatar className="h-9 w-9 shrink-0 rounded-full">
                    <AvatarImage
                      src={member.user.image || undefined}
                      alt={member.user.name || t('team.members.memberAlt')}
                    />
                    <AvatarFallback className="rounded-full text-xs font-medium">
                      {member.user.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">
                      {member.user.name || member.user.email}
                    </p>
                    {member.user.name && member.user.email ? (
                      <p className="text-muted-foreground truncate text-xs">{member.user.email}</p>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground col-start-2 truncate text-xs capitalize sm:col-auto">
                    {member.role}
                  </p>
                  <span
                    className={
                      isActive
                        ? 'text-accent-emerald inline-flex items-center gap-1.5 text-xs font-medium'
                        : 'text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium'
                    }
                    aria-label={isActive ? t('team.members.online') : t('team.members.offline')}
                  >
                    <span
                      className={isActive ? 'status-dot status-live' : 'status-dot status-idle'}
                      aria-hidden
                    />
                    <span className="hidden sm:inline">
                      {isActive ? t('team.members.online') : t('team.members.offline')}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
