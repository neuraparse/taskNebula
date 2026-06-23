'use client';

import * as React from 'react';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type SlashArgumentKind =
  | 'user' // @mention picker
  | 'label' // free-text label
  | 'duration' // 30m, 1h30m, etc.
  | 'project'
  | 'status'
  | 'free'; // any string

export interface SlashArgumentSpec {
  /** Human label shown in the inline hint. */
  label: string;
  /** next-intl key used when rendering the default registry. */
  labelKey?: string;
  kind: SlashArgumentKind;
  /** Whether the argument is required to fire the command. */
  required: boolean;
}

export interface SlashCommand {
  /** Trigger token, e.g. `assign` (no leading slash). */
  name: string;
  /** Human description shown in the picker. */
  description: string;
  /** next-intl key used when rendering the default registry. */
  descriptionKey?: string;
  /** Optional aliases that also trigger this command. */
  aliases?: ReadonlyArray<string>;
  /** Ordered list of arguments parsed from the rest of the line. */
  arguments?: ReadonlyArray<SlashArgumentSpec>;
  /**
   * Called when the user accepts the command. The implementation runs
   * outside the hook — the hook only delivers a structured payload.
   */
  run: (input: SlashCommandInvocation) => void | Promise<void>;
}

export interface SlashCommandInvocation {
  command: SlashCommand;
  /** Raw text after the trigger token, e.g. for `/assign @alice` -> `@alice`. */
  raw: string;
  /** Tokens parsed by whitespace. */
  tokens: ReadonlyArray<string>;
}

/* -------------------------------------------------------------------------- */
/* Default registry                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Notion-style slash commands shipped with FEAT-25. Each command's
 * `run` is a stub that dispatches a global custom event — consumers
 * (issue detail, doc editor, comment composer) can listen for these
 * to wire actual behavior without coupling to the registry.
 */
function dispatchSlash(event: string, detail: unknown) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(`tasknebula:slash:${event}`, { detail }));
}

type SlashTranslator = (key: string) => string;

function slashText(t: SlashTranslator | undefined, key: string) {
  return t ? t(key) : key;
}

export function createDefaultSlashCommands(t?: SlashTranslator): ReadonlyArray<SlashCommand> {
  return [
    {
      name: 'assign',
      descriptionKey: 'slashCommands.assign.description',
      description: slashText(t, 'slashCommands.assign.description'),
      aliases: ['a'],
      arguments: [
        {
          labelKey: 'slashCommands.arguments.user',
          label: slashText(t, 'slashCommands.arguments.user'),
          kind: 'user',
          required: true,
        },
      ],
      run: (invocation) => dispatchSlash('assign', invocation),
    },
    {
      name: 'label',
      descriptionKey: 'slashCommands.label.description',
      description: slashText(t, 'slashCommands.label.description'),
      aliases: ['tag'],
      arguments: [
        {
          labelKey: 'slashCommands.arguments.label',
          label: slashText(t, 'slashCommands.arguments.label'),
          kind: 'label',
          required: true,
        },
      ],
      run: (invocation) => dispatchSlash('label', invocation),
    },
    {
      name: 'track',
      descriptionKey: 'slashCommands.track.description',
      description: slashText(t, 'slashCommands.track.description'),
      arguments: [
        {
          labelKey: 'slashCommands.arguments.duration',
          label: slashText(t, 'slashCommands.arguments.duration'),
          kind: 'duration',
          required: true,
        },
      ],
      run: (invocation) => dispatchSlash('track', invocation),
    },
    {
      name: 'status',
      descriptionKey: 'slashCommands.status.description',
      description: slashText(t, 'slashCommands.status.description'),
      arguments: [
        {
          labelKey: 'slashCommands.arguments.status',
          label: slashText(t, 'slashCommands.arguments.status'),
          kind: 'status',
          required: true,
        },
      ],
      run: (invocation) => dispatchSlash('status', invocation),
    },
    {
      name: 'due',
      descriptionKey: 'slashCommands.due.description',
      description: slashText(t, 'slashCommands.due.description'),
      arguments: [
        {
          labelKey: 'slashCommands.arguments.date',
          label: slashText(t, 'slashCommands.arguments.date'),
          kind: 'free',
          required: true,
        },
      ],
      run: (invocation) => dispatchSlash('due', invocation),
    },
    {
      name: 'mention',
      descriptionKey: 'slashCommands.mention.description',
      description: slashText(t, 'slashCommands.mention.description'),
      arguments: [
        {
          labelKey: 'slashCommands.arguments.user',
          label: slashText(t, 'slashCommands.arguments.user'),
          kind: 'user',
          required: true,
        },
      ],
      run: (invocation) => dispatchSlash('mention', invocation),
    },
  ];
}

export const DEFAULT_SLASH_COMMANDS: ReadonlyArray<SlashCommand> = createDefaultSlashCommands();

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Finds an active slash trigger in the text immediately before `caret`.
 * Returns `null` if the cursor is not in a slash context (e.g. inside
 * a word, no leading slash, or already past whitespace after the
 * argument list).
 */
export function detectSlashTrigger(
  text: string,
  caret: number
): { start: number; query: string; argsRaw: string } | null {
  if (caret < 1) return null;
  // Walk back to find either the start or a whitespace boundary that
  // immediately precedes a `/`.
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === '\n') return null;
    if (ch === '/') {
      const prev = i === 0 ? ' ' : text[i - 1];
      // Slash must start the line or follow whitespace — otherwise
      // it's a path/URL/etc. and we should ignore it.
      if (prev !== ' ' && prev !== '\t' && prev !== '\n' && i !== 0) return null;
      const after = text.slice(i + 1, caret);
      // Split into command + remaining args at the first whitespace.
      const spaceIdx = after.indexOf(' ');
      const query = spaceIdx === -1 ? after : after.slice(0, spaceIdx);
      const argsRaw = spaceIdx === -1 ? '' : after.slice(spaceIdx + 1);
      // Bail if the command token contains a non-identifier char.
      if (!/^[a-zA-Z0-9_-]*$/.test(query)) return null;
      return { start: i, query, argsRaw };
    }
    i -= 1;
  }
  return null;
}

export function matchSlashCommands(
  registry: ReadonlyArray<SlashCommand>,
  query: string
): SlashCommand[] {
  if (!query) return registry.slice(0, 8);
  const lower = query.toLowerCase();
  return registry
    .filter((cmd) => {
      if (cmd.name.startsWith(lower)) return true;
      if (cmd.aliases?.some((a) => a.startsWith(lower))) return true;
      return cmd.description.toLowerCase().includes(lower);
    })
    .slice(0, 8);
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                        */
/* -------------------------------------------------------------------------- */

export interface UseSlashCommandsOptions {
  /** Override the default registry — useful for context-specific commands. */
  commands?: ReadonlyArray<SlashCommand>;
}

export interface UseSlashCommandsResult {
  /** Current trigger state, or `null` when the slash menu should be hidden. */
  trigger: { start: number; query: string; argsRaw: string } | null;
  /** Candidate commands matching the current query. */
  candidates: SlashCommand[];
  /**
   * Bind to a textarea/input's `onChange` (or pass the value directly).
   * `caret` is the current selection start.
   */
  update: (text: string, caret: number) => void;
  /** Manually clear (e.g. when the menu is dismissed). */
  reset: () => void;
  /**
   * Fire the given command with the parsed tail. Caller is responsible
   * for splicing the slash text out of the source value.
   */
  invoke: (command: SlashCommand) => void;
}

/**
 * useSlashCommands — Notion-style command palette inside text fields.
 *
 * The hook is editor-agnostic: it works with plain textareas, content-
 * editable surfaces, or a tiptap editor wrapped to expose `value` /
 * `selection` props. Call `update(value, caretOffset)` on every change
 * and render the returned `candidates` inside a floating popover.
 *
 * Once a candidate is accepted, call `invoke(command)` — the hook
 * dispatches the command's `run` callback with a parsed payload and
 * resets the trigger state.
 */
export function useSlashCommands(options: UseSlashCommandsOptions = {}): UseSlashCommandsResult {
  const registry = options.commands ?? DEFAULT_SLASH_COMMANDS;
  const [trigger, setTrigger] = React.useState<UseSlashCommandsResult['trigger']>(null);

  const update = React.useCallback((text: string, caret: number) => {
    const next = detectSlashTrigger(text, caret);
    setTrigger(next);
  }, []);

  const reset = React.useCallback(() => setTrigger(null), []);

  const candidates = React.useMemo(
    () => (trigger ? matchSlashCommands(registry, trigger.query) : []),
    [registry, trigger]
  );

  const invoke = React.useCallback(
    (command: SlashCommand) => {
      const raw = trigger?.argsRaw ?? '';
      const tokens = raw.length === 0 ? [] : raw.trim().split(/\s+/);
      void command.run({ command, raw, tokens });
      setTrigger(null);
    },
    [trigger]
  );

  return { trigger, candidates, update, reset, invoke };
}
