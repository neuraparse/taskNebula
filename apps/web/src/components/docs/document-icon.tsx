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
          'inline-flex shrink-0 items-center justify-center rounded-md border bg-transparent text-lg',
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
        'inline-flex shrink-0 items-center justify-center rounded-md border bg-transparent text-muted-foreground',
        className
      )}
    >
      <FileText className="h-[55%] w-[55%]" />
    </span>
  );
}
