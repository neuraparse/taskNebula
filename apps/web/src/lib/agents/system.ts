import { createId } from '@paralleldrive/cuid2';
import { db, eq, systemSettings } from '@tasknebula/db';
import {
  DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS,
  normalizeSystemAgentControlSettings,
  type SystemAgentControlSettings,
} from './config';

export const SYSTEM_AGENT_CONTROL_KEY = 'agent_control_center';

export async function getSystemAgentControlSettingsFromDb(): Promise<SystemAgentControlSettings> {
  const [setting] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, SYSTEM_AGENT_CONTROL_KEY))
    .limit(1);

  return normalizeSystemAgentControlSettings(setting?.value);
}

export async function upsertSystemAgentControlSettings(
  value: SystemAgentControlSettings,
  userId: string
) {
  const [existing] = await db
    .select({ id: systemSettings.id })
    .from(systemSettings)
    .where(eq(systemSettings.key, SYSTEM_AGENT_CONTROL_KEY))
    .limit(1);

  if (!existing) {
    const [created] = await db
      .insert(systemSettings)
      .values({
        id: createId(),
        key: SYSTEM_AGENT_CONTROL_KEY,
        category: 'features',
        description: 'Global controls for TaskNebula AI and agentic execution.',
        value,
        updatedBy: userId,
      })
      .returning();

    return created;
  }

  const [updated] = await db
    .update(systemSettings)
    .set({
      value,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(eq(systemSettings.id, existing.id))
    .returning();

  return updated;
}

export function ensureSystemAgentControlSettings(
  value: unknown
): SystemAgentControlSettings {
  return normalizeSystemAgentControlSettings(value ?? DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS);
}
