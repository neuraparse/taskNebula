'use client';

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { describeEntity, type SidecarMessage, useSidecar } from '@/lib/ai/sidecar-context';
import { AiBadge } from '@/components/ai/AiBadge';

export function AiSidecar() {
  const t = useTranslations('aiFeatures');
  const { open, setOpen, entity, messages, sendMessage } = useSidecar();
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    const value = input.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setInput('');
    try {
      await sendMessage(value);
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
        'bg-background border-border fixed bottom-0 right-0 top-0 z-40 flex w-[380px] max-w-full flex-col border-l shadow-md',
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
          {entity ? <EntityBadge label={describeEntity(entity)} /> : null}
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

      <div className="border-border text-muted-foreground shrink-0 border-b px-4 py-2 text-[11px]">
        {t('sidecar.modes.ask.hint')}
      </div>

      {/* Body / chat thread */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <EmptyState hasEntity={!!entity} />
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
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
            placeholder={t('sidecar.askPlaceholder')}
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
      </footer>
    </aside>
  );
}

interface EntityBadgeProps {
  label: string;
}

function EntityBadge({ label }: EntityBadgeProps) {
  return (
    <span
      title={label}
      className="border-border bg-muted/40 text-foreground ml-1 inline-flex max-w-[140px] items-center truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium"
    >
      {label}
    </span>
  );
}

interface MessageBubbleProps {
  message: SidecarMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const t = useTranslations('aiFeatures');
  const isAssistant = message.role === 'assistant';

  return (
    <div className={cn('flex flex-col gap-1', isAssistant ? 'items-start' : 'items-end')}>
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

interface EmptyStateProps {
  hasEntity: boolean;
}

function EmptyState({ hasEntity }: EmptyStateProps) {
  const t = useTranslations('aiFeatures');
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="text-foreground text-sm font-medium">{t('sidecar.greeting')}</p>
      <p className="text-muted-foreground text-xs">
        {hasEntity ? t('sidecar.modes.ask.hint') : t('sidecar.emptyNoEntity')}
      </p>
    </div>
  );
}
