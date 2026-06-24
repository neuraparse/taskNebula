'use client';

/**
 * Compact quick-action toolbar for the issue detail header (Jira's
 * quick-add/actions row analogue): copy ID / link / branch name / Markdown,
 * a flag toggle, open in a new tab, plus an overflow menu for heavier or
 * destructive actions.
 *
 * Delete renders only when a callback is provided. Duplicate / Archive have no
 * backend yet, so they render as clearly-disabled "coming soon" items (never
 * dead buttons) unless a real callback is supplied.
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Hash,
  Link as LinkIcon,
  GitBranch,
  ExternalLink,
  MoreHorizontal,
  Copy,
  Archive,
  Trash2,
  Flag,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useUpdateIssue, type Issue } from '@/lib/hooks/use-issues';
import { cn } from '@/lib/utils';

export interface IssueQuickActionsProps {
  issueKey: string;
  title: string;
  /** Issue id (CUID2) — required for the flag toggle PATCH. */
  issueId?: string;
  /** Current flagged state; drives the flag/unflag toggle affordance. */
  flagged?: boolean;
  /** Optional branch prefix, e.g. the current user's handle. */
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
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}

function IconAction({ label, onClick, disabled, active, children }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          className={cn(active && 'text-accent-amber')}
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
  issueId,
  flagged = false,
  username,
  onDuplicate,
  onArchive,
  onDelete,
  className,
}: IssueQuickActionsProps) {
  const t = useTranslations('issueDetail.quickActions');
  const tq = useTranslations('issueQuickActions');
  const { toast } = useToast();
  const updateIssue = useUpdateIssue();

  const branchName = React.useMemo(() => {
    const prefix = username ? `${slugify(username, 20)}/` : '';
    const remaining = Math.max(8, MAX_BRANCH_LENGTH - issueKey.length - 1);
    const titleSlug = slugify(title, remaining);
    return `${prefix}${issueKey.toLowerCase()}-${titleSlug}`.replace(/-+$/g, '');
  }, [issueKey, title, username]);

  const handleCopyId = React.useCallback(async () => {
    const ok = await copyToClipboard(issueKey);
    toast({
      title: ok ? t('copiedId', { key: issueKey }) : t('copyFailed'),
      ...(ok ? {} : { variant: 'destructive' as const }),
    });
  }, [issueKey, t, toast]);

  const handleCopyUrl = React.useCallback(async () => {
    const ok = typeof window !== 'undefined' && (await copyToClipboard(window.location.href));
    toast({
      title: ok ? t('copiedLink') : t('copyFailed'),
      ...(ok ? {} : { variant: 'destructive' as const }),
    });
  }, [t, toast]);

  const handleCopyBranch = React.useCallback(async () => {
    const ok = await copyToClipboard(branchName);
    toast({
      title: ok ? t('copiedBranch', { branch: branchName }) : t('copyFailed'),
      ...(ok ? {} : { variant: 'destructive' as const }),
    });
  }, [branchName, t, toast]);

  const handleCopyMarkdown = React.useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const markdown = `[${issueKey}: ${title}](${url})`;
    const ok = await copyToClipboard(markdown);
    toast({
      title: ok ? tq('copied') : t('copyFailed'),
      ...(ok ? {} : { variant: 'destructive' as const }),
    });
  }, [issueKey, title, tq, t, toast]);

  const handleToggleFlag = React.useCallback(() => {
    if (!issueId) {
      return;
    }
    // `flagged` is a server-side issue column the sidebar-fields agent adds to
    // the PATCH route; it is not yet on the shared client `Issue` type, so cast
    // the optimistic patch through `Partial<Issue>` rather than widen the type.
    updateIssue.mutate(
      { issueId, data: { flagged: !flagged } as unknown as Partial<Issue> },
      {
        onError: () => {
          toast({ title: tq('flagFailed'), variant: 'destructive' });
        },
      }
    );
  }, [issueId, flagged, updateIssue, toast, tq]);

  const handleOpenInNewTab = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          'border-border/60 bg-background/40 inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-md border p-0.5',
          className
        )}
        role="toolbar"
        aria-label={t('toolbarLabel')}
      >
        <IconAction label={t('copyId', { key: issueKey })} onClick={handleCopyId}>
          <Hash />
        </IconAction>
        <IconAction label={t('copyLink')} onClick={handleCopyUrl}>
          <LinkIcon />
        </IconAction>
        <IconAction label={tq('copyMarkdown')} onClick={handleCopyMarkdown}>
          <FileText />
        </IconAction>
        <IconAction label={t('copyBranch')} onClick={handleCopyBranch}>
          <GitBranch />
        </IconAction>
        {issueId && (
          <IconAction
            label={flagged ? tq('unflag') : tq('flag')}
            onClick={handleToggleFlag}
            active={flagged}
            disabled={updateIssue.isPending}
          >
            <Flag className={cn(flagged && 'fill-current')} />
          </IconAction>
        )}
        <IconAction label={t('openInNewTab')} onClick={handleOpenInNewTab}>
          <ExternalLink />
        </IconAction>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t('more')}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('more')}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="min-w-[10rem]">
            {onDuplicate ? (
              <DropdownMenuItem onSelect={() => onDuplicate()}>
                <Copy className="mr-2 h-4 w-4" />
                {t('duplicate')}
              </DropdownMenuItem>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenuItem disabled className="justify-between">
                      <span className="flex items-center">
                        <Copy className="mr-2 h-4 w-4" />
                        {t('duplicate')}
                      </span>
                    </DropdownMenuItem>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">{tq('comingSoon')}</TooltipContent>
              </Tooltip>
            )}
            {onArchive ? (
              <DropdownMenuItem onSelect={() => onArchive()}>
                <Archive className="mr-2 h-4 w-4" />
                {t('archive')}
              </DropdownMenuItem>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenuItem disabled className="justify-between">
                      <span className="flex items-center">
                        <Archive className="mr-2 h-4 w-4" />
                        {t('archive')}
                      </span>
                    </DropdownMenuItem>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">{tq('comingSoon')}</TooltipContent>
              </Tooltip>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onDelete()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('delete')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}

export default IssueQuickActions;
