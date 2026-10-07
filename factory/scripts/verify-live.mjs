#!/usr/bin/env node
// Verify a deployed app for real: it responds, it renders, the core UI is there,
// nothing errors in the console, and no asset 404s (the base-path bug).
// Run from inside the app so @playwright/test resolves:
//   cd apps/<slug> && node ../../factory/scripts/verify-live.mjs https://slug.pages.dev
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Node resolves imports relative to this script, not the working directory, so
// resolve Playwright out of the app's own node_modules.
let chromium;
try {
  const requireFromApp = createRequire(`${process.cwd()}/package.json`);
  const mod = await import(pathToFileURL(requireFromApp.resolve('@playwright/test')).href);
  // The package resolves to a CJS entry, so the named export may sit on .default.
  chromium = mod.chromium ?? mod.default?.chromium;
  if (!chromium) throw new Error('no chromium export');
} catch {
  console.error('Run this from inside the app directory, after npm install:');
  console.error('  cd apps/<slug> && node ../../factory/scripts/verify-live.mjs <url>');
  process.exit(2);
}

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

// The factory environment ships Chromium at PLAYWRIGHT_BROWSERS_PATH and blocks
// downloads, so use that binary when the revision Playwright wants is absent.
const preinstalled = `${process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'}/chromium`;
const browser = await chromium.launch(
  existsSync(preinstalled) ? { executablePath: preinstalled } : {},
);
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
