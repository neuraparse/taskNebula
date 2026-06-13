'use client';

import { Loader2, Plus } from 'lucide-react';
import { CommandItem } from '@/components/ui/command';

/**
 * Shared inline-create affordance for the sidebar pickers (labels, versions,
 * components — Jira/Plane style "Create {name}" row at the bottom of the
 * combobox). Keeps the icon/spinner/aria treatment identical across pickers.
 */

/**
 * Reads the HTTP status the picker create-mutations attach to their thrown
 * Error (`Object.assign(new Error(...), { status })`). Lets pickers branch
 * on 403 (no permission) vs 409 (duplicate name) without a shared class.
 */
export function getCreateErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

interface PickerCreateItemProps {
  /** Trimmed query text the row would create (used as the cmdk value). */
  name: string;
  /** Translated row label, e.g. `Create "{name}"`. */
  label: string;
  /** Shows a spinner and disables the row while the POST is in flight. */
  creating: boolean;
  /** Fires on click or Enter while the row is highlighted (cmdk onSelect). */
  onCreate: () => void;
}

export function PickerCreateItem({ name, label, creating, onCreate }: PickerCreateItemProps) {
  return (
    <CommandItem value={`__create__${name}`} disabled={creating} onSelect={onCreate}>
      {creating ? (
        <Loader2
          aria-hidden="true"
          className="text-muted-foreground mr-2 h-4 w-4 shrink-0 animate-spin"
        />
      ) : (
        <Plus aria-hidden="true" className="text-muted-foreground mr-2 h-4 w-4 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </CommandItem>
  );
}

/**
 * Visually hidden polite live region announcing create results to assistive
 * tech. Mount it OUTSIDE the popover so announcements survive close.
 */
export function PickerLiveRegion({ message }: { message: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {message}
    </span>
  );
}

/** Quiet inline error line rendered below the option list (403/409/500). */
export function PickerInlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive border-border border-t px-3 py-2 text-xs">
      {message}
    </p>
  );
}
