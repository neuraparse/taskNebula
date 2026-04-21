'use client';

import { useMemo, useState } from 'react';
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
        <a href="/settings/members">
          <Button size="sm">Invite member</Button>
        </a>
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
            className="h-9 pl-8"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-9 w-[160px]">
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
        <div className="stagger divide-y divide-border rounded-lg border border-border bg-card">
          {filtered.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-accent/60 transition-colors"
            >
              <Avatar className="h-8 w-8 shrink-0 rounded-full">
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
                {member.user.name && member.user.email && (
                  <p className="truncate text-xs text-muted-foreground">
                    {member.user.email}
                  </p>
                )}
              </div>
              <span className="chip capitalize">{member.role}</span>
              <span
                className={`status-dot ${
                  member.user.status === 'active' ? 'status-live' : 'status-idle'
                }`}
                aria-label={member.user.status === 'active' ? 'Active' : 'Idle'}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
