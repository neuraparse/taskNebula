import type {
  AgentPolicyDocument,
  AgentPolicyEffect,
  AgentPolicyParseError,
  AgentPolicyRule,
} from './types';

const EFFECTS = new Set(['allow', 'deny', 'require-approval', 'require_approval']);

function normalizeEffect(value: string): AgentPolicyEffect | null {
  if (value === 'allow' || value === 'deny') return value;
  if (value === 'require-approval' || value === 'require_approval') return 'require_approval';
  return null;
}

function parseActorToken(token: string): Pick<AgentPolicyRule, 'actor' | 'actorKind'> | null {
  const [kind, actor, ...rest] = token.split(':');
  if (rest.length > 0 || !actor) return null;
  if (kind !== 'agent' && kind !== 'unknown') return null;
  return { actor, actorKind: kind };
}

function parseResourceActionToken(
  token: string
): Pick<AgentPolicyRule, 'resource' | 'action'> | null {
  if (token === '*') return { resource: '*', action: '*' };

  const [resource, action, ...rest] = token.split(':');
  if (rest.length > 0 || !resource || !action) return null;
  return { resource, action };
}

export function parseAgentPolicy(
  content: string,
  sourcePath?: string
): Pick<AgentPolicyDocument, 'rules' | 'errors'> {
  const rules: AgentPolicyRule[] = [];
  const errors: AgentPolicyParseError[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const raw = line;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const tokens = trimmed.split(/\s+/);
    if (tokens.length < 3) {
      errors.push({
        line: lineNumber,
        message: 'Expected: agent:<actor> <resource>:<action> <effect> [approvers...]',
        raw,
      });
      return;
    }

    const [actorToken, resourceActionToken, effectToken, ...approvers] = tokens;
    const actor = parseActorToken(actorToken!);
    if (!actor) {
      errors.push({
        line: lineNumber,
        message: 'Actor must use agent:<name>, agent:*, or unknown:*',
        raw,
      });
      return;
    }

    const resourceAction = parseResourceActionToken(resourceActionToken!);
    if (!resourceAction) {
      errors.push({
        line: lineNumber,
        message: 'Resource/action must use <resource>:<action> or *',
        raw,
      });
      return;
    }

    if (!EFFECTS.has(effectToken!)) {
      errors.push({
        line: lineNumber,
        message: 'Effect must be allow, deny, or require-approval',
        raw,
      });
      return;
    }

    const effect = normalizeEffect(effectToken!);
    if (!effect) {
      errors.push({
        line: lineNumber,
        message: 'Effect must be allow, deny, or require-approval',
        raw,
      });
      return;
    }

    if (effect !== 'require_approval' && approvers.length > 0) {
      errors.push({
        line: lineNumber,
        message: 'Approvers are only valid with require-approval',
        raw,
      });
      return;
    }

    rules.push({
      ...actor,
      ...resourceAction,
      effect,
      approvers: approvers.length > 0 ? approvers : undefined,
      raw: trimmed,
      line: lineNumber,
      sourcePath,
    });
  });

  return { rules, errors };
}

export function createAgentPolicyDocument(params: {
  found: boolean;
  sourcePath: string | null;
  content: string | null;
}): AgentPolicyDocument {
  const parsed = params.content
    ? parseAgentPolicy(params.content, params.sourcePath ?? undefined)
    : { rules: [], errors: [] };

  return {
    found: params.found,
    sourcePath: params.sourcePath,
    content: params.content,
    rules: parsed.rules,
    errors: parsed.errors,
    parsedAt: new Date().toISOString(),
  };
}
