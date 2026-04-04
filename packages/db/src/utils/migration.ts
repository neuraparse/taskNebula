import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { resolve } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

type JournalEntry = {
  idx: number;
  when: number;
  tag: string;
};

type PostgresClient = ReturnType<typeof postgres>;

const MARKERS = [
  { idx: 15, type: 'table', table: 'conversation_rooms' },
  { idx: 14, type: 'table', table: 'agent_model_configs' },
  { idx: 13, type: 'table', table: 'agent_runs' },
  { idx: 12, type: 'column', table: 'document_pages', column: 'public_share_enabled' },
  { idx: 11, type: 'table', table: 'document_pages' },
  { idx: 10, type: 'column', table: 'organizations', column: 'stripe_customer_id' },
  { idx: 9, type: 'table', table: 'feature_flags' },
  { idx: 7, type: 'table', table: 'push_subscriptions' },
  { idx: 6, type: 'table', table: 'saved_filters' },
  { idx: 5, type: 'table', table: 'watchers' },
  { idx: 4, type: 'table', table: 'audit_logs' },
  { idx: 3, type: 'table', table: 'custom_fields' },
  { idx: 2, type: 'table', table: 'notifications' },
  { idx: 1, type: 'table', table: 'attachments' },
  { idx: 0, type: 'table', table: 'organizations' },
] as const;

function getDrizzleDir() {
  return resolve(__dirname, '../../drizzle');
}

async function loadJournalEntries() {
  const journalPath = resolve(getDrizzleDir(), 'meta/_journal.json');
  const raw = await readFile(journalPath, 'utf8');
  const parsed = JSON.parse(raw) as { entries: JournalEntry[] };
  return parsed.entries;
}

async function tableExists(client: PostgresClient, table: string) {
  const [result] = await client<{ exists: boolean }[]>`
    select to_regclass(${`public.${table}`}) is not null as "exists"
  `;

  return Boolean(result?.exists);
}

async function columnExists(client: PostgresClient, table: string, column: string) {
  const [result] = await client<{ exists: boolean }[]>`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${table}
        and column_name = ${column}
    ) as "exists"
  `;

  return Boolean(result?.exists);
}

export async function detectLegacyBaselineIndex(client: PostgresClient) {
  for (const marker of MARKERS) {
    if (marker.type === 'table' && await tableExists(client, marker.table)) {
      return marker.idx;
    }

    if (
      marker.type === 'column'
      && await columnExists(client, marker.table, marker.column)
    ) {
      return marker.idx;
    }
  }

  return null;
}

async function ensureMigrationTable(client: PostgresClient) {
  await client`create schema if not exists drizzle`;
  await client`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `;
}

async function getMigrationCount(client: PostgresClient) {
  const [result] = await client<{ count: string }[]>`
    select count(*)::text as "count"
    from drizzle.__drizzle_migrations
  `;

  return Number(result?.count || '0');
}

async function backfillLegacyBaseline(client: PostgresClient) {
  await ensureMigrationTable(client);

  const existingCount = await getMigrationCount(client);
  if (existingCount > 0) {
    return;
  }

  const baselineIndex = await detectLegacyBaselineIndex(client);
  if (baselineIndex === null) {
    return;
  }

  const entries = (await loadJournalEntries()).filter((entry) => entry.idx <= baselineIndex);
  if (entries.length === 0) {
    return;
  }

  console.log(
    `🧭 Legacy schema detected with empty drizzle history. Backfilling ${entries.length} migration record(s) through ${entries.at(-1)?.tag}.`
  );

  await client.begin(async (transaction) => {
    for (const entry of entries) {
      const sqlPath = resolve(getDrizzleDir(), `${entry.tag}.sql`);
      const sql = await readFile(sqlPath, 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');

      await transaction`
        insert into drizzle.__drizzle_migrations ("hash", "created_at")
        values (${hash}, ${entry.when})
      `;
    }
  });
}

export async function runMigrationsWithLegacyBaselineSupport(connectionString: string) {
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    await backfillLegacyBaseline(migrationClient);
    await migrate(db, {
      migrationsFolder: getDrizzleDir(),
    });
  } finally {
    await migrationClient.end();
  }
}
