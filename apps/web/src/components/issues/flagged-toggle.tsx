'use client';

import { Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FlaggedToggleProps {
  /** Whether the issue is currently flagged as an impediment. */
  value: boolean;
  /** Emits the next flagged state. */
  onChange: (flagged: boolean) => void;
  disabled?: boolean;
}

/**
 * Jira-style impediment marker. Amber when flagged, muted otherwise.
 */
export function FlaggedToggle({ value, onChange, disabled = false }: FlaggedToggleProps) {
  const t = useTranslations('issueFields');

  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={value}
      aria-label={value ? t('unflag') : t('flag')}
      className={cn(
        'hover:bg-accent ease-snap h-8 w-full justify-start gap-1.5 rounded-md px-2 text-sm transition-colors duration-150',
        value ? 'text-accent-amber' : 'text-muted-foreground'
      )}
      disabled={disabled}
      onClick={() => onChange(!value)}
    >
      <Flag className={cn('h-3.5 w-3.5 shrink-0', value && 'fill-current')} />
      <span>{value ? t('flagged') : t('flag')}</span>
    </Button>
  );
}
