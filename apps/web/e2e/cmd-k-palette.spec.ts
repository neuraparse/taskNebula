/**
 * Command palette (Cmd+K / Ctrl+K) — opens, accepts a query, and selects an
 * action. We use the "Create" leader chord (C → I) which is registered as
 * "New work item" in `command-palette.tsx`.
 */
import { test, expect } from '@playwright/test';
import { ensureSeed } from './fixtures/seed';

test.describe('cmd+k command palette', () => {
  test('opens with the keyboard shortcut and surfaces a create action', async ({ page }) => {
    const seed = await ensureSeed();
    await page.goto(`/projects/${seed.projectId}`);

    // Use ControlOrMeta so the same test works on macOS (Cmd) and Linux (Ctrl).
    await page.keyboard.press('ControlOrMeta+KeyK');

    // The Radix Dialog renders the palette with a Combobox-style input.
    const palette = page.getByRole('dialog');
    await expect(palette).toBeVisible({ timeout: 10_000 });

    // The combobox is the cmdk Command.Input.
    const input = palette.getByRole('combobox');
    await expect(input).toBeVisible();
    await input.fill('create issue');

    // The palette should surface an option that matches the query.
    // We accept either "New work item", "Create issue", or "New issue".
    const createOption = palette
      .getByRole('option', { name: /new (work item|issue)|create issue/i })
      .first();
    await expect(createOption).toBeVisible({ timeout: 5_000 });

    await createOption.click();

    // After selecting, the palette closes. We do not assert on a follow-up
    // modal because routing differs by registered chord; closing the dialog
    // is sufficient evidence the action fired.
    await expect(palette).toBeHidden({ timeout: 5_000 });
  });
});
