import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for TaskNebula web E2E suite.
 *
 * - `pnpm dev` is auto-started on port 3000 and reused if already running.
 * - Three browser projects (chromium, firefox, webkit) run in parallel.
 * - Auth state for "authed" projects is saved by `e2e/auth.setup.ts`.
 * - Traces + screenshots are captured on failure for fast debugging.
 *
 * Override base URL via `PLAYWRIGHT_BASE_URL` to target a deployed env.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const STORAGE_STATE = 'e2e/.auth/admin.json';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  // Limit per-test wall time so CI fails fast on hung selectors.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Run individual files in parallel; one file at a time inside its workers.
  fullyParallel: true,
  // Fail the build on .only() in CI.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // 1) Setup: programmatic signin → storage state shared by authed specs.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // 2) Unauthenticated specs (signup, first-run wizard) run without state.
    {
      name: 'chromium-public',
      testMatch: /(signup|workspace-setup)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // 3) Authed product specs across three browsers.
    {
      name: 'chromium',
      testIgnore: /(signup\.spec\.ts|workspace-setup\.spec\.ts|auth\.setup\.ts)$/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
    },
    {
      name: 'firefox',
      testIgnore: /(signup\.spec\.ts|workspace-setup\.spec\.ts|auth\.setup\.ts)$/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Firefox'],
        storageState: STORAGE_STATE,
      },
    },
    {
      name: 'webkit',
      testIgnore: /(signup\.spec\.ts|workspace-setup\.spec\.ts|auth\.setup\.ts)$/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Safari'],
        storageState: STORAGE_STATE,
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // Force the AI draft endpoint to use a deterministic stub during e2e.
      // The route reads PLAYWRIGHT_AI_STUB and short-circuits OpenAI when set.
      PLAYWRIGHT_AI_STUB: '1',
      // Ensures Next dev server uses the same DB as the seeder.
      NODE_ENV: process.env.NODE_ENV ?? 'development',
    },
  },
});
