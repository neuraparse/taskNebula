'use client';

import * as React from 'react';

import { KeyboardShortcutsModal } from '@/components/help/keyboard-shortcuts-modal';

export interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
}

/**
 * Returns true when the active element is a text input surface that should
 * swallow the global Cmd+/ shortcut (so users can still type "/" inside fields).
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  if (target.getAttribute('contenteditable') === 'true') return true;

  return false;
}

/**
 * Mounts the keyboard-shortcuts cheat sheet and binds the global trigger:
 *  - Cmd+/ on macOS, Ctrl+/ elsewhere → toggle modal
 *  - Esc closes (handled by the underlying Radix Dialog)
 *
 * The shortcut is suppressed when focus is inside an `<input>`, `<textarea>`,
 * `<select>`, or any `[contenteditable]` element.
 */
export function KeyboardShortcutsProvider({
  children,
}: KeyboardShortcutsProviderProps) {
  const [open, setOpen] = React.useState<boolean>(false);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      // Only react to "/" with the platform modifier.
      if (event.key !== '/') return;
      const usesMod = event.metaKey || event.ctrlKey;
      if (!usesMod) return;

      // Don't hijack typing in form fields / editors.
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      setOpen((previous) => !previous);
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, []);

  return (
    <>
      {children}
      <KeyboardShortcutsModal open={open} onOpenChange={setOpen} />
    </>
  );
}

export default KeyboardShortcutsProvider;
