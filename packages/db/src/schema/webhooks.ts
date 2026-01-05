import { pgTable, text, timestamp, boolean, jsonb, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';
import { organizations } from './organizations';
import { projects } from './projects';

// Webhook event types
export const webhookEventEnum = pgEnum('webhook_event', [
  'issue.created',
  'issue.updated',
  'issue.deleted',
  'issue.status_changed',
  'issue.assigned',
  'issue.commented',
  'sprint.started',
  'sprint.completed',
  'project.created',
  'project.updated',
]);

// Webhooks table
export const webhooks = pgTable('webhooks', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  
  // Webhook details
  name: text('name').notNull(),
  url: text('url').notNull(), // Endpoint to send webhook to
  secret: text('secret').notNull(), // For HMAC signature verification
  
  // Ownership
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }), // null = org-wide
  
  // Events to listen to
  events: jsonb('events').notNull(), // Array of event types
  
  // Status
  isActive: boolean('is_active').notNull().default(true),
  
  // Statistics
  lastTriggeredAt: timestamp('last_triggered_at'),
  successCount: integer('success_count').notNull().default(0),
  failureCount: integer('failure_count').notNull().default(0),
  
  // Metadata
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  organizationIdx: index('webhook_organization_idx').on(table.organizationId),
  projectIdx: index('webhook_project_idx').on(table.projectId),
  activeIdx: index('webhook_active_idx').on(table.isActive),
  orgActiveIdx: index('webhook_org_active_idx').on(table.organizationId, table.isActive),
}));

// Webhook deliveries table (for tracking delivery attempts)
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  
  webhookId: text('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  
  // Event details
  event: webhookEventEnum('event').notNull(),
  payload: jsonb('payload').notNull(),
  
  // Delivery status
  status: text('status').notNull(), // 'pending', 'success', 'failed'
  statusCode: integer('status_code'), // HTTP status code
  responseBody: text('response_body'),
  errorMessage: text('error_message'),
  
  // Retry information
  attemptCount: integer('attempt_count').notNull().default(0),
  nextRetryAt: timestamp('next_retry_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deliveredAt: timestamp('delivered_at'),
}, (table) => ({
  webhookIdx: index('webhook_delivery_webhook_idx').on(table.webhookId),
  statusIdx: index('webhook_delivery_status_idx').on(table.status),
  createdAtIdx: index('webhook_delivery_created_at_idx').on(table.createdAt),
  webhookStatusIdx: index('webhook_delivery_webhook_status_idx').on(table.webhookId, table.status),
}));

