import { pgTable, text, timestamp, jsonb, varchar, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

// Enums
export const organizationPlanEnum = pgEnum('organization_plan', ['free', 'starter', 'growth', 'enterprise']);
export const organizationStatusEnum = pgEnum('organization_status', ['active', 'suspended', 'trial']);
export const organizationRoleEnum = pgEnum('organization_role', ['owner', 'admin', 'member', 'viewer', 'guest']);
export const teamRoleEnum = pgEnum('team_role', ['lead', 'member']);

// Organizations table
export const organizations = pgTable('organizations', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  domain: varchar('domain', { length: 255 }),
  logoUrl: text('logo_url'),
  settings: jsonb('settings').notNull().default('{}'),
  plan: organizationPlanEnum('plan').notNull().default('free'),
  status: organizationStatusEnum('status').notNull().default('trial'),
  // Stripe subscription fields
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripePriceId: text('stripe_price_id'),
  stripeCurrentPeriodEnd: timestamp('stripe_current_period_end'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('org_slug_idx').on(table.slug),
  stripeCustomerIdx: index('org_stripe_customer_idx').on(table.stripeCustomerId),
  stripeSubscriptionIdx: index('org_stripe_subscription_idx').on(table.stripeSubscriptionId),
}));

// Teams table
export const teams = pgTable('teams', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  description: text('description'),
  avatarUrl: text('avatar_url'),
  leadId: text('lead_id'), // References users.id (added later)
  settings: jsonb('settings').notNull().default('{}'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgSlugIdx: uniqueIndex('team_org_slug_idx').on(table.organizationId, table.slug),
  organizationIdx: index('team_organization_idx').on(table.organizationId),
}));

// Organization Members table
export const organizationMembers = pgTable('organization_members', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), // References users.id
  role: organizationRoleEnum('role').notNull().default('member'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgUserIdx: uniqueIndex('org_member_org_user_idx').on(table.organizationId, table.userId),
  userIdx: index('org_member_user_idx').on(table.userId),
  organizationIdx: index('org_member_organization_idx').on(table.organizationId),
}));

// Team Members table
export const teamMembers = pgTable('team_members', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), // References users.id
  role: teamRoleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  teamUserIdx: uniqueIndex('team_member_team_user_idx').on(table.teamId, table.userId),
  userIdx: index('team_member_user_idx').on(table.userId),
  teamIdx: index('team_member_team_idx').on(table.teamId),
}));

