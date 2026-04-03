import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { getDatabaseConnectionString } from './utils/connection-string';

// Database connection - DATABASE_URL must be set at runtime
const connectionString = getDatabaseConnectionString();

// Create postgres client
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export types
export type Database = typeof db;
