'use client';

import { Palette, X } from 'lucide-react';
import {
  type ChangeEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/utils';
import {
  STICKY_COLORS,
  type Sticky,
  type StickyColor,
} from '@/lib/personal/use-stickies';

interface StickyNoteProps {
  sticky: Sticky;
  onUpdate: (id: string, patch: Partial<Sticky>) => void;
  onRemove: (id: string) => void;
  className?: string;
}

const COLOR_CLASSES: Record<StickyColor, string> = {
  yellow:
    'bg-amber-50/70 border-amber-200 dark:bg-amber-100/30 dark:border-amber-300/40',
  pink:
    'bg-rose-50/70 border-rose-200 dark:bg-rose-100/30 dark:border-rose-300/40',
  blue:
    'bg-blue-50/70 border-blue-200 dark:bg-blue-100/30 dark:border-blue-300/40',
  green:
    'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-100/30 dark:border-emerald-300/40',
  purple:
    'bg-violet-50/70 border-violet-200 dark:bg-violet-100/30 dark:border-violet-300/40',
};

const COLOR_DOT: Record<StickyColor, string> = {
  yellow: 'bg-amber-300',
  pink: 'bg-rose-300',
  blue: 'bg-blue-300',
  green: 'bg-emerald-300',
  purple: 'bg-violet-300',
};

const AUTOSAVE_DEBOUNCE_MS = 600;

function formatRelative(timestamp: number, now: number): string {
  const diff = Math.max(0, now - timestamp);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `edited ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `edited ${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `edited ${day}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function nextColor(current: StickyColor): StickyColor {
  const idx = STICKY_COLORS.indexOf(current);
  const next = STICKY_COLORS[(idx + 1) % STICKY_COLORS.length];
  return next ?? 'yellow';
}

export function StickyNote({
  sticky,
  onUpdate,
  onRemove,
  className,
}: StickyNoteProps): ReactElement {
  const [draft, setDraft] = useState<string>(sticky.content);
  const [now, setNow] = useState<number>(() => Date.now());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(sticky.content);

  // Sync external changes (e.g. cross-tab) into local draft
  useEffect(() => {
    if (sticky.content !== lastSavedRef.current) {
      setDraft(sticky.content);
      lastSavedRef.current = sticky.content;
    }
  }, [sticky.content]);

  // Auto-resize textarea to fit content
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    resize();
  }, [draft, resize]);

  // Tick the relative timestamp once a minute
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup debounce on unmount, flushing any pending save
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, []);

  const flushSave = useCallback(
    (value: string) => {
      if (value === lastSavedRef.current) return;
      lastSavedRef.current = value;
      onUpdate(sticky.id, { content: value });
    },
    [onUpdate, sticky.id]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setDraft(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        flushSave(value);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [flushSave]
  );

  const handleBlur = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    flushSave(draft);
  }, [draft, flushSave]);

  const handleCycleColor = useCallback(() => {
    onUpdate(sticky.id, { color: nextColor(sticky.color) });
  }, [onUpdate, sticky.color, sticky.id]);

  const handleRemove = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    onRemove(sticky.id);
  }, [onRemove, sticky.id]);

  const relative = useMemo(
    () => formatRelative(sticky.updatedAt, now),
    [sticky.updatedAt, now]
  );

  return (
    <div
      className={cn(
        'group relative flex w-full max-w-[260px] flex-col rounded-lg border p-3 shadow-sm transition-shadow hover:shadow-md',
        COLOR_CLASSES[sticky.color],
        className
      )}
    >
      <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={handleCycleColor}
          aria-label="Change sticky color"
          title="Change color"
          className="inline-flex h-5 w-5 items-center justify-center rounded text-foreground/60 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
        >
          <Palette className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={handleRemove}
          aria-label="Delete sticky"
          title="Delete"
          className="inline-flex h-5 w-5 items-center justify-center rounded text-foreground/60 hover:bg-black/5 hover:text-rose-600 dark:hover:bg-white/10"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <span
        aria-hidden="true"
        className={cn(
          'mb-1.5 inline-block h-1.5 w-6 rounded-full',
          COLOR_DOT[sticky.color]
        )}
      />

      <textarea
        ref={textareaRef}
        value={draft}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Write a quick note..."
        rows={2}
        className={cn(
          'w-full resize-none overflow-hidden bg-transparent text-sm leading-snug',
          'text-foreground placeholder:text-foreground/40',
          'focus:outline-none'
        )}
      />

      <div className="mt-2 flex justify-end">
        <span className="text-[10px] text-foreground/50">{relative}</span>
      </div>
    </div>
  );
}
