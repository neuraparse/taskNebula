'use client';

import { Button } from '@/components/ui/button';
import { Star, Bell, BookOpen, CheckSquare, Bug, Zap, FileText, Copy, Check } from 'lucide-react';
import { PresenceAvatars } from '@/components/presence/presence-avatars';
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

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  story: { icon: BookOpen, color: 'text-accent-emerald', label: 'Story' },
  task: { icon: CheckSquare, color: 'text-accent-blue', label: 'Task' },
  bug: { icon: Bug, color: 'text-accent-rose', label: 'Bug' },
  epic: { icon: Zap, color: 'text-accent-violet', label: 'Epic' },
};

export function IssueHeader({ issue }: IssueHeaderProps) {
  const [isStarred, setIsStarred] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [copied, setCopied] = useState(false);

  const config = typeConfig[issue.type] || {
    icon: FileText,
    color: 'text-muted-foreground',
    label: 'Issue',
  };
  const TypeIcon = config.icon;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TypeIcon className={cn('h-3.5 w-3.5 shrink-0', config.color)} />
          <span>{config.label}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-mono">{issue.key}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
          {issue.title}
        </h1>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <PresenceAvatars issueId={issue.id} />

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-1.5 rounded-md transition-colors duration-150 ease-snap',
            isStarred && 'text-accent-amber'
          )}
          onClick={() => setIsStarred(!isStarred)}
        >
          <Star className={cn('h-3.5 w-3.5', isStarred && 'fill-current')} />
          <span className="hidden sm:inline">{isStarred ? 'Starred' : 'Star'}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-1.5 rounded-md transition-colors duration-150 ease-snap',
            isWatching && 'text-accent-blue'
          )}
          onClick={() => setIsWatching(!isWatching)}
        >
          <Bell className={cn('h-3.5 w-3.5', isWatching && 'fill-current')} />
          <span className="hidden sm:inline">{isWatching ? 'Watching' : 'Watch'}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors duration-150 ease-snap"
          onClick={handleCopyLink}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-accent-emerald" />
              <span className="hidden sm:inline">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Copy link</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
