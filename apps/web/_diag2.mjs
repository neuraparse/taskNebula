import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3000';
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.goto(`${BASE}/auth/signin`, { waitUntil: 'domcontentloaded' });
await p.getByLabel(/email address/i).fill('admin@tasknebula.io');
await p.getByLabel(/^password$/i).fill('demo123');
await p.getByRole('button', { name: /^sign in$/i }).click();
await p.waitForURL(/\/dashboard/, { timeout: 30000 });
for (const u of ['/de/settings', '/de/dashboard']) {
  await p.goto(`${BASE}${u}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  const lang = await p.evaluate(() => document.documentElement.lang);
  const txt = await p.evaluate(() =>
    Array.from(document.querySelectorAll('h1,h2,nav a,nav button'))
      .map((e) => e.textContent.trim())
      .filter(Boolean)
      .slice(0, 8)
  );
  console.log(u, '| lang=' + lang, '| url=' + p.url(), '|', JSON.stringify(txt));
}
await b.close();
