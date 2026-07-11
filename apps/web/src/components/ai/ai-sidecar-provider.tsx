'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import {
  SidecarContext,
  type SidecarContextValue,
  type SidecarEntity,
  type SidecarMessage,
  type SidecarMode,
  describeEntity,
} from '@/lib/ai/sidecar-context';
import { AiSidecar } from './ai-sidecar';
import { AiDisclosureModal } from './ai-disclosure-modal';

type AskStreamEvent =
  | { type: 'token'; text?: string }
  | { type: 'error'; error?: string }
  | { type: 'done' }
  | { type: 'sources'; sources?: unknown[] }
  | { type: 'citations'; citations?: unknown[] };

function parseAskFrame(frame: string): AskStreamEvent | null {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)
    .join('\n');

  if (!data || data === '[DONE]') return null;

  try {
    return JSON.parse(data) as AskStreamEvent;
  } catch {
    return null;
  }
}

async function consumeAskStream(
  response: Response,
  onToken: (text: string) => void
): Promise<string> {
  if (!response.ok || !response.body) {
    throw new Error('ask_request_failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';

  const consumeFrames = (flush: boolean) => {
    const frames = buffer.split(/\r?\n\r?\n/);
    if (!flush) buffer = frames.pop() ?? '';
    else buffer = '';

    for (const frame of frames) {
      const event = parseAskFrame(frame);
      if (!event) continue;
      if (event.type === 'error') throw new Error('ask_stream_failed');
      if (event.type === 'token' && event.text) {
        answer += event.text;
        onToken(event.text);
      }
    }
  };

  let streamDone = false;
  while (!streamDone) {
    const { value, done } = await reader.read();
    if (done) {
      streamDone = true;
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    consumeFrames(false);
  }

  buffer += decoder.decode();
  if (buffer.trim()) consumeFrames(true);
  return answer;
}

interface AiSidecarProviderProps {
  children: ReactNode;
  enabled?: boolean;
}

/**
 * Provides the AI Sidecar global state (open/closed, current entity,
 * message thread) and mounts the floating <AiSidecar /> panel once,
 * above any page layout.
 *
 * Keyboard: Cmd+J (macOS) / Ctrl+J (Win/Linux) toggles. ESC closes
 * (handled inside <AiSidecar />).
 */
export function AiSidecarProvider({ children, enabled = true }: AiSidecarProviderProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  return <AiSidecarProviderInner>{children}</AiSidecarProviderInner>;
}

function AiSidecarProviderInner({ children }: { children: ReactNode }) {
  const t = useTranslations('aiFeatures');
  const tErrors = useTranslations('errorPages');
  const { toast } = useToast();
  const [open, setOpenState] = useState(false);
  const [entity, setEntity] = useState<SidecarEntity | null>(null);
  const [messages, setMessages] = useState<SidecarMessage[]>([]);

  // Track pending simulated response timers so we can cancel on unmount.
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
  }, []);

  const toggle = useCallback(() => {
    setOpenState((prev) => !prev);
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  // Cmd+J / Ctrl+J global listener.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const isToggle =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        (event.key === 'j' || event.key === 'J');
      if (!isToggle) return;

      // Don't intercept if user is composing in a text field unless they
      // really meant the shortcut (Cmd/Ctrl is held — most browsers treat
      // Cmd+J as reserved anyway, so this is safe).
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  const sendMessage = useCallback(
    async (content: string, mode: SidecarMode) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const userMessage: SidecarMessage = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `u_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);

      if (mode === 'ask') {
        const assistantId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `a_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '', createdAt: Date.now() },
        ]);

        try {
          const projectId = entity?.kind === 'project' ? entity.id : undefined;
          const response = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              query: trimmed,
              ...(projectId ? { projectId } : {}),
            }),
          });

          const answer = await consumeAskStream(response, (text) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? { ...message, content: `${message.content}${text}` }
                  : message
              )
            );
          });

          if (!answer.trim()) throw new Error('ask_empty_response');
        } catch {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: t('assist.assistFailed') }
                : message
            )
          );
          toast({
            title: t('assist.assistFailed'),
            description: tErrors('error.description'),
          });
        }
        return;
      }

      if (mode === 'build') {
        // Build mode is stubbed for now — surface a toast so the user knows
        // the action landed, then still produce an assistant acknowledgement
        // so the thread stays coherent.
        toast({
          title: t('sidecar.buildStubTitle'),
          description: t('sidecar.buildStubDescription'),
        });
      }

      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          timersRef.current.delete(timer);
          const entityLabel = describeEntity(entity);
          const reply: SidecarMessage = {
            id:
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: 'assistant',
            content: t('sidecar.stubBuild', { prompt: trimmed, entity: entityLabel }),
            thinking: t('sidecar.stubThinkingBuild', { prompt: trimmed, entity: entityLabel }),
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, reply]);
          resolve();
        }, 500);
        timersRef.current.add(timer);
      });
    },
    [entity, toast, t, tErrors]
  );

  // The command palette emits this event when the user chooses its Ask AI
  // action. Keep the two entry points on the same sidecar thread instead of
  // closing the palette and silently dropping the prompt.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onAskAi = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: unknown }>).detail?.prompt;
      if (typeof prompt !== 'string' || !prompt.trim()) return;

      setOpenState(true);
      void sendMessage(prompt, 'ask');
    };

    window.addEventListener('tasknebula:ask-ai', onAskAi);
    return () => window.removeEventListener('tasknebula:ask-ai', onAskAi);
  }, [sendMessage]);

  const value = useMemo<SidecarContextValue>(
    () => ({
      open,
      setOpen,
      toggle,
      entity,
      setEntity,
      messages,
      sendMessage,
      clear,
    }),
    [open, setOpen, toggle, entity, messages, sendMessage, clear]
  );

  return (
    <SidecarContext.Provider value={value}>
      {children}
      <AiSidecar />
      {/* EU AI Act Article 50 — first-time disclosure modal. Self-gates on
          the current disclosure version + per-user acknowledgement. */}
      <AiDisclosureModal />
    </SidecarContext.Provider>
  );
}
