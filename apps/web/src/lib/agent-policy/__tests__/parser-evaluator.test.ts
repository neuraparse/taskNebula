import { createAgentPolicyDocument, parseAgentPolicy } from '../parser';
import { evaluateAgentPolicyDocument } from '../evaluator';

function doc(content: string) {
  return createAgentPolicyDocument({
    found: true,
    sourcePath: '/repo/AGENTOWNERS',
    content,
  });
}

describe('AGENTOWNERS parser', () => {
  it('parses allow, deny, and require-approval rules', () => {
    const parsed = parseAgentPolicy(`
# comment
agent:tasknebula-ai issues:create allow
agent:tasknebula-ai issues:close require-approval @maintainers
agent:* boards:create-card deny
`);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rules).toHaveLength(3);
    expect(parsed.rules[1]).toEqual(
      expect.objectContaining({
        actor: 'tasknebula-ai',
        resource: 'issues',
        action: 'close',
        effect: 'require_approval',
        approvers: ['@maintainers'],
      })
    );
  });

  it('reports invalid syntax with line numbers', () => {
    const parsed = parseAgentPolicy('agent:tasknebula-ai issues:create maybe');
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0]).toEqual(
      expect.objectContaining({
        line: 1,
        message: expect.stringContaining('Effect'),
      })
    );
  });
});

describe('AGENTOWNERS evaluator', () => {
  it('allows exact actor rules before broader wildcard rules', () => {
    const result = evaluateAgentPolicyDocument(
      {
        workspaceId: 'org-1',
        actorType: 'agent',
        actor: 'tasknebula-ai',
        resource: 'boards',
        action: 'create-card',
      },
      doc(`
agent:tasknebula-ai boards:create-card allow
agent:* boards:create-card deny
`)
    );

    expect(result.decision).toBe('allow');
    expect(result.matchedRule?.raw).toBe('agent:tasknebula-ai boards:create-card allow');
  });

  it('uses deny over allow when specificity is equal', () => {
    const result = evaluateAgentPolicyDocument(
      {
        workspaceId: 'org-1',
        actorType: 'agent',
        actor: 'tasknebula-ai',
        resource: 'issues',
        action: 'close',
      },
      doc(`
agent:tasknebula-ai issues:close allow
agent:tasknebula-ai issues:close deny
`)
    );

    expect(result.decision).toBe('deny');
  });

  it('requires approval for unknown agents by default', () => {
    const result = evaluateAgentPolicyDocument(
      {
        workspaceId: 'org-1',
        actorType: 'agent',
        actor: 'unlisted-bot',
        resource: 'issues',
        action: 'assign',
      },
      createAgentPolicyDocument({ found: false, sourcePath: null, content: null })
    );

    expect(result.decision).toBe('require_approval');
  });

  it('requires approval for destructive AI actions without a matching rule', () => {
    const result = evaluateAgentPolicyDocument(
      {
        workspaceId: 'org-1',
        actorType: 'agent',
        actor: 'tasknebula-ai',
        resource: 'issues',
        action: 'close',
      },
      createAgentPolicyDocument({ found: false, sourcePath: null, content: null })
    );

    expect(result.decision).toBe('require_approval');
  });

  it('does not block human actions', () => {
    const result = evaluateAgentPolicyDocument(
      {
        workspaceId: 'org-1',
        actorType: 'human',
        actor: 'user-1',
        resource: 'issues',
        action: 'close',
      },
      doc('agent:* issues:close deny')
    );

    expect(result.decision).toBe('allow');
  });
});
