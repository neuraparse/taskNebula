import { createId } from '@paralleldrive/cuid2';
import { db, eq, systemSettings } from '@tasknebula/db';

export const REGISTRATION_POLICY_KEY = 'registration_policy';

export const REGISTRATION_MODES = [
  'allow_registration',
  'invite_only',
  'admin_created_only',
] as const;

export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

export type RegistrationPolicy = {
  mode: RegistrationMode;
  updatedAt?: string;
  updatedBy?: string;
};

export const DEFAULT_REGISTRATION_POLICY: RegistrationPolicy = {
  mode: 'allow_registration',
};

export function isRegistrationMode(value: unknown): value is RegistrationMode {
  return typeof value === 'string' && REGISTRATION_MODES.includes(value as RegistrationMode);
}

export function normalizeRegistrationPolicy(value: unknown): RegistrationPolicy {
  const raw = (value as Record<string, unknown>) || {};
  const modeCandidate = typeof value === 'string' ? value : raw.mode;

  return {
    mode: isRegistrationMode(modeCandidate) ? modeCandidate : DEFAULT_REGISTRATION_POLICY.mode,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

export async function getRegistrationPolicy(): Promise<RegistrationPolicy> {
  const [setting] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, REGISTRATION_POLICY_KEY))
    .limit(1);

  return normalizeRegistrationPolicy(setting?.value);
}

export async function upsertRegistrationPolicy(
  mode: RegistrationMode,
  userId: string
): Promise<RegistrationPolicy> {
  const next: RegistrationPolicy = {
    mode,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };

  const [existing] = await db
    .select({ id: systemSettings.id })
    .from(systemSettings)
    .where(eq(systemSettings.key, REGISTRATION_POLICY_KEY))
    .limit(1);

  if (!existing) {
    await db.insert(systemSettings).values({
      id: createId(),
      key: REGISTRATION_POLICY_KEY,
      category: 'security',
      description: 'Controls who can create TaskNebula accounts through public signup.',
      value: next,
      updatedBy: userId,
    });
    return next;
  }

  await db
    .update(systemSettings)
    .set({ value: next, updatedAt: new Date(), updatedBy: userId })
    .where(eq(systemSettings.id, existing.id));

  return next;
}
