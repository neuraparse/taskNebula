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
  const result = await pool.query('SELECT data FROM collab_documents WHERE name = $1 LIMIT 1', [
    documentName,
  ]);
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

/**
 * Verify the user can edit the issue this document represents.
 *
 * Document names use the form `issue:<issueId>`. Until this check existed,
 * any user with a valid collaboration JWT could connect to any document
 * and receive its Y-state — including issues in projects they don't
 * belong to. Authorization rule: user must be a member of the issue's
 * project with edit rights, OR an owner/admin of the issue's organization.
 *
 * Returns `true` when access is granted, `false` otherwise. Unknown
 * document-name shapes are rejected (no implicit fallthrough).
 */
async function userCanAccessDocument(userId, documentName) {
  if (typeof documentName !== 'string') return false;
  const issueMatch = /^issue:([A-Za-z0-9_-]+)$/.exec(documentName);
  if (!issueMatch) return false;
  const issueId = issueMatch[1];

  const result = await pool.query(
    `
    SELECT 1
    FROM issues i
	    INNER JOIN users u
	      ON u.id = $1 AND u.status = 'active'
	    LEFT JOIN project_members pm
	      ON pm.project_id = i.project_id
	     AND pm.user_id = $1
	     AND (
	       pm.can_edit_issues = 'true'
	       OR pm.can_administer_project = 'true'
	       OR pm.role IN ('product_owner', 'scrum_master', 'tech_lead', 'developer', 'qa_engineer', 'designer')
	     )
	    LEFT JOIN organization_members om
	      ON om.organization_id = i.organization_id
	       AND om.user_id = $1
	       AND om.role IN ('owner', 'admin')
	       AND om.status = 'active'
    WHERE i.id = $2
      AND (pm.user_id IS NOT NULL OR om.user_id IS NOT NULL)
    LIMIT 1
    `,
    [userId, issueId]
  );
  return result.rowCount > 0;
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
  try {
    // Parse a redis URL into the (host, port, password) shape the extension wants.
    // The Redis extension also accepts the raw URL via `options.path`, but the
    // explicit shape works across redis@5 and ioredis variants.
    const url = new URL(REDIS_URL);
    const port = Number.parseInt(url.port || '6379', 10);
    const db =
      url.pathname && url.pathname.length > 1 ? Number.parseInt(url.pathname.slice(1), 10) : 0;
    if (!Number.isInteger(port) || port <= 0 || !Number.isInteger(db) || db < 0) {
      throw new Error('REDIS_URL has an invalid port or database index');
    }
    extensions.push(
      new Redis({
        host: url.hostname,
        port,
        options: {
          password: decodeURIComponent(url.password || '') || undefined,
          db,
        },
      })
    );
  } catch (error) {
    console.warn(
      '[hocuspocus] REDIS_URL is invalid; running in single-node mode:',
      error?.message || error
    );
  }
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
    let userId;
    let email = null;
    let name = null;
    try {
      const { payload } = await jwtVerify(token, verifyKey, {
        issuer: 'tasknebula-web',
        audience: 'tasknebula-collab',
      });
      if (!payload.sub) {
        throw new Error('Token missing subject');
      }
      userId = payload.sub;
      email = payload.email || null;
      name = payload.name || null;
    } catch (error) {
      console.warn('[hocuspocus] rejecting connection (bad token):', error?.message || error);
      throw new Error('Invalid collaboration token');
    }

    // Per-document authorization. Without this check a valid JWT for any
    // user lets that user open any `issue:<id>` doc — including issues in
    // projects they cannot see via REST. We resolve the issue's project
    // and require either project edit access or org-level admin/owner.
    let permitted;
    try {
      permitted = await userCanAccessDocument(userId, documentName);
    } catch (error) {
      console.warn('[hocuspocus] authz lookup failed:', error?.message || error);
      throw new Error('Authorization check failed');
    }
    if (!permitted) {
      console.warn(
        `[hocuspocus] rejecting connection: user ${userId} not authorized for ${documentName}`
      );
      throw new Error('Not authorized for this document');
    }

    // Return data attached to the connection — surfaced as `context` in
    // later hooks.
    return { userId, email, name, documentName };
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
