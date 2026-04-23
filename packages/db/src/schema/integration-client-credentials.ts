import { pgTable, text, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';

/**
 * Integration Client Credentials (platform-level)
 *
 * Stores the system-wide OAuth *client* credentials (client id / client secret
 * / optional redirect uri / scope) for each third-party integration provider
 * (slack, gitlab, jira, github, google, ...). This is the platform-side of the
 * OAuth picture — the per-organization access/refresh tokens obtained by the
 * user flows live in `integration_connections`.
 *
 * Historically these values were read from environment variables
 * (SLACK_CLIENT_ID, GITLAB_CLIENT_SECRET, JIRA_CLIENT_ID, ...). Super-admins
 * can now manage them through the admin dashboard instead; env vars still
 * act as a fallback when no DB row is present.
 *
 * Secrets are stored as encrypted AES-256-GCM envelopes
 * (`{ iv, authTag, ciphertext }`) using the same helpers as the integration
 * connection tokens — see `apps/web/src/lib/integrations/token-crypto.ts`.
 */
export const integrationClientCredentials = pgTable(
  'integration_client_credentials',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),

    // Short provider key, unique system-wide: 'slack', 'gitlab', 'jira', ...
    provider: text('provider').notNull(),

    // Encrypted envelope for the OAuth client_id. We encrypt it even though
    // it's technically not secret so we only need one storage/handling path.
    clientIdEnc: jsonb('client_id_enc'),

    // Encrypted envelope for the OAuth client_secret.
    clientSecretEnc: jsonb('client_secret_enc'),

    // Optional redirect URI override — when null, the provider falls back to
    // env var / computed default.
    redirectUri: text('redirect_uri'),

    // Optional custom scope string (space-separated OAuth scopes). When null,
    // the provider falls back to its hard-coded default scope list.
    scope: text('scope'),

    // Provider-specific extras (e.g. Slack bot scopes, Atlassian audience).
    metadata: jsonb('metadata').notNull().default('{}'),

    // Super-admin who last changed the row (nullable for historical rows).
    updatedBy: text('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    providerIdx: uniqueIndex('integration_client_credentials_provider_idx').on(
      table.provider
    ),
  })
);

export type IntegrationClientCredential =
  typeof integrationClientCredentials.$inferSelect;
export type NewIntegrationClientCredential =
  typeof integrationClientCredentials.$inferInsert;
