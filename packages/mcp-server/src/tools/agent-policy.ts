type AgentPolicyMarker = {
  actor: string;
  source?: string;
  resource?: string;
  action?: string;
  targetType?: string;
};

type AgentPolicyOptions = Omit<AgentPolicyMarker, 'actor' | 'source'>;

const DISABLED_VALUES = new Set(['0', 'false', 'off', 'disabled']);
const DEFAULT_AGENT_ACTOR = 'mcp-agent';
const DEFAULT_AGENT_SOURCE = 'mcp-server';

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find((value): value is string => Boolean(value));
}

function isPolicyDisabled(env: NodeJS.ProcessEnv): boolean {
  const raw = firstNonEmpty(env.TASKNEBULA_AGENT_POLICY, env.AGENTOWNERS_POLICY);
  return raw ? DISABLED_VALUES.has(raw.toLowerCase()) : false;
}

export function resolveAgentPolicyMarker(
  options: AgentPolicyOptions = {},
  env: NodeJS.ProcessEnv = process.env
): AgentPolicyMarker | null {
  if (isPolicyDisabled(env)) return null;

  const actor =
    firstNonEmpty(env.TASKNEBULA_AGENT_ACTOR, env.AGENTOWNERS_ACTOR) ?? DEFAULT_AGENT_ACTOR;
  const source =
    firstNonEmpty(env.TASKNEBULA_AGENT_SOURCE, env.AGENTOWNERS_SOURCE) ?? DEFAULT_AGENT_SOURCE;

  return {
    actor,
    source,
    ...options,
  };
}

export function withAgentPolicy<T extends Record<string, unknown>>(
  body: T,
  options: AgentPolicyOptions = {},
  env: NodeJS.ProcessEnv = process.env
): T & { agentPolicy?: AgentPolicyMarker } {
  const marker = resolveAgentPolicyMarker(options, env);
  if (!marker) return body;
  return {
    ...body,
    agentPolicy: marker,
  };
}
