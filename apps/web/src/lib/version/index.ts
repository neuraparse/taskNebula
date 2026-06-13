/**
 * TaskNebula version utilities — current version, update check, and cache.
 *
 * The entire outbound update-check surface lives in this one file so
 * security-conscious self-hosters can audit it quickly:
 *
 *   - One HTTPS GET to the GitHub releases API (`RELEASES_LATEST_URL`), at
 *     most once per `VERSION_CHECK_TTL_MS` (6h), only when an admin surface
 *     asks for update status. No instance data is sent beyond a
 *     `tasknebula/<version>` User-Agent. This is not telemetry.
 *   - `TASKNEBULA_DISABLE_UPDATE_CHECK=true` disables all outbound calls.
 *   - Results are cached in the `system_settings` table (key
 *     `version_check`) so multi-replica deployments share one cache.
 *   - Every failure mode (offline, 403/429, bad JSON, DB down) fails soft:
 *     callers get the last cached value or `null`, never an exception.
 */

import { db, systemSettings, eq } from '@tasknebula/db';
import pkg from '../../../package.json';

export const VERSION_CHECK_KEY = 'version_check';
export const GITHUB_REPO_URL = 'https://github.com/neuraparse/taskNebula';
export const RELEASES_LATEST_URL =
  'https://api.github.com/repos/neuraparse/taskNebula/releases/latest';

/** Cached check is considered fresh for 6 hours. */
export const VERSION_CHECK_TTL_MS = 6 * 60 * 60 * 1000;
/** Outbound fetch hard timeout. A slow GitHub must never hang an admin request. */
const FETCH_TIMEOUT_MS = 10_000;
/** Release notes are stored truncated — they render in a small admin panel. */
const NOTES_MAX_CHARS = 2000;

/**
 * Accepts `1.2.3` / `v1.2.3` with an optional pre-release suffix. Anything
 * else (including attacker-ish strings from an overridden endpoint) is
 * rejected before storage or display.
 */
const SEMVERISH = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export type VersionCheckState = {
  /** Latest published version, normalized without the leading `v`. */
  latest: string;
  htmlUrl: string | null;
  publishedAt: string | null;
  /** First {@link NOTES_MAX_CHARS} chars of the release body. */
  notes: string | null;
  /** ISO timestamp of the successful upstream fetch. */
  fetchedAt: string;
};

export type UpdateStatus = {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
  notes: string | null;
  checkedAt: string | null;
  /** True when TASKNEBULA_DISABLE_UPDATE_CHECK suppresses all checks. */
  checkDisabled: boolean;
};

// ---------------------------------------------------------------------------
// Current version
// ---------------------------------------------------------------------------

/**
 * The version of the running build.
 *
 * `process.env.npm_package_version` is NOT used — the Docker standalone
 * runtime starts via `node apps/web/server.js`, where it is undefined.
 * Importing package.json bakes the version into the bundle at build time.
 * `TASKNEBULA_VERSION` (when set to a valid semver) wins, so release
 * tooling can stamp images explicitly.
 */
export function getCurrentVersion(): string {
  const envVersion = process.env.TASKNEBULA_VERSION;
  if (typeof envVersion === 'string' && SEMVERISH.test(envVersion.trim())) {
    return stripV(envVersion.trim());
  }
  return pkg.version;
}

export function isUpdateCheckDisabled(): boolean {
  const flag = process.env.TASKNEBULA_DISABLE_UPDATE_CHECK;
  return flag === 'true' || flag === '1';
}

// ---------------------------------------------------------------------------
// Semver compare (tiny, dependency-free)
// ---------------------------------------------------------------------------

function stripV(version: string): string {
  return version.startsWith('v') || version.startsWith('V') ? version.slice(1) : version;
}

type ParsedSemver = {
  core: [number, number, number];
  prerelease: string[];
};

function parseSemver(version: string): ParsedSemver | null {
  const trimmed = version.trim();
  if (!SEMVERISH.test(trimmed)) return null;
  const withoutV = stripV(trimmed);
  const dashIdx = withoutV.indexOf('-');
  const corePart = dashIdx === -1 ? withoutV : withoutV.slice(0, dashIdx);
  const prereleasePart = dashIdx === -1 ? '' : withoutV.slice(dashIdx + 1);
  const nums = corePart.split('.').map((n) => parseInt(n, 10));
  const [major, minor, patch] = nums;
  if (
    nums.length !== 3 ||
    major === undefined ||
    minor === undefined ||
    patch === undefined ||
    !Number.isFinite(major) ||
    !Number.isFinite(minor) ||
    !Number.isFinite(patch)
  ) {
    return null;
  }
  return {
    core: [major, minor, patch],
    prerelease: prereleasePart ? prereleasePart.split('.') : [],
  };
}

/**
 * Compare two semver strings (leading `v` tolerated).
 * Returns >0 when `a` is newer, <0 when older, 0 when equal.
 * Unparseable input compares as equal — callers fail soft to "no update".
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;

  for (let i = 0; i < 3; i++) {
    const ca = pa.core[i] ?? 0;
    const cb = pb.core[i] ?? 0;
    if (ca !== cb) return ca - cb;
  }

  // Per semver spec: a pre-release sorts BELOW the plain release.
  if (pa.prerelease.length === 0 && pb.prerelease.length === 0) return 0;
  if (pa.prerelease.length === 0) return 1;
  if (pb.prerelease.length === 0) return -1;

  const len = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < len; i++) {
    const ia = pa.prerelease[i];
    const ib = pb.prerelease[i];
    // Fewer identifiers sorts lower when all preceding ones are equal.
    if (ia === undefined) return -1;
    if (ib === undefined) return 1;
    const na = /^\d+$/.test(ia) ? parseInt(ia, 10) : null;
    const nb = /^\d+$/.test(ib) ? parseInt(ib, 10) : null;
    if (na !== null && nb !== null) {
      if (na !== nb) return na - nb;
    } else if (na !== null) {
      return -1; // numeric identifiers sort below alphanumeric ones
    } else if (nb !== null) {
      return 1;
    } else if (ia !== ib) {
      return ia < ib ? -1 : 1;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// system_settings cache (key: version_check)
// ---------------------------------------------------------------------------

function normalizeVersionCheckState(value: unknown): VersionCheckState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.latest !== 'string' || !SEMVERISH.test(raw.latest)) return null;
  if (typeof raw.fetchedAt !== 'string' || Number.isNaN(Date.parse(raw.fetchedAt))) return null;
  return {
    latest: stripV(raw.latest),
    htmlUrl: typeof raw.htmlUrl === 'string' ? raw.htmlUrl : null,
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : null,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, NOTES_MAX_CHARS) : null,
    fetchedAt: raw.fetchedAt,
  };
}

async function readCachedVersionCheck(): Promise<VersionCheckState | null> {
  try {
    const [row] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, VERSION_CHECK_KEY))
      .limit(1);
    return normalizeVersionCheckState(row?.value);
  } catch (err) {
    console.warn('[version] failed to read cached version check:', err);
    return null;
  }
}

async function writeVersionCheck(state: VersionCheckState): Promise<void> {
  try {
    await db
      .insert(systemSettings)
      .values({
        key: VERSION_CHECK_KEY,
        value: state,
        category: 'general',
        description:
          'Cached result of the GitHub releases update check (see apps/web/src/lib/version).',
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: state, updatedAt: new Date() },
      });
  } catch (err) {
    // A failed cache write only costs an extra fetch on the next call.
    console.warn('[version] failed to persist version check result:', err);
  }
}

// ---------------------------------------------------------------------------
// Upstream fetch
// ---------------------------------------------------------------------------

async function fetchLatestRelease(currentVersion: string): Promise<VersionCheckState | null> {
  // Manual AbortController instead of AbortSignal.timeout for jsdom/test
  // compatibility; the timer is always cleared.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(RELEASES_LATEST_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `tasknebula/${currentVersion}`,
      },
      // We manage our own TTL in system_settings — bypass Next's data cache.
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const release: unknown = await res.json().catch(() => null);
    if (!release || typeof release !== 'object') return null;
    const raw = release as Record<string, unknown>;

    const tag = typeof raw.tag_name === 'string' ? raw.tag_name.trim() : '';
    if (!SEMVERISH.test(tag)) return null;

    const htmlUrl =
      typeof raw.html_url === 'string' && raw.html_url.startsWith('https://') ? raw.html_url : null;

    return {
      latest: stripV(tag),
      htmlUrl,
      publishedAt: typeof raw.published_at === 'string' ? raw.published_at : null,
      notes: typeof raw.body === 'string' ? raw.body.slice(0, NOTES_MAX_CHARS) : null,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    // Network error / timeout — silent by design; callers fall back to cache.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the latest published release, honoring the 6h cache TTL.
 *
 * - Disabled via env → `null`, no network and no DB access.
 * - Fresh cache → cached state, no network.
 * - Stale/missing cache (or `forceRefresh`) → one upstream fetch; on success
 *   the result is persisted, on failure the stale cache (or `null`) is
 *   returned. Never throws.
 */
export async function checkLatestVersion(
  options: { forceRefresh?: boolean } = {}
): Promise<VersionCheckState | null> {
  if (isUpdateCheckDisabled()) return null;

  const cached = await readCachedVersionCheck();
  if (cached && !options.forceRefresh) {
    const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
    if (ageMs >= 0 && ageMs < VERSION_CHECK_TTL_MS) {
      return cached;
    }
  }

  const fresh = await fetchLatestRelease(getCurrentVersion());
  if (!fresh) return cached;

  await writeVersionCheck(fresh);
  return fresh;
}

/**
 * Assembles the admin-facing update status (consumed by
 * `GET /api/admin/version`).
 */
export async function getUpdateStatus(options: { refresh?: boolean } = {}): Promise<UpdateStatus> {
  const current = getCurrentVersion();
  if (isUpdateCheckDisabled()) {
    return {
      current,
      latest: null,
      updateAvailable: false,
      releaseUrl: null,
      publishedAt: null,
      notes: null,
      checkedAt: null,
      checkDisabled: true,
    };
  }

  const state = await checkLatestVersion({ forceRefresh: options.refresh === true });
  return {
    current,
    latest: state?.latest ?? null,
    updateAvailable: state ? compareSemver(state.latest, current) > 0 : false,
    releaseUrl: state?.htmlUrl ?? null,
    publishedAt: state?.publishedAt ?? null,
    notes: state?.notes ?? null,
    checkedAt: state?.fetchedAt ?? null,
    checkDisabled: false,
  };
}
