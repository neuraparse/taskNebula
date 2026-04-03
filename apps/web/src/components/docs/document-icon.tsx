'use client';

import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DOCUMENT_ICON_OPTIONS = [
  '📝',
  '📘',
  '📗',
  '📙',
  '📕',
  '📚',
  '🧠',
  '🧩',
  '🚀',
  '🎯',
  '🛠️',
  '🧪',
  '📊',
  '📎',
  '⚙️',
  '🔒',
  '💡',
  '✅',
] as const;

interface DocumentIconProps {
  icon?: string | null;
  className?: string;
  emojiClassName?: string;
}

export function DocumentIcon({ icon, className, emojiClassName }: DocumentIconProps) {
  const normalizedIcon = typeof icon === 'string' && icon.trim().length > 0 ? icon.trim() : null;

  if (normalizedIcon) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background text-lg shadow-sm',
          className
        )}
      >
        <span className={cn('leading-none', emojiClassName)}>{normalizedIcon}</span>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/50 text-muted-foreground shadow-sm',
        className
      )}
    >
      <FileText className="h-[55%] w-[55%]" />
    </span>
  );
}
