'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';

interface StoryPointsFieldProps {
  /** Current story points value, or null when unset. */
  value: number | null;
  /** Emits the next value (non-negative integer) or null to clear. */
  onChange: (storyPoints: number | null) => void;
  disabled?: boolean;
}

/** Compact numeric input for agile story points. Commits on blur / Enter. */
export function StoryPointsField({ value, onChange, disabled = false }: StoryPointsFieldProps) {
  const t = useTranslations('issueFields');
  const [draft, setDraft] = useState(value == null ? '' : String(value));

  // Keep the local draft in sync when the server value changes externally.
  useEffect(() => {
    setDraft(value == null ? '' : String(value));
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (value !== null) onChange(null);
      return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      // Revert invalid input back to the last known value.
      setDraft(value == null ? '' : String(value));
      return;
    }
    setDraft(String(parsed));
    if (parsed !== value) onChange(parsed);
  };

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      placeholder={t('storyPointsShort')}
      aria-label={t('storyPoints')}
      disabled={disabled}
      className="h-8 w-20 text-sm"
    />
  );
}
