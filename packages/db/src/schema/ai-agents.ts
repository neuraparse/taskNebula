import { pgTable, text, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

/**
 * AI Agents - Autonomous AI assistants that can execute tasks independently
 * Inspired by ClickUp Autopilot, Asana AI Teammates, Monday.com agents
 */
export const aiAgents = pgTable('ai_agents', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // Agent configuration
  name: text('name').notNull(), // e.g., "Task Creator", "Status Updater"
  description: text('description'),
  type: text('type').notNull(), // 'task_creator', 'status_updater', 'email_sender', 'smart_assigner', 'summarizer'

  // AI Model configuration
  aiProvider: text('ai_provider').notNull().default('openai'), // 'openai', 'anthropic', 'google'
  aiModel: text('ai_model').notNull().default('gpt-4o-mini'), // 'gpt-4o', 'claude-3.5-sonnet', 'gemini-pro'

  // Agent behavior
  config: jsonb('config').notNull().default('{}'), // Agent-specific configuration
  /**
   * Example configs:
   *
   * Task Creator Agent:
   * {
   *   "triggerOn": "meeting_ended",
   *   "sourceIntegrations": ["slack", "zoom", "loom"],
   *   "defaultProject": "uuid",
   *   "defaultAssignee": "reporter",
   *   "autoStart": true
   * }
   *
   * Status Updater Agent:
   * {
   *   "triggerOn": "pr_merged",
   *   "sourceIntegrations": ["github"],
   *   "statusMapping": {
   *     "pr_opened": "in_review",
   *     "pr_merged": "done"
   *   }
   * }
   *
   * Smart Assignment Agent:
   * {
   *   "considerWorkload": true,
   *   "considerSkills": true,
   *   "considerTimezone": true,
   *   "maxAssignmentsPerDay": 5
   * }
   */

  // Triggers and conditions
  triggers: jsonb('triggers').notNull().default('[]'), // Array of trigger conditions
  /**
   * Example triggers:
   * [{
   *   "type": "webhook",
   *   "source": "slack",
   *   "event": "message_posted",
   *   "conditions": {
   *     "channel": "#tasks",
   *     "contains": "TODO:"
   *   }
   * }]
   */

  // Execution settings
  enabled: boolean('enabled').notNull().default(true),
  executionLimit: integer('execution_limit').default(100), // Max executions per day
  executionCount: integer('execution_count').notNull().default(0), // Current day count
  lastExecutionReset: timestamp('last_execution_reset').defaultNow(),

  // Permissions
  allowedProjects: jsonb('allowed_projects').default('[]'), // Array of project IDs, empty = all
  allowedUsers: jsonb('allowed_users').default('[]'), // Array of user IDs who can trigger, empty = all

  // Audit
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * AI Agent Executions - Track agent execution history
 */
export const aiAgentExecutions = pgTable('ai_agent_executions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  agentId: text('agent_id')
    .notNull()
    .references(() => aiAgents.id, { onDelete: 'cascade' }),

  // Execution details
  status: text('status').notNull(), // 'pending', 'running', 'completed', 'failed', 'cancelled'

  // Input/Output
  input: jsonb('input').notNull(), // What triggered the agent
  output: jsonb('output'), // What the agent produced
  error: text('error'), // Error message if failed

  // AI usage
  aiProvider: text('ai_provider').notNull(),
  aiModel: text('ai_model').notNull(),
  tokensUsed: integer('tokens_used'),
  cost: integer('cost'), // Cost in cents

  // Performance
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),

  // Context
  triggeredBy: text('triggered_by').references(() => users.id), // User who triggered (if manual)
  triggerType: text('trigger_type').notNull(), // 'manual', 'webhook', 'scheduled', 'event'

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * AI Agent Templates - Pre-built agent configurations
 */
export const aiAgentTemplates = pgTable('ai_agent_templates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Template info
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // 'productivity', 'automation', 'collaboration', 'reporting'
  icon: text('icon'),

  // Template configuration
  agentType: text('agent_type').notNull(),
  defaultConfig: jsonb('default_config').notNull(),
  defaultTriggers: jsonb('default_triggers').notNull(),

  // Marketplace
  isPublic: boolean('is_public').notNull().default(false),
  isVerified: boolean('is_verified').notNull().default(false),
  downloads: integer('downloads').notNull().default(0),
  rating: integer('rating').default(0), // Average rating * 100 (e.g., 450 = 4.5 stars)

  // Requirements
  requiredIntegrations: jsonb('required_integrations').default('[]'), // ['github', 'slack']
  minPlan: text('min_plan').default('free'), // 'free', 'starter', 'growth', 'enterprise'

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
