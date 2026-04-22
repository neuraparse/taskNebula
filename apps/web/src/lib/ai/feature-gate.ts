/**
 * Feature-flag gate for AI/agent endpoints.
 *
 * Source of truth: systemSettings.value.globalEnabled (DB row keyed by
 * `agent_control_center`). Managed from Admin → Agent control.
 *
 * When the flag is false we return 404 so the surface is indistinguishable
 * from a codebase that never shipped AI — no leaks, no enablement hints.
 *
 * In-process cache (5s TTL) avoids pounding the DB on every request.
 * Admin mutations call `invalidateAiFeatureCache()` to drop the cache
 * immediately after a toggle.
 */

import { NextResponse } from 'next/server';
import { getSystemAgentControlSettingsFromDb } from '@/lib/agents/system';

const CACHE_TTL_MS = 5_000;

type CacheEntry = {
  value: boolean;
  expiresAt: number;
};

let cache: CacheEntry | null = null;

export function invalidateAiFeatureCache(): void {
  cache = null;
}

export async function isAiFeatureEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  try {
    const settings = await getSystemAgentControlSettingsFromDb();
    const value = settings.globalEnabled === true;
    cache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  } catch (err) {
    // Database unavailable — fail closed (AI off).
    console.warn('isAiFeatureEnabled: failed to read systemSettings', err);
    return false;
  }
}

export function aiDisabledResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
