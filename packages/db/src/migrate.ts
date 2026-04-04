import { getDatabaseConnectionString } from './utils/connection-string';
import { runMigrationsWithLegacyBaselineSupport } from './utils/migration';

const runMigrations = async () => {
  const connectionString = getDatabaseConnectionString();

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('🔄 Running migrations...');

  await runMigrationsWithLegacyBaselineSupport(connectionString);

  console.log('✅ Migrations completed successfully');
};

runMigrations().catch((err) => {
  console.error('❌ Migration failed');
  console.error(err);
  process.exit(1);
});
