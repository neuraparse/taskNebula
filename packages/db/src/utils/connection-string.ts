import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../../.env') });

export function getDatabaseConnectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required in production');
  }

  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || 'postgres';
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.DB_PORT || process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB || 'tasknebula';

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}
