'use client';

import { Button } from '@/components/ui/button';
import { MoreHorizontal, Share, Star, Bell, BookOpen, CheckSquare, Bug, Zap, FileText, ExternalLink, Copy } from 'lucide-react';
import { PresenceAvatars } from '@/components/presence/presence-avatars';
import { StartAgentDialog } from '@/components/agents/start-agent-dialog';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface IssueHeaderProps {
  issue: {
    id: string;
    key: string;
    type: string;
    title: string;
    status: string;
  };
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  story: {
    icon: BookOpen,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    label: 'Story',
  },
  task: {
    icon: CheckSquare,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    label: 'Task',
  },
  bug: {
    icon: Bug,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/40',
    label: 'Bug',
  },
  epic: {
    icon: Zap,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    label: 'Epic',
  },
};

export function IssueHeader({ issue }: IssueHeaderProps) {
  const [isStarred, setIsStarred] = useState(false);
  const [isWatching, setIsWatching] = useState(false);

  const config = typeConfig[issue.type] || {
    icon: FileText,
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    label: 'Issue',
  };
  const TypeIcon = config.icon;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Left side: Type icon + Key + Type badge + Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={cn(
          'h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
          config.bg
        )}>
          <TypeIcon className={cn('h-5 w-5', config.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="font-mono text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              {issue.key}
            </span>
            <span className={cn(
              'text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide',
              config.bg,
              config.color
            )}>
              {config.label}
            </span>
          </div>
          <h1 className="text-lg font-semibold truncate text-foreground leading-tight">
            {issue.title}
          </h1>
        </div>
      </div>

      {/* Right side: Presence + Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <PresenceAvatars issueId={issue.id} />

        <StartAgentDialog issueId={issue.id} />

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 transition-colors',
              isStarred
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setIsStarred(!isStarred)}
          >
            <Star className={cn('h-4 w-4', isStarred && 'fill-current')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 transition-colors',
              isWatching
                ? 'text-blue-500 hover:text-blue-600'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setIsWatching(!isWatching)}
          >
            <Bell className={cn('h-4 w-4', isWatching && 'fill-current')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleCopyLink}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
