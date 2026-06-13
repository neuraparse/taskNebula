'use client';

import { BookOpen, Bug, CheckSquare, FileText, ListTree, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * Shared issue-type icon/color vocabulary. Labels come from the `issueTypes`
 * i18n namespace keyed by the same names.
 */
export const ISSUE_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  story: { icon: BookOpen, color: 'text-accent-emerald' },
  task: { icon: CheckSquare, color: 'text-accent-blue' },
  bug: { icon: Bug, color: 'text-accent-rose' },
  epic: { icon: Zap, color: 'text-accent-violet' },
  subtask: { icon: ListTree, color: 'text-accent-cyan' },
};

export const ISSUE_TYPE_FALLBACK = { icon: FileText, color: 'text-muted-foreground' };

interface TypePickerProps {
  value: string;
  className?: string;
}

/**
 * READ-ONLY type display.
 *
 * The PATCH /api/issues/[issueId] schema does not accept `type` (it is fixed
 * at creation via POST /api/issues), so this renders the type without an
 * editor. Swap in a Popover/Command picker once the API supports mutating it.
 */
export function TypePicker({ value, className }: TypePickerProps) {
  const t = useTranslations('issueTypes');

  const known = value in ISSUE_TYPE_CONFIG;
  const config = known ? ISSUE_TYPE_CONFIG[value]! : ISSUE_TYPE_FALLBACK;
  const TypeIcon = config.icon;

  return (
    <div
      className={cn('flex h-8 items-center gap-2 px-2 text-sm', className)}
      title={t('readOnly')}
    >
      <TypeIcon className={cn('h-3.5 w-3.5 shrink-0', config.color)} />
      <span className="text-foreground truncate">{known ? t(value) : t('issue')}</span>
    </div>
  );
}
