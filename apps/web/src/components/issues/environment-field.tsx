'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';

interface EnvironmentFieldProps {
  /** Current environment string, or null/undefined when unset. */
  value: string | null | undefined;
  /** Emits the trimmed value, or null to clear. Commits on blur / Enter. */
  onChange: (environment: string | null) => void;
  disabled?: boolean;
}

/** Free-text "Environment" field (Jira parity), stored in customFields. */
export function EnvironmentField({ value, onChange, disabled = false }: EnvironmentFieldProps) {
  const t = useTranslations('issueFields');
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    const next = trimmed === '' ? null : trimmed;
    const current = value ?? null;
    setDraft(trimmed);
    if (next !== current) onChange(next);
  };

  return (
    <Input
      type="text"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      placeholder={t('environmentPlaceholder')}
      aria-label={t('environment')}
      disabled={disabled}
      className="h-8 text-sm"
    />
  );
}
