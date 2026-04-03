import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getDatabaseConnectionString } from './utils/connection-string';

const runMigrations = async () => {
  const connectionString = getDatabaseConnectionString();

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('🔄 Running migrations...');

  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  await migrate(db, { migrationsFolder: './drizzle' });

  await migrationClient.end();

  console.log('✅ Migrations completed successfully');
};

runMigrations().catch((err) => {
  console.error('❌ Migration failed');
  console.error(err);
  process.exit(1);
});
