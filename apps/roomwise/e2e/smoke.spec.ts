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

  test('core loop: edit rent and perks, share link reproduces the split', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel(/^Share for/)).toHaveCount(3);
    await page.getByLabel('Total rent per month').fill('3000');
    const first = page.getByLabel('Share for Front room');
    const before = await first.textContent();
    await page
      .getByRole('checkbox', { name: /Dark or small window/ })
      .first()
      .check();
    await expect(first).not.toHaveText(before ?? '');
    const url = page.url();
    expect(url).toContain('#s=');
    const fresh = await page.context().newPage();
    await fresh.goto(url);
    await expect(fresh.getByLabel('Total rent per month')).toHaveValue('3000');
    await expect(fresh.getByLabel('Share for Front room')).toHaveText(
      (await first.textContent()) ?? '',
    );
  });

  test('survives a corrupt share link', async ({ page }) => {
    await page.goto('/#s=abcd');
    await expect(page.getByText(/share link could not be read/)).toBeVisible();
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
      localStorage.setItem('roomwise:state', 'garbage');
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
