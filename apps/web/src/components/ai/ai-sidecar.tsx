'use client';

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Brain, ChevronDown, Send, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  describeEntity,
  type SidecarMessage,
  type SidecarMode,
  useSidecar,
} from '@/lib/ai/sidecar-context';
import { AiBadge } from '@/components/ai/AiBadge';

const MODE_VALUES: readonly SidecarMode[] = ['ask', 'build'];

export function AiSidecar() {
  const t = useTranslations('aiFeatures');
  const modeLabel = (m: SidecarMode) => t(`sidecar.modes.${m}.label`);
  const modeHint = (m: SidecarMode) => t(`sidecar.modes.${m}.hint`);
  const { open, setOpen, entity, messages, sendMessage } = useSidecar();
  const [mode, setMode] = useState<SidecarMode>('ask');
  const [input, setInput] = useState('');
  const [showThinking, setShowThinking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-focus the input when the sidecar opens.
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, open]);

  // ESC closes the panel.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  const activeModeHint = modeHint(mode);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    const value = input.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setInput('');
    try {
      await sendMessage(value, mode);
    } finally {
      setSubmitting(false);
      // Re-focus for fast follow-up.
      if (inputRef.current) inputRef.current.focus();
    }
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <aside
      aria-hidden={!open}
      aria-label={t('sidecar.ariaLabel')}
      role="complementary"
      className={cn(
        'bg-background border-border fixed bottom-0 right-0 top-0 z-40 flex w-[380px] max-w-full flex-col border-l shadow-2xl',
        'ease-snap transition-transform duration-200',
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
      )}
    >
      {/* Header */}
      <header className="border-border flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-md">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="text-foreground text-sm font-semibold">{t('sidecar.name')}</span>
          <EntityBadge label={describeEntity(entity)} dim={!entity} />
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('sidecar.close')}
          className="text-muted-foreground hover:bg-accent/60 hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Mode tabs */}
      <div className="border-border shrink-0 border-b px-3 pt-2">
        <div className="border-border bg-muted/30 inline-flex rounded-md border p-0.5">
          {MODE_VALUES.map((value) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={active}
                className={cn(
                  'rounded-[5px] px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {modeLabel(value)}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground mb-2 mt-1.5 text-[11px]">{activeModeHint}</p>
      </div>

      {/* Body / chat thread */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <EmptyState entityLabel={describeEntity(entity)} hasEntity={!!entity} />
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} showThinking={showThinking} />
          ))
        )}
      </div>

      {/* Footer / input */}
      <footer className="border-border shrink-0 space-y-2 border-t p-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={
              mode === 'ask' ? t('sidecar.askPlaceholder') : t('sidecar.buildPlaceholder')
            }
            rows={2}
            disabled={submitting}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex-1 resize-none rounded-md border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || submitting}
            aria-label={t('sidecar.send')}
            className="bg-primary text-primary-foreground ease-snap inline-flex h-9 w-9 items-center justify-center rounded-md transition-all duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        <div className="text-muted-foreground flex items-center justify-between gap-2 text-[11px]">
          <ModeDropdown
            mode={mode}
            onChange={setMode}
            open={modeMenuOpen}
            setOpen={setModeMenuOpen}
          />
          <label className="inline-flex cursor-pointer select-none items-center gap-1.5">
            <input
              type="checkbox"
              checked={showThinking}
              onChange={(event) => setShowThinking(event.target.checked)}
              className="border-border accent-primary h-3 w-3 rounded"
            />
            <Brain className="h-3 w-3" />
            {t('sidecar.showThinking')}
          </label>
        </div>
      </footer>
    </aside>
  );
}

interface EntityBadgeProps {
  label: string;
  dim?: boolean;
}

function EntityBadge({ label, dim }: EntityBadgeProps) {
  return (
    <span
      title={label}
      className={cn(
        'ml-1 inline-flex max-w-[140px] items-center truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
        dim
          ? 'border-border text-muted-foreground border-dashed'
          : 'border-border bg-muted/40 text-foreground'
      )}
    >
      {label}
    </span>
  );
}

interface ModeDropdownProps {
  mode: SidecarMode;
  onChange: (next: SidecarMode) => void;
  open: boolean;
  setOpen: (next: boolean) => void;
}

function ModeDropdown({ mode, onChange, open, setOpen }: ModeDropdownProps) {
  const t = useTranslations('aiFeatures');
  const modeLabel = (m: SidecarMode) => t(`sidecar.modes.${m}.label`);
  const modeHint = (m: SidecarMode) => t(`sidecar.modes.${m}.hint`);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, setOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="border-border bg-background text-foreground hover:bg-accent/60 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium"
      >
        {t('sidecar.modePrefix', { mode: modeLabel(mode) })}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div
          role="listbox"
          className="border-border bg-popover absolute bottom-full left-0 mb-1 w-44 overflow-hidden rounded-md border shadow-md"
        >
          {MODE_VALUES.map((value) => {
            const active = value === mode;
            return (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(value);
                  setOpen(false);
                }}
                className={cn(
                  'hover:bg-accent/60 flex w-full flex-col items-start gap-0.5 px-2.5 py-1.5 text-left text-xs transition-colors',
                  active && 'bg-accent/40'
                )}
              >
                <span className="text-foreground font-medium">{modeLabel(value)}</span>
                <span className="text-muted-foreground text-[10px]">{modeHint(value)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: SidecarMessage;
  showThinking: boolean;
}

function MessageBubble({ message, showThinking }: MessageBubbleProps) {
  const t = useTranslations('aiFeatures');
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const isAssistant = message.role === 'assistant';

  return (
    <div className={cn('flex flex-col gap-1', isAssistant ? 'items-start' : 'items-end')}>
      {isAssistant && showThinking && (
        <ThinkingBlock
          text={message.thinking}
          open={thinkingOpen}
          onToggle={() => setThinkingOpen((prev) => !prev)}
        />
      )}
      <div
        className={cn(
          'max-w-[88%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm',
          isAssistant ? 'bg-muted/50 text-foreground' : 'bg-primary text-primary-foreground'
        )}
      >
        {message.content}
      </div>
      {isAssistant && (
        <AiBadge
          feature={t('sidecar.badgeFeature')}
          generatedAt={new Date(message.createdAt)}
          className="mt-0.5"
        />
      )}
    </div>
  );
}

interface ThinkingBlockProps {
  text?: string;
  open: boolean;
  onToggle: () => void;
}

function ThinkingBlock({ text, open, onToggle }: ThinkingBlockProps) {
  const t = useTranslations('aiFeatures');
  return (
    <div className="border-border/70 bg-background/40 w-full max-w-[88%] rounded-md border border-dashed">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-2 py-1 text-[11px] font-medium transition-colors"
      >
        <Brain className="h-3 w-3" />
        {t('sidecar.thinking')}
        <ChevronDown
          className={cn('ml-auto h-3 w-3 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="border-border/60 text-muted-foreground whitespace-pre-wrap border-t border-dashed px-2 py-1.5 text-[11px] leading-relaxed">
          {text || t('sidecar.noTrace')}
        </div>
      )}
    </div>
  );
}

interface EmptyStateProps {
  hasEntity: boolean;
  entityLabel: string;
}

function EmptyState({ hasEntity, entityLabel }: EmptyStateProps) {
  const t = useTranslations('aiFeatures');
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="text-foreground text-sm font-medium">{t('sidecar.greeting')}</p>
      <p className="text-muted-foreground text-xs">
        {hasEntity
          ? t('sidecar.emptyWithEntity', { entity: entityLabel })
          : t('sidecar.emptyNoEntity')}
      </p>
    </div>
  );
}
