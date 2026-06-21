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
  const { toast } = useToast();
  const [open, setOpenState] = useState(false);
  const [entity, setEntity] = useState<SidecarEntity | null>(null);
  const [messages, setMessages] = useState<SidecarMessage[]>([]);

  // Track pending simulated response timers so we can cancel on unmount.
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
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
            content:
              mode === 'ask'
                ? t('sidecar.stubAnswer', { prompt: trimmed, entity: entityLabel })
                : t('sidecar.stubBuild', { prompt: trimmed, entity: entityLabel }),
            thinking:
              mode === 'ask'
                ? t('sidecar.stubThinkingAsk', { entity: entityLabel })
                : t('sidecar.stubThinkingBuild', { prompt: trimmed, entity: entityLabel }),
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, reply]);
          resolve();
        }, 500);
        timersRef.current.add(timer);
      });
    },
    [entity, toast, t]
  );

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
