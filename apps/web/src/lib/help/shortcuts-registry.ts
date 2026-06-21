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
      { keys: ['G', 'I'], label: 'Go to My Issues' },
      { keys: ['G', 'P'], label: 'Go to Projects' },
      { keys: ['G', 'D'], label: 'Go to Docs' },
      { keys: ['G', 'S'], label: 'Go to Sprints' },
      { keys: ['G', 'M'], label: 'Go to Modules' },
      { keys: ['G', 'N'], label: 'Go to Initiatives' },
      { keys: ['G', 'A'], label: 'Go to Analytics' },
      { keys: ['G', 'X'], label: 'Go to Inbox' },
      { keys: ['G', 'T'], label: 'Go to Team' },
    ],
  },
  {
    category: 'Create',
    items: [
      { keys: ['N', 'I'], label: 'New issue' },
      { keys: ['N', 'D'], label: 'New doc' },
      { keys: ['N', 'P'], label: 'New project' },
      { keys: ['N', 'S'], label: 'New sprint' },
      { keys: ['N', 'M'], label: 'New module' },
      { keys: ['N', 'V'], label: 'New view' },
      { keys: ['N', 'T'], label: 'New template' },
    ],
  },
  {
    category: 'Issue actions',
    items: [
      { keys: ['S'], label: 'Change state' },
      { keys: ['P'], label: 'Change priority' },
      { keys: ['A'], label: 'Assign' },
      { keys: ['L'], label: 'Labels' },
      { keys: ['Mod', 'C'], label: 'Add to sprint' },
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
