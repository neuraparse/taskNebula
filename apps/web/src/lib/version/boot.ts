/**
 * Boot-time version-change detection.
 *
 * Called once per server boot from `apps/web/instrumentation.ts`. Compares
 * the running version against the `last_boot_version` row in
 * `system_settings`; when an upgrade is detected, every super admin gets an
 * in-app notification ("TaskNebula updated to vX.Y.Z").
 *
 * Concurrency / idempotency (multi-replica boots):
 * The gate is a single conditional UPDATE —
 *   `UPDATE system_settings SET value = <current>
 *    WHERE key = 'last_boot_version' AND value->>'version' IS DISTINCT FROM <current>`
 * Under READ COMMITTED, concurrent replicas serialize on the row lock; the
 * loser re-evaluates the WHERE clause against the winner's committed value
 * and matches zero rows. Notifications are only inserted by the replica
 * whose UPDATE changed a row, so admins are notified at most once per
 * version transition. The first-ever boot seeds the row via
 * `INSERT ... ON CONFLICT DO NOTHING` (unique key) without notifying — a
 * fresh install is not an "update".
 *
 * Failure policy: everything is wrapped in try/catch — an unreachable or
 * un-migrated database must never crash or delay boot.
 */

import { db, systemSettings, notifications, users, eq, and, sql } from '@tasknebula/db';
import { getCurrentVersion, GITHUB_REPO_URL } from './index';
import { getVersionUpdatePreferences } from './preferences';

export const LAST_BOOT_VERSION_KEY = 'last_boot_version';

export async function handleBootVersionChange(): Promise<void> {
  try {
    const current = getCurrentVersion();
    const nextValue = { version: current, bootedAt: new Date().toISOString() };

    // Previous version, for message context only — the conditional UPDATE
    // below is the idempotency gate, not this read.
    const [existing] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, LAST_BOOT_VERSION_KEY))
      .limit(1);
    const existingValue = existing?.value as Record<string, unknown> | undefined | null;
    const previous = typeof existingValue?.version === 'string' ? existingValue.version : null;

    const updated = await db
      .update(systemSettings)
      .set({ value: nextValue, updatedAt: new Date() })
      .where(
        and(
          eq(systemSettings.key, LAST_BOOT_VERSION_KEY),
          sql`${systemSettings.value}->>'version' IS DISTINCT FROM ${current}`
        )
      )
      .returning({ id: systemSettings.id });

    if (updated.length === 0) {
      // Row already records the current version (normal restart, or another
      // replica won the race) — or no row exists yet. Seed the baseline
      // silently; ON CONFLICT covers concurrent first boots.
      await db
        .insert(systemSettings)
        .values({
          key: LAST_BOOT_VERSION_KEY,
          value: nextValue,
          category: 'general',
          description:
            'Version recorded at the last web server boot — drives the post-upgrade super-admin notification.',
        })
        .onConflictDoNothing({ target: systemSettings.key });
      return;
    }

    // Exactly one replica reaches this point per version transition.
    await notifySuperAdminsOfUpgrade(current, previous);
  } catch (err) {
    console.warn('[version] boot version detection skipped:', err);
  }
}

async function notifySuperAdminsOfUpgrade(current: string, previous: string | null): Promise<void> {
  const preferences = await getVersionUpdatePreferences();
  if (!preferences.postUpdateNotificationsEnabled) return;

  const admins = await db.select({ id: users.id }).from(users).where(eq(users.isSuperAdmin, true));
  if (admins.length === 0) return;

  const releaseUrl = `${GITHUB_REPO_URL}/releases/tag/v${current}`;
  const fromPart = previous ? ` (previously v${previous})` : '';
  // The notifications table has no metadata/link column, so the admin
  // updates path and the GitHub release URL ride along in the message body.
  const message =
    `This instance is now running TaskNebula v${current}${fromPart}. ` +
    `Review what changed under Admin > Updates (/admin?tab=updates) or on GitHub: ${releaseUrl}`;

  try {
    await db.insert(notifications).values(
      admins.map((admin) => ({
        userId: admin.id,
        // 'issue_updated' is reused deliberately: it exists in the
        // notification_type pg enum and the client union, and the bell UI
        // renders unmapped types with the default Bell icon + "update" chip.
        // Adding a dedicated 'system_update' enum value needs a hand-written
        // migration owned elsewhere.
        type: 'issue_updated' as const,
        title: `TaskNebula updated to v${current}`,
        message,
        actorType: 'system' as const,
      }))
    );
  } catch (err) {
    console.warn('[version] failed to insert upgrade notifications:', err);
  }
}
