import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The real TensorFlow.js and MobileNet downloads are replaced with a stand-in that
 * keeps the same surface (`tf.ready`, `mobilenet.load`, `net.infer(img, true)`) and
 * returns an embedding built from the picture's colours. That exercises the app's real
 * loader, dataset, trainer and UI without a 20 MB download in CI.
 */
const FAKE_TF = `window.tf = { ready: async () => {}, setBackend: async () => true };`;
const FAKE_MOBILENET = `
window.mobilenet = { load: async () => ({
  infer(src) {
    const c = document.createElement('canvas'); c.width = c.height = 4;
    const ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0, 4, 4);
    const px = ctx.getImageData(0, 0, 4, 4).data;
    const out = new Float32Array(512).fill(0.01);
    for (let i = 0; i < px.length; i++) out[i] += px[i] / 255;
    return { data: async () => out, dispose() {} };
  },
}) };`;

async function stubModel(page: Page) {
  await page.route('**/@tensorflow/tfjs@*/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: FAKE_TF }),
  );
  await page.route('**/@tensorflow-models/mobilenet@*/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: FAKE_MOBILENET }),
  );
}

/** Feeds N solid-colour PNGs to a hidden file input, the way a user's picker would. */
async function pick(page: Page, testId: string, colour: string, count: number) {
  await page.evaluate(
    async ({ testId, colour, count }) => {
      const dt = new DataTransfer();
      for (let i = 0; i < count; i++) {
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        ctx.fillStyle = colour;
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = `rgba(255,255,255,${0.03 * i})`;
        ctx.fillRect(0, 0, 8, 8);
        const blob = await new Promise<Blob>((res, rej) =>
          c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'),
        );
        dt.items.add(new File([blob], `${colour}-${i}.png`, { type: 'image/png' }));
      }
      const input = document.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
      if (!input) throw new Error('input missing');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { testId, colour, count },
  );
}

test.describe('the core loop', () => {
  test.beforeEach(async ({ page }) => {
    // Start clean once; a reload inside a test must keep what the app saved.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e-seeded')) {
        localStorage.removeItem('trainyard:state');
        sessionStorage.setItem('e2e-seeded', '1');
      }
    });
    await stubModel(page);
  });

  test('starts with two empty classes and Train blocked, with a reason', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('class-card')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Train', exact: true })).toBeDisabled();
    await expect(page.getByText(/at least 5 examples for two classes/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Record “Class 1”/ })).toBeDisabled();
  });

  test('add, rename and remove classes within limits', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Name of class 1').fill('Cats');
    await expect(page.getByLabel('Name of class 1')).toHaveValue('Cats');
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Add class' }).click();
    await expect(page.getByTestId('class-card')).toHaveCount(8);
    await expect(page.getByRole('button', { name: 'Add class' })).toBeDisabled();
    await page.getByRole('button', { name: /^Remove class Class 8/ }).click();
    await expect(page.getByTestId('class-card')).toHaveCount(7);
  });

  test('images → train → predict → persist → export → import', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Name of class 1').fill('Red');
    await page.getByLabel('Name of class 2').fill('Blue');

    await pick(page, 'image-input', '#d03020', 6);
    await expect(page.getByText('6 / 150').first()).toBeVisible();
    await page
      .getByRole('button', { name: /^Select Class 2$|^Select Blue$|^Select (?!ed)/ })
      .first()
      .click();
    await pick(page, 'image-input', '#2040d0', 6);
    await expect(page.getByText('6 / 150')).toHaveCount(2);

    const train = page.getByRole('button', { name: 'Train', exact: true });
    await expect(train).toBeEnabled();
    await train.click();
    await expect(page.getByText(/right on its own training set/)).toBeVisible();

    await pick(page, 'test-input', '#cc2a1a', 1);
    const redBar = page.getByRole('progressbar', { name: 'Red' });
    await expect
      .poll(async () => Number(await redBar.getAttribute('aria-valuenow')))
      .toBeGreaterThan(70);
    await pick(page, 'test-input', '#2a48c8', 1);
    await expect
      .poll(async () =>
        Number(
          await page.getByRole('progressbar', { name: 'Blue' }).getAttribute('aria-valuenow'),
        ),
      )
      .toBeGreaterThan(70);

    // Survives a reload.
    await page.reload();
    await expect(page.getByLabel('Name of class 1')).toHaveValue('Red');
    await expect(page.getByText('6 / 150')).toHaveCount(2);
    await expect(page.getByRole('progressbar', { name: 'Red' })).toBeVisible();

    // Export, wipe, import.
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const file = await download;
    const path = await file.path();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(page.getByLabel('Name of class 1')).toHaveValue('Class 1');
    await page.getByTestId('import-input').setInputFiles(path);
    await expect(page.getByLabel('Name of class 1')).toHaveValue('Red');
    await expect(page.getByRole('progressbar', { name: 'Blue' })).toBeVisible();
  });

  test('rejects a bad model file and changes nothing', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Name of class 1').fill('Keep me');
    await page.getByTestId('import-input').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"nope":true}'),
    });
    await expect(page.getByText(/was not exported from Trainyard/)).toBeVisible();
    await expect(page.getByLabel('Name of class 1')).toHaveValue('Keep me');
  });

  test('a failed model download explains itself and offers a retry', async ({ page }) => {
    await page.unroute('**/@tensorflow/tfjs@*/**');
    await page.route('**/@tensorflow/tfjs@*/**', (r) => r.abort());
    await page.goto('/');
    await pick(page, 'image-input', '#d03020', 1);
    await expect(page.getByRole('alert')).toContainText(/Could not download|offline/i);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('is operable by keyboard alone', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /skip to content/i }).focus();
    await page.keyboard.press('Enter');
    const name = page.getByLabel('Name of class 1');
    await name.fill('');
    await page.keyboard.type('Mug');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /^Selected: Mug/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: /Delete all examples in Mug/ }),
    ).toBeDisabled();
  });
});

test.describe('accessibility with real content', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`trained state has no serious violations in ${theme} mode`, async ({ page }) => {
      await stubModel(page);
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/');
      await pick(page, 'image-input', '#d03020', 6);
      await page
        .getByRole('button', { name: /^Select Class 2$|^Select Blue$|^Select (?!ed)/ })
        .first()
        .click();
      await pick(page, 'image-input', '#2040d0', 6);
      await page.getByRole('button', { name: 'Train', exact: true }).click();
      await expect(page.getByText(/right on its own training set/)).toBeVisible();
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
    });
  }
});
