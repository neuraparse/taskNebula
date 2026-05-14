/**
 * Central Pino logger.
 *
 * Behaviour:
 *   - Production (NODE_ENV=production): structured JSON to stdout, ready for
 *     ingestion by Loki / Datadog / Cloud Logging.
 *   - Development / test: pretty-printed, single-line, colourised lines via
 *     pino-pretty (loaded lazily so it never bundles into the prod build).
 *   - Level controlled by LOG_LEVEL env (debug | info | warn | error). Falls
 *     back to "info" in prod and "debug" in dev. "silent" is supported for
 *     tests to suppress output.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ userId }, "user signed in");
 *
 *   // Scoped child loggers — preferred for API routes / modules:
 *   const log = logger.child({ scope: "api/issues" });
 *   log.warn({ issueId }, "issue not found");
 *
 * NOTE: Do not call this from edge runtime (Pino requires Node). Route
 * handlers and server actions run under Node by default; if you need an edge
 * runtime route, fall back to console.* there.
 */

import pino, { type Logger, type LoggerOptions } from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

function resolveLevel(): pino.LevelWithSilent {
  const raw = (process.env.LOG_LEVEL || '').toLowerCase();
  const allowed: pino.LevelWithSilent[] = [
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent',
  ];
  if ((allowed as string[]).includes(raw)) {
    return raw as pino.LevelWithSilent;
  }
  if (isTest) return 'silent';
  return isProd ? 'info' : 'debug';
}

const baseOptions: LoggerOptions = {
  level: resolveLevel(),
  // Pino redacts these before serialising — never log raw auth material.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.authorization',
      'headers.cookie',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
  base: {
    env: process.env.NODE_ENV || 'development',
    // npm_package_version is injected by node when running via npm/pnpm; in
    // bundled prod we fall back to undefined which Pino drops.
    service: 'tasknebula-web',
    version: process.env.npm_package_version,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

function createLogger(): Logger {
  if (isProd) {
    // Production: structured JSON, no pretty transport.
    return pino(baseOptions);
  }

  // Dev / non-prod: try pino-pretty. If it's missing (e.g. someone strips
  // devDeps in a production-like container by accident) we degrade silently
  // to plain JSON rather than crashing the process at import time.
  try {
    return pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname,service,env,version',
        },
      },
    });
  } catch {
    return pino(baseOptions);
  }
}

export const logger: Logger = createLogger();

/**
 * Convenience: create a scoped child logger.
 *
 *   const log = childLogger("api/issues");
 *   log.info({ issueId }, "fetched");
 */
export function childLogger(scope: string, bindings?: Record<string, unknown>): Logger {
  return logger.child({ scope, ...(bindings || {}) });
}

export type { Logger };
