import { pgTable, text, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { issues } from './issues';
import { users } from './users';

/**
 * GitHub Installations - GitHub App installations per organization
 */
export const githubInstallations = pgTable('github_installations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // GitHub installation details
  installationId: text('installation_id').notNull().unique(),
  accountLogin: text('account_login').notNull(), // GitHub org/user name
  accountType: text('account_type').notNull(), // 'Organization' or 'User'

  // Access
  accessToken: text('access_token').notNull(), // Encrypted
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshToken: text('refresh_token'), // Encrypted

  // Permissions
  permissions: jsonb('permissions').default('{}'),
  /**
   * Example:
   * {
   *   "contents": "read",
   *   "pull_requests": "write",
   *   "issues": "write",
   *   "metadata": "read"
   * }
   */

  // Installation status
  isActive: boolean('is_active').notNull().default(true),
  suspendedAt: timestamp('suspended_at'),

  // Audit
  installedBy: text('installed_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * GitHub Repositories - Linked repositories
 */
export const githubRepositories = pgTable('github_repositories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  installationId: text('installation_id')
    .notNull()
    .references(() => githubInstallations.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .references(() => projects.id, { onDelete: 'cascade' }),

  // Repository details
  githubRepoId: text('github_repo_id').notNull(), // GitHub's internal ID
  fullName: text('full_name').notNull(), // 'owner/repo'
  name: text('name').notNull(),
  owner: text('owner').notNull(),
  isPrivate: boolean('is_private').notNull(),
  defaultBranch: text('default_branch').default('main'),

  // URLs
  htmlUrl: text('html_url').notNull(),
  cloneUrl: text('clone_url'),

  // Sync settings
  autoLinkCommits: boolean('auto_link_commits').notNull().default(true),
  autoLinkPRs: boolean('auto_link_prs').notNull().default(true),
  autoTransitionOnMerge: boolean('auto_transition_on_merge').notNull().default(false),
  mergeTransitionStatus: text('merge_transition_status'), // Status to transition to on PR merge

  // Statistics
  totalCommits: integer('total_commits').default(0),
  totalPRs: integer('total_prs').default(0),

  // Last sync
  lastSyncAt: timestamp('last_sync_at'),
  lastSyncStatus: text('last_sync_status'), // 'success', 'failed', 'partial'

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * GitHub Commits - Commits linked to issues
 */
export const githubCommits = pgTable('github_commits', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  repositoryId: text('repository_id')
    .notNull()
    .references(() => githubRepositories.id, { onDelete: 'cascade' }),
  issueId: text('issue_id')
    .references(() => issues.id, { onDelete: 'cascade' }),

  // Commit details
  sha: text('sha').notNull().unique(),
  message: text('message').notNull(),
  shortSha: text('short_sha').notNull(), // First 7 characters

  // Author information
  authorName: text('author_name').notNull(),
  authorEmail: text('author_email').notNull(),
  authorGithubUsername: text('author_github_username'),
  authorUserId: text('author_user_id').references(() => users.id), // Mapped user

  // Commit metadata
  committedAt: timestamp('committed_at').notNull(),
  url: text('url').notNull(),
  branch: text('branch'),

  // Files changed
  filesChanged: jsonb('files_changed').default('[]'),
  additions: integer('additions').default(0),
  deletions: integer('deletions').default(0),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * GitHub Pull Requests - PRs linked to issues
 */
export const githubPullRequests = pgTable('github_pull_requests', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  repositoryId: text('repository_id')
    .notNull()
    .references(() => githubRepositories.id, { onDelete: 'cascade' }),
  issueId: text('issue_id')
    .references(() => issues.id, { onDelete: 'cascade' }),

  // PR details
  githubPrId: text('github_pr_id').notNull(), // GitHub's internal ID
  prNumber: integer('pr_number').notNull(),
  title: text('title').notNull(),
  body: text('body'),

  // State
  state: text('state').notNull(), // 'open', 'closed'
  merged: boolean('merged').notNull().default(false),
  draft: boolean('draft').notNull().default(false),

  // Author
  authorName: text('author_name').notNull(),
  authorGithubUsername: text('author_github_username').notNull(),
  authorUserId: text('author_user_id').references(() => users.id),

  // Branches
  headBranch: text('head_branch').notNull(),
  baseBranch: text('base_branch').notNull(),

  // URLs
  htmlUrl: text('html_url').notNull(),
  diffUrl: text('diff_url'),

  // Review status
  reviewStatus: text('review_status'), // 'pending', 'approved', 'changes_requested'
  reviewers: jsonb('reviewers').default('[]'), // Array of reviewer usernames

  // PR metadata
  additions: integer('additions').default(0),
  deletions: integer('deletions').default(0),
  changedFiles: integer('changed_files').default(0),
  commits: integer('commits').default(0),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  mergedAt: timestamp('merged_at'),
  closedAt: timestamp('closed_at'),
});

/**
 * GitHub Branches - Branches created from issues
 */
export const githubBranches = pgTable('github_branches', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  repositoryId: text('repository_id')
    .notNull()
    .references(() => githubRepositories.id, { onDelete: 'cascade' }),
  issueId: text('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),

  // Branch details
  branchName: text('branch_name').notNull(),
  baseBranch: text('base_branch').notNull(),
  createdFrom: text('created_from').notNull(), // 'issue_key', 'issue_title'

  // Status
  isDeleted: boolean('is_deleted').notNull().default(false),
  mergedToPR: text('merged_to_pr').references(() => githubPullRequests.id),

  // Creator
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

/**
 * GitHub Webhooks - Webhook events from GitHub
 */
export const githubWebhookEvents = pgTable('github_webhook_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  installationId: text('installation_id')
    .notNull()
    .references(() => githubInstallations.id, { onDelete: 'cascade' }),

  // Event details
  eventType: text('event_type').notNull(), // 'push', 'pull_request', 'pull_request_review', etc.
  action: text('action'), // 'opened', 'closed', 'merged', etc.
  deliveryId: text('delivery_id').notNull().unique(), // GitHub delivery ID

  // Payload
  payload: jsonb('payload').notNull(),

  // Processing
  processed: boolean('processed').notNull().default(false),
  processedAt: timestamp('processed_at'),
  processingError: text('processing_error'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});
