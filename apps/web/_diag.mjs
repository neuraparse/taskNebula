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
await ctx.addCookies([{ name: 'tasknebula-locale', value: 'de', domain: 'localhost', path: '/' }]);
const resp = await p.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
console.log('URL:', p.url());
console.log('html lang:', await p.evaluate(() => document.documentElement.lang));
console.log('html dir:', await p.evaluate(() => document.documentElement.dir));
console.log('x-tasknebula-locale header:', resp.headers()['x-tasknebula-locale'] || '(none)');
console.log(
  'cookie sent back:',
  (await ctx.cookies()).filter((c) => c.name === 'tasknebula-locale').map((c) => c.value)
);
// sample some sidebar text
const txt = await p.evaluate(() =>
  Array.from(document.querySelectorAll('a,button,h1,h2,p,span'))
    .map((e) => e.textContent.trim())
    .filter((t) => t && t.length < 30)
    .slice(0, 25)
);
console.log('sample texts:', JSON.stringify(txt.slice(0, 20)));
await b.close();
