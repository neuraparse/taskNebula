'use client';

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Brain,
  ChevronDown,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  describeEntity,
  type SidecarMessage,
  type SidecarMode,
  useSidecar,
} from '@/lib/ai/sidecar-context';

interface ModeOption {
  value: SidecarMode;
  label: string;
  hint: string;
}

const ASK_OPTION: ModeOption = {
  value: 'ask',
  label: 'Ask',
  hint: 'Read-only Q&A about current context',
};

const BUILD_OPTION: ModeOption = {
  value: 'build',
  label: 'Build',
  hint: 'Create entities from a prompt',
};

const MODE_OPTIONS: readonly ModeOption[] = [ASK_OPTION, BUILD_OPTION];

function resolveMode(mode: SidecarMode): ModeOption {
  return mode === 'build' ? BUILD_OPTION : ASK_OPTION;
}

export function AiSidecar() {
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

  const activeMode = useMemo(() => resolveMode(mode), [mode]);

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
      aria-label="AI Sidecar"
      role="complementary"
      className={cn(
        'fixed right-0 top-0 bottom-0 z-40 w-[380px] bg-background border-l border-border flex flex-col shadow-2xl',
        'transition-transform duration-200 ease-snap',
        open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
      )}
    >
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold text-foreground">Sidecar</span>
          <EntityBadge label={describeEntity(entity)} dim={!entity} />
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close Sidecar"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Mode tabs */}
      <div className="shrink-0 border-b border-border px-3 pt-2">
        <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
          {MODE_OPTIONS.map((option) => {
            const active = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                aria-pressed={active}
                className={cn(
                  'rounded-[5px] px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 mb-2 text-[11px] text-muted-foreground">
          {activeMode.hint}
        </p>
      </div>

      {/* Body / chat thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <EmptyState entityLabel={describeEntity(entity)} hasEntity={!!entity} />
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              showThinking={showThinking}
            />
          ))
        )}
      </div>

      {/* Footer / input */}
      <footer className="shrink-0 border-t border-border p-3 space-y-2">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={
              mode === 'ask'
                ? 'Ask about this context…'
                : 'Describe what to build…'
            }
            rows={2}
            disabled={submitting}
            className="flex-1 resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || submitting}
            aria-label="Send message"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-all duration-150 ease-snap hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <ModeDropdown
            mode={mode}
            onChange={setMode}
            open={modeMenuOpen}
            setOpen={setModeMenuOpen}
          />
          <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={showThinking}
              onChange={(event) => setShowThinking(event.target.checked)}
              className="h-3 w-3 rounded border-border accent-primary"
            />
            <Brain className="h-3 w-3" />
            Show thinking
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
          ? 'border-dashed border-border text-muted-foreground'
          : 'border-border bg-muted/40 text-foreground',
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

  const current = resolveMode(mode);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent/60"
      >
        Mode: {current.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute bottom-full left-0 mb-1 w-44 overflow-hidden rounded-md border border-border bg-popover shadow-md"
        >
          {MODE_OPTIONS.map((option) => {
            const active = option.value === mode;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent/60',
                  active && 'bg-accent/40',
                )}
              >
                <span className="font-medium text-foreground">{option.label}</span>
                <span className="text-[10px] text-muted-foreground">{option.hint}</span>
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
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        isAssistant ? 'items-start' : 'items-end',
      )}
    >
      {isAssistant && showThinking && (
        <ThinkingBlock
          text={message.thinking}
          open={thinkingOpen}
          onToggle={() => setThinkingOpen((prev) => !prev)}
        />
      )}
      <div
        className={cn(
          'max-w-[88%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
          isAssistant
            ? 'bg-muted/50 text-foreground'
            : 'bg-primary text-primary-foreground',
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

interface ThinkingBlockProps {
  text?: string;
  open: boolean;
  onToggle: () => void;
}

function ThinkingBlock({ text, open, onToggle }: ThinkingBlockProps) {
  return (
    <div className="w-full max-w-[88%] rounded-md border border-dashed border-border/70 bg-background/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Brain className="h-3 w-3" />
        Thinking…
        <ChevronDown
          className={cn(
            'ml-auto h-3 w-3 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="border-t border-dashed border-border/60 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {text || 'No reasoning trace recorded for this response.'}
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
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">Hi, I&apos;m Pi.</p>
      <p className="text-xs text-muted-foreground">
        {hasEntity
          ? `Ask anything about ${entityLabel}, or switch to Build mode to create work.`
          : 'Open me from any work item, project, or page and I will pick up the context automatically.'}
      </p>
    </div>
  );
}
