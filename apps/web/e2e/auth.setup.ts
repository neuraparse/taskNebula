/**
 * Playwright "setup" project — seeds the database and signs in the e2e admin
 * once, then persists the storage state at `e2e/.auth/admin.json` so the
 * authed product specs can reuse it across all browsers.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import { ensureSeed, E2E_ADMIN } from './fixtures/seed';

const STORAGE_STATE = path.join(__dirname, '.auth', 'admin.json');

setup('seed db + sign in as admin', async ({ page, request }) => {
  // 1) Make sure the deterministic workspace + admin user exist.
  await ensureSeed();

  // 2) Programmatic credentials sign-in via the Auth.js endpoint.
  //    We fetch the CSRF token first because next-auth credentials provider
  //    requires it on the form post.
  const csrfRes = await request.get('/api/auth/csrf');
  expect(csrfRes.ok(), 'CSRF endpoint should respond').toBeTruthy();
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const signInRes = await request.post('/api/auth/callback/credentials', {
    form: {
      csrfToken,
      email: E2E_ADMIN.email,
      password: E2E_ADMIN.password,
      callbackUrl: '/dashboard',
      json: 'true',
    },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    maxRedirects: 0,
  });
  // next-auth returns 302 on success, 200 with `{url}` if json=true.
  expect([200, 302]).toContain(signInRes.status());

  // 3) Validate by visiting a protected route in the browser context.
  //    This forces cookies set above to be present in the storage state.
  await page.goto('/dashboard');
  // Either the dashboard loaded or we got redirected back to signin —
  // assert we are not on /auth/signin to fail fast on auth misconfig.
  await expect(page).not.toHaveURL(/\/auth\/signin/);

  await page.context().storageState({ path: STORAGE_STATE });
});
