import { pgTable, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';
import { organizations } from './organizations';

/**
 * Push Subscriptions Table
 * Stores web push notification subscriptions for users
 */
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  
  // User and organization
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Subscription details (from PushSubscription API)
  endpoint: text('endpoint').notNull().unique(),
  
  // Keys for encryption (stored as JSONB)
  keys: jsonb('keys').notNull().$type<{
    p256dh: string;
    auth: string;
  }>(),
  
  // Device/browser information
  userAgent: text('user_agent'),
  deviceName: text('device_name'),
  
  // Status
  isActive: boolean('is_active').notNull().default(true),
  
  // Last notification sent
  lastNotificationAt: timestamp('last_notification_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

