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
  members: TeamMemberRow[];
}

export function TeamMembersList({ members }: TeamMembersListProps) {
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
        <Link href="/settings?tab=members">
          <Button size="sm">{t('team.inviteMember')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('team.members.searchPlaceholder')}
            className="ease-snap h-9 rounded-md pl-8 transition-all duration-150"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="ease-snap h-9 w-[160px] rounded-md transition-all duration-150">
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
        <div className="stagger grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member) => {
            const isActive = member.user.status === 'active';
            return (
              <div
                key={member.id}
                className="surface-card ease-snap hover:border-border-strong flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-150"
              >
                <Avatar className="h-9 w-9 shrink-0 rounded-full">
                  <AvatarImage
                    src={member.user.image || undefined}
                    alt={member.user.name || t('team.members.memberAlt')}
                  />
                  <AvatarFallback className="rounded-full text-xs font-medium">
                    {member.user.name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {member.user.name || member.user.email}
                  </p>
                  <p className="text-muted-foreground truncate text-xs capitalize">{member.role}</p>
                </div>
                {isActive ? (
                  <span className="live-pill" aria-label={t('team.members.online')}>
                    {t('team.members.online')}
                  </span>
                ) : (
                  <span className="chip" aria-label={t('team.members.offline')}>
                    <span className="status-dot status-idle" aria-hidden />
                    {t('team.members.offline')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
