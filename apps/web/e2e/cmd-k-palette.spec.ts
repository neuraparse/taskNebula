/**
 * Command palette — opens from the global trigger, accepts a query, and
 * surfaces the Ask AI action for sentence-like input.
 */
import { test, expect } from '@playwright/test';
import { ensureSeed } from './fixtures/seed';

test.describe('cmd+k command palette', () => {
  test('opens from the global trigger and surfaces an Ask AI action', async ({ page }) => {
    const seed = await ensureSeed();
    await page.goto(`/projects/${seed.projectId}/views`);

    const trigger = page.getByRole('button', { name: /open command palette/i });
    await expect(trigger).toBeVisible({ timeout: 20_000 });
    await trigger.click();

    // The Radix Dialog renders the palette with a named text input.
    const palette = page.getByRole('dialog', { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 10_000 });

    const input = palette.getByLabel(/command palette query/i);
    await expect(input).toBeVisible();
    await input.fill('summarize project risks');

    const askOption = palette.getByRole('option', {
      name: /ask tasknebula.*summarize project risks/i,
    });
    await expect(askOption).toBeVisible({ timeout: 5_000 });

    await askOption.click();

    await expect(palette).toBeHidden({ timeout: 5_000 });
  });
});
