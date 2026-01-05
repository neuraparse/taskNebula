import { pgTable, text, timestamp, boolean, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { projects } from './projects';
import { issues } from './issues';
import { users } from './users';

// Custom field types
export const customFieldTypeEnum = pgEnum('custom_field_type', [
  'text',
  'number',
  'date',
  'select',
  'multi_select',
  'checkbox',
  'url',
  'email',
]);

// Custom field definitions (schema)
export const customFields = pgTable('custom_fields', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }), // null = org-wide
  name: text('name').notNull(),
  description: text('description'),
  type: customFieldTypeEnum('type').notNull(),
  isRequired: boolean('is_required').notNull().default(false),
  defaultValue: text('default_value'),
  options: text('options'), // JSON array for select/multi_select
  position: integer('position').notNull().default(0), // for ordering
  isActive: boolean('is_active').notNull().default(true),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  updatedBy: text('updated_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('custom_field_org_idx').on(table.organizationId),
  projectIdx: index('custom_field_project_idx').on(table.projectId),
  activeIdx: index('custom_field_active_idx').on(table.isActive),
}));

// Custom field values (actual data)
export const customFieldValues = pgTable('custom_field_values', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  customFieldId: text('custom_field_id').notNull().references(() => customFields.id, { onDelete: 'cascade' }),
  issueId: text('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  value: text('value'), // stored as text, parsed based on field type
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  updatedBy: text('updated_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  fieldIdx: index('custom_field_value_field_idx').on(table.customFieldId),
  issueIdx: index('custom_field_value_issue_idx').on(table.issueId),
  // Unique constraint: one value per field per issue
  uniqueFieldIssue: index('custom_field_value_unique_idx').on(table.customFieldId, table.issueId),
}));

