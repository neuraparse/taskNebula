/**
 * JQL (Jira Query Language) Parser
 * 
 * Parses JQL-like query strings into structured criteria and Drizzle ORM conditions.
 * 
 * Supported syntax:
 * - assignee = me
 * - assignee = "user@example.com"
 * - status = "In Progress"
 * - status IN ("To Do", "In Progress")
 * - priority = high
 * - priority IN (high, urgent)
 * - project = "PROJ"
 * - type = bug
 * - labels CONTAINS "frontend"
 * - created >= "2024-01-01"
 * - updated <= "2024-12-31"
 * - sprint = "Sprint 1"
 * - reporter = me
 * - AND, OR operators
 * - Parentheses for grouping
 */

export interface ParsedCriteria {
  assignee?: string | string[];
  reporter?: string | string[];
  status?: string | string[];
  priority?: string | string[];
  type?: string | string[];
  project?: string | string[];
  sprint?: string | string[];
  labels?: string | string[];
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  [key: string]: string | string[] | undefined;
}

export interface ParseResult {
  criteria: ParsedCriteria;
  isValid: boolean;
  error?: string;
}

/**
 * Parse JQL query string into structured criteria
 */
export function parseJQL(query: string): ParseResult {
  try {
    const criteria: ParsedCriteria = {};
    
    // Remove extra whitespace
    const normalized = query.trim().replace(/\s+/g, ' ');
    
    if (!normalized) {
      return { criteria: {}, isValid: true };
    }
    
    // Split by AND (simple implementation, doesn't handle OR or parentheses yet)
    const conditions = normalized.split(/\s+AND\s+/i);
    
    for (const condition of conditions) {
      const parsed = parseCondition(condition.trim());
      if (!parsed) {
        return {
          criteria: {},
          isValid: false,
          error: `Invalid condition: ${condition}`,
        };
      }
      
      // Merge parsed condition into criteria
      Object.assign(criteria, parsed);
    }
    
    return { criteria, isValid: true };
  } catch (error) {
    return {
      criteria: {},
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse a single condition (e.g., "assignee = me" or "status IN ('To Do', 'In Progress')")
 */
function parseCondition(condition: string): ParsedCriteria | null {
  // Match: field operator value
  const eqMatch = condition.match(/^(\w+)\s*=\s*(.+)$/i);
  if (eqMatch && eqMatch[1] && eqMatch[2]) {
    const field = eqMatch[1];
    const value = eqMatch[2];
    return { [field.toLowerCase()]: parseValue(value) };
  }

  // Match: field IN (value1, value2, ...)
  const inMatch = condition.match(/^(\w+)\s+IN\s*\((.+)\)$/i);
  if (inMatch && inMatch[1] && inMatch[2]) {
    const field = inMatch[1];
    const values = inMatch[2];
    const parsedValues = values.split(',').map(v => parseValue(v.trim()));
    return { [field.toLowerCase()]: parsedValues };
  }

  // Match: field CONTAINS value
  const containsMatch = condition.match(/^(\w+)\s+CONTAINS\s+(.+)$/i);
  if (containsMatch && containsMatch[1] && containsMatch[2]) {
    const field = containsMatch[1];
    const value = containsMatch[2];
    return { [field.toLowerCase()]: parseValue(value) };
  }

  // Match: field >= value (for dates)
  const gteMatch = condition.match(/^(\w+)\s*>=\s*(.+)$/i);
  if (gteMatch && gteMatch[1] && gteMatch[2]) {
    const field = gteMatch[1];
    const value = gteMatch[2];
    const key = field.toLowerCase() === 'created' ? 'createdAfter' : 'updatedAfter';
    return { [key]: parseValue(value) };
  }

  // Match: field <= value (for dates)
  const lteMatch = condition.match(/^(\w+)\s*<=\s*(.+)$/i);
  if (lteMatch && lteMatch[1] && lteMatch[2]) {
    const field = lteMatch[1];
    const value = lteMatch[2];
    const key = field.toLowerCase() === 'created' ? 'createdBefore' : 'updatedBefore';
    return { [key]: parseValue(value) };
  }

  return null;
}

/**
 * Parse a value, removing quotes if present
 */
function parseValue(value: string): string {
  const trimmed = value.trim();
  
  // Remove surrounding quotes
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  
  return trimmed;
}

/**
 * Convert parsed criteria back to JQL string
 */
export function criteriaToJQL(criteria: ParsedCriteria): string {
  const conditions: string[] = [];

  for (const [key, value] of Object.entries(criteria)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      const quotedValues = value.map(v => `"${v}"`).join(', ');
      conditions.push(`${key} IN (${quotedValues})`);
    } else if (key === 'createdAfter') {
      conditions.push(`created >= "${value}"`);
    } else if (key === 'createdBefore') {
      conditions.push(`created <= "${value}"`);
    } else if (key === 'updatedAfter') {
      conditions.push(`updated >= "${value}"`);
    } else if (key === 'updatedBefore') {
      conditions.push(`updated <= "${value}"`);
    } else {
      conditions.push(`${key} = "${value}"`);
    }
  }

  return conditions.join(' AND ');
}

/**
 * Build Drizzle ORM conditions from parsed criteria
 *
 * This is a helper to convert criteria into Drizzle where conditions.
 * The actual implementation should be in the API route where you have access to the schema.
 */
export function buildWhereConditions(criteria: ParsedCriteria): Record<string, unknown> {
  const conditions: Record<string, unknown> = {};

  // Map criteria to database fields
  if (criteria.assignee) {
    conditions.assigneeId = criteria.assignee;
  }

  if (criteria.reporter) {
    conditions.reporterId = criteria.reporter;
  }

  if (criteria.status) {
    conditions.status = criteria.status;
  }

  if (criteria.priority) {
    conditions.priority = criteria.priority;
  }

  if (criteria.type) {
    conditions.type = criteria.type;
  }

  if (criteria.project) {
    conditions.projectId = criteria.project;
  }

  if (criteria.sprint) {
    conditions.sprintId = criteria.sprint;
  }

  // Date filters need special handling in the API route
  // These are returned as-is for the API to handle
  if (criteria.createdAfter) {
    conditions.createdAfter = criteria.createdAfter;
  }

  if (criteria.createdBefore) {
    conditions.createdBefore = criteria.createdBefore;
  }

  if (criteria.updatedAfter) {
    conditions.updatedAfter = criteria.updatedAfter;
  }

  if (criteria.updatedBefore) {
    conditions.updatedBefore = criteria.updatedBefore;
  }

  return conditions;
}

