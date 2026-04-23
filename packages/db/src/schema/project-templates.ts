import { pgTable, text, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';
import { workflows } from './workflows';
import { permissionSchemes } from './permission-schemes';

/**
 * Project Templates - Reusable project configurations
 * #1 most requested Jira feature - save entire project setup
 */
export const projectTemplates = pgTable('project_templates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // Template metadata
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull().default('custom'), // 'software_development', 'marketing', 'hr', 'sales', 'design', 'custom'
  icon: text('icon'), // Emoji or icon name
  color: text('color'), // Hex color for visual identification

  /**
   * Freeform template kind. Drives the "Use template" flow:
   *  - 'project' → POST /api/projects with payload
   *  - 'issue'   → POST /api/issues   with payload
   *  - 'doc'     → POST /api/docs     with payload
   * Defaults to 'project' to preserve legacy behaviour for pre-existing rows.
   */
  kind: text('kind').notNull().default('project'),

  /**
   * Arbitrary JSON describing the entity to create when the template is used.
   * Shape depends on `kind`; validated at the API boundary.
   */
  payload: jsonb('payload').notNull().default('{}'),

  // Template configuration
  workflowId: text('workflow_id').references(() => workflows.id),
  permissionSchemeId: text('permission_scheme_id').references(() => permissionSchemes.id),

  // Workflow statuses configuration
  statuses: jsonb('statuses').notNull().default('[]'),
  /**
   * Example:
   * [{
   *   "name": "Backlog",
   *   "category": "backlog",
   *   "color": "#gray",
   *   "isDefault": true
   * }, {
   *   "name": "In Progress",
   *   "category": "in_progress",
   *   "color": "#blue"
   * }]
   */

  // Issue types
  issueTypes: jsonb('issue_types').notNull().default('["task", "bug", "story"]'),
  // ['task', 'bug', 'story', 'epic', 'subtask']

  // Custom fields configuration
  customFields: jsonb('custom_fields').notNull().default('[]'),
  /**
   * Example:
   * [{
   *   "name": "Sprint",
   *   "type": "select",
   *   "options": ["Sprint 1", "Sprint 2"],
   *   "required": false
   * }, {
   *   "name": "Story Points",
   *   "type": "number",
   *   "required": true
   * }]
   */

  // Automation rules
  automationRules: jsonb('automation_rules').notNull().default('[]'),
  /**
   * Example:
   * [{
   *   "name": "Auto-assign to reporter",
   *   "trigger": { "type": "issue_created" },
   *   "actions": [{ "type": "assign_issue", "assignee": "reporter" }]
   * }]
   */

  // Default project settings
  defaultSettings: jsonb('default_settings').notNull().default('{}'),
  /**
   * Example:
   * {
   *   "visibility": "private",
   *   "enableSprints": true,
   *   "enableBacklog": true,
   *   "defaultAssignee": "unassigned",
   *   "defaultPriority": "medium",
   *   "requireEstimation": false,
   *   "allowIssueLinks": true
   * }
   */

  // Sprint configuration (if applicable)
  sprintConfig: jsonb('sprint_config'),
  /**
   * Example:
   * {
   *   "defaultDuration": 14,
   *   "startDay": "monday",
   *   "autoStart": false,
   *   "autoComplete": false
   * }
   */

  // Board configuration
  boardConfig: jsonb('board_config'),
  /**
   * Example:
   * {
   *   "columns": ["backlog", "todo", "in_progress", "review", "done"],
   *   "swimlanes": "none", // 'none', 'assignee', 'priority', 'epic'
   *   "cardFields": ["assignee", "priority", "labels", "estimation"]
   * }
   */

  // Marketplace settings
  isPublic: boolean('is_public').notNull().default(false),
  isVerified: boolean('is_verified').notNull().default(false),
  isFeatured: boolean('is_featured').notNull().default(false),

  // Usage statistics
  usageCount: integer('usage_count').notNull().default(0),
  rating: integer('rating').default(0), // Average * 100
  reviews: jsonb('reviews').default('[]'),

  // Requirements
  minPlan: text('min_plan').default('free'), // 'free', 'starter', 'growth', 'enterprise'
  requiredIntegrations: jsonb('required_integrations').default('[]'),

  // Preview
  thumbnail: text('thumbnail'), // URL to template preview image
  screenshots: jsonb('screenshots').default('[]'), // Array of screenshot URLs

  // Audit
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Template Usage Tracking - Track template installations
 */
export const templateUsages = pgTable('template_usages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  templateId: text('template_id')
    .notNull()
    .references(() => projectTemplates.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),

  // Usage details
  projectName: text('project_name').notNull(),
  projectKey: text('project_key').notNull(),
  customizations: jsonb('customizations').default('{}'), // What user changed from template

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Template Reviews - User reviews for templates
 */
export const templateReviews = pgTable('template_reviews', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  templateId: text('template_id')
    .notNull()
    .references(() => projectTemplates.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  rating: integer('rating').notNull(), // 1-5 stars
  comment: text('comment'),
  helpful: integer('helpful').notNull().default(0), // Upvotes

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Template Categories - Predefined template categories
 */
export const templateCategories = pgTable('template_categories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  description: text('description'),
  icon: text('icon'),
  order: integer('order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});
