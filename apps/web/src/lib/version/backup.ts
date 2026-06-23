import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';

const DEFAULT_BACKUP_DIR = '/app/backups';
const BACKUP_TIMEOUT_MS = 10 * 60 * 1000;

export type SelfUpdateBackupArtifact = {
  path: string | null;
  sha256: string | null;
  sizeBytes: number | null;
};

export type SelfUpdateBackupSnapshot = {
  id: string;
  status: 'pending' | 'succeeded' | 'failed' | 'skipped';
  required: boolean;
  directory: string;
  startedAt: string;
  completedAt: string | null;
  database: SelfUpdateBackupArtifact | null;
  uploads: SelfUpdateBackupArtifact | null;
  manifest: SelfUpdateBackupArtifact | null;
  failureReason: string | null;
};

export type SelfUpdateBackupPreflight = {
  required: boolean;
  available: boolean;
  directory: string;
  uploadsPath: string;
  postgresDumpAvailable: boolean;
  uploadsReadable: boolean;
  backupDirWritable: boolean;
  blockedReason:
    | 'missing_pg_dump'
    | 'backup_dir_unwritable'
    | 'uploads_unreadable'
    | 'database_url_missing'
    | null;
};

export class SelfUpdateBackupError extends Error {
  snapshot: SelfUpdateBackupSnapshot;

  constructor(message: string, snapshot: SelfUpdateBackupSnapshot) {
    super(message);
    this.name = 'SelfUpdateBackupError';
    this.snapshot = snapshot;
  }
}

function boolEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function backupRequired(): boolean {
  return boolEnv('TASKNEBULA_SELF_UPDATE_REQUIRE_BACKUP', true);
}

function backupDir(): string {
  const configured =
    process.env.TASKNEBULA_UPDATE_BACKUP_DIR?.trim() || process.env.TASKNEBULA_BACKUP_DIR?.trim();
  return path.resolve(configured || DEFAULT_BACKUP_DIR);
}

export function resolveUploadsPath(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (!configured) return path.resolve(process.cwd(), 'uploads');
  return path.resolve(process.cwd(), configured);
}

async function executableAvailable(command: string, args: string[]): Promise<boolean> {
  try {
    await run(command, args, { timeoutMs: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function getSelfUpdateBackupPreflight(): Promise<SelfUpdateBackupPreflight> {
  const required = backupRequired();
  const directory = backupDir();
  const uploadsPath = resolveUploadsPath();

  let backupDirWritable = true;
  try {
    await mkdir(directory, { recursive: true });
    await access(directory, constants.W_OK);
  } catch {
    backupDirWritable = false;
  }

  let uploadsReadable = true;
  try {
    await mkdir(uploadsPath, { recursive: true });
    await access(uploadsPath, constants.R_OK);
  } catch {
    uploadsReadable = false;
  }

  const postgresDumpAvailable = await executableAvailable('pg_dump', ['--version']);
  const databaseUrlPresent = Boolean(process.env.DATABASE_URL?.trim());
  const blockedReason =
    !databaseUrlPresent && required
      ? 'database_url_missing'
      : !postgresDumpAvailable && required
        ? 'missing_pg_dump'
        : !backupDirWritable && required
          ? 'backup_dir_unwritable'
          : !uploadsReadable && required
            ? 'uploads_unreadable'
            : null;

  return {
    required,
    available: !required || blockedReason === null,
    directory,
    uploadsPath,
    postgresDumpAvailable,
    uploadsReadable,
    backupDirWritable,
    blockedReason,
  };
}

function backupPath(id: string, startedAt: string): string {
  const timestamp = startedAt.replace(/[:.]/g, '-');
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'update';
  return path.join(backupDir(), `self-update-${timestamp}-${safeId}`);
}

function parseDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is missing');
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!url.hostname || !database) throw new Error('DATABASE_URL is invalid');
  return {
    host: url.hostname,
    port: url.port || '5432',
    user: decodeURIComponent(url.username || 'postgres'),
    password: decodeURIComponent(url.password || ''),
    database,
  };
}

type RunOptions = {
  env?: Partial<NodeJS.ProcessEnv>;
  timeoutMs?: number;
};

function run(command: string, args: string[], options: RunOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${command} timed out`));
    }, options.timeoutMs ?? BACKUP_TIMEOUT_MS);

    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk).slice(0, 2000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function hashFile(filePath: string): Promise<SelfUpdateBackupArtifact> {
  const hash = crypto.createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  const details = await stat(filePath);
  return {
    path: filePath,
    sha256: hash.digest('hex'),
    sizeBytes: details.size,
  };
}

async function createDatabaseBackup(filePath: string): Promise<void> {
  const database = parseDatabaseUrl();
  await run(
    'pg_dump',
    [
      '-h',
      database.host,
      '-p',
      database.port,
      '-U',
      database.user,
      '-d',
      database.database,
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--file',
      filePath,
    ],
    {
      env: { PGPASSWORD: database.password },
    }
  );
}

async function createUploadsBackup(filePath: string, uploadsPath: string): Promise<void> {
  await mkdir(uploadsPath, { recursive: true });
  await run('tar', ['-czf', filePath, '-C', path.dirname(uploadsPath), path.basename(uploadsPath)]);
}

export async function createSelfUpdateBackup(input: {
  id: string;
  currentVersion: string;
  targetVersion: string;
  repository: string;
  imageRef: string;
  digest: string | null;
  triggeredBy: string;
}): Promise<SelfUpdateBackupSnapshot> {
  const startedAt = new Date().toISOString();
  const required = backupRequired();
  const directory = backupPath(input.id, startedAt);
  const pending: SelfUpdateBackupSnapshot = {
    id: input.id,
    status: required ? 'pending' : 'skipped',
    required,
    directory,
    startedAt,
    completedAt: required ? null : startedAt,
    database: null,
    uploads: null,
    manifest: null,
    failureReason: null,
  };

  if (!required) return pending;

  try {
    const preflight = await getSelfUpdateBackupPreflight();
    if (!preflight.available) {
      throw new Error(preflight.blockedReason ?? 'backup_unavailable');
    }

    await mkdir(directory, { recursive: true });
    const databasePath = path.join(directory, 'postgres.dump');
    const uploadsPath = path.join(directory, 'uploads.tar.gz');
    const manifestPath = path.join(directory, 'manifest.json');

    await createDatabaseBackup(databasePath);
    const database = await hashFile(databasePath);

    await createUploadsBackup(uploadsPath, preflight.uploadsPath);
    const uploads = await hashFile(uploadsPath);

    const manifestBody = {
      kind: 'tasknebula.self_update.backup',
      backupId: input.id,
      createdAt: startedAt,
      completedAt: new Date().toISOString(),
      currentVersion: input.currentVersion,
      targetVersion: input.targetVersion,
      image: {
        repository: input.repository,
        ref: input.imageRef,
        digest: input.digest,
      },
      triggeredBy: input.triggeredBy,
      artifacts: {
        database,
        uploads,
      },
      restoreHint:
        'Use pg_restore for postgres.dump and restore uploads.tar.gz into the uploads volume before starting the updated web service.',
    };
    await writeFile(manifestPath, `${JSON.stringify(manifestBody, null, 2)}\n`, { mode: 0o600 });
    const manifest = await hashFile(manifestPath);

    return {
      ...pending,
      status: 'succeeded',
      completedAt: new Date().toISOString(),
      database,
      uploads,
      manifest,
    };
  } catch (err) {
    const failed: SelfUpdateBackupSnapshot = {
      ...pending,
      status: 'failed',
      completedAt: new Date().toISOString(),
      failureReason: err instanceof Error ? err.message.slice(0, 500) : 'backup_failed',
    };
    throw new SelfUpdateBackupError(failed.failureReason ?? 'backup_failed', failed);
  }
}
