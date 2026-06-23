import { renderHook, act } from '@testing-library/react';
import {
  DEFAULT_SLASH_COMMANDS,
  createDefaultSlashCommands,
  detectSlashTrigger,
  matchSlashCommands,
  useSlashCommands,
  type SlashCommand,
} from '../slash-commands';

describe('detectSlashTrigger', () => {
  it('detects a slash at the start of the buffer', () => {
    expect(detectSlashTrigger('/assign', 7)).toEqual({
      start: 0,
      query: 'assign',
      argsRaw: '',
    });
  });

  it('detects a slash after whitespace', () => {
    expect(detectSlashTrigger('hello /la', 9)).toEqual({
      start: 6,
      query: 'la',
      argsRaw: '',
    });
  });

  it('captures the args portion after the first space', () => {
    expect(detectSlashTrigger('/assign @alice', 14)).toEqual({
      start: 0,
      query: 'assign',
      argsRaw: '@alice',
    });
  });

  it('rejects mid-word slashes (path-like)', () => {
    expect(detectSlashTrigger('https://foo', 11)).toBeNull();
  });

  it('rejects across newlines', () => {
    expect(detectSlashTrigger('hello\n/cmd', 10)).toEqual({
      start: 6,
      query: 'cmd',
      argsRaw: '',
    });
    expect(detectSlashTrigger('/cmd\nhello', 10)).toBeNull();
  });
});

describe('matchSlashCommands', () => {
  it('returns the full registry when query is empty', () => {
    expect(matchSlashCommands(DEFAULT_SLASH_COMMANDS, '').length).toBeGreaterThan(0);
  });

  it('builds the default registry from localized labels', () => {
    const commands = createDefaultSlashCommands((key) => `translated:${key}`);
    const assign = commands.find((command) => command.name === 'assign');

    expect(assign?.description).toBe('translated:slashCommands.assign.description');
    expect(assign?.arguments?.[0]?.label).toBe('translated:slashCommands.arguments.user');
  });

  it('matches by prefix on name', () => {
    const results = matchSlashCommands(DEFAULT_SLASH_COMMANDS, 'ass');
    expect(results.some((c) => c.name === 'assign')).toBe(true);
  });

  it('matches by alias', () => {
    const results = matchSlashCommands(DEFAULT_SLASH_COMMANDS, 'tag');
    expect(results.some((c) => c.name === 'label')).toBe(true);
  });
});

describe('useSlashCommands', () => {
  it('emits a trigger and invokes the chosen command with parsed tokens', () => {
    const run = jest.fn();
    const command: SlashCommand = {
      name: 'assign',
      description: 'Assign someone',
      arguments: [{ label: '@user', kind: 'user', required: true }],
      run,
    };

    const { result } = renderHook(() => useSlashCommands({ commands: [command] }));

    act(() => {
      result.current.update('/assign @bob', 12);
    });

    expect(result.current.trigger?.query).toBe('assign');
    expect(result.current.candidates).toHaveLength(1);

    act(() => {
      result.current.invoke(result.current.candidates[0]);
    });

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        raw: '@bob',
        tokens: ['@bob'],
        command,
      })
    );
    // After invoke the trigger should be cleared.
    expect(result.current.trigger).toBeNull();
  });
});
