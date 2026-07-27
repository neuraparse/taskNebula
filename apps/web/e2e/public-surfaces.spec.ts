import { expect, type Page, test } from '@playwright/test';

const PUBLIC_SURFACES = [
  { id: 'landing', path: '/' },
  { id: 'trust', path: '/trust' },
  { id: 'ai-model-cards', path: '/ai-model-cards' },
  { id: 'sign-in', path: '/auth/signin' },
  { id: 'sign-up', path: '/auth/signup' },
  { id: 'password-recovery', path: '/auth/forgot-password' },
  { id: 'offline', path: '/offline' },
] as const;

const VIEW_MATRIX = [
  {
    id: 'desktop-light',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light' as const,
  },
  {
    id: 'desktop-dark',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark' as const,
  },
  {
    id: 'mobile-390-light',
    viewport: { width: 390, height: 844 },
    colorScheme: 'light' as const,
  },
  {
    id: 'mobile-390-dark',
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark' as const,
  },
  {
    id: 'mobile-320-light',
    viewport: { width: 320, height: 568 },
    colorScheme: 'light' as const,
  },
  {
    id: 'mobile-320-dark',
    viewport: { width: 320, height: 568 },
    colorScheme: 'dark' as const,
  },
] as const;

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    root: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));

  expect(dimensions.root).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test.describe('public surface contract', () => {
  for (const surface of PUBLIC_SURFACES) {
    for (const view of VIEW_MATRIX) {
      test(`${surface.id} · ${view.id}`, async ({ page }) => {
        const browserErrors: string[] = [];
        page.on('console', (message) => {
          if (message.type() === 'error') browserErrors.push(message.text());
        });
        page.on('pageerror', (error) => browserErrors.push(error.message));

        await page.setViewportSize(view.viewport);
        await page.emulateMedia({
          colorScheme: view.colorScheme,
          reducedMotion: 'reduce',
        });
        await page.addInitScript((theme) => {
          window.localStorage.setItem('theme', theme);
          document.documentElement?.classList.toggle('dark', theme === 'dark');
        }, view.colorScheme);

        const response = await page.goto(surface.path, { waitUntil: 'domcontentloaded' });
        expect(response?.status(), `${surface.path} should resolve`).toBeLessThan(400);

        await expect(page.locator('main')).toHaveCount(1);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await expect(page).toHaveTitle(/\S/);
        await expectNoDocumentOverflow(page);

        await page.keyboard.press('Tab');
        const focusLeftDocumentRoot = await page.evaluate(() => {
          const active = document.activeElement;
          return active !== document.body && active !== document.documentElement;
        });
        expect(focusLeftDocumentRoot, `${surface.path} should expose a keyboard target`).toBe(true);

        expect(browserErrors, `${surface.path} should not log browser errors`).toEqual([]);
      });
    }
  }
});
