import { agentRunKindLabel, auditActionLabel } from './audit-actions';

const translations: Record<string, string> = {
  'admin.agent.runKinds.backlogTriage': 'Backlog triage',
};

const t = (key: string) => translations[key] ?? key;

describe('audit action labels', () => {
  it('uses localized labels for known agent run kinds', () => {
    expect(agentRunKindLabel('backlog_triage', t)).toBe('Backlog triage');
  });

  it('keeps open-ended audit action codes intact instead of inventing English title case', () => {
    expect(auditActionLabel('api_key.revoked')).toBe('api_key.revoked');
    expect(auditActionLabel('custom.future_event')).toBe('custom.future_event');
    expect(agentRunKindLabel('future_agent_kind', t)).toBe('future_agent_kind');
  });
});
