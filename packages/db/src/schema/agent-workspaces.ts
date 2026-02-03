import { pgTable, text, timestamp, boolean, jsonb, integer, index, unique, numeric } from 'drizzle-orm/pg-core';
import { issues } from './issues';
import { projects } from './projects';
import { organizations } from './organizations';

/**
 * Agent Workspaces - Docker containers for isolated agent execution
 * Inspired by Vibe Kanban's coding agents feature
 */
export const agentWorkspaces = pgTable('agent_workspaces', {
  id: text('id').primaryKey(),
  issueId: text('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  // Docker container info
  containerId: text('container_id'),
  containerName: text('container_name'),

  // Git info
  branchName: text('branch_name').notNull(),
  workingDirectory: text('working_directory'),

  // Status tracking
  status: text('status').notNull().default('setup_pending'), // 'setup_pending', 'setup_in_progress', 'ready', 'error', 'terminated'
  setupCompletedAt: timestamp('setup_completed_at'),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  issueIdIdx: index('agent_workspaces_issue_id_idx').on(table.issueId),
  statusIdx: index('agent_workspaces_status_idx').on(table.status),
}));

/**
 * Agent Sessions - Link between workspace and agent execution
 */
export const agentSessions = pgTable('agent_sessions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => agentWorkspaces.id, { onDelete: 'cascade' }),

  // Executor configuration
  executorProfile: text('executor_profile').notNull(), // 'CLAUDE_CODE', 'OPENAI', 'GITHUB_COPILOT'
  executorVariant: text('executor_variant').default('DEFAULT'), // 'SONNET', 'OPUS', 'O1', 'GPT4', etc.

  // MCP (Model Context Protocol) configuration
  mcpConfig: jsonb('mcp_config').notNull().default('{}'),

  // Environment variables for agent execution
  environmentVariables: jsonb('environment_variables').notNull().default('{}'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  workspaceIdIdx: index('agent_sessions_workspace_id_idx').on(table.workspaceId),
}));

/**
 * Agent Execution Processes - Individual agent runs
 */
export const agentExecutionProcesses = pgTable('agent_execution_processes', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => agentSessions.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => agentWorkspaces.id, { onDelete: 'cascade' }),

  // Execution details
  runReason: text('run_reason').notNull(), // 'initial_prompt', 'feedback', 'retry'
  status: text('status').notNull().default('running'), // 'running', 'completed', 'failed', 'cancelled'
  exitCode: integer('exit_code'),

  // Timing
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),

  // Whether this execution was dropped/cancelled
  dropped: boolean('dropped').notNull().default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  sessionIdIdx: index('agent_execution_processes_session_id_idx').on(table.sessionId),
  statusIdx: index('agent_execution_processes_status_idx').on(table.status),
}));

/**
 * Coding Agent Turns - Multi-turn conversations with AI agents
 */
export const codingAgentTurns = pgTable('coding_agent_turns', {
  id: text('id').primaryKey(),
  executionProcessId: text('execution_process_id')
    .notNull()
    .references(() => agentExecutionProcesses.id, { onDelete: 'cascade' }),
  agentSessionId: text('agent_session_id'),

  // Turn details
  turnNumber: integer('turn_number').notNull(),
  initialPrompt: text('initial_prompt').notNull(),
  assistantSummary: text('assistant_summary'),

  // Files changed in this turn
  filesChanged: jsonb('files_changed').notNull().default('[]'),

  // Cost tracking
  tokensUsed: integer('tokens_used').default(0),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }).default('0'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  executionProcessIdIdx: index('coding_agent_turns_execution_process_id_idx').on(table.executionProcessId),
}));

/**
 * Agent Execution Logs - Streamed logs from agent executions
 */
export const agentExecutionLogs = pgTable('agent_execution_logs', {
  id: text('id').primaryKey(),
  executionProcessId: text('execution_process_id')
    .notNull()
    .references(() => agentExecutionProcesses.id, { onDelete: 'cascade' }),

  // Log details
  logIndex: integer('log_index').notNull(),
  logType: text('log_type').notNull().default('stdout'), // 'stdout', 'stderr', 'system'
  content: text('content').notNull(),

  timestamp: timestamp('timestamp').notNull().defaultNow(),
}, (table) => ({
  executionProcessIdIdx: index('agent_execution_logs_execution_process_id_idx').on(table.executionProcessId),
  logIndexIdx: index('agent_execution_logs_log_index_idx').on(table.logIndex),
}));

/**
 * Executor Profiles - Configuration for different AI agents
 */
export const executorProfiles = pgTable('executor_profiles', {
  id: text('id').primaryKey(),

  // Executor identification
  executor: text('executor').notNull(), // 'CLAUDE_CODE', 'OPENAI', 'GITHUB_COPILOT'
  variant: text('variant').notNull().default('DEFAULT'), // 'SONNET', 'OPUS', 'HAIKU', 'O1', 'GPT4', 'GPT4O'

  // Display information
  displayName: text('display_name').notNull(),
  description: text('description'),

  // Command configuration
  baseCommand: text('base_command').notNull(), // e.g., 'npx', 'python', 'gh'
  extraParams: jsonb('extra_params').notNull().default('[]'), // Array of command-line arguments
  envVars: jsonb('env_vars').notNull().default('{}'), // Environment variables

  // MCP configuration
  mcpConfig: jsonb('mcp_config').notNull().default('{}'),

  // Status
  enabled: boolean('enabled').notNull().default(true),

  // Organization-specific override (null = global)
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  executorIdx: index('executor_profiles_executor_idx').on(table.executor),
  executorVariantUnique: unique('executor_profiles_executor_variant_unique').on(table.executor, table.variant),
}));
