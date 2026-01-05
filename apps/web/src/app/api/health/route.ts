/**
 * Health Check Endpoint
 * 
 * Returns the health status of the application.
 * Used by Docker, Kubernetes, and monitoring services.
 */

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

  // Check memory usage - use RSS (Resident Set Size) for more accurate container memory check
  const memoryUsage = process.memoryUsage();
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

  // Only mark as error if heap is critically full (>95%)
  // Warning at >85% to give time for scaling/investigation
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

