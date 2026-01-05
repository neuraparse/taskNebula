import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';
import { organizations } from './organizations';

// API keys table for programmatic access
export const apiKeys = pgTable('api_keys', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  
  // Key details
  name: text('name').notNull(), // User-friendly name for the key
  key: text('key').notNull().unique(), // The actual API key (hashed)
  keyPrefix: text('key_prefix').notNull(), // First 8 chars for display (e.g., "sk_live_...")
  
  // Ownership
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Status
  isActive: boolean('is_active').notNull().default(true),
  
  // Usage tracking
  lastUsedAt: timestamp('last_used_at'),
  
  // Expiration
  expiresAt: timestamp('expires_at'), // null = never expires
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  revokedAt: timestamp('revoked_at'),
  revokedBy: text('revoked_by').references(() => users.id),
});

// Indexes
export const apiKeyIndexes = {
  organizationIdIdx: 'api_keys_organization_id_idx',
  keyIdx: 'api_keys_key_idx',
  isActiveIdx: 'api_keys_is_active_idx',
};

