/**
 * Standup runner — orchestrates digest generation and persistence.
 *
 * Shared between the cron route (loops over every org member) and the
 * preview route (single user). Resolves the Anthropic API key from the
 * org's stored credentials and writes the resulting digest into the
 * `standups` table with an upsert keyed on (user, org, date).
 */

import { db, standups, users, eq, sql } from '@tasknebula/db';

import { buildStandupDigest, StandupEvent } from './standup';
import { collectStandupEvents } from './standup-events';
import {
  getOrganizationSettingsForAgentCredentials,
  resolveProviderApiKeyFromSettings,
} from './credentials';

export interface RunStandupOptions {
  userId: string;
  organizationId: string;
  /** Defaults to "now - 24h" → "now". */
  windowStart?: Date;
  windowEnd?: Date;
  /** Extra events from sources outside the DB (e.g. GitHub commits). */
  extraEvents?: StandupEvent[];
  /** Skip persistence (preview mode). */
  persist?: boolean;
}

export interface RunStandupResult {
  date: string;
  contentMd: string;
  blockersMd: string;
  yesterday: string[];
  today: string[];
  blockers: string[];
  eventCount: number;
  recordId: string | null;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function runStandupForUser(options: RunStandupOptions): Promise<RunStandupResult> {
  const windowEnd = options.windowEnd ?? new Date();
  const windowStart = options.windowStart ?? new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);
  const dateKey = toDateKey(windowEnd);

  const settings = await getOrganizationSettingsForAgentCredentials(options.organizationId);
  const apiKey = resolveProviderApiKeyFromSettings(settings, 'anthropic');

  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, options.userId))
    .limit(1);

  if (!user) {
    throw new Error(`User ${options.userId} not found`);
  }

  const dbEvents = await collectStandupEvents({
    userId: options.userId,
    organizationId: options.organizationId,
    windowStart,
    windowEnd,
  });

  const events = [...(options.extraEvents ?? []), ...dbEvents];

  const digest = await buildStandupDigest({
    userId: options.userId,
    userName: user.name,
    events,
    windowStart,
    windowEnd,
    anthropicApiKey: apiKey,
    organizationId: options.organizationId,
  });

  let recordId: string | null = null;
  if (options.persist !== false) {
    // Upsert keyed on (user_id, organization_id, date) — matches the
    // unique index defined in the schema.
    const [row] = await db
      .insert(standups)
      .values({
        userId: options.userId,
        organizationId: options.organizationId,
        date: dateKey,
        contentMd: digest.contentMd,
        blockersMd: digest.blockersMd,
        sourceEvents: digest.sourceEvents,
      })
      .onConflictDoUpdate({
        target: [standups.userId, standups.organizationId, standups.date],
        set: {
          contentMd: digest.contentMd,
          blockersMd: digest.blockersMd,
          sourceEvents: digest.sourceEvents,
          createdAt: sql`now()`,
        },
      })
      .returning({ id: standups.id });
    recordId = row?.id ?? null;
  }

  return {
    date: dateKey,
    contentMd: digest.contentMd,
    blockersMd: digest.blockersMd,
    yesterday: digest.yesterday,
    today: digest.today,
    blockers: digest.blockers,
    eventCount: events.length,
    recordId,
  };
}

/** Resolve all active member IDs for an org. */
export async function listOrgMemberIds(organizationId: string): Promise<string[]> {
  const rows = await db.execute<{ user_id: string }>(
    sql`SELECT user_id FROM organization_members
        WHERE organization_id = ${organizationId} AND status = 'active'`
  );
  // node-postgres returns either { rows: [...] } or just an array — handle both.
  const list: Array<{ user_id: string }> = Array.isArray(rows)
    ? (rows as any)
    : ((rows as any).rows ?? []);
  return list.map((r) => r.user_id);
}
