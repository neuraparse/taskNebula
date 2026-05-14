/**
 * Slack integration auxiliary tables.
 *
 * The OAuth connection itself lives in `integration_connections` (provider =
 * 'slack'). These tables add two pieces of state that the generic connection
 * row cannot model:
 *
 *  1. `slack_channel_routes` — per-channel mapping that decides which project
 *     should receive new issues created from a Slack message (emoji-triage,
 *     "create issue from message", or a slash command without a project arg).
 *  2. `slack_message_links` — bidirectional mapping between a Slack message
 *     (and the bot thread we posted) and the TaskNebula issue it spawned, so
 *     subsequent comments and status changes mirror back into the same thread.
 *
 * Both tables are scoped by `organizationId` so multi-tenant data stays isolated;
 * the slack workspace / team id is also stored for human debugging and for the
 * Events API webhook which is keyed off `team_id`.
 */
import {
  pgTable,
  text,
  timestamp,
  varchar,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { projects } from './projects';
import { issues } from './issues';

export const slackChannelRoutes = pgTable(
  'slack_channel_routes',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),

    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Slack workspace identifier (e.g. T01234567). One Slack workspace can
    // back multiple TaskNebula orgs in theory, so we store it here rather
    // than relying on the integration_connections row alone.
    slackTeamId: varchar('slack_team_id', { length: 32 }).notNull(),

    // Slack channel id (e.g. C01234567).
    slackChannelId: varchar('slack_channel_id', { length: 32 }).notNull(),

    // Optional human label cached at create-time for UI lists.
    slackChannelName: varchar('slack_channel_name', { length: 80 }),

    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Label applied to every issue created via this route — typically "slack"
    // or the channel name. Optional.
    defaultLabel: varchar('default_label', { length: 80 }),

    // If set, only `reaction_added` events with this emoji name (without the
    // surrounding colons, e.g. 'bug' or 'pin') trigger issue creation. NULL
    // disables the emoji-triage path for this route.
    emojiTrigger: varchar('emoji_trigger', { length: 64 }),

    // Default priority for issues created via this route. Stored as text and
    // resolved against issuePriorityEnum at call sites — keeping it loose
    // here avoids a circular schema import.
    defaultPriority: varchar('default_priority', { length: 16 })
      .notNull()
      .default('medium'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // One mapping per (workspace, channel) per org.
    orgChannelIdx: uniqueIndex('slack_channel_route_org_channel_idx').on(
      table.organizationId,
      table.slackTeamId,
      table.slackChannelId
    ),
    organizationIdx: index('slack_channel_route_organization_idx').on(
      table.organizationId
    ),
    projectIdx: index('slack_channel_route_project_idx').on(table.projectId),
    teamChannelIdx: index('slack_channel_route_team_channel_idx').on(
      table.slackTeamId,
      table.slackChannelId
    ),
  })
);

export type SlackChannelRoute = typeof slackChannelRoutes.$inferSelect;
export type NewSlackChannelRoute = typeof slackChannelRoutes.$inferInsert;

export const slackMessageLinks = pgTable(
  'slack_message_links',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),

    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Slack workspace + channel + the originating message timestamp.
    slackTeamId: varchar('slack_team_id', { length: 32 }).notNull(),
    slackChannelId: varchar('slack_channel_id', { length: 32 }).notNull(),
    slackMessageTs: varchar('slack_message_ts', { length: 64 }).notNull(),

    // The bot's reply thread root — usually the bot's first message in the
    // channel that confirmed the issue creation. Mirrored comments go here.
    // Falls back to slackMessageTs when the bot replied inline.
    slackThreadTs: varchar('slack_thread_ts', { length: 64 }),

    issueId: text('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),

    // Cached permalink so we can include it in issue activity / description
    // without an extra `chat.getPermalink` call.
    permalink: text('permalink'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // One link per (team, channel, message) — two issues from the same Slack
    // message would be confusing, so we treat the message as the natural key.
    teamChannelMessageIdx: uniqueIndex(
      'slack_message_link_team_channel_message_idx'
    ).on(table.slackTeamId, table.slackChannelId, table.slackMessageTs),
    issueIdx: index('slack_message_link_issue_idx').on(table.issueId),
    organizationIdx: index('slack_message_link_organization_idx').on(
      table.organizationId
    ),
  })
);

export type SlackMessageLink = typeof slackMessageLinks.$inferSelect;
export type NewSlackMessageLink = typeof slackMessageLinks.$inferInsert;
