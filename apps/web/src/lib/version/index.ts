/**
 * TaskNebula version utilities — current version, update check, and cache.
 *
 * The entire outbound update-check surface lives in this one file so
 * security-conscious self-hosters can audit it quickly:
 *
 *   - HTTPS GETs to the GitHub releases API (`RELEASES_LATEST_URL`) and the
 *     Docker Hub tags API (`DOCKER_HUB_TAGS_URL`), at most once per
 *     `VERSION_CHECK_TTL_MS` (6h), only when an admin surface asks for update
 *     status. No instance data is sent beyond a `tasknebula/<version>`
 *     User-Agent. This is not telemetry.
 *   - `TASKNEBULA_DISABLE_UPDATE_CHECK=true` disables all outbound calls.
 *   - Results are cached in the `system_settings` table (key
 *     `version_check`) so multi-replica deployments share one cache.
 *   - Every failure mode (offline, 403/429, bad JSON, DB down) fails soft:
 *     callers get the last cached value or `null`, never an exception.
 */

import { db, systemSettings, notifications, users, eq, and, sql } from '@tasknebula/db';
import pkg from '../../../package.json';

export const VERSION_CHECK_KEY = 'version_check';
export const UPDATE_NOTIFICATION_KEY = 'version_update_notification';
export const GITHUB_REPO_URL = 'https://github.com/neuraparse/taskNebula';
export const RELEASES_LATEST_URL =
  'https://api.github.com/repos/neuraparse/taskNebula/releases/latest';
export const DOCKER_HUB_REPOSITORY = 'neuraparse/tasknebula';
export const DOCKER_HUB_TAGS_URL =
  'https://hub.docker.com/v2/namespaces/neuraparse/repositories/tasknebula/tags?page_size=100';

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

export type ReleaseCheckState = {
  /** Latest published version, normalized without the leading `v`. */
  latest: string;
  htmlUrl: string | null;
  publishedAt: string | null;
  /** First {@link NOTES_MAX_CHARS} chars of the release body. */
  notes: string | null;
};

export type DockerImageCheckState = {
  repository: string;
  /** Most recently pushed semver image tag, normalized without the leading `v`. */
  latestTag: string;
  tagUrl: string | null;
  pushedAt: string | null;
  digest: string | null;
  sizeBytes: number | null;
};

export type VersionCheckState = {
  release: ReleaseCheckState | null;
  docker: DockerImageCheckState | null;
  /** ISO timestamp of the successful upstream fetch batch. */
  fetchedAt: string;
};

export type UpdateStatus = {
  current: string;
  latest: string | null;
  releaseUpdateAvailable: boolean;
  updateAvailable: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
  notes: string | null;
  checkedAt: string | null;
  image: {
    repository: string;
    latestTag: string | null;
    latestTagUrl: string | null;
    latestPushedAt: string | null;
    latestDigest: string | null;
    latestSizeBytes: number | null;
    updateAvailable: boolean;
    checkedAt: string | null;
  };
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

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function normalizeReleaseCheckState(value: unknown): ReleaseCheckState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.latest !== 'string' || !SEMVERISH.test(raw.latest)) return null;
  return {
    latest: stripV(raw.latest),
    htmlUrl: typeof raw.htmlUrl === 'string' ? raw.htmlUrl : null,
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : null,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, NOTES_MAX_CHARS) : null,
  };
}

function normalizeDockerImageCheckState(value: unknown): DockerImageCheckState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.latestTag !== 'string' || !SEMVERISH.test(raw.latestTag)) return null;
  return {
    repository:
      typeof raw.repository === 'string' && raw.repository ? raw.repository : DOCKER_HUB_REPOSITORY,
    latestTag: stripV(raw.latestTag),
    tagUrl: typeof raw.tagUrl === 'string' && raw.tagUrl.startsWith('https://') ? raw.tagUrl : null,
    pushedAt: typeof raw.pushedAt === 'string' ? raw.pushedAt : null,
    digest:
      typeof raw.digest === 'string' && /^sha256:[0-9a-f]{64}$/i.test(raw.digest)
        ? raw.digest
        : null,
    sizeBytes:
      typeof raw.sizeBytes === 'number' && Number.isFinite(raw.sizeBytes) ? raw.sizeBytes : null,
  };
}

function normalizeVersionCheckState(value: unknown): VersionCheckState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  // Back-compat for the pre-Docker-Hub cache shape:
  // { latest, htmlUrl, publishedAt, notes, fetchedAt }.
  if (typeof raw.latest === 'string') {
    if (!isIsoDateString(raw.fetchedAt)) return null;
    const release = normalizeReleaseCheckState(raw);
    if (!release) return null;
    return {
      release,
      docker: null,
      fetchedAt: raw.fetchedAt,
    };
  }

  if (!isIsoDateString(raw.fetchedAt)) return null;
  const release = raw.release === null ? null : normalizeReleaseCheckState(raw.release);
  const docker = raw.docker === null ? null : normalizeDockerImageCheckState(raw.docker);

  if (!release && !docker) return null;

  return {
    release,
    docker,
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
          'Cached result of the GitHub release and Docker Hub image update checks (see apps/web/src/lib/version).',
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

async function fetchLatestRelease(currentVersion: string): Promise<ReleaseCheckState | null> {
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
    };
  } catch {
    // Network error / timeout — silent by design; callers fall back to cache.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function dockerTagUrl(tag: string): string {
  return `https://hub.docker.com/r/${DOCKER_HUB_REPOSITORY}/tags?name=${encodeURIComponent(tag)}`;
}

function readDockerTagTimestamp(raw: Record<string, unknown>): string | null {
  const candidates = [raw.tag_last_pushed, raw.last_updated];
  for (const candidate of candidates) {
    if (isIsoDateString(candidate)) return candidate;
  }
  return null;
}

function readDockerTagDigest(raw: Record<string, unknown>): string | null {
  const candidate = typeof raw.digest === 'string' ? raw.digest : null;
  if (candidate && /^sha256:[0-9a-f]{64}$/i.test(candidate)) return candidate;
  const images = Array.isArray(raw.images) ? raw.images : [];
  for (const image of images) {
    if (!image || typeof image !== 'object') continue;
    const digest = (image as Record<string, unknown>).digest;
    if (typeof digest === 'string' && /^sha256:[0-9a-f]{64}$/i.test(digest)) {
      return digest;
    }
  }
  return null;
}

function normalizeDockerTag(raw: unknown): DockerImageCheckState | null {
  if (!raw || typeof raw !== 'object') return null;
  const tag = raw as Record<string, unknown>;
  const name = typeof tag.name === 'string' ? tag.name.trim() : '';
  if (!SEMVERISH.test(name)) return null;

  return {
    repository: DOCKER_HUB_REPOSITORY,
    latestTag: stripV(name),
    tagUrl: dockerTagUrl(name),
    pushedAt: readDockerTagTimestamp(tag),
    digest: readDockerTagDigest(tag),
    sizeBytes:
      typeof tag.full_size === 'number' && Number.isFinite(tag.full_size) ? tag.full_size : null,
  };
}

function compareDockerImageFreshness(a: DockerImageCheckState, b: DockerImageCheckState): number {
  const aTime = a.pushedAt ? Date.parse(a.pushedAt) : 0;
  const bTime = b.pushedAt ? Date.parse(b.pushedAt) : 0;
  if (aTime !== bTime) return bTime - aTime;
  return compareSemver(b.latestTag, a.latestTag);
}

async function fetchLatestDockerImage(
  currentVersion: string
): Promise<DockerImageCheckState | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(DOCKER_HUB_TAGS_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': `tasknebula/${currentVersion}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const payload: unknown = await res.json().catch(() => null);
    if (!payload || typeof payload !== 'object') return null;
    const results = (payload as Record<string, unknown>).results;
    if (!Array.isArray(results)) return null;

    return (
      results
        .map((tag) => normalizeDockerTag(tag))
        .filter((tag): tag is DockerImageCheckState => Boolean(tag))
        .sort(compareDockerImageFreshness)[0] ?? null
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLatestVersionState(currentVersion: string): Promise<VersionCheckState | null> {
  const [release, docker] = await Promise.all([
    fetchLatestRelease(currentVersion),
    fetchLatestDockerImage(currentVersion),
  ]);

  if (!release && !docker) return null;

  return {
    release,
    docker,
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the latest published release/image metadata, honoring the 6h cache TTL.
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

  const fresh = await fetchLatestVersionState(getCurrentVersion());
  if (!fresh) return cached;

  await writeVersionCheck(fresh);
  return fresh;
}

function pickNewestKnownVersion(...versions: Array<string | null | undefined>): string | null {
  const valid = versions.filter(
    (version): version is string => typeof version === 'string' && SEMVERISH.test(version)
  );
  if (valid.length === 0) return null;
  return valid.sort((a, b) => compareSemver(b, a))[0] ?? null;
}

type UpdateNotificationSource = 'release' | 'docker' | 'release_and_docker';

function getUpdateNotificationSource(status: UpdateStatus): UpdateNotificationSource {
  if (status.releaseUpdateAvailable && status.image.updateAvailable) return 'release_and_docker';
  if (status.image.updateAvailable) return 'docker';
  return 'release';
}

async function rememberUpdateNotification(
  status: UpdateStatus,
  source: UpdateNotificationSource
): Promise<boolean> {
  if (!status.latest) return false;

  const now = new Date();
  const value = {
    version: status.latest,
    current: status.current,
    source,
    repository: status.image.repository,
    detectedAt: now.toISOString(),
  };

  const inserted = await db
    .insert(systemSettings)
    .values({
      key: UPDATE_NOTIFICATION_KEY,
      value,
      category: 'general',
      description: 'Last upstream version update notification sent to super admins.',
    })
    .onConflictDoNothing({ target: systemSettings.key })
    .returning({ id: systemSettings.id });

  if (inserted.length > 0) return true;

  const updated = await db
    .update(systemSettings)
    .set({ value, updatedAt: now })
    .where(
      and(
        eq(systemSettings.key, UPDATE_NOTIFICATION_KEY),
        sql`${systemSettings.value}->>'version' IS DISTINCT FROM ${status.latest}`
      )
    )
    .returning({ id: systemSettings.id });

  return updated.length > 0;
}

function buildAvailableUpdateMessage(
  status: UpdateStatus,
  source: UpdateNotificationSource
): string {
  const latest = status.latest ? `v${status.latest}` : 'a new version';
  const dockerTag = status.image.latestTag ? `:${status.image.latestTag}` : '';
  const sourceSentence =
    source === 'docker'
      ? `Docker Hub published ${status.image.repository}${dockerTag}.`
      : source === 'release_and_docker'
        ? `GitHub and Docker Hub published TaskNebula ${latest}.`
        : `GitHub published TaskNebula ${latest}.`;

  return (
    `${sourceSentence} This instance is running v${status.current}. ` +
    'Open Admin > Updates (/admin?tab=updates) to review release notes and run: ' +
    'docker compose pull && docker compose up -d web.'
  );
}

async function notifySuperAdminsOfAvailableUpdate(status: UpdateStatus): Promise<void> {
  if (!status.updateAvailable || !status.latest) return;

  const source = getUpdateNotificationSource(status);

  try {
    const shouldNotify = await rememberUpdateNotification(status, source);
    if (!shouldNotify) return;

    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isSuperAdmin, true));
    if (!Array.isArray(admins) || admins.length === 0) return;

    await db.insert(notifications).values(
      admins.map((admin) => ({
        userId: admin.id,
        // Reuse an existing enum value so this notification works without a
        // database enum migration; the inbox still marks it as a system actor.
        type: 'issue_updated' as const,
        title: `TaskNebula v${status.latest} is available`,
        message: buildAvailableUpdateMessage(status, source),
        actorType: 'system' as const,
      }))
    );
  } catch (err) {
    console.warn('[version] failed to insert available-update notifications:', err);
  }
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
      releaseUpdateAvailable: false,
      updateAvailable: false,
      releaseUrl: null,
      publishedAt: null,
      notes: null,
      checkedAt: null,
      image: {
        repository: DOCKER_HUB_REPOSITORY,
        latestTag: null,
        latestTagUrl: null,
        latestPushedAt: null,
        latestDigest: null,
        latestSizeBytes: null,
        updateAvailable: false,
        checkedAt: null,
      },
      checkDisabled: true,
    };
  }

  const state = await checkLatestVersion({ forceRefresh: options.refresh === true });
  const release = state?.release ?? null;
  const docker = state?.docker ?? null;
  const releaseUpdateAvailable = release ? compareSemver(release.latest, current) > 0 : false;
  const imageUpdateAvailable = docker ? compareSemver(docker.latestTag, current) > 0 : false;
  const latest = pickNewestKnownVersion(release?.latest, docker?.latestTag);

  const status: UpdateStatus = {
    current,
    latest,
    releaseUpdateAvailable,
    updateAvailable: releaseUpdateAvailable || imageUpdateAvailable,
    releaseUrl: release?.htmlUrl ?? null,
    publishedAt: release?.publishedAt ?? null,
    notes: release?.notes ?? null,
    checkedAt: state?.fetchedAt ?? null,
    image: {
      repository: docker?.repository ?? DOCKER_HUB_REPOSITORY,
      latestTag: docker?.latestTag ?? null,
      latestTagUrl: docker?.tagUrl ?? null,
      latestPushedAt: docker?.pushedAt ?? null,
      latestDigest: docker?.digest ?? null,
      latestSizeBytes: docker?.sizeBytes ?? null,
      updateAvailable: imageUpdateAvailable,
      checkedAt: state?.fetchedAt ?? null,
    },
    checkDisabled: false,
  };

  await notifySuperAdminsOfAvailableUpdate(status);

  return status;
}
