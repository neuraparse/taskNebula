/**
 * Readiness Check Endpoint
 * 
 * Returns whether the application is ready to accept traffic.
 * Used by Kubernetes readiness probes.
 */

import { NextResponse } from 'next/server';
import { db } from '@tasknebula/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface ReadinessStatus {
  ready: boolean;
  timestamp: string;
  checks: {
    database: boolean;
    migrations: boolean;
  };
}

export async function GET() {
  const checks: ReadinessStatus['checks'] = {
    database: false,
    migrations: false,
  };

  // Check database connection
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = true;
  } catch (error) {
    console.error('Database readiness check failed:', error);
  }

  // Check if migrations are up to date
  try {
    // Simple check: try to query a table that should exist after migrations
    await db.execute(sql`SELECT 1 FROM organizations LIMIT 1`);
    checks.migrations = true;
  } catch (error) {
    console.error('Migrations readiness check failed:', error);
  }

  const ready = checks.database && checks.migrations;

  const response: ReadinessStatus = {
    ready,
    timestamp: new Date().toISOString(),
    checks,
  };

  const statusCode = ready ? 200 : 503;

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

