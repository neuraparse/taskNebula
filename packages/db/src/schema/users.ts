import { pgTable, text, timestamp, jsonb, varchar, pgEnum, uniqueIndex, integer, boolean } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

// Enums
export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'invited']);

// Users table (Auth.js compatible)
export const users = pgTable('users', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  password: text('password'), // For credentials-based auth
  // Custom fields
  timezone: varchar('timezone', { length: 100 }),
  locale: varchar('locale', { length: 10 }),
  settings: jsonb('settings').notNull().default('{}'),
  status: userStatusEnum('status').notNull().default('active'),
  // Super Admin
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
  superAdminGrantedAt: timestamp('super_admin_granted_at', { mode: 'date' }),
  superAdminGrantedBy: text('super_admin_granted_by'), // User ID who granted super admin
  // Tracked at end of each authenticated request — drives the dashboard
  // "Welcome back / Catch me up" banner heuristic (banner shows if last
  // visit was >4h ago). Nullable for users that haven't authenticated since
  // the column was introduced.
  lastSeenAt: timestamp('last_seen_at', { mode: 'date' }),
  // Agent-as-assignee: virtual user representing an AI coding agent that can
  // be assigned issues like a human (Linear Agent Protocol compatibility).
  isAgent: boolean('is_agent').notNull().default(false),
  agentProvider: text('agent_provider'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex('user_email_idx').on(table.email),
}));

// User Sessions (for Auth.js compatibility)
export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').notNull().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

// Accounts (OAuth providers) - Auth.js compatible
export const accounts = pgTable('accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => ({
  compoundKey: uniqueIndex('account_provider_account_idx').on(table.provider, table.providerAccountId),
}));

// Verification tokens for email verification
export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (table) => ({
  compoundKey: uniqueIndex('verification_token_identifier_token_idx').on(table.identifier, table.token),
}));

