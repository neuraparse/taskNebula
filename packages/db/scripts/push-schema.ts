import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { execSync } from 'child_process';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

async function pushSchema() {
  try {
    console.log('🔄 Pushing schema to database...');
    console.log(`📍 Database: ${DATABASE_URL.replace(/:[^:]*@/, ':****@')}`);

    // Use drizzle-kit push via CLI
    execSync('pnpm drizzle-kit push', {
      cwd: '/app/packages/db',
      stdio: 'inherit',
      env: {
        ...process.env,
        DRIZZLE_PUSH_CONFIRM: 'yes',
      },
      input: 'y\n',
    });

    console.log('✅ Schema pushed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Schema push failed:', error);
    process.exit(1);
  }
}

pushSchema();
