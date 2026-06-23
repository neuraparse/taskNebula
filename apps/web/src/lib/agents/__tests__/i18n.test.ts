import { formatAgentRunDisplayText } from '@/lib/agents/i18n';

describe('agent i18n helpers', () => {
  const t = jest.fn((key: string, values?: Record<string, string | number>) => {
    if (key === 'agentShared.runMessages.kinds.project_tracking') {
      return 'Translated project scan';
    }

    return `${key}:${JSON.stringify(values ?? {})}`;
  });

  beforeEach(() => {
    t.mockClear();
  });

  it('localizes deterministic native run messages and keeps dynamic values', () => {
    expect(
      formatAgentRunDisplayText(t, 'Project health scan started for Web App in preview mode.')
    ).toBe(
      'agentShared.runMessages.startedPreview:{"kind":"Translated project scan","project":"Web App"}'
    );

    expect(formatAgentRunDisplayText(t, 'Using openai provider with model gpt-5.4.')).toBe(
      'agentShared.runMessages.usingProvider:{"provider":"OpenAI","model":"gpt-5.4"}'
    );

    expect(formatAgentRunDisplayText(t, 'Created 2 planned sprints for Web App.')).toBe(
      'agentShared.runMessages.createdSprintSummary:{"count":2,"project":"Web App"}'
    );
  });

  it('falls back to provider or user-generated text when no native template matches', () => {
    expect(formatAgentRunDisplayText(t, 'LLM provider generated a custom summary.')).toBe(
      'LLM provider generated a custom summary.'
    );
  });
});
