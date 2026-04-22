'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type SlotContext = {
  target: HTMLElement | null;
  setTarget: (el: HTMLElement | null) => void;
  hasContent: boolean;
  setHasContent: (v: boolean) => void;
};

const PageSidebarContext = createContext<SlotContext | null>(null);

export function PageSidebarSlotProvider({ children }: { children: ReactNode }) {
  const [target, setTargetState] = useState<HTMLElement | null>(null);
  const [consumerCount, setConsumerCount] = useState(0);

  const setTarget = useCallback((el: HTMLElement | null) => {
    setTargetState((prev) => (prev === el ? prev : el));
  }, []);

  const setHasContent = useCallback((v: boolean) => {
    setConsumerCount((prev) => (v ? prev + 1 : Math.max(0, prev - 1)));
  }, []);

  const value = useMemo<SlotContext>(
    () => ({ target, setTarget, hasContent: consumerCount > 0, setHasContent }),
    [target, setTarget, consumerCount, setHasContent]
  );

  return <PageSidebarContext.Provider value={value}>{children}</PageSidebarContext.Provider>;
}

export function PageSidebarSlotTarget({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = useContext(PageSidebarContext);
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    ctx?.setTarget(ref.current);
    return () => ctx?.setTarget(null);
  }, [ctx]);

  return <div ref={ref} className={className} {...rest} />;
}

export function usePageSidebarHasContent() {
  const ctx = useContext(PageSidebarContext);
  return ctx?.hasContent ?? false;
}

export function PageSidebarContent({ children }: { children: ReactNode }) {
  const ctx = useContext(PageSidebarContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.setHasContent(true);
    return () => ctx.setHasContent(false);
  }, [ctx]);

  if (!ctx?.target) return null;
  return createPortal(children, ctx.target);
}
