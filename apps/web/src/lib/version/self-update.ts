import crypto from 'node:crypto';
import { db, eq, sql, systemAuditLogs, systemSettings } from '@tasknebula/db';
import { compareSemver, type UpdateStatus } from './index';

export const SELF_UPDATE_JOB_KEY = 'version_self_update_job';

const SEMVERISH = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const DOCKER_DIGEST = /^sha256:[0-9a-f]{64}$/i;
const WEBHOOK_TIMEOUT_MS = 15_000;
const ACTIVE_JOB_TTL_MS = 60 * 60 * 1000;

export type SelfUpdateJobStatus = 'queued' | 'requested' | 'succeeded' | 'failed';

export type SelfUpdateJob = {
  id: string;
  status: SelfUpdateJobStatus;
  currentVersion: string;
  targetVersion: string;
  repository: string;
  imageTag: string;
  digest: string | null;
  releaseUrl: string | null;
  triggeredBy: string;
  createdAt: string;
  updatedAt: string;
  requestedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  webhookStatus: number | null;
};

export type SelfUpdateBlockedReason =
  | 'disabled'
  | 'missing_webhook'
  | 'missing_secret'
  | 'checks_disabled'
  | 'no_update'
  | 'missing_docker_image'
  | 'invalid_target'
  | 'active_job';

export type SelfUpdateStatus = {
  enabled: boolean;
  available: boolean;
  mode: 'external-webhook' | 'manual';
  blockedReason: SelfUpdateBlockedReason | null;
  targetVersion: string | null;
  repository: string;
  digest: string | null;
  webhookConfigured: boolean;
  manualCommands: string;
  job: SelfUpdateJob | null;
};

export type SelfUpdateStartInput = {
  targetVersion: string;
  acknowledged: boolean;
  triggeredBy: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  status: UpdateStatus;
};

export class SelfUpdateError extends Error {
  status: number;
  reason: SelfUpdateBlockedReason | 'not_acknowledged' | 'webhook_failed';

  constructor(
    message: string,
    status: number,
    reason: SelfUpdateBlockedReason | 'not_acknowledged' | 'webhook_failed'
  ) {
    super(message);
    this.name = 'SelfUpdateError';
    this.status = status;
    this.reason = reason;
  }
}

function boolEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function cleanUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function stripV(version: string): string {
  return version.trim().replace(/^v/i, '');
}

function normalizeTargetVersion(version: string): string | null {
  const trimmed = version.trim();
  if (!SEMVERISH.test(trimmed)) return null;
  return stripV(trimmed);
}

function isActiveJob(job: SelfUpdateJob | null): boolean {
  if (!job || (job.status !== 'queued' && job.status !== 'requested')) return false;
  const updatedAt = Date.parse(job.updatedAt);
  if (!Number.isFinite(updatedAt)) return false;
  return Date.now() - updatedAt < ACTIVE_JOB_TTL_MS;
}

function normalizeJob(value: unknown): SelfUpdateJob | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const status = raw.status;
  if (
    status !== 'queued' &&
    status !== 'requested' &&
    status !== 'succeeded' &&
    status !== 'failed'
  ) {
    return null;
  }

  const targetVersion =
    typeof raw.targetVersion === 'string' ? normalizeTargetVersion(raw.targetVersion) : null;
  const currentVersion =
    typeof raw.currentVersion === 'string' ? normalizeTargetVersion(raw.currentVersion) : null;
  const imageTag = typeof raw.imageTag === 'string' ? normalizeTargetVersion(raw.imageTag) : null;
  const repository = typeof raw.repository === 'string' ? raw.repository.trim() : '';
  const digest =
    typeof raw.digest === 'string' && DOCKER_DIGEST.test(raw.digest) ? raw.digest : null;
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : '';
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : '';

  if (
    typeof raw.id !== 'string' ||
    !targetVersion ||
    !currentVersion ||
    !imageTag ||
    !repository ||
    Number.isNaN(Date.parse(createdAt)) ||
    Number.isNaN(Date.parse(updatedAt)) ||
    typeof raw.triggeredBy !== 'string'
  ) {
    return null;
  }

  return {
    id: raw.id,
    status,
    currentVersion,
    targetVersion,
    repository,
    imageTag,
    digest,
    releaseUrl:
      typeof raw.releaseUrl === 'string' && raw.releaseUrl.startsWith('https://')
        ? raw.releaseUrl
        : null,
    triggeredBy: raw.triggeredBy,
    createdAt,
    updatedAt,
    requestedAt: typeof raw.requestedAt === 'string' ? raw.requestedAt : null,
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
    failureReason: typeof raw.failureReason === 'string' ? raw.failureReason.slice(0, 500) : null,
    webhookStatus:
      typeof raw.webhookStatus === 'number' && Number.isFinite(raw.webhookStatus)
        ? raw.webhookStatus
        : null,
  };
}

async function readSelfUpdateJob(): Promise<SelfUpdateJob | null> {
  try {
    const [row] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, SELF_UPDATE_JOB_KEY))
      .limit(1);
    return normalizeJob(row?.value);
  } catch (err) {
    console.warn('[self-update] failed to read update job:', err);
    return null;
  }
}

async function writeSelfUpdateJob(job: SelfUpdateJob): Promise<void> {
  await db
    .insert(systemSettings)
    .values({
      key: SELF_UPDATE_JOB_KEY,
      value: job,
      category: 'general',
      description:
        'Last TaskNebula self-update request. The privileged updater runs outside the web container.',
      updatedBy: job.triggeredBy,
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: job, updatedAt: new Date(), updatedBy: job.triggeredBy },
    });
}

async function queueSelfUpdateJob(job: SelfUpdateJob): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${SELF_UPDATE_JOB_KEY}))`);
    const [row] = await tx
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, SELF_UPDATE_JOB_KEY))
      .limit(1);
    const existing = normalizeJob(row?.value);
    if (isActiveJob(existing)) {
      throw new SelfUpdateError('Another self-update request is already active', 409, 'active_job');
    }

    await tx
      .insert(systemSettings)
      .values({
        key: SELF_UPDATE_JOB_KEY,
        value: job,
        category: 'general',
        description:
          'Last TaskNebula self-update request. The privileged updater runs outside the web container.',
        updatedBy: job.triggeredBy,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: job, updatedAt: new Date(), updatedBy: job.triggeredBy },
      });
  });
}

async function auditSelfUpdate(input: {
  userId: string;
  action: string;
  job: SelfUpdateJob;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.insert(systemAuditLogs).values({
      userId: input.userId,
      action: input.action,
      resourceType: 'self_update',
      resourceId: input.job.id,
      changes: {
        currentVersion: input.job.currentVersion,
        targetVersion: input.job.targetVersion,
        status: input.job.status,
      },
      metadata: {
        repository: input.job.repository,
        imageTag: input.job.imageTag,
        digest: input.job.digest,
        webhookStatus: input.job.webhookStatus,
        ...input.metadata,
      },
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (err) {
    console.warn('[self-update] failed to write audit log:', err);
  }
}

function manualCommands(status: UpdateStatus): string {
  const tag = status.image.latestTag ?? status.latest ?? '<version>';
  const repository = status.image.repository;
  return [
    `# Set TASKNEBULA_IMAGE=${repository}:${tag} in .env for pinned installs.`,
    `TASKNEBULA_IMAGE=${repository}:${tag} docker compose pull web`,
    `TASKNEBULA_IMAGE=${repository}:${tag} docker compose up -d web`,
    'docker compose ps web',
  ].join('\n');
}

function baseStatus(status: UpdateStatus, job: SelfUpdateJob | null): SelfUpdateStatus {
  const enabled = boolEnv('TASKNEBULA_SELF_UPDATE_ENABLED');
  const webhookUrl = cleanUrl(process.env.TASKNEBULA_SELF_UPDATE_WEBHOOK_URL);
  const webhookSecret = process.env.TASKNEBULA_SELF_UPDATE_WEBHOOK_SECRET?.trim() ?? '';
  const targetVersion = status.image.latestTag ?? null;
  const activeJob = isActiveJob(job);

  let blockedReason: SelfUpdateBlockedReason | null = null;
  if (!enabled) blockedReason = 'disabled';
  else if (!webhookUrl) blockedReason = 'missing_webhook';
  else if (!webhookSecret) blockedReason = 'missing_secret';
  else if (status.checkDisabled) blockedReason = 'checks_disabled';
  else if (!status.image.latestTag) blockedReason = 'missing_docker_image';
  else if (!status.image.updateAvailable) blockedReason = 'no_update';
  else if (activeJob) blockedReason = 'active_job';

  return {
    enabled,
    available: blockedReason === null,
    mode: enabled && webhookUrl && webhookSecret ? 'external-webhook' : 'manual',
    blockedReason,
    targetVersion,
    repository: status.image.repository,
    digest: status.image.latestDigest,
    webhookConfigured: Boolean(webhookUrl && webhookSecret),
    manualCommands: manualCommands(status),
    job,
  };
}

async function settleCompletedJob(status: UpdateStatus, job: SelfUpdateJob | null) {
  if (!job || (job.status !== 'queued' && job.status !== 'requested')) return job;
  if (compareSemver(status.current, job.targetVersion) < 0) return job;

  const now = new Date().toISOString();
  const next: SelfUpdateJob = {
    ...job,
    status: 'succeeded',
    completedAt: now,
    updatedAt: now,
    failureReason: null,
  };
  try {
    await writeSelfUpdateJob(next);
    return next;
  } catch (err) {
    console.warn('[self-update] failed to settle completed job:', err);
    return job;
  }
}

export async function getSelfUpdateStatus(status: UpdateStatus): Promise<SelfUpdateStatus> {
  const job = await settleCompletedJob(status, await readSelfUpdateJob());
  return baseStatus(status, job);
}

function buildWebhookPayload(input: { job: SelfUpdateJob; status: UpdateStatus }) {
  return {
    event: 'tasknebula.self_update.requested',
    jobId: input.job.id,
    requestedAt: input.job.createdAt,
    currentVersion: input.job.currentVersion,
    targetVersion: input.job.targetVersion,
    image: {
      repository: input.job.repository,
      tag: input.job.imageTag,
      digest: input.job.digest,
      tagUrl: input.status.image.latestTagUrl,
      pushedAt: input.status.image.latestPushedAt,
      sizeBytes: input.status.image.latestSizeBytes,
    },
    release: {
      url: input.status.releaseUrl,
      publishedAt: input.status.publishedAt,
    },
    triggeredBy: input.job.triggeredBy,
  };
}

function signature(secret: string, timestamp: string, body: string) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function sendWebhook(job: SelfUpdateJob, status: UpdateStatus) {
  const webhookUrl = cleanUrl(process.env.TASKNEBULA_SELF_UPDATE_WEBHOOK_URL);
  const webhookSecret = process.env.TASKNEBULA_SELF_UPDATE_WEBHOOK_SECRET?.trim();
  if (!webhookUrl || !webhookSecret) {
    throw new SelfUpdateError('Self-update webhook is not configured', 412, 'missing_webhook');
  }

  const body = JSON.stringify(buildWebhookPayload({ job, status }));
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `tasknebula-self-update/${status.current}`,
        'X-TaskNebula-Event': 'tasknebula.self_update.requested',
        'X-TaskNebula-Delivery': job.id,
        'X-TaskNebula-Timestamp': timestamp,
        'X-TaskNebula-Signature': `sha256=${signature(webhookSecret, timestamp, body)}`,
      },
      body,
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new SelfUpdateError(
        `Self-update webhook rejected the request with HTTP ${response.status}`,
        502,
        'webhook_failed'
      );
    }

    return response.status;
  } finally {
    clearTimeout(timer);
  }
}

export async function startSelfUpdate(input: SelfUpdateStartInput): Promise<SelfUpdateStatus> {
  if (!input.acknowledged) {
    throw new SelfUpdateError('Update acknowledgement is required', 400, 'not_acknowledged');
  }

  const targetVersion = normalizeTargetVersion(input.targetVersion);
  if (!targetVersion) {
    throw new SelfUpdateError('Invalid target version', 400, 'invalid_target');
  }

  const existing = await getSelfUpdateStatus(input.status);
  if (!existing.available) {
    const statusCode = existing.blockedReason === 'active_job' ? 409 : 412;
    throw new SelfUpdateError(
      `Self-update is not available: ${existing.blockedReason ?? 'unknown'}`,
      statusCode,
      existing.blockedReason ?? 'disabled'
    );
  }

  if (
    !input.status.image.latestTag ||
    targetVersion !== stripV(input.status.image.latestTag) ||
    compareSemver(targetVersion, input.status.current) <= 0
  ) {
    throw new SelfUpdateError('Invalid target version', 400, 'invalid_target');
  }

  const now = new Date().toISOString();
  let job: SelfUpdateJob = {
    id: crypto.randomUUID(),
    status: 'queued',
    currentVersion: stripV(input.status.current),
    targetVersion,
    repository: input.status.image.repository,
    imageTag: stripV(input.status.image.latestTag),
    digest: input.status.image.latestDigest,
    releaseUrl: input.status.releaseUrl,
    triggeredBy: input.triggeredBy,
    createdAt: now,
    updatedAt: now,
    requestedAt: null,
    completedAt: null,
    failureReason: null,
    webhookStatus: null,
  };

  await queueSelfUpdateJob(job);
  await auditSelfUpdate({
    userId: input.triggeredBy,
    action: 'self_update.queued',
    job,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  try {
    const webhookStatus = await sendWebhook(job, input.status);
    const requestedAt = new Date().toISOString();
    job = {
      ...job,
      status: 'requested',
      requestedAt,
      updatedAt: requestedAt,
      webhookStatus,
    };
    await writeSelfUpdateJob(job);
    await auditSelfUpdate({
      userId: input.triggeredBy,
      action: 'self_update.requested',
      job,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return baseStatus(input.status, job);
  } catch (err) {
    const failedAt = new Date().toISOString();
    job = {
      ...job,
      status: 'failed',
      updatedAt: failedAt,
      completedAt: failedAt,
      failureReason: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
    };
    await writeSelfUpdateJob(job);
    await auditSelfUpdate({
      userId: input.triggeredBy,
      action: 'self_update.failed',
      job,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { error: job.failureReason },
    });
    if (err instanceof SelfUpdateError) throw err;
    throw new SelfUpdateError(
      job.failureReason ?? 'Self-update webhook failed',
      502,
      'webhook_failed'
    );
  }
}
