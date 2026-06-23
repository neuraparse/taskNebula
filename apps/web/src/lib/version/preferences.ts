import { db, eq, systemSettings } from '@tasknebula/db';

export const VERSION_UPDATE_PREFERENCES_KEY = 'version_update_preferences';

export type VersionUpdatePreferences = {
  bannerEnabled: boolean;
  availableUpdateNotificationsEnabled: boolean;
  postUpdateNotificationsEnabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type VersionUpdatePreferencesInput = Partial<
  Pick<
    VersionUpdatePreferences,
    'bannerEnabled' | 'availableUpdateNotificationsEnabled' | 'postUpdateNotificationsEnabled'
  >
>;

const DEFAULT_VERSION_UPDATE_PREFERENCES: Omit<
  VersionUpdatePreferences,
  'updatedAt' | 'updatedBy'
> = {
  bannerEnabled: true,
  availableUpdateNotificationsEnabled: true,
  postUpdateNotificationsEnabled: true,
};

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeVersionUpdatePreferences(
  value: unknown,
  metadata: { updatedAt?: Date | string | null; updatedBy?: string | null } = {}
): VersionUpdatePreferences {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    bannerEnabled: normalizeBoolean(
      raw.bannerEnabled,
      DEFAULT_VERSION_UPDATE_PREFERENCES.bannerEnabled
    ),
    availableUpdateNotificationsEnabled: normalizeBoolean(
      raw.availableUpdateNotificationsEnabled,
      DEFAULT_VERSION_UPDATE_PREFERENCES.availableUpdateNotificationsEnabled
    ),
    postUpdateNotificationsEnabled: normalizeBoolean(
      raw.postUpdateNotificationsEnabled,
      DEFAULT_VERSION_UPDATE_PREFERENCES.postUpdateNotificationsEnabled
    ),
    updatedAt:
      typeof raw.updatedAt === 'string'
        ? raw.updatedAt
        : metadata.updatedAt instanceof Date
          ? metadata.updatedAt.toISOString()
          : typeof metadata.updatedAt === 'string'
            ? metadata.updatedAt
            : null,
    updatedBy:
      typeof raw.updatedBy === 'string'
        ? raw.updatedBy
        : typeof metadata.updatedBy === 'string'
          ? metadata.updatedBy
          : null,
  };
}

export async function getVersionUpdatePreferences(): Promise<VersionUpdatePreferences> {
  try {
    const [row] = await db
      .select({
        value: systemSettings.value,
        updatedAt: systemSettings.updatedAt,
        updatedBy: systemSettings.updatedBy,
      })
      .from(systemSettings)
      .where(eq(systemSettings.key, VERSION_UPDATE_PREFERENCES_KEY))
      .limit(1);

    return normalizeVersionUpdatePreferences(row?.value, {
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    });
  } catch (err) {
    console.warn('[version] failed to read update preferences:', err);
    return normalizeVersionUpdatePreferences(null);
  }
}

export async function updateVersionUpdatePreferences(
  input: VersionUpdatePreferencesInput,
  userId: string
): Promise<VersionUpdatePreferences> {
  const current = await getVersionUpdatePreferences();
  const now = new Date();
  const next: VersionUpdatePreferences = {
    ...current,
    ...input,
    updatedAt: now.toISOString(),
    updatedBy: userId,
  };

  await db
    .insert(systemSettings)
    .values({
      key: VERSION_UPDATE_PREFERENCES_KEY,
      value: next,
      category: 'general',
      description:
        'Super-admin preferences for TaskNebula update banners and in-app update notifications.',
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: next, updatedAt: now, updatedBy: userId },
    });

  return next;
}
