/**
 * Signup flow — verifies the email/password registration path renders, the
 * client-side password validation kicks in, and a fresh account can reach the
 * signed-in product shell.
 *
 * Runs without storage state (project: chromium-public).
 */
import { test, expect } from '@playwright/test';

test.describe('signup', () => {
  test('rejects passwords shorter than 8 characters', async ({ page }) => {
    await page.goto('/auth/signup');

    // Wait for the form (it briefly waits on /api/setup).
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();

    await page.getByLabel(/full name/i).fill('Too Short');
    await page.getByLabel(/email address/i).fill(`shortpw+${Date.now()}@tasknebula.test`);
    await page.getByLabel(/^password$/i).fill('short');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible();
  });

  test('creates a new account and redirects to dashboard', async ({ page }) => {
    const email = `e2e-signup+${Date.now()}@tasknebula.test`;

    await page.goto('/auth/signup');
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();

    await page.getByLabel(/full name/i).fill('E2E Signup');
    await page.getByLabel(/email address/i).fill(email);
    await page.getByLabel(/^password$/i).fill('Pa55word!2026');

    await page.getByRole('button', { name: /create account/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
