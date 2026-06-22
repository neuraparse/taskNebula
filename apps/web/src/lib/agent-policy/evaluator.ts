import { discoverAgentPolicy } from './source';
import type {
  AgentPolicyDocument,
  AgentPolicyEvaluationInput,
  AgentPolicyEvaluationResult,
  AgentPolicyRule,
} from './types';

export const DEFAULT_KNOWN_AI_ACTORS = [
  'tasknebula-ai',
  'claude-code',
  'codex',
  'gemini',
  'github-copilot',
] as const;

const DESTRUCTIVE_ACTIONS = new Set([
  'issues:close',
  'issues:delete',
  'comments:edit',
  'comments:delete',
  'sprints:delete',
  'workflows:update',
  'automation:janitor',
]);

const EFFECT_WEIGHT = {
  deny: 3,
  require_approval: 2,
  allow: 1,
} as const;

function isUnknownAgent(input: AgentPolicyEvaluationInput) {
  if (input.actorType !== 'agent') return false;
  const actor = input.actor?.trim();
  if (!actor) return true;
  const knownActors = input.knownActors ?? DEFAULT_KNOWN_AI_ACTORS;
  return !knownActors.includes(actor);
}

function isDestructiveAction(resource: string, action: string) {
  return DESTRUCTIVE_ACTIONS.has(`${resource}:${action}`);
}

function actorMatchScore(rule: AgentPolicyRule, input: AgentPolicyEvaluationInput) {
  if (input.actorType !== 'agent') return -1;
  const actor = input.actor?.trim() || '';
  const unknown = isUnknownAgent(input);

  if (rule.actorKind === 'unknown') {
    if (!unknown) return -1;
    return rule.actor === '*' || rule.actor === actor ? 80 : -1;
  }

  if (rule.actor === '*') return 10;
  return rule.actor === actor ? 100 : -1;
}

function resourceActionScore(rule: AgentPolicyRule, resource: string, action: string) {
  const resourceMatches = rule.resource === '*' || rule.resource === resource;
  const actionMatches = rule.action === '*' || rule.action === action;
  if (!resourceMatches || !actionMatches) return -1;

  return (rule.resource === resource ? 20 : 0) + (rule.action === action ? 10 : 0);
}

function equivalentResourceActions(resource: string, action: string) {
  const pairs = [{ resource, action }];
  if (resource === 'comments' && action === 'create') {
    pairs.push({ resource: 'issues', action: 'comment' });
  } else if (resource === 'issues' && action === 'comment') {
    pairs.push({ resource: 'comments', action: 'create' });
  }
  return pairs;
}

function findBestRule(
  rules: AgentPolicyRule[],
  input: AgentPolicyEvaluationInput
): AgentPolicyRule | undefined {
  const resourceActions = equivalentResourceActions(input.resource, input.action);

  return rules
    .map((rule, index) => {
      const actorScore = actorMatchScore(rule, input);
      const resourceScore = Math.max(
        ...resourceActions.map(({ resource, action }) =>
          resourceActionScore(rule, resource, action)
        )
      );
      if (actorScore < 0 || resourceScore < 0) return null;
      return {
        rule,
        index,
        specificity: actorScore + resourceScore,
        effectWeight: EFFECT_WEIGHT[rule.effect],
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => {
      if (right.specificity !== left.specificity) {
        return right.specificity - left.specificity;
      }
      if (right.effectWeight !== left.effectWeight) {
        return right.effectWeight - left.effectWeight;
      }
      return right.index - left.index;
    })[0]?.rule;
}

function buildResult(
  policy: AgentPolicyDocument,
  decision: AgentPolicyEvaluationResult['decision'],
  reason: string,
  matchedRule?: AgentPolicyRule
): AgentPolicyEvaluationResult {
  return {
    decision,
    matchedRule,
    reason,
    policyFound: policy.found,
    policySourcePath: policy.sourcePath,
    validationErrors: policy.errors,
  };
}

export function evaluateAgentPolicyDocument(
  input: AgentPolicyEvaluationInput,
  policy: AgentPolicyDocument
): AgentPolicyEvaluationResult {
  if (input.actorType === 'human') {
    return buildResult(policy, 'allow', 'Human actions are outside AGENTOWNERS scope.');
  }

  if (policy.errors.length > 0) {
    return buildResult(
      policy,
      'require_approval',
      'Policy validation errors require human approval before agent writes.'
    );
  }

  if (policy.found) {
    const matchedRule = findBestRule(policy.rules, input);
    if (matchedRule) {
      return buildResult(
        policy,
        matchedRule.effect,
        `Matched AGENTOWNERS rule on line ${matchedRule.line}.`,
        matchedRule
      );
    }
  }

  if (isUnknownAgent(input)) {
    return buildResult(
      policy,
      'require_approval',
      'Unknown AI actors require approval by default.'
    );
  }

  if (isDestructiveAction(input.resource, input.action)) {
    return buildResult(
      policy,
      'require_approval',
      'Destructive AI actions require approval by default.'
    );
  }

  if (!policy.found) {
    return buildResult(policy, 'allow', 'No AGENTOWNERS policy found; using current behavior.');
  }

  return buildResult(policy, 'deny', 'No matching AGENTOWNERS rule allows this AI action.');
}

export async function evaluateAgentPolicy(
  input: AgentPolicyEvaluationInput
): Promise<AgentPolicyEvaluationResult> {
  const policy = input.policy ?? (await discoverAgentPolicy());
  return evaluateAgentPolicyDocument(input, policy);
}
