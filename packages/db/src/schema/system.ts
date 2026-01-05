import { pgTable, text, timestamp, jsonb, varchar, boolean, integer } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

// System Settings - Global configuration
export const systemSettings = pgTable('system_settings', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: jsonb('value').notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(), // 'general', 'security', 'billing', 'features'
  isPublic: boolean('is_public').notNull().default(false), // Can be accessed by non-super-admins
  updatedBy: text('updated_by'), // User ID who last updated
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// System Audit Logs - Track super admin actions
export const systemAuditLogs = pgTable('system_audit_logs', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  userId: text('user_id').notNull(), // Super admin who performed action
  action: varchar('action', { length: 255 }).notNull(), // 'org.created', 'org.suspended', 'plan.changed', 'user.promoted', etc.
  resourceType: varchar('resource_type', { length: 100 }).notNull(), // 'organization', 'user', 'system_setting'
  resourceId: text('resource_id'), // ID of affected resource
  organizationId: text('organization_id'), // If action is org-specific
  changes: jsonb('changes'), // Before/after values
  metadata: jsonb('metadata'), // Additional context
  ipAddress: varchar('ip_address', { length: 45 }), // IPv4 or IPv6
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Organization Invitations - For creating new organizations
export const organizationInvitations = pgTable('organization_invitations', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  organizationName: varchar('organization_name', { length: 255 }).notNull(),
  organizationSlug: varchar('organization_slug', { length: 100 }).notNull(),
  plan: varchar('plan', { length: 50 }).notNull().default('free'), // 'free', 'starter', 'growth', 'enterprise'
  role: varchar('role', { length: 50 }).notNull().default('owner'), // Initial role for invitee
  token: text('token').notNull().unique(),
  invitedBy: text('invited_by'), // Super admin user ID
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'accepted', 'expired', 'cancelled'
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// System Statistics - Cached stats for admin dashboard
export const systemStatistics = pgTable('system_statistics', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  date: timestamp('date').notNull(), // Date of statistics
  totalOrganizations: integer('total_organizations').notNull().default(0),
  activeOrganizations: integer('active_organizations').notNull().default(0),
  trialOrganizations: integer('trial_organizations').notNull().default(0),
  suspendedOrganizations: integer('suspended_organizations').notNull().default(0),
  totalUsers: integer('total_users').notNull().default(0),
  activeUsers: integer('active_users').notNull().default(0),
  totalProjects: integer('total_projects').notNull().default(0),
  totalIssues: integer('total_issues').notNull().default(0),
  totalComments: integer('total_comments').notNull().default(0),
  planDistribution: jsonb('plan_distribution').notNull().default('{}'), // { free: 10, starter: 5, growth: 2, enterprise: 1 }
  metadata: jsonb('metadata').notNull().default('{}'), // Additional metrics
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Feature Flags - Control feature rollout
export const featureFlags = pgTable('feature_flags', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isEnabled: boolean('is_enabled').notNull().default(false),
  enabledForPlans: jsonb('enabled_for_plans').notNull().default('[]'), // ['enterprise', 'growth']
  enabledForOrganizations: jsonb('enabled_for_organizations').notNull().default('[]'), // Specific org IDs
  rolloutPercentage: integer('rollout_percentage').notNull().default(0), // 0-100
  metadata: jsonb('metadata').notNull().default('{}'),
  createdBy: text('created_by'), // Super admin user ID
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

