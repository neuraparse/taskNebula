/**
 * Environment Configuration
 *
 * Centralized environment variable validation and access.
 * Uses Zod for runtime validation.
 */

import { z } from 'zod';

// Environment schema
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url(),

  // OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // AI
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  NEXT_PUBLIC_LIVEKIT_URL: z.string().optional(),
  TURN_URL: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_PASSWORD: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().default('TaskNebula'),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  NEXT_PUBLIC_CHAT_DEBUG: z.string().optional(),

  // Collaboration (Hocuspocus / Yjs)
  NEXT_PUBLIC_COLLAB_ENABLED: z.string().optional(),
  NEXT_PUBLIC_HOCUSPOCUS_URL: z.string().optional(),

  // Email / SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .preprocess((v) => {
      if (v === '' || v === undefined || v === null) return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }, z.number().int().positive().optional())
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Cache
  CACHE_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  REDIS_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Monitoring
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Analytics
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  VERCEL_ANALYTICS_ID: z.string().optional(),

  // File Upload
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('10485760'),

  // Web Push
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().email().optional(),

  // Feature Flags
  // AI on/off is managed in DB (systemSettings.agent_control_center.globalEnabled,
  // toggled from Admin → Agent control), not via env. No FEATURE_AI_ENABLED here.
  FEATURE_WEBHOOKS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  FEATURE_EMAIL_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  FEATURE_PUSH_NOTIFICATIONS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Rate Limiting
  RATE_LIMIT_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('100'),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('60000'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

function withEnvAliases(source: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  const authSecret = source.AUTH_SECRET || source.NEXTAUTH_SECRET;
  const authUrl =
    source.AUTH_URL || source.NEXTAUTH_URL || source.NEXT_PUBLIC_APP_URL || source.APP_URL;
  const appUrl = source.NEXT_PUBLIC_APP_URL || source.APP_URL || authUrl;

  return {
    ...source,
    AUTH_SECRET: authSecret,
    AUTH_URL: authUrl,
    NEXT_PUBLIC_APP_URL: appUrl,
  };
}

// Parse and validate environment variables.
//
// IMPORTANT: this used to throw at module-load time. That caused the Next 15
// "Collecting page data" build stage to fail whenever AUTH_SECRET / AUTH_URL
// were not available in the page-data subprocess (which happens during
// `output: 'standalone'` builds and when Next probes dynamic routes). We
// now treat the build phase as best-effort and fall back to safe stubs so
// the build artifact can be produced; the real validation still runs the
// first time `env` is accessed at runtime in the long-lived web server.
function parseEnv() {
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  try {
    return envSchema.parse(withEnvAliases(process.env));
  } catch (error) {
    // During build/page-data collection, return a permissive shape so route
    // modules can be loaded without crashing. Real validation will run
    // again at first request because Next re-evaluates env in the runtime
    // server process.
    if (isBuildPhase) {
      const stub = {
        ...process.env,
        AUTH_SECRET:
          process.env.AUTH_SECRET ||
          process.env.NEXTAUTH_SECRET ||
          'build-time-placeholder-secret-min-32-chars',
        AUTH_URL:
          process.env.AUTH_URL ||
          process.env.NEXTAUTH_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          'http://localhost:3000',
        NEXT_PUBLIC_APP_URL:
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.AUTH_URL ||
          process.env.NEXTAUTH_URL ||
          'http://localhost:3000',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://build:build@localhost:5432/build',
      } as Record<string, string>;
      return envSchema.parse(withEnvAliases(stub));
    }

    // Real failure at runtime — surface every missing field, then throw.
    console.error('❌ Invalid environment variables:');
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw new Error('Invalid environment variables');
  }
}

// Export validated environment variables
export const env = parseEnv();

// Runtime guard: prevent booting production with the placeholder AUTH_SECRET.
// Scoped to production so local dev using the default template `.env` still works.
if (env.NODE_ENV === 'production' && env.AUTH_SECRET && env.AUTH_SECRET.startsWith('change-me')) {
  throw new Error(
    'AUTH_SECRET is still the placeholder value. Generate a real secret with `openssl rand -base64 32`.'
  );
}

// Helper functions
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

// Feature flags (env-sourced flags only — AI toggle lives in DB)
export const features = {
  webhooks: env.FEATURE_WEBHOOKS_ENABLED,
  email: env.FEATURE_EMAIL_ENABLED,
  pushNotifications: env.FEATURE_PUSH_NOTIFICATIONS_ENABLED,
};

// Rate limiting config
export const rateLimit = {
  enabled: env.RATE_LIMIT_ENABLED,
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
};
