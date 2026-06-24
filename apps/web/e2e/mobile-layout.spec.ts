import { expect, type Page, test } from '@playwright/test';
import { ensureSeed } from './fixtures/seed';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewport = window.innerWidth;
    return {
      bodyScrollWidth: body.scrollWidth,
      rootScrollWidth: root.scrollWidth,
      viewport,
    };
  });

  expect(overflow.rootScrollWidth).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.viewport + 1);
}

test.describe('mobile app layout', () => {
  test('keeps dashboard and issue detail inside the mobile viewport', async ({
    page,
  }, testInfo) => {
    const seed = await ensureSeed();

    await page.goto('/dashboard');
    await expect(page.locator('.dashboard-carbon')).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath('dashboard-mobile.png'),
      fullPage: true,
    });

    await page.goto(`/issues/${seed.issueIds[0]}`);
    await expect(page.getByRole('toolbar', { name: /issue quick actions/i })).toBeVisible({
      timeout: 20_000,
    });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath('issue-detail-mobile.png'),
      fullPage: true,
    });

    const detailsSection = page.getByText('Details', { exact: true }).first();
    await detailsSection.scrollIntoViewIfNeeded();
    await expect(detailsSection).toBeInViewport();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath('issue-detail-mobile-details.png'),
    });
  });
});
