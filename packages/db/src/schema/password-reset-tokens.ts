import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';

/**
 * Password Reset Tokens
 *
 * Stores hashed tokens (SHA-256) issued when a user requests a password reset.
 * The raw token is sent to the user via email; we never store it in plaintext.
 *
 * - `tokenHash` - SHA-256 hex of the random token we mailed the user.
 * - `expiresAt` - Tokens are single-use and short-lived (1 hour).
 * - `usedAt` - Marked when the token is successfully redeemed; consumed tokens
 *   cannot be reused.
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('password_reset_tokens_user_id_idx').on(table.userId),
    tokenHashIdx: uniqueIndex('password_reset_tokens_token_hash_idx').on(table.tokenHash),
  })
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
