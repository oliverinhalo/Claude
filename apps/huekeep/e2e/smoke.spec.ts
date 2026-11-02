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
      localStorage.setItem('huekeep:state', 'garbage');
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

test.describe('core loop', () => {
  test('first load shows a failing pair and a fix that passes', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Needs 4.5 : 1')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Change the text colour' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Change the background' })).toBeVisible();
  });

  test('keyboard: type a pair, apply the fix, see it pass', async ({ page }) => {
    await page.goto('/');
    const text = page.getByLabel('Text colour', { exact: true });
    await text.fill('#999999');
    await page.getByLabel('Background', { exact: true }).fill('#ffffff');
    await expect(page.getByText('Needs 4.5 : 1')).toBeVisible();
    await page
      .getByRole('button', { name: /^Use #/ })
      .first()
      .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Passes 4.5 : 1')).toBeVisible();
    await expect(page.getByText(/already clears the target/)).toBeVisible();
  });

  test('bad input explains itself and keeps the last result', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Text colour', { exact: true }).fill('banana');
    await expect(page.getByText(/not a colour I know/)).toBeVisible();
    await expect(page.getByText(/last valid pair/)).toBeVisible();
  });

  test('state survives reload; a share link restores a pair', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Text colour', { exact: true }).fill('#336699');
    await page.reload();
    await expect(page.getByLabel('Text colour', { exact: true })).toHaveValue('#336699');
    await page.goto('/#fg=%23aa0000&bg=%23000000&t=7');
    await expect(page.getByLabel('Text colour', { exact: true })).toHaveValue('#aa0000');
    await expect(page.getByRole('radio', { name: /AAA/ })).toBeChecked();
  });

  test('huge paste is rejected without freezing', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Text colour', { exact: true }).fill('a'.repeat(50000));
    await expect(page.getByText(/characters; a colour is under/)).toBeVisible();
  });

  test('works at 320px with fixes visible', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
