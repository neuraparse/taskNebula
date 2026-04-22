// Automation rule evaluator engine.
//
// This module is the CORE ENGINE for running automation rules. It is invoked
// by mutation endpoints (wired separately) when something happens that might
// trigger a rule — an issue is created, a sprint starts, etc. The engine:
//
//   1. Loads enabled rules for the org/project matching the trigger type.
//   2. Evaluates each rule's conditions against the provided payload.
//   3. Runs the rule's actions in order, using a dispatch map.
//   4. Writes one automation_executions row per rule (matched/skipped/
//      success/failed) capturing the trigger payload and per-action results.
//   5. Returns a summary array to the caller.
//
// Important invariants:
//   - The engine never throws. Callers use `void runAutomations(...)` as
//     fire-and-forget — one bad rule must never break a mutation.
//   - Errors are swallowed per-rule and per-action and logged.
//   - Actions trust the caller for authorization — no auth checks here.

import {
  db,
  automationRules,
  issues,
  issueComments,
  notifications,
  and,
  eq,
  or,
  isNull,
  sql,
} from '@tasknebula/db';
// automationExecutions is declared in the schema package but not yet
// re-exported from the barrel index (schema/index.ts). Importing the table
// directly via the subpath follows the existing pattern used for
// password-reset-tokens / email-verification-tokens / project-modules.
import { automationExecutions } from '@tasknebula/db/src/schema/automation-executions';
import { evaluateConditions, type AutomationCondition } from './conditions';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type AutomationTrigger =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.status_changed'
  | 'issue.assigned'
  | 'sprint.started'
  | 'sprint.completed'
  | 'project.created';

export interface AutomationAction {
  type: string;
  // Additional action-specific params live on the same object. The dispatch
  // map reads the fields it cares about per action type.
  [key: string]: unknown;
}

export interface ActionResult {
  actionType: string;
  ok: boolean;
  error?: string;
}

export type ExecutionStatus = 'matched' | 'skipped' | 'success' | 'failed';

export interface ExecutionResult {
  ruleId: string;
  ruleName: string;
  status: ExecutionStatus;
  actionResults: ActionResult[];
  durationMs: number;
  error?: string;
}

export interface RunAutomationsParams {
  trigger: AutomationTrigger;
  organizationId: string;
  projectId?: string | null;
  payload: Record<string, unknown>;
  actorUserId?: string | null;
}

// Shape of the raw rule row as loaded from the DB. The jsonb columns are
// typed loosely because they are user-authored content.
interface StoredAutomationRule {
  id: string;
  organizationId: string;
  projectId: string | null;
  name: string;
  enabled: boolean;
  trigger: unknown;
  conditions: unknown;
  actions: unknown;
}

// --------------------------------------------------------------------------
// Action dispatch
// --------------------------------------------------------------------------

interface ActionContext {
  trigger: AutomationTrigger;
  organizationId: string;
  projectId?: string | null;
  payload: Record<string, unknown>;
  actorUserId?: string | null;
}

type ActionHandler = (ctx: ActionContext, action: AutomationAction) => Promise<void>;

function getString(obj: unknown, key: string): string | undefined {
  if (obj == null || typeof obj !== 'object') return undefined;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getIssueIdFromPayload(payload: Record<string, unknown>): string | undefined {
  // Common conventions we accept: `issueId`, or nested `issue.id`.
  const direct = getString(payload, 'issueId');
  if (direct) return direct;
  const issue = payload.issue;
  if (issue && typeof issue === 'object') {
    return getString(issue, 'id');
  }
  return undefined;
}

// set_status — sets issue.statusId to the configured value.
const setStatusAction: ActionHandler = async (ctx, action) => {
  const issueId = getIssueIdFromPayload(ctx.payload);
  if (!issueId) throw new Error('set_status: no issue id in payload');

  const statusId = getString(action, 'statusId') || getString(action, 'value');
  if (!statusId) throw new Error('set_status: missing statusId');

  await db
    .update(issues)
    .set({
      statusId,
      updatedAt: new Date(),
      ...(ctx.actorUserId ? { updatedBy: ctx.actorUserId } : {}),
    })
    .where(eq(issues.id, issueId));
};

// assign — sets issue.assigneeId.
const assignAction: ActionHandler = async (ctx, action) => {
  const issueId = getIssueIdFromPayload(ctx.payload);
  if (!issueId) throw new Error('assign: no issue id in payload');

  const assigneeId =
    getString(action, 'assigneeId') ||
    getString(action, 'userId') ||
    getString(action, 'value');
  if (!assigneeId) throw new Error('assign: missing assigneeId');

  await db
    .update(issues)
    .set({
      assigneeId,
      updatedAt: new Date(),
      ...(ctx.actorUserId ? { updatedBy: ctx.actorUserId } : {}),
    })
    .where(eq(issues.id, issueId));
};

// add_label — appends the configured label to issue.labels if not present.
const addLabelAction: ActionHandler = async (ctx, action) => {
  const issueId = getIssueIdFromPayload(ctx.payload);
  if (!issueId) throw new Error('add_label: no issue id in payload');

  const label = getString(action, 'label') || getString(action, 'value');
  if (!label) throw new Error('add_label: missing label');

  // Use a jsonb concat that de-dupes to avoid inserting duplicate labels.
  // Fallback is a read-modify-write if the driver rejects the raw expression.
  try {
    await db
      .update(issues)
      .set({
        labels: sql`CASE WHEN (${issues.labels})::jsonb @> ${JSON.stringify([label])}::jsonb
          THEN ${issues.labels}
          ELSE (${issues.labels})::jsonb || ${JSON.stringify([label])}::jsonb
        END`,
        updatedAt: new Date(),
        ...(ctx.actorUserId ? { updatedBy: ctx.actorUserId } : {}),
      })
      .where(eq(issues.id, issueId));
  } catch {
    const [row] = await db
      .select({ labels: issues.labels })
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);
    const existing = Array.isArray(row?.labels) ? (row!.labels as unknown[]) : [];
    if (!existing.includes(label)) {
      await db
        .update(issues)
        .set({
          labels: [...existing, label],
          updatedAt: new Date(),
          ...(ctx.actorUserId ? { updatedBy: ctx.actorUserId } : {}),
        })
        .where(eq(issues.id, issueId));
    }
  }
};

// add_comment — inserts a comment. Uses actorUserId if provided; otherwise
// falls back to the issue reporter so the NOT NULL created_by constraint
// is still satisfied.
const addCommentAction: ActionHandler = async (ctx, action) => {
  const issueId = getIssueIdFromPayload(ctx.payload);
  if (!issueId) throw new Error('add_comment: no issue id in payload');

  const content = getString(action, 'content') || getString(action, 'value');
  if (!content) throw new Error('add_comment: missing content');

  let authorId = ctx.actorUserId ?? undefined;
  if (!authorId) {
    const [row] = await db
      .select({ reporterId: issues.reporterId })
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);
    authorId = row?.reporterId;
  }
  if (!authorId) throw new Error('add_comment: no author available');

  await db.insert(issueComments).values({
    issueId,
    content,
    createdBy: authorId,
    updatedBy: authorId,
  });
};

// set_priority — sets issue.priority.
const setPriorityAction: ActionHandler = async (ctx, action) => {
  const issueId = getIssueIdFromPayload(ctx.payload);
  if (!issueId) throw new Error('set_priority: no issue id in payload');

  const priority = getString(action, 'priority') || getString(action, 'value');
  if (!priority) throw new Error('set_priority: missing priority');

  const allowed = new Set(['critical', 'high', 'medium', 'low', 'none']);
  if (!allowed.has(priority)) {
    throw new Error(`set_priority: invalid priority "${priority}"`);
  }

  await db
    .update(issues)
    .set({
      priority: priority as 'critical' | 'high' | 'medium' | 'low' | 'none',
      updatedAt: new Date(),
      ...(ctx.actorUserId ? { updatedBy: ctx.actorUserId } : {}),
    })
    .where(eq(issues.id, issueId));
};

// notify_user — inserts an in-app notification.
const notifyUserAction: ActionHandler = async (ctx, action) => {
  const userId =
    getString(action, 'userId') ||
    getString(action, 'recipientId') ||
    getString(action, 'value');
  if (!userId) throw new Error('notify_user: missing userId');

  const title = getString(action, 'title') || 'Automation';
  const message =
    getString(action, 'message') || `Automation triggered: ${ctx.trigger}`;

  const issueId = getIssueIdFromPayload(ctx.payload) ?? null;
  const projectId = ctx.projectId ?? null;

  // The notifications.type column is a pgEnum. Pick the closest existing
  // value for the trigger so we don't fail on enum validation.
  const type = mapTriggerToNotificationType(ctx.trigger);

  await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    issueId,
    projectId,
    actorId: ctx.actorUserId ?? null,
  });
};

function mapTriggerToNotificationType(trigger: AutomationTrigger):
  | 'mention'
  | 'comment'
  | 'assigned'
  | 'status_changed'
  | 'issue_created'
  | 'issue_updated'
  | 'issue_linked'
  | 'sprint_started'
  | 'sprint_completed' {
  switch (trigger) {
    case 'issue.created':
      return 'issue_created';
    case 'issue.updated':
      return 'issue_updated';
    case 'issue.status_changed':
      return 'status_changed';
    case 'issue.assigned':
      return 'assigned';
    case 'sprint.started':
      return 'sprint_started';
    case 'sprint.completed':
      return 'sprint_completed';
    case 'project.created':
      return 'issue_updated';
    default:
      return 'issue_updated';
  }
}

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  set_status: setStatusAction,
  assign: assignAction,
  add_label: addLabelAction,
  add_comment: addCommentAction,
  set_priority: setPriorityAction,
  notify_user: notifyUserAction,
};

// --------------------------------------------------------------------------
// Core engine
// --------------------------------------------------------------------------

function triggerMatches(rule: StoredAutomationRule, trigger: AutomationTrigger): boolean {
  const t = rule.trigger;
  if (t == null || typeof t !== 'object') return false;
  const ruleType = (t as Record<string, unknown>).type;
  if (typeof ruleType !== 'string') return false;
  return ruleType === trigger;
}

async function recordExecution(
  ruleId: string,
  status: ExecutionStatus,
  triggerPayload: unknown,
  actionResults: ActionResult[] | null,
  durationMs: number,
  error: string | undefined
): Promise<void> {
  try {
    await db.insert(automationExecutions).values({
      ruleId,
      status,
      triggerPayload: triggerPayload as any,
      actionResults: actionResults as any,
      durationMs,
      error: error ?? null,
    });
  } catch (err) {
    console.error('[automation] failed to record execution', {
      ruleId,
      status,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function runRule(
  rule: StoredAutomationRule,
  params: RunAutomationsParams
): Promise<ExecutionResult> {
  const startedAt = Date.now();
  const ctx: ActionContext = {
    trigger: params.trigger,
    organizationId: params.organizationId,
    projectId: params.projectId ?? null,
    payload: params.payload,
    actorUserId: params.actorUserId ?? null,
  };

  // Condition evaluation (fast path: zero conditions always match).
  const conditions = Array.isArray(rule.conditions)
    ? (rule.conditions as AutomationCondition[])
    : [];

  let matched = false;
  try {
    matched = evaluateConditions(conditions, params.payload);
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errorMsg = err instanceof Error ? err.message : String(err);
    await recordExecution(rule.id, 'failed', params.payload, null, durationMs, errorMsg);
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      status: 'failed',
      actionResults: [],
      durationMs,
      error: errorMsg,
    };
  }

  if (!matched) {
    const durationMs = Date.now() - startedAt;
    await recordExecution(rule.id, 'skipped', params.payload, [], durationMs, undefined);
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      status: 'skipped',
      actionResults: [],
      durationMs,
    };
  }

  // Execute actions in order. One failing action does NOT abort the others
  // — each is recorded in actionResults so admins can see the whole picture.
  const actions = Array.isArray(rule.actions) ? (rule.actions as AutomationAction[]) : [];
  const actionResults: ActionResult[] = [];
  let anyFailure = false;

  for (const action of actions) {
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      actionResults.push({
        actionType: 'unknown',
        ok: false,
        error: 'Malformed action entry',
      });
      anyFailure = true;
      continue;
    }

    const handler = ACTION_HANDLERS[action.type];
    if (!handler) {
      actionResults.push({
        actionType: action.type,
        ok: false,
        error: `Unknown action type: ${action.type}`,
      });
      anyFailure = true;
      continue;
    }

    try {
      await handler(ctx, action);
      actionResults.push({ actionType: action.type, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      actionResults.push({ actionType: action.type, ok: false, error: msg });
      anyFailure = true;
      console.error('[automation] action failed', {
        ruleId: rule.id,
        actionType: action.type,
        error: msg,
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  const status: ExecutionStatus = anyFailure ? 'failed' : 'success';
  await recordExecution(rule.id, status, params.payload, actionResults, durationMs, undefined);

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    status,
    actionResults,
    durationMs,
  };
}

/**
 * Load enabled automation rules for the given org, optionally scoped to a
 * project. Rules with projectId IS NULL are org-wide and always considered;
 * rules with a specific projectId only match when that project is supplied.
 */
async function loadEnabledRules(
  organizationId: string,
  projectId?: string | null
): Promise<StoredAutomationRule[]> {
  const rows = await db
    .select({
      id: automationRules.id,
      organizationId: automationRules.organizationId,
      projectId: automationRules.projectId,
      name: automationRules.name,
      enabled: automationRules.enabled,
      trigger: automationRules.trigger,
      conditions: automationRules.conditions,
      actions: automationRules.actions,
    })
    .from(automationRules)
    .where(
      and(
        eq(automationRules.organizationId, organizationId),
        eq(automationRules.enabled, true),
        projectId
          ? or(eq(automationRules.projectId, projectId), isNull(automationRules.projectId))
          : isNull(automationRules.projectId)
      )
    );

  return rows as StoredAutomationRule[];
}

/**
 * Fire automation rules for a trigger. Non-blocking-safe: callers should
 * invoke as `void runAutomations(...)`. All errors are swallowed and logged;
 * the returned promise always resolves.
 */
export async function runAutomations(
  params: RunAutomationsParams
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  try {
    const rules = await loadEnabledRules(params.organizationId, params.projectId ?? null);
    const applicable = rules.filter((rule) => triggerMatches(rule, params.trigger));

    if (applicable.length === 0) return results;

    // Run rules sequentially. Keeping it sequential makes action ordering
    // predictable when multiple rules target the same entity, and prevents
    // swamping the DB with parallel updates on hot triggers.
    for (const rule of applicable) {
      try {
        const result = await runRule(rule, params);
        results.push(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[automation] rule execution crashed', {
          ruleId: rule.id,
          error: msg,
        });
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          status: 'failed',
          actionResults: [],
          durationMs: 0,
          error: msg,
        });
      }
    }
  } catch (err) {
    console.error('[automation] runAutomations crashed', {
      trigger: params.trigger,
      organizationId: params.organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return results;
}
