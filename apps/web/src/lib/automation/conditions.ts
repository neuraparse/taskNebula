// Condition evaluation for automation rules.
//
// Conditions are stored on an automation rule as an array of
// { field, operator, value } objects. The evaluator supports simple
// field-operator-value checks against the trigger payload. Conditions are
// implicitly AND-ed together. If the conditions array is empty, the rule is
// considered matching (fast path handled by the caller).

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'gt'
  | 'lt'
  | 'contains';

export interface AutomationCondition {
  field: string;
  operator: ConditionOperator | string;
  value: unknown;
}

export type AutomationPayload = Record<string, unknown>;

/**
 * Read a (possibly dotted) path from an arbitrary object.
 * Returns undefined on any missing step or non-object traversal.
 * Keeps things simple on purpose — only supports property access,
 * not bracketed indices or wildcards.
 */
function getPath(source: unknown, path: string): unknown {
  if (source == null || typeof path !== 'string' || path.length === 0) {
    return undefined;
  }

  const segments = path.split('.');
  let current: unknown = source;

  for (const segment of segments) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function evaluateOne(condition: AutomationCondition, payload: AutomationPayload): boolean {
  const { field, operator, value } = condition;
  const actual = getPath(payload, field);

  switch (operator) {
    case 'eq':
      return actual === value;

    case 'neq':
      return actual !== value;

    case 'in': {
      if (!Array.isArray(value)) return false;
      // If the payload field is itself an array, match if any element is in the set.
      if (Array.isArray(actual)) {
        return actual.some((item) => (value as unknown[]).includes(item));
      }
      return (value as unknown[]).includes(actual);
    }

    case 'gt': {
      const a = toNumber(actual);
      const b = toNumber(value);
      if (a === null || b === null) return false;
      return a > b;
    }

    case 'lt': {
      const a = toNumber(actual);
      const b = toNumber(value);
      if (a === null || b === null) return false;
      return a < b;
    }

    case 'contains': {
      // String contains check. Also supports array.includes semantics when the
      // target field is an array (handy for `labels`).
      if (Array.isArray(actual)) {
        return (actual as unknown[]).includes(value);
      }
      if (typeof actual === 'string' && typeof value === 'string') {
        return actual.includes(value);
      }
      return false;
    }

    default:
      // Unknown operator — treat as non-match rather than throwing so one
      // bad condition doesn't nuke the whole rule.
      return false;
  }
}

/**
 * Evaluate a list of conditions against a payload. All conditions must pass
 * (implicit AND). An empty list always passes.
 */
export function evaluateConditions(
  conditions: AutomationCondition[] | null | undefined,
  payload: AutomationPayload
): boolean {
  if (!conditions || conditions.length === 0) return true;

  for (const condition of conditions) {
    if (!condition || typeof condition !== 'object') continue;
    if (!evaluateOne(condition, payload)) return false;
  }

  return true;
}
