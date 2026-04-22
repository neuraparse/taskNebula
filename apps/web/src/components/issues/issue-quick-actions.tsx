'use client';

import * as React from 'react';
import {
  Hash,
  Link as LinkIcon,
  GitBranch,
  ExternalLink,
  MoreHorizontal,
  Copy,
  Archive,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface IssueQuickActionsProps {
  issueKey: string;
  title: string;
  username?: string;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  className?: string;
}

const MAX_BRANCH_LENGTH = 40;

function slugify(input: string, maxLength = MAX_BRANCH_LENGTH): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= maxLength) {
    return slug;
  }

  return slug.slice(0, maxLength).replace(/-+$/g, '');
}

type ToastFn = (message: string) => void;

function resolveToast(): ToastFn {
  // Lazy resolve sonner if it's available; otherwise fall back gracefully.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const sonner = require('sonner') as { toast?: (msg: string) => void };
    if (sonner && typeof sonner.toast === 'function') {
      return (msg: string) => sonner.toast?.(msg);
    }
  } catch {
    // sonner not installed — fall through
  }
  return (msg: string) => {
    // eslint-disable-next-line no-console
    console.log('[issue-quick-actions]', msg);
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(msg);
    }
  };
}

async function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

interface IconActionProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}

function IconAction({ label, onClick, children }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function IssueQuickActions({
  issueKey,
  title,
  username = 'user',
  onDuplicate,
  onArchive,
  onDelete,
  className,
}: IssueQuickActionsProps) {
  const toast = React.useMemo(resolveToast, []);

  const branchName = React.useMemo(() => {
    const remaining = Math.max(8, MAX_BRANCH_LENGTH - issueKey.length - 1);
    const titleSlug = slugify(title, remaining);
    return `${username}/${issueKey}-${titleSlug}`.replace(/-+$/g, '');
  }, [issueKey, title, username]);

  const handleCopyId = React.useCallback(async () => {
    const ok = await copyToClipboard(issueKey);
    toast(ok ? `Copied ${issueKey}` : `Could not copy ${issueKey}`);
  }, [issueKey, toast]);

  const handleCopyUrl = React.useCallback(async () => {
    if (typeof window === 'undefined') {
      toast('URL unavailable');
      return;
    }
    const url = window.location.href;
    const ok = await copyToClipboard(url);
    toast(ok ? 'Copied link to clipboard' : 'Could not copy link');
  }, [toast]);

  const handleCopyBranch = React.useCallback(async () => {
    const ok = await copyToClipboard(branchName);
    toast(ok ? `Copied branch ${branchName}` : 'Could not copy branch name');
  }, [branchName, toast]);

  const handleOpenInNewTab = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  }, []);

  const handleDuplicate = React.useCallback(() => {
    if (onDuplicate) {
      onDuplicate();
    } else {
      // eslint-disable-next-line no-console
      console.info('[issue-quick-actions] duplicate', { issueKey });
    }
  }, [issueKey, onDuplicate]);

  const handleArchive = React.useCallback(() => {
    if (onArchive) {
      onArchive();
    } else {
      // eslint-disable-next-line no-console
      console.info('[issue-quick-actions] archive', { issueKey });
    }
  }, [issueKey, onArchive]);

  const handleDelete = React.useCallback(() => {
    if (onDelete) {
      onDelete();
    } else {
      // eslint-disable-next-line no-console
      console.info('[issue-quick-actions] delete', { issueKey });
    }
  }, [issueKey, onDelete]);

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          'inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-background/40 p-0.5',
          className,
        )}
        role="toolbar"
        aria-label="Issue quick actions"
      >
        <IconAction label={`Copy ID (${issueKey})`} onClick={handleCopyId}>
          <Hash />
        </IconAction>
        <IconAction label="Copy link" onClick={handleCopyUrl}>
          <LinkIcon />
        </IconAction>
        <IconAction label={`Copy branch name`} onClick={handleCopyBranch}>
          <GitBranch />
        </IconAction>
        <IconAction label="Open in new tab" onClick={handleOpenInNewTab}>
          <ExternalLink />
        </IconAction>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="More actions"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">More actions</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="min-w-[10rem]">
            <DropdownMenuItem onSelect={handleDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}

export default IssueQuickActions;
