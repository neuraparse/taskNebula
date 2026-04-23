import { pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';

/**
 * Email Verification Tokens
 *
 * Stores SHA-256 hashed tokens used to verify a user's email address.
 * Raw tokens are emailed to users; only the hash lives in the database.
 *
 * Lifecycle:
 * - Issued on signup and via POST /api/auth/send-verification.
 * - Consumed by GET /api/auth/verify-email/[token] which sets `usedAt`
 *   and `users.email_verified`.
 * - Prior unused tokens for a user are invalidated (marked used) when a
 *   new token is requested.
 */
export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // SHA-256 hex digest of the raw token delivered to the user.
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    usedAt: timestamp('used_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex('email_verification_token_hash_idx').on(table.tokenHash),
    userIdx: index('email_verification_user_idx').on(table.userId),
  })
);

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;
