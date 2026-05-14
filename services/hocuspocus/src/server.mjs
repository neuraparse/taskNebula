/**
 * TaskNebula Hocuspocus server.
 *
 * Standalone Node service that hosts the Yjs documents backing the
 * collaborative issue description (and, eventually, comments + docs). The
 * web app connects via `@hocuspocus/provider` at the URL exposed by
 * `NEXT_PUBLIC_HOCUSPOCUS_URL`.
 *
 * Auth: every connection presents a short-lived JWT minted by the web app
 *       at `/api/collab/token`, signed with `AUTH_SECRET`. We verify with
 *       the same secret here (read from `AUTH_SECRET` or, for parity with
 *       older deployments, `NEXTAUTH_SECRET`).
 *
 * Persistence: Yjs document state is mirrored into Postgres so that
 *              docs survive restarts. We store the binary state in a
 *              dedicated `collab_documents` table (auto-provisioned).
 *
 * Scale-out: Redis pub-sub keeps multiple Hocuspocus instances in sync.
 */
import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { Logger } from '@hocuspocus/extension-logger';
import { Redis } from '@hocuspocus/extension-redis';
import { jwtVerify } from 'jose';
import pg from 'pg';

const PORT = Number.parseInt(process.env.HOCUSPOCUS_PORT || '1234', 10);
const SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;

if (!SECRET) {
  console.error('[hocuspocus] Refusing to start: AUTH_SECRET / NEXTAUTH_SECRET is required.');
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('[hocuspocus] Refusing to start: DATABASE_URL is required.');
  process.exit(1);
}

const verifyKey = new TextEncoder().encode(SECRET);

// --- Postgres connection + schema bootstrap -------------------------------
const pool = new pg.Pool({ connectionString: DATABASE_URL });

await pool.query(`
  CREATE TABLE IF NOT EXISTS collab_documents (
    name TEXT PRIMARY KEY,
    data BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`);

async function fetchDocument({ documentName }) {
  const result = await pool.query(
    'SELECT data FROM collab_documents WHERE name = $1 LIMIT 1',
    [documentName]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].data;
}

async function storeDocument({ documentName, state }) {
  await pool.query(
    `INSERT INTO collab_documents (name, data, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [documentName, Buffer.from(state)]
  );
}

// --- Extensions -----------------------------------------------------------
const extensions = [
  new Logger({
    onLoadDocument: false,
    onChange: false,
    onConnect: true,
    onDisconnect: true,
    onUpgrade: false,
    onRequest: false,
    onListen: true,
    onDestroy: true,
    onConfigure: true,
  }),
  new Database({
    fetch: fetchDocument,
    store: storeDocument,
  }),
];

if (REDIS_URL) {
  // Parse a redis URL into the (host, port, password) shape the extension wants.
  // The Redis extension also accepts the raw URL via `options.path`, but the
  // explicit shape works across redis@5 and ioredis variants.
  const url = new URL(REDIS_URL);
  extensions.push(
    new Redis({
      host: url.hostname,
      port: Number.parseInt(url.port || '6379', 10),
      options: {
        password: decodeURIComponent(url.password || '') || undefined,
        db: url.pathname && url.pathname.length > 1 ? Number.parseInt(url.pathname.slice(1), 10) || 0 : 0,
      },
    })
  );
} else {
  console.warn('[hocuspocus] REDIS_URL not set — running in single-node mode (no pub/sub).');
}

// --- Server ---------------------------------------------------------------
const server = new Server({
  port: PORT,
  address: '0.0.0.0',
  extensions,
  async onAuthenticate({ token, documentName }) {
    if (!token) {
      throw new Error('Missing collaboration token');
    }
    try {
      const { payload } = await jwtVerify(token, verifyKey, {
        issuer: 'tasknebula-web',
        audience: 'tasknebula-collab',
      });
      if (!payload.sub) {
        throw new Error('Token missing subject');
      }
      // Return data attached to the connection — surfaced as `context` in
      // later hooks (e.g. for per-document authorization).
      return {
        userId: payload.sub,
        email: payload.email || null,
        name: payload.name || null,
        documentName,
      };
    } catch (error) {
      console.warn('[hocuspocus] rejecting connection:', error?.message || error);
      throw new Error('Invalid collaboration token');
    }
  },
});

await server.listen();
console.log(`[hocuspocus] listening on ws://0.0.0.0:${PORT}`);

async function shutdown(signal) {
  console.log(`[hocuspocus] received ${signal}, shutting down`);
  try {
    await server.destroy();
  } catch (error) {
    console.error('[hocuspocus] error during shutdown:', error);
  }
  try {
    await pool.end();
  } catch {
    /* noop */
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
