/**
 * Health Check Endpoint
 *
 * Returns the health status of the application.
 * Used by Docker, Kubernetes, and monitoring services.
 *
 * Required checks (cause unhealthy when failing):
 *   - database
 *   - memory (heap pressure against V8 limit)
 *
 * Optional checks (degraded but still healthy when failing — only when configured):
 *   - redis: pinged when REDIS_URL is set
 *   - livekit: marks degraded when env vars are configured but reachability fails
 *   - smtp: passive — only reports configuration state, not reachability
 */

import * as v8 from 'v8';
import { NextResponse } from 'next/server';
import { db } from '@tasknebula/db';
import { sql } from 'drizzle-orm';
import { getRedisClient, isRedisConfigured } from '@/lib/server/redis';
import { getLivekitStatus } from '@/lib/chat/livekit';

export const dynamic = 'force-dynamic';

type CheckState = 'ok' | 'warning' | 'error' | 'skipped';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: CheckState;
    memory: CheckState;
    redis: CheckState;
    livekit: CheckState;
    smtp: CheckState;
  };
  details?: Record<string, string>;
  version?: string;
}

const REDIS_PING_TIMEOUT_MS = 1500;

async function pingRedis(): Promise<{ state: CheckState; detail?: string }> {
  if (!isRedisConfigured()) {
    return { state: 'skipped', detail: 'REDIS_URL not set' };
  }

  const client = getRedisClient();
  if (!client) {
    return { state: 'skipped', detail: 'redis client unavailable' };
  }

  try {
    if (client.status === 'wait' || client.status === 'end') {
      await client.connect();
    }
    const result = await Promise.race([
      client.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('redis ping timeout')), REDIS_PING_TIMEOUT_MS),
      ),
    ]);
    return result === 'PONG' ? { state: 'ok' } : { state: 'warning', detail: `unexpected reply: ${result}` };
  } catch (error) {
    return {
      state: 'error',
      detail: error instanceof Error ? error.message : 'redis ping failed',
    };
  }
}

export async function GET() {
  const startTime = Date.now();
  const checks: HealthStatus['checks'] = {
    database: 'ok',
    memory: 'ok',
    redis: 'skipped',
    livekit: 'skipped',
    smtp: 'skipped',
  };
  const details: Record<string, string> = {};

  let unhealthy = false;
  let degraded = false;

  // Database — required
  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    console.error('Database health check failed:', error);
    checks.database = 'error';
    details.database = error instanceof Error ? error.message : 'database unreachable';
    unhealthy = true;
  }

  // Memory — required. V8 keeps heapTotal sized close to heapUsed by design,
  // so heapUsed/heapTotal is not a useful saturation signal. Compare against
  // heap_size_limit (the V8 cap) which is what actually triggers GC pressure / OOM.
  const heapStats = v8.getHeapStatistics();
  const heapUsedPercent = (heapStats.used_heap_size / heapStats.heap_size_limit) * 100;

  if (heapUsedPercent > 95) {
    checks.memory = 'error';
    details.memory = `${heapUsedPercent.toFixed(1)}% of V8 heap limit`;
    unhealthy = true;
  } else if (heapUsedPercent > 85) {
    checks.memory = 'warning';
    details.memory = `${heapUsedPercent.toFixed(1)}% of V8 heap limit`;
    degraded = true;
  }

  // Redis — optional. Container healthcheck stays green even if Redis fails,
  // but the response surfaces the degradation for monitoring/alerts.
  const redisResult = await pingRedis();
  checks.redis = redisResult.state;
  if (redisResult.detail) details.redis = redisResult.detail;
  if (redisResult.state === 'error') degraded = true;

  // LiveKit — passive: env-config check only (avoids tying the API process
  // healthcheck to LiveKit reachability, which has its own container probe).
  const livekitStatus = getLivekitStatus();
  if (livekitStatus.ready) {
    checks.livekit = 'ok';
  } else if (livekitStatus.missing.length > 0 && livekitStatus.missing.length < 4) {
    checks.livekit = 'warning';
    details.livekit = `partial config; missing: ${livekitStatus.missing.join(', ')}`;
    degraded = true;
  }

  // SMTP — passive: env-config check only.
  if (process.env.SMTP_HOST) {
    checks.smtp = 'ok';
  }

  const status: HealthStatus['status'] = unhealthy ? 'unhealthy' : degraded ? 'degraded' : 'healthy';

  const response: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    ...(Object.keys(details).length > 0 ? { details } : {}),
    version: process.env.npm_package_version,
  };

  // Container healthcheck contract: only return 503 when truly unhealthy.
  // Degraded (Redis down, memory warn, partial LiveKit) still returns 200
  // so containers don't restart for transient subsystem hiccups.
  const statusCode = unhealthy ? 503 : 200;
  const responseTime = Date.now() - startTime;

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': `${responseTime}ms`,
    },
  });
}
