#!/usr/bin/env node
// Verify a deployed app for real: it responds, it renders, the core UI is there,
// nothing errors in the console, and no asset 404s (the base-path bug).
//   node verify-live.mjs https://slug.pages.dev
import { chromium } from '@playwright/test';

const url = process.argv[2];
if (!url) {
  console.error('usage: verify-live.mjs <url>');
  process.exit(2);
}

const problems = [];
const note = (ok, label, detail = '') => {
  console.log(`${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) problems.push(label);
};

const res = await fetch(url, { redirect: 'follow' });
note(res.status === 200, 'responds 200', `got ${res.status}`);
const html = await res.text();
const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
note(title.length > 0 && !/vite|react|__APP_/i.test(title), 'has its own <title>', title || 'none');
note(/<meta[^>]+name=["']description["']/i.test(html), 'has a meta description');

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));
page.on('response', (r) => r.status() >= 400 && failedRequests.push(`${r.status()} ${r.url()}`));

await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(1500);

const text = (await page.locator('body').innerText()).trim();
note(text.length > 40, 'renders visible content', `${text.length} chars`);
note((await page.locator('h1').count()) >= 1, 'has an h1');
note((await page.locator('main').count()) >= 1, 'has a main landmark');
note(failedRequests.length === 0, 'no failed requests', failedRequests.slice(0, 5).join('; '));
note(consoleErrors.length === 0, 'console is clean', consoleErrors.slice(0, 3).join('; '));

await page.setViewportSize({ width: 320, height: 568 });
await page.waitForTimeout(400);
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
note(overflow <= 1, 'no horizontal overflow at 320px', `${overflow}px`);

await browser.close();

if (problems.length) {
  console.error(`\n\x1b[31m${problems.length} problem(s): ${problems.join(', ')}\x1b[0m`);
  console.error('A failed asset request is almost always the wrong VITE_BASE. See references/deploy.md.');
  process.exit(1);
}
console.log('\n\x1b[32mlive and healthy\x1b[0m');
