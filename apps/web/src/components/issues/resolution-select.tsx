'use client';

import { CheckCircle2, ChevronsUpDown, XCircle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** Mirrors the PATCH /api/issues/[issueId] `resolution` zod enum. */
export const RESOLUTION_VALUES = [
  'fixed',
  'wont_do',
  'duplicate',
  'cannot_reproduce',
  'done',
] as const;

export type IssueResolution = (typeof RESOLUTION_VALUES)[number];

export function isIssueResolution(value: string): value is IssueResolution {
  return (RESOLUTION_VALUES as readonly string[]).includes(value);
}

interface ResolutionSelectProps {
  value: string | null;
  /** Stamped server-side when the resolution is set; shown in the tooltip. */
  resolvedAt?: string | Date | null;
  /** `null` clears the resolution (and `resolvedAt`) server-side. */
  onChange: (resolution: IssueResolution | null) => void;
  disabled?: boolean;
}

export function ResolutionSelect({
  value,
  resolvedAt,
  onChange,
  disabled = false,
}: ResolutionSelectProps) {
  const t = useTranslations('issueSidebar.resolution');
  const format = useFormatter();

  const resolution = value && isIssueResolution(value) ? value : null;

  const menu = (
    <DropdownMenuContent align="start" className="w-52">
      {RESOLUTION_VALUES.map((option) => (
        <DropdownMenuItem key={option} onSelect={() => onChange(option)} className="text-sm">
          <CheckCircle2 className="text-accent-emerald mr-2 h-3.5 w-3.5" />
          {t(`values.${option}`)}
        </DropdownMenuItem>
      ))}
      {resolution && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onChange(null)} className="text-sm">
            <XCircle className="text-muted-foreground mr-2 h-3.5 w-3.5" />
            {t('clear')}
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  );

  if (!resolution) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            className="hover:bg-accent ease-snap h-8 w-full justify-between rounded-md px-2 text-sm transition-colors duration-150"
            disabled={disabled}
          >
            <span className="text-muted-foreground min-w-0 flex-1 truncate">{t('unresolved')}</span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
          </Button>
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    );
  }

  const chip = (
    <span className="chip-emerald inline-flex items-center gap-1 rounded-sm">
      <CheckCircle2 className="h-3 w-3 shrink-0" />
      {t(`values.${resolution}`)}
    </span>
  );

  return (
    <div className="flex items-center justify-between gap-2">
      {resolvedAt ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>{chip}</TooltipTrigger>
            <TooltipContent side="top">
              {t('resolvedOn', {
                date: format.dateTime(new Date(resolvedAt), { dateStyle: 'medium' }),
              })}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        chip
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-6 w-6 rounded-md p-0"
            aria-label={t('set')}
            disabled={disabled}
          >
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    </div>
  );
}
