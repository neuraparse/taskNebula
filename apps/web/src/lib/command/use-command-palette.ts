'use client';

import * as React from 'react';

export interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (next: boolean) => void;
}

export const CommandPaletteContext = React.createContext<CommandPaletteContextValue | null>(null);

/**
 * Access the global Power-K command palette controller.
 *
 * Must be used inside a `<CommandPaletteProvider>` ancestor — throws
 * a descriptive error otherwise so that misuse is caught at runtime
 * during development instead of silently no-oping.
 */
export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = React.useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error(
      'useCommandPalette() must be used within a <CommandPaletteProvider>. ' +
        'Wrap your app (e.g. in app/(app)/layout.tsx) with <CommandPaletteProvider>.'
    );
  }
  return ctx;
}
