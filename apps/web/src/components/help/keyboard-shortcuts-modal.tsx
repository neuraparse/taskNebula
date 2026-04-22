'use client';

import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SHORTCUTS, type ShortcutKey } from '@/lib/help/shortcuts-registry';
import { cn } from '@/lib/utils';

export interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Detect macOS in the browser; falls back to `false` during SSR. */
function useIsMac(): boolean {
  const [isMac, setIsMac] = React.useState(false);

  React.useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const platform =
      // `userAgentData` is preferred when available (Chromium); fall back to platform.
      (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform ?? navigator.platform ?? '';
    setIsMac(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);

  return isMac;
}

interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/** Mini keyboard-cap renderer used inside the cheat sheet. */
function Kbd({ className, children, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded border border-border bg-muted/50 text-[11px] font-mono font-medium text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

/** Convert a registry key string into its display form for the current OS. */
function renderKey(key: ShortcutKey, isMac: boolean): string {
  if (key === 'Mod') return isMac ? '⌘' : 'Ctrl';
  if (key === 'Shift') return isMac ? '⇧' : 'Shift';
  if (key === 'Alt') return isMac ? '⌥' : 'Alt';
  if (key === 'Backspace') return isMac ? '⌫' : 'Backspace';
  if (key === 'Enter') return isMac ? '⏎' : 'Enter';
  return key;
}

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  const isMac = useIsMac();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Move faster across taskNebula with these shortcuts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {SHORTCUTS.map((section) => (
            <section key={section.category} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.category}
              </h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                {section.items.map((item) => (
                  <React.Fragment key={`${section.category}:${item.label}`}>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, index) => (
                        <React.Fragment key={`${item.label}:${key}:${index}`}>
                          <Kbd>{renderKey(key, isMac)}</Kbd>
                          {index < item.keys.length - 1 ? (
                            <span
                              aria-hidden="true"
                              className="text-[11px] text-muted-foreground"
                            >
                              {/* Combine with + when modifier-bound, otherwise show "then" for sequences. */}
                              {item.keys[0] === 'Mod' ||
                              item.keys[0] === 'Shift' ||
                              item.keys[0] === 'Alt'
                                ? '+'
                                : 'then'}
                            </span>
                          ) : null}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="flex items-center text-sm text-foreground/90">
                      {item.label}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutsModal;
