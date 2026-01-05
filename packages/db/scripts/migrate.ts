/**
 * Database Migration Script
 * 
 * Runs database migrations in production.
 * Usage: pnpm tsx scripts/migrate.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { resolve } from 'path';

// Load environment variables only in development
try {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = require('dotenv');
    dotenv.config({ path: resolve(__dirname, '../../../.env') });
  }
} catch (error) {
  // Dotenv not available in production, use environment variables directly
}

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('🔄 Starting database migrations...');
  console.log(`📍 Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

  // Create connection for migrations
  const migrationClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    // Run migrations
    await migrate(db, {
      migrationsFolder: resolve(__dirname, '../drizzle'),
    });

    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

// Run migrations
runMigrations().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

