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
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <TypeIcon className={cn('h-4 w-4 shrink-0', config.color)} />
        <span className="font-mono text-xs font-medium text-muted-foreground shrink-0">
          {issue.key}
        </span>
        <span className="text-muted-foreground/40 shrink-0">/</span>
        <h1 className="text-sm font-medium truncate text-foreground">
          {issue.title}
        </h1>
      </div>

      <div className="flex items-center gap-1 shrink-0 pr-6">
        <PresenceAvatars issueId={issue.id} />

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7 transition-colors duration-200',
            isStarred ? 'text-accent-amber' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setIsStarred(!isStarred)}
        >
          <Star className={cn('h-3.5 w-3.5', isStarred && 'fill-current')} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7 transition-colors duration-200',
            isWatching ? 'text-accent-blue' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setIsWatching(!isWatching)}
        >
          <Bell className={cn('h-3.5 w-3.5', isWatching && 'fill-current')} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground transition-colors duration-200"
          onClick={handleCopyLink}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-accent-emerald" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}
