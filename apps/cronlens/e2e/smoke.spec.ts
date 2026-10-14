import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('smoke', () => {
  test('renders the example without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel('Cron expression')).toHaveValue('30 2 * * *');
    await expect(page.getByLabel('Time zone')).toHaveValue('America/New_York');
    await expect(page.getByText('does not exist').first()).toBeVisible();
    await expect(page.locator('.strip-zone[data-kind="skipped"]').first()).toBeVisible();
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('suggests a safe time and applies it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Nearest safe time:')).toBeVisible();
    await page.getByRole('button', { name: 'Use this schedule' }).click();
    await expect(page.getByLabel('Cron expression')).toHaveValue('30 3 * * *');
    await expect(page.getByText('Nearest safe time:')).toHaveCount(0);
  });

  test('has a title and a meta description', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.{10,}/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{30,}/);
  });

  test('the core loop works from the keyboard alone', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard path is a desktop concern');
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /skip to content/i })).toBeFocused();
    await page.keyboard.press('Tab'); // theme toggle
    await page.keyboard.press('Tab'); // expression
    const input = page.getByLabel('Cron expression');
    await expect(input).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('0 9 * * 1-5');
    await expect(page.getByText('At 09:00, Monday through Friday')).toBeVisible();
    await page.keyboard.press('Tab'); // zone
    await expect(page.getByLabel('Time zone')).toBeFocused();
    await page.keyboard.press('Tab'); // first chip
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('30 2 * * *');
  });

  test('a bad expression gets a specific message', async ({ page }) => {
    await page.goto('/');
    const input = page.getByLabel('Cron expression');
    await input.fill('* * * *');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(/4 fields/)).toBeVisible();
  });

  test('a link restores state and the state is written back to the URL', async ({ page }) => {
    await page.goto('/#c=0+1+*+*+*&z=Europe%2FLondon');
    await expect(page.getByLabel('Time zone')).toHaveValue('Europe/London');
    await page.getByLabel('Cron expression').fill('15 1 * * *');
    await expect.poll(() => page.url()).toContain('c=15+1');
  });

  test('makes no network requests after load', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('table')).toBeVisible();
    const late: string[] = [];
    page.on('request', (r) => late.push(r.url()));
    await context.setOffline(true);
    await page.getByRole('button', { name: /Lord Howe/ }).click();
    await expect(page.getByLabel('Cron expression')).toHaveValue('*/15 * * * *');
    await expect(page.getByRole('table')).toBeVisible();
    expect(late).toEqual([]);
  });

  test('does not scroll horizontally at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await expect(page.getByRole('table')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('survives corrupt stored data', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', '{{{not valid');
      localStorage.setItem('cronlens:state', 'garbage');
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel('Cron expression')).toHaveValue('30 2 * * *');
  });
});

test.describe('hostile input', () => {
  test('a 50,000-character paste does not break the layout at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.getByLabel('Cron expression').fill(`${'9'.repeat(50_000)} * * * *`);
    await expect(page.getByLabel('Cron expression')).toHaveAttribute('aria-invalid', 'true');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('changing the hash in the same tab updates the page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.location.hash = '#c=5+5+*+*+*&z=Europe/Paris';
    });
    await expect(page.getByLabel('Cron expression')).toHaveValue('5 5 * * *');
    await expect(page.getByLabel('Time zone')).toHaveValue('Europe/Paris');
  });
});

test.describe('accessibility', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const hash of ['', '#c=61+*+*+*+*&z=UTC']) {
      test(`has no serious violations in ${theme} mode${hash ? ' with an error' : ''}`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(`/${hash}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        const blocking = violations.filter(
          (v) => v.impact === 'critical' || v.impact === 'serious',
        );
        expect(
          blocking,
          blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`).join('\n'),
        ).toEqual([]);
      });
    }
  }
});
