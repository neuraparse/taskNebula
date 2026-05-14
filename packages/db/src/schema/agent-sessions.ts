/**
 * Linear Agent Protocol parity tables.
 *
 * `agent_sessions` is the per-issue session row a coding agent (Claude Code,
 * Cursor, Devin, Copilot, OpenHands, ...) creates when it picks up work.
 * Receivers post AgentSessionEvent webhooks back to us; we update the row
 * and surface state in the issue UI.
 *
 * `agent_providers` is the per-workspace configuration for each provider:
 * webhook endpoint URL, optional FK to the encrypted credentials envelope in
 * `integration_client_credentials`, and the shared HMAC secret used to sign
 * outbound dispatch payloads and verify inbound session-event posts.
 *
 * See apps/web/src/lib/agents/sessions.ts for the matching state machine and
 * HMAC helpers.
 */

import { createId } from '@paralleldrive/cuid2';
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { issues } from './issues';
import { organizations } from './organizations';
import { integrationClientCredentials } from './integration-client-credentials';

// Linear-compatible session state machine.
// Source: https://linear.app/docs/agents (AgentSessionEvent.state).
export const agentSessionStateEnum = pgEnum('agent_session_state', [
  'pending',
  'active',
  'awaitingInput',
  'error',
  'complete',
  'stale',
]);

export const agentSessionProviderEnum = pgEnum('agent_session_provider', [
  'claude',
  'cursor',
  'devin',
  'copilot',
  'openhands',
  'custom',
]);

export const agentSessions = pgTable(
  'agent_sessions',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),

    issueId: text('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),

    provider: agentSessionProviderEnum('provider').notNull(),

    // Provider-side identifier (Linear's `AgentSessionEvent.sessionId`, Cursor's
    // run id, etc.) — `null` until the provider returns one in its first event.
    externalId: text('external_id'),

    state: agentSessionStateEnum('state').notNull().default('pending'),

    // Per-session HMAC secret used to verify the provider's reply webhooks.
    // Generated when the session is dispatched and never returned over the API
    // after creation.
    signedSecret: text('signed_secret').notNull(),

    // Full payload mirror: latest AgentSessionEvent body, original prompt, repo
    // refs, etc. Kept as jsonb so we can evolve the schema without migrations.
    payload: jsonb('payload').notNull().default('{}'),

    startedAt: timestamp('started_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    finishedAt: timestamp('finished_at'),
  },
  (table) => ({
    issueIdx: index('agent_session_issue_idx').on(table.issueId),
    stateIdx: index('agent_session_state_idx').on(table.state),
    providerIdx: index('agent_session_provider_idx').on(table.provider),
    issueStateIdx: index('agent_session_issue_state_idx').on(
      table.issueId,
      table.state
    ),
  })
);

export const agentProviders = pgTable(
  'agent_providers',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),

    // Workspace = TaskNebula organization. Provider config is scoped here so
    // each org wires up its own Cursor / Devin / Claude tokens.
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    provider: agentSessionProviderEnum('provider').notNull(),

    // Optional FK to the encrypted client credentials envelope. We point at the
    // existing `integration_client_credentials` row (already AES-256-GCM
    // wrapped) rather than duplicating secret storage.
    credentialsRef: text('credentials_ref').references(
      () => integrationClientCredentials.id,
      { onDelete: 'set null' }
    ),

    // Webhook endpoint we POST AgentSessionRequest events to.
    endpointUrl: text('endpoint_url').notNull(),

    // Shared HMAC secret used to sign outbound dispatch payloads and verify
    // inbound session-event posts. Stored in plaintext intentionally — same
    // pattern as `webhooks.secret`.
    hmacSecret: text('hmac_secret').notNull(),

    enabled: boolean('enabled').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    workspaceProviderIdx: uniqueIndex('agent_provider_workspace_provider_idx').on(
      table.workspaceId,
      table.provider
    ),
    workspaceIdx: index('agent_provider_workspace_idx').on(table.workspaceId),
  })
);

export type AgentSession = typeof agentSessions.$inferSelect;
export type NewAgentSession = typeof agentSessions.$inferInsert;
export type AgentProvider = typeof agentProviders.$inferSelect;
export type NewAgentProvider = typeof agentProviders.$inferInsert;
