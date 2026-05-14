import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';

/**
 * SSO Configurations (per workspace / organization).
 *
 * Holds SAML 2.0 (and future OIDC) IdP metadata for a workspace so we can:
 *   - Generate SP-initiated AuthN requests at /api/auth/saml/[slug]/init
 *   - Validate AuthN responses at /api/auth/saml/[slug]/callback
 *   - Serve SP metadata.xml for IdP configuration
 *
 * `cert` holds the IdP's X.509 signing certificate in PEM form. `private_key`
 * is the SP's private key, used only when we sign AuthnRequests / decrypt
 * encrypted assertions — leave NULL to use plain (non-signed) requests.
 *
 * `attribute_map` lets each workspace declare which SAML attributes map to
 * which TaskNebula user fields. Default keys: { email, first_name, last_name,
 * groups }.
 */
export const ssoConfigs = pgTable(
  'sso_configs',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'saml' | 'oidc'
    entryPointUrl: text('entry_point_url').notNull(),
    issuer: text('issuer').notNull(),
    cert: text('cert').notNull(), // X.509 IdP signing cert (PEM)
    privateKey: text('private_key'), // optional SP private key (PEM)
    audience: text('audience').notNull(),
    // Maps internal fields -> SAML attribute URIs, e.g.
    // { email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    //   first_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    //   last_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    //   groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role' }
    attributeMap: jsonb('attribute_map').notNull().default('{}'),
    enabled: boolean('enabled').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: uniqueIndex('sso_configs_workspace_idx').on(table.workspaceId),
  })
);

export type SsoConfig = typeof ssoConfigs.$inferSelect;
export type NewSsoConfig = typeof ssoConfigs.$inferInsert;

/**
 * SCIM 2.0 provisioning tokens.
 *
 * Each row is one Bearer token an IdP (Okta / Entra ID / Google Workspace)
 * can use to call our SCIM endpoints under /api/scim/v2/. We store only an
 * Argon2/bcrypt hash of the secret — the plaintext token is shown to the
 * admin exactly once at creation time (same pattern as `api_keys`).
 *
 * `scopes` is reserved for future per-token policy (e.g. `users:read`,
 * `groups:write`). The scaffolding implementation treats any non-revoked
 * token as full SCIM admin.
 */
export const scimTokens = pgTable(
  'scim_tokens',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    name: text('name').notNull(),
    scopes: text('scopes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
  },
  (table) => ({
    workspaceIdx: index('scim_tokens_workspace_idx').on(table.workspaceId),
    tokenHashIdx: uniqueIndex('scim_tokens_token_hash_idx').on(table.tokenHash),
  })
);

export type ScimToken = typeof scimTokens.$inferSelect;
export type NewScimToken = typeof scimTokens.$inferInsert;
