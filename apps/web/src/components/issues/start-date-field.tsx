'use client';

import { useState } from 'react';
import { ChevronsUpDown, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** ISO datetime → `YYYY-MM-DD` for the native date input (local date parts). */
function toDateInputValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

interface StartDateFieldProps {
  /** ISO datetime string or null (stored in customFields.startDate). */
  value: string | null | undefined;
  /** Emits a full ISO datetime (noon UTC) or null to clear. */
  onChange: (startDate: string | null) => void;
  disabled?: boolean;
}

/** Mirrors DueDatePicker but for the customFields-backed "Start date". */
export function StartDateField({ value, onChange, disabled = false }: StartDateFieldProps) {
  const t = useTranslations('issueFields');
  const format = useFormatter();
  const [open, setOpen] = useState(false);

  const handleDateInput = (dateValue: string) => {
    if (!dateValue) return;
    // Anchor at noon UTC so the calendar day survives timezone conversion.
    onChange(`${dateValue}T12:00:00.000Z`);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  const valid = value ? !Number.isNaN(new Date(value).getTime()) : false;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label={t('startDate')}
          className="hover:bg-accent ease-snap h-8 w-full justify-between rounded-md px-2 text-sm transition-colors duration-150"
          disabled={disabled}
        >
          {valid ? (
            <span className="text-foreground min-w-0 flex-1 truncate">
              {format.dateTime(new Date(value as string), { month: 'short', day: 'numeric' })}
            </span>
          ) : (
            <span className="text-muted-foreground min-w-0 flex-1 truncate">{t('startDate')}</span>
          )}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-2 p-3">
        <Input
          type="date"
          defaultValue={valid ? toDateInputValue(value as string) : ''}
          onChange={(event) => handleDateInput(event.target.value)}
          aria-label={t('startDate')}
          className="h-8 text-sm"
        />
        {valid && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground ease-snap h-7 w-full justify-start gap-1.5 rounded-md px-2 text-xs transition-colors duration-150"
            onClick={handleClear}
          >
            <X className="h-3.5 w-3.5" />
            {t('startDate')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
