'use client';

import * as React from 'react';

import { CommandPalette } from '@/components/command/command-palette';
import {
  CommandPaletteContext,
  type CommandPaletteContextValue,
} from '@/lib/command/use-command-palette';

interface CommandPaletteProviderProps {
  children: React.ReactNode;
}

/**
 * Mounts the global Power-K command palette and exposes imperative
 * controls (`open` / `close` / `setOpen`) via React context.
 *
 * Behavior:
 *  - Cmd+K (macOS) / Ctrl+K (Win/Linux) toggles the palette.
 *  - ESC is handled inside the dialog (Radix) and via the chord state
 *    machine in <CommandPalette/>.
 *  - The keydown listener intentionally lives at `window` so it works
 *    no matter which element currently has focus.
 */
export function CommandPaletteProvider({ children }: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);
  const setOpen = React.useCallback((next: boolean) => setIsOpen(next), []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isToggle = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isToggle) return;

      // Don't fight the browser when the user is in some other shortcut
      // combination (e.g. Cmd+Shift+K is "clear console" in DevTools).
      if (event.shiftKey || event.altKey) return;

      event.preventDefault();
      setIsOpen((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const value = React.useMemo<CommandPaletteContextValue>(
    () => ({ isOpen, open, close, setOpen }),
    [isOpen, open, close, setOpen]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette open={isOpen} onOpenChange={setIsOpen} />
    </CommandPaletteContext.Provider>
  );
}
