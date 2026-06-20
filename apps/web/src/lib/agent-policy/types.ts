export type AgentPolicyEffect = 'allow' | 'deny' | 'require_approval';

export type AgentPolicyDecision = AgentPolicyEffect;

export type AgentPolicyActorKind = 'agent' | 'unknown';

export type AgentPolicyResource =
  | 'issues'
  | 'boards'
  | 'comments'
  | 'sprints'
  | 'workflows'
  | 'automation'
  | '*';

export type AgentPolicyRule = {
  actor: string;
  actorKind: AgentPolicyActorKind;
  resource: string;
  action: string;
  effect: AgentPolicyEffect;
  approvers?: string[];
  raw: string;
  line: number;
  sourcePath?: string;
};

export type AgentPolicyParseError = {
  line: number;
  message: string;
  raw: string;
};

export type AgentPolicyDocument = {
  found: boolean;
  sourcePath: string | null;
  content: string | null;
  rules: AgentPolicyRule[];
  errors: AgentPolicyParseError[];
  parsedAt: string;
};

export type AgentPolicyEvaluationInput = {
  workspaceId: string;
  projectId?: string | null;
  actor?: string | null;
  actorType?: 'agent' | 'human';
  resource: string;
  action: string;
  targetId?: string | null;
  context?: Record<string, unknown>;
  policy?: AgentPolicyDocument;
  knownActors?: readonly string[];
};

export type AgentPolicyEvaluationResult = {
  decision: AgentPolicyDecision;
  matchedRule?: AgentPolicyRule;
  reason: string;
  policyFound: boolean;
  policySourcePath: string | null;
  validationErrors: AgentPolicyParseError[];
};

export type AgentPolicyMarker = {
  actor: string;
  source?: string;
  resource?: string;
  action?: string;
  targetType?: string;
};

export type AgentApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type AgentApprovalExecutor = 'issues:create' | 'issues:update' | 'comments:create';
