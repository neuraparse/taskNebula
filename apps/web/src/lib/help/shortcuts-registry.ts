/**
 * Keyboard shortcuts registry.
 *
 * `Mod` is rendered as ⌘ on macOS and `Ctrl` on Windows/Linux by the modal.
 * Keep this file framework-agnostic — UI lives in
 * `@/components/help/keyboard-shortcuts-modal`.
 */

export type ShortcutKey = string;

export interface ShortcutItem {
  /** Sequence of keys for this shortcut. Each entry is rendered as one <kbd>. */
  readonly keys: readonly ShortcutKey[];
  /** Human-readable description of what the shortcut does. */
  readonly label: string;
}

export interface ShortcutCategory {
  /** Section heading shown above the shortcut list. */
  readonly category: string;
  readonly items: readonly ShortcutItem[];
}

export const SHORTCUTS: readonly ShortcutCategory[] = [
  {
    category: 'Navigation',
    items: [
      { keys: ['G', 'H'], label: 'Go to Home' },
      { keys: ['G', 'I'], label: 'Go to Work items' },
      { keys: ['G', 'P'], label: 'Go to Pages' },
      { keys: ['G', 'C'], label: 'Go to Cycles' },
      { keys: ['G', 'M'], label: 'Go to Modules' },
      { keys: ['G', 'N'], label: 'Go to Initiatives' },
      { keys: ['G', 'D'], label: 'Go to Dashboards' },
      { keys: ['G', 'X'], label: 'Go to Inbox' },
      { keys: ['G', 'T'], label: 'Go to Teamspaces' },
    ],
  },
  {
    category: 'Create',
    items: [
      { keys: ['N', 'I'], label: 'New work item' },
      { keys: ['N', 'D'], label: 'New page' },
      { keys: ['N', 'P'], label: 'New project' },
      { keys: ['N', 'C'], label: 'New cycle' },
      { keys: ['N', 'M'], label: 'New module' },
      { keys: ['N', 'V'], label: 'New view' },
      { keys: ['N', 'B'], label: 'New dashboard' },
    ],
  },
  {
    category: 'Work item actions',
    items: [
      { keys: ['S'], label: 'Change state' },
      { keys: ['P'], label: 'Change priority' },
      { keys: ['A'], label: 'Assign' },
      { keys: ['L'], label: 'Labels' },
      { keys: ['Mod', 'C'], label: 'Add to cycle' },
      { keys: ['Mod', 'M'], label: 'Add to modules' },
      { keys: ['Mod', 'E'], label: 'Estimate' },
      { keys: ['Mod', 'S'], label: 'Subscribe' },
      { keys: ['Mod', '.'], label: 'Copy ID' },
      { keys: ['Mod', 'Shift', ','], label: 'Copy URL' },
      { keys: ['Mod', 'Backspace'], label: 'Delete' },
    ],
  },
  {
    category: 'Page actions',
    items: [
      { keys: ['Mod', 'L'], label: 'Lock page' },
      { keys: ['Mod', 'A'], label: 'Make public' },
      { keys: ['Mod', 'R'], label: 'Archive' },
      { keys: ['Mod', 'Shift', 'C'], label: 'Copy URL' },
    ],
  },
  {
    category: 'Misc',
    items: [
      { keys: ['Mod', 'K'], label: 'Open command palette' },
      { keys: ['Mod', '/'], label: 'Show shortcuts' },
      { keys: ['Mod', 'B'], label: 'Toggle sidebar' },
      { keys: ['Mod', 'F'], label: 'Add to favorites' },
    ],
  },
] as const;
