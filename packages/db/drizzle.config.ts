import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL || `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'tasknebula'}`;

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
