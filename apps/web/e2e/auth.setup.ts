/**
 * Playwright "setup" project — seeds the database and signs in the e2e admin
 * once, then persists the storage state at `e2e/.auth/admin.json` so the
 * authed product specs can reuse it across all browsers.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import { ensureSeed, E2E_ADMIN } from './fixtures/seed';

const STORAGE_STATE = path.join(__dirname, '.auth', 'admin.json');

setup('seed db + sign in as admin', async ({ page }) => {
  // 1) Make sure the deterministic workspace + admin user exist.
  await ensureSeed();

  // 2) Sign in through the browser so persisted storage includes page cookies.
  await page.goto('/auth/signin');
  await page.getByLabel(/email address/i).fill(E2E_ADMIN.email);
  await page.getByLabel(/^password$/i).fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // 3) Validate by visiting a protected route in the browser context.
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: STORAGE_STATE });
});
