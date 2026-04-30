/**
 * Health Check Endpoint
 * 
 * Returns the health status of the application.
 * Used by Docker, Kubernetes, and monitoring services.
 */

import * as v8 from 'v8';
import { NextResponse } from 'next/server';
import { db } from '@tasknebula/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
    memory: 'ok' | 'warning' | 'error';
  };
  version?: string;
}

export async function GET() {
  const startTime = Date.now();
  const checks: HealthStatus['checks'] = {
    database: 'ok',
    memory: 'ok',
  };

  let status: 'healthy' | 'unhealthy' = 'healthy';

  // Check database connection
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = 'ok';
  } catch (error) {
    console.error('Database health check failed:', error);
    checks.database = 'error';
    status = 'unhealthy';
  }

  // V8 keeps heapTotal sized close to heapUsed by design, so heapUsed/heapTotal
  // is not a useful saturation signal. Compare heapUsed against heap_size_limit
  // (the V8 cap, ~1.7G default or --max-old-space-size) which is what actually
  // triggers GC pressure / OOM.
  const heapStats = v8.getHeapStatistics();
  const heapUsedPercent = (heapStats.used_heap_size / heapStats.heap_size_limit) * 100;

  if (heapUsedPercent > 95) {
    checks.memory = 'error';
    status = 'unhealthy';
  } else if (heapUsedPercent > 85) {
    checks.memory = 'warning';
  }

  const response: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    version: process.env.npm_package_version,
  };

  const statusCode = status === 'healthy' ? 200 : 503;
  const responseTime = Date.now() - startTime;

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': `${responseTime}ms`,
    },
  });
}

