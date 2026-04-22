'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
      <div className="surface-card p-8 text-center space-y-3 animate-fade-up">
        <Users className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Invite team members to collaborate on projects.
        </p>
        <Link href="/settings?tab=members">
          <Button size="sm">Invite member</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members"
            className="h-9 rounded-md pl-8 transition-all duration-150 ease-snap"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-9 w-[160px] rounded-md transition-all duration-150 ease-snap">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r} value={r} className="capitalize">
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card p-8 text-center space-y-3">
          <Search className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No members match your filters.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setQuery('');
              setRole('all');
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="stagger grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member) => {
            const isActive = member.user.status === 'active';
            return (
              <div
                key={member.id}
                className="surface-card rounded-lg flex items-center gap-3 px-4 py-3 transition-all duration-150 ease-snap hover:border-border-strong"
              >
                <Avatar className="h-9 w-9 shrink-0 rounded-full">
                  <AvatarImage
                    src={member.user.image || undefined}
                    alt={member.user.name || 'Member'}
                  />
                  <AvatarFallback className="rounded-full text-xs font-medium">
                    {member.user.name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {member.user.name || member.user.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground capitalize">
                    {member.role}
                  </p>
                </div>
                {isActive ? (
                  <span className="live-pill" aria-label="Online">
                    Online
                  </span>
                ) : (
                  <span className="chip" aria-label="Offline">
                    <span className="status-dot status-idle" aria-hidden />
                    Offline
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
