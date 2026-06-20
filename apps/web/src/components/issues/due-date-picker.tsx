'use client';

import { useState } from 'react';
import { ChevronsUpDown, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * True when the due date's local calendar day has fully elapsed.
 * Exported for unit tests.
 */
export function isPastDue(value: string | Date, now: Date = new Date()): boolean {
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  const endOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999);
  return endOfDueDay.getTime() < now.getTime();
}

/** ISO datetime → `YYYY-MM-DD` for the native date input (local date parts). */
function toDateInputValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

interface DueDatePickerProps {
  /** ISO datetime string or null (as stored on the issue). */
  value: string | null;
  /** Emits a full ISO datetime (noon UTC, keeps the calendar day stable across timezones) or null to clear. */
  onChange: (dueDate: string | null) => void;
  disabled?: boolean;
}

export function DueDatePicker({ value, onChange, disabled = false }: DueDatePickerProps) {
  const t = useTranslations('issueSidebar.dueDate');
  const format = useFormatter();
  const [open, setOpen] = useState(false);

  const overdue = value ? isPastDue(value) : false;

  const handleDateInput = (dateValue: string) => {
    if (!dateValue) return;
    // Anchor at noon UTC so the calendar day survives toLocaleDateString in
    // every timezone between UTC-11 and UTC+12.
    onChange(`${dateValue}T12:00:00.000Z`);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label={t('pickAria')}
          className="hover:bg-accent ease-snap h-8 w-full justify-between rounded-md px-2 text-sm transition-colors duration-150"
          disabled={disabled}
        >
          {value ? (
            <span
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1.5',
                overdue ? 'text-accent-rose' : 'text-foreground'
              )}
            >
              <span className="truncate">
                {format.dateTime(new Date(value), { month: 'short', day: 'numeric' })}
              </span>
              {overdue && (
                <span className="bg-accent-rose/10 text-accent-rose shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium">
                  {t('overdue')}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground truncate">{t('set')}</span>
          )}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-2 p-3">
        <Input
          type="date"
          defaultValue={value ? toDateInputValue(value) : ''}
          onChange={(event) => handleDateInput(event.target.value)}
          aria-label={t('pickAria')}
          className="h-8 text-sm"
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground ease-snap h-7 w-full justify-start gap-1.5 rounded-md px-2 text-xs transition-colors duration-150"
            onClick={handleClear}
          >
            <X className="h-3.5 w-3.5" />
            {t('clear')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
