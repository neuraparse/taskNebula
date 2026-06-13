import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3000',
  OUT = '/home/taskNebula/.ui-audit/i18n',
  P = 'kmnkmc4cle9k0nxwtn8s1f9s';
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
  colorScheme: 'dark',
});
const p = await ctx.newPage();
async function dismiss() {
  const x = p.getByRole('button', { name: /I understand, continue/i });
  try {
    if (await x.isVisible({ timeout: 1500 })) {
      await x.click();
      await p.waitForTimeout(700);
    }
  } catch {}
}
// login (English)
await p.goto(`${BASE}/auth/signin`, { waitUntil: 'domcontentloaded' });
await p.getByLabel(/email address/i).fill('admin@tasknebula.io');
await p.getByLabel(/^password$/i).fill('demo123');
await p.getByRole('button', { name: /^sign in$/i }).click();
await p.waitForURL(/\/dashboard/, { timeout: 30000 });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(1500);
await dismiss();
// 1) open language switcher dropdown
try {
  const langBtn = p.getByRole('button', { name: /language|dil|sprache/i });
  await langBtn.first().click({ timeout: 5000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/lang-switcher.png` });
  console.log('lang-switcher ok');
  await p.keyboard.press('Escape');
} catch (e) {
  console.log('lang-switcher FAIL', e.message.split('\n')[0]);
  await p.screenshot({ path: `${OUT}/lang-switcher.png` });
}
// 2) switch to German via cookie + reload
await ctx.addCookies([{ name: 'tasknebula-locale', value: 'de', domain: 'localhost', path: '/' }]);
async function shot(path, name) {
  try {
    await p.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await p.evaluate(() => document.fonts.ready).catch(() => {});
    await p.waitForTimeout(1800);
    await dismiss();
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/${name}.png` });
    console.log('✓', name, '->', p.url());
  } catch (e) {
    console.log('✗', name, e.message.split('\n')[0]);
  }
}
await shot('/dashboard', 'de-dashboard');
await shot('/settings', 'de-settings');
await shot('/settings/integrations', 'de-settings-integrations');
await shot('/admin', 'de-admin');
await shot('/projects', 'de-projects');
await shot(`/projects/${P}/board`, 'de-project-board');
await shot(`/projects/${P}/settings`, 'de-project-settings');
await shot('/my-issues', 'de-my-issues');
await b.close();
console.log('DONE');
