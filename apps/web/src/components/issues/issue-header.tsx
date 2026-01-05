'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Share, Star, Bell } from 'lucide-react';
import { PresenceAvatars } from '@/components/presence/presence-avatars';

interface IssueHeaderProps {
  issue: {
    id: string;
    key: string;
    type: string;
    title: string;
    status: string;
  };
}

const typeIcons: Record<string, string> = {
  story: '📖',
  task: '✓',
  bug: '🐛',
  epic: '⚡',
};

export function IssueHeader({ issue }: IssueHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-xl">{typeIcons[issue.type] || '📄'}</span>
        <span className="font-mono text-sm text-muted-foreground shrink-0">{issue.key}</span>
        <h1 className="text-xl font-semibold truncate">{issue.title}</h1>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <PresenceAvatars issueId={issue.id} />
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Star className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Share className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

