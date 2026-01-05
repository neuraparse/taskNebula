import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { issues } from './issues';
import { users } from './users';

export const attachments = pgTable('attachments', {
  id: text('id').primaryKey(),
  issueId: text('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  filePath: text('file_path').notNull(),
  uploadedById: text('uploaded_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

