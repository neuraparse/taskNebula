import { pgTable, text, timestamp, vector, jsonb, integer, boolean, bigserial, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { issues } from './issues';
import { issueComments } from './issues';
import { projects } from './projects';

/**
 * Content Embeddings - AI-powered semantic search
 * Store vector embeddings for semantic search capabilities
 * Requires PostgreSQL with pgvector extension
 */
export const contentEmbeddings = pgTable('content_embeddings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Content reference
  contentType: text('content_type').notNull(), // 'issue', 'comment', 'description', 'project'
  contentId: text('content_id').notNull(), // Reference to the actual content

  // For issues
  issueId: text('issue_id').references(() => issues.id, { onDelete: 'cascade' }),

  // For comments
  commentId: text('comment_id').references(() => issueComments.id, { onDelete: 'cascade' }),

  // For projects
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),

  // Content snapshot (for quick preview without joins)
  contentSnippet: text('content_snippet'), // First 500 chars
  metadata: jsonb('metadata').default('{}'), // Additional searchable metadata

  // Vector embedding (OpenAI ada-002 = 1536 dimensions)
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),

  // Embedding metadata
  embeddingModel: text('embedding_model').notNull().default('text-embedding-ada-002'),
  embeddingProvider: text('embedding_provider').notNull().default('openai'),
  tokensUsed: integer('tokens_used'),

  // Version control (re-embed if content changes)
  contentHash: text('content_hash').notNull(), // MD5 hash of content
  version: integer('version').notNull().default(1),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  typeIdIdx: uniqueIndex('content_embeddings_type_id_idx').on(table.contentType, table.contentId),
}));

/**
 * Durable queue for the embedding worker. Postgres triggers on
 * issues/issue_comments insert into this table on relevant text changes
 * and NOTIFY the `content_embeddings_jobs` channel; the worker picks rows
 * up via LISTEN (or a polling fallback when Redis/LISTEN is unavailable).
 */
export const contentEmbeddingsQueue = pgTable('content_embeddings_queue', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  contentType: text('content_type').notNull(), // 'issue' | 'comment'
  contentId: text('content_id').notNull(),
  organizationId: text('organization_id'),
  projectId: text('project_id'),
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'done' | 'failed'
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  enqueuedAt: timestamp('enqueued_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  statusIdx: index('content_embeddings_queue_status_idx').on(table.status, table.enqueuedAt),
  refIdx: index('content_embeddings_queue_ref_idx').on(table.contentType, table.contentId),
}));

/**
 * Search History - Track semantic searches for analytics
 */
export const semanticSearchHistory = pgTable('semantic_search_history', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  organizationId: text('organization_id').notNull(),

  // Query details
  query: text('query').notNull(), // Natural language query
  queryEmbedding: vector('query_embedding', { dimensions: 1536 }),

  // Search configuration
  filters: jsonb('filters').default('{}'), // Applied filters (project, status, etc)
  limit: integer('limit').default(20),
  similarityThreshold: integer('similarity_threshold').default(70), // 0-100

  // Results
  resultsCount: integer('results_count').notNull(),
  topResults: jsonb('top_results').default('[]'), // Top 3 results for analytics

  // Performance
  executionTimeMs: integer('execution_time_ms'),

  // User interaction
  clickedResultId: text('clicked_result_id'), // Which result user clicked
  wasHelpful: boolean('was_helpful'), // User feedback

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Search Suggestions - AI-powered search suggestions
 */
export const searchSuggestions = pgTable('search_suggestions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Suggestion text
  suggestion: text('suggestion').notNull().unique(),
  category: text('category'), // 'common', 'recent', 'trending'

  // Usage statistics
  usageCount: integer('usage_count').notNull().default(0),
  lastUsed: timestamp('last_used'),

  // Embedding for similarity matching
  embedding: vector('embedding', { dimensions: 1536 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
