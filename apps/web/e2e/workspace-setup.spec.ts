/**
 * First-run wizard — verifies that `/setup` is the entrypoint when the
 * database has no admin yet, and that submitting the form creates the admin
 * account plus the initial organization.
 *
 * This spec is *defensive*: if the DB has already been seeded (admin exists),
 * `/api/setup` returns `setupRequired: false` and the page redirects to
 * `/auth/signin`. We assert that branch too, so the suite never fails in a
 * shared seeded environment.
 */
import { test, expect } from '@playwright/test';

test.describe('first-run workspace setup', () => {
  test('shows wizard or redirects depending on setup state', async ({ page }) => {
    const setupCheck = await page.request.get('/api/setup');
    const { setupRequired } = (await setupCheck.json()) as { setupRequired: boolean };

    await page.goto('/setup');

    if (!setupRequired) {
      // Already configured: wizard should bounce us to sign-in.
      await page.waitForURL(/\/auth\/signin/, { timeout: 15_000 });
      return;
    }

    // Fresh DB path: complete the wizard.
    await expect(page.getByRole('heading', { name: /welcome to tasknebula/i })).toBeVisible();

    const adminEmail = `e2e-setup+${Date.now()}@tasknebula.test`;

    await page.getByLabel(/full name/i).fill('First Admin');
    await page.getByLabel(/email address/i).fill(adminEmail);
    await page.getByLabel(/^password$/i).fill('Pa55word!2026');
    await page.getByLabel(/confirm password/i).fill('Pa55word!2026');
    await page.getByLabel(/organization name/i).fill('Acme Inc');

    await page.getByRole('button', { name: /create admin account/i }).click();

    await expect(page.getByRole('heading', { name: /setup complete/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForURL(/\/auth\/signin/, { timeout: 15_000 });
  });
});
