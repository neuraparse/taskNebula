import { pgTable, text, timestamp, jsonb, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';
import { issues } from './issues';

/**
 * Intake Forms — public-facing web forms that funnel submissions into a
 * project as auto-created issues. Field definitions live in JSONB so we
 * can iterate on the field schema without per-change migrations.
 *
 * Field schema entry shape:
 *   { name: string, label: string, type: 'text'|'textarea'|'email'|'select'|'file',
 *     required?: boolean, options?: string[] }
 */
export const intakeForms = pgTable('intake_forms', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  // Workspace = organization scope. Forms always belong to an org so admin
  // listing / access checks can fan out from a single membership query.
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  // Public URL slug. Unique globally so /intake/[slug] is deterministic.
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  // JSON-schema-ish field definitions, see header comment for shape.
  fields: jsonb('fields').notNull().default('[]'),
  isPublic: boolean('is_public').notNull().default(true),
  requiresCaptcha: boolean('requires_captcha').notNull().default(false),
  // Default issue category target. Plain text so a form can target any
  // workflow category (backlog / in_progress / etc) without enum coupling.
  targetStatus: text('target_status').notNull().default('triage'),
  // Optional: every submission auto-assigns to this user. Null = unassigned.
  autoAssignUserId: text('auto_assign_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  // Render-side knobs (primary color, brand mark, etc). Kept free-form.
  customStyling: jsonb('custom_styling').notNull().default('{}'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('intake_form_slug_idx').on(table.slug),
  workspaceIdx: index('intake_form_workspace_idx').on(table.workspaceId),
  projectIdx: index('intake_form_project_idx').on(table.projectId),
}));

/**
 * Intake Submissions — one row per submitted form. Stays distinct from
 * `issues` so we can retain unconverted spam / pending entries without
 * polluting the project backlog. `created_issue_id` is set when the
 * submission is promoted to an issue (immediately for happy-path, or
 * later for manually triaged ones).
 */
export const intakeSubmissions = pgTable('intake_submissions', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  intakeFormId: text('intake_form_id')
    .notNull()
    .references(() => intakeForms.id, { onDelete: 'cascade' }),
  // Best-effort submitter email from the field marked as type=email, if any.
  submittedByEmail: text('submitted_by_email'),
  submittedPayload: jsonb('submitted_payload').notNull().default('{}'),
  // pending | triaged | converted | spam — plain text so future statuses
  // don't require an enum migration.
  status: text('status').notNull().default('pending'),
  createdIssueId: text('created_issue_id').references(() => issues.id, {
    onDelete: 'set null',
  }),
  // Hash so we never log the raw IP. Used purely for rate limiting / audit
  // and trivial to compare for repeat submitters.
  ipHash: text('ip_hash'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  formIdx: index('intake_submission_form_idx').on(table.intakeFormId),
  createdAtIdx: index('intake_submission_created_at_idx').on(table.createdAt),
  statusIdx: index('intake_submission_status_idx').on(table.status),
}));

export const intakeFormsRelations = relations(intakeForms, ({ many, one }) => ({
  submissions: many(intakeSubmissions),
  project: one(projects, {
    fields: [intakeForms.projectId],
    references: [projects.id],
  }),
  workspace: one(organizations, {
    fields: [intakeForms.workspaceId],
    references: [organizations.id],
  }),
  autoAssignUser: one(users, {
    fields: [intakeForms.autoAssignUserId],
    references: [users.id],
  }),
}));

export const intakeSubmissionsRelations = relations(intakeSubmissions, ({ one }) => ({
  form: one(intakeForms, {
    fields: [intakeSubmissions.intakeFormId],
    references: [intakeForms.id],
  }),
  createdIssue: one(issues, {
    fields: [intakeSubmissions.createdIssueId],
    references: [issues.id],
  }),
}));

export type IntakeForm = typeof intakeForms.$inferSelect;
export type NewIntakeForm = typeof intakeForms.$inferInsert;
export type IntakeSubmission = typeof intakeSubmissions.$inferSelect;
export type NewIntakeSubmission = typeof intakeSubmissions.$inferInsert;

export type IntakeFieldType = 'text' | 'textarea' | 'email' | 'select' | 'file';

export interface IntakeFieldDefinition {
  name: string;
  label: string;
  type: IntakeFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
}
