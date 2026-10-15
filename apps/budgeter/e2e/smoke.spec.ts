import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('smoke', () => {
  test('renders without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('has a title and a meta description', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.{10,}/);
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /.{30,}/);
  });

  test('is reachable by keyboard alone', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /skip to content/i })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /theme/i })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('does not scroll horizontally at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('survives corrupt stored data', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', '{{{not valid');
      localStorage.setItem('budgeter:state', 'garbage');
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('accessibility', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`has no serious violations in ${theme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/');
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
});

test.describe('budgeter core loop', () => {
  test('shows a worked example with no input', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('takehome-month')).toContainText('£');
    await expect(page.getByTestId('expense')).toHaveCount(3);
  });

  test('£5 a day Mon–Fri is £108.33 a month, by keyboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /add an expense/i }).click();
    const rows = page.getByTestId('expense');
    const row = rows.last();
    await row.getByLabel(/^Name of/).fill('Coffee');
    await row.getByLabel(/^Amount for/).fill('5');
    await expect(row).toContainText('£108.33 a month');
    await row.getByRole('button', { name: 'Fri' }).click();
    await expect(row).toContainText('£86.67 a month');
  });

  test('salary of £30,000 with no pension takes home £2,093.30 a month', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/pension contribution/i).fill('0');
    await page.getByLabel(/annual salary/i).fill('£30,000');
    await expect(page.getByTestId('takehome-month')).toContainText('£2,093.30');
  });

  test('says so in words when spending exceeds take-home', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/annual salary/i).fill('12000');
    await expect(page.getByTestId('left-month')).toContainText('short');
  });

  test('survives hostile input', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/annual salary/i).fill('9'.repeat(50_000));
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByLabel(/annual salary/i).fill('-100');
    await expect(page.getByRole('alert')).toBeVisible();
    // Two clicks in the same tick: the button moves after the first, so a real
    // double-click cannot land twice, but the state update must not lose one.
    await page.getByRole('button', { name: /add an expense/i }).evaluate((b: HTMLElement) => {
      b.click();
      b.click();
    });
    await expect(page.getByTestId('expense')).toHaveCount(5);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('edits persist across reload', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/annual salary/i).fill('52000');
    await page.reload();
    await expect(page.getByLabel(/annual salary/i)).toHaveValue('52000');
  });

  test('a shared link restores the plan, and a bad link falls back', async ({
    page,
    context,
  }) => {
    await context
      .grantPermissions(['clipboard-read', 'clipboard-write'])
      .catch(() => undefined);
    await page.goto('/');
    await page.getByLabel(/annual salary/i).fill('61000');
    await page.getByRole('button', { name: /copy link/i }).click();
    const url = await page.getByLabel('Plan link').inputValue();
    expect(url).toContain('#p=');
    const fresh = await context.newPage();
    await fresh.addInitScript(() => localStorage.clear());
    await fresh.goto(url);
    await expect(fresh.getByLabel(/annual salary/i)).toHaveValue('61000');

    await fresh.goto('/#p=garbage');
    await expect(fresh.getByText(/could not be read/)).toBeVisible();
  });
});
