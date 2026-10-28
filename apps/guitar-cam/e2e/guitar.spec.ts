import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.describe('guitar cam', () => {
  test('the demo is heard as notes, then chords, and lights the fretboard', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /try the demo/i }).click();
    const main = page.getByTestId('readout-main');
    // The lick is a run of single notes.
    await expect(main).toHaveText(/^[A-G]♯?\d$/, { timeout: 8000 });
    await expect(page.locator('.mark-primary')).toHaveCount(1);
    await expect(page.getByRole('img', { name: /playing [a-g]♯? on string/i })).toBeVisible();
    // Later the lick gives way to chords.
    await expect(main).toHaveText(/^(Em|C|G|D)$/, { timeout: 20000 });
  });

  test('a recorded take becomes tab and exports in four formats', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /try the demo/i }).click();
    await page.getByRole('button', { name: /^record$/i }).click();
    await expect(page.getByTestId('tab')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /stop recording/i }).click();

    const tab = await page.getByTestId('tab').innerText();
    expect(tab).toMatch(/^E\|/m);
    expect(tab).toMatch(/^e\|/m);

    for (const [id, ext] of [
      ['musicxml', 'musicxml'],
      ['midi', 'mid'],
      ['tab', 'txt'],
      ['json', 'json'],
    ] as const) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId(`export-${id}`).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${ext}$`));
      const path = await download.path();
      const body = await readFile(path);
      expect(body.length).toBeGreaterThan(50);
      if (id === 'musicxml') expect(body.toString()).toContain('<score-partwise');
      if (id === 'midi') expect(body.subarray(0, 4).toString('ascii')).toBe('MThd');
    }
  });

  test('a take survives a reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /try the demo/i }).click();
    await page.getByRole('button', { name: /^record$/i }).click();
    await expect(page.getByTestId('tab')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /stop recording/i }).click();
    await page.reload();
    await expect(page.getByTestId('tab')).toBeVisible();
  });

  test('a blocked or missing microphone gets a specific message and leaves the demo', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: /^listen$/i }).click();
    await expect(page.getByTestId('mic-error')).toContainText(/blocked/i);
    await expect(page.getByRole('button', { name: /try the demo/i })).toBeEnabled();
  });

  test('the drill names a target and can reveal it on the fretboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: /fretboard drill/i }).click();
    await page.getByRole('button', { name: /start the drill/i }).click();
    await expect(page.getByTestId('drill-prompt')).toHaveText(/^Play .+ on the .+ string$/);
    await page.getByRole('button', { name: /show me where/i }).click();
    await expect(
      page.getByRole('img', { name: /target: string \d+, fret \d+/i }),
    ).toBeVisible();
  });

  test('the whole loop works from the keyboard', async ({ page }) => {
    await page.goto('/');
    const demo = page.getByRole('button', { name: /try the demo/i });
    await demo.focus();
    await page.keyboard.press('Enter');
    const record = page.getByRole('button', { name: /^record$/i });
    await record.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('tab')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /stop recording/i }).focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('export-tab').focus();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.keyboard.press('Enter'),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.txt$/);
  });

  test('hostile input: a 50,000 character tempo and rapid double clicks do not break it', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/');
    const tempo = page.getByLabel(/tempo/i);
    await tempo.fill('9'.repeat(50000));
    await tempo.blur();
    const value = Number(await tempo.inputValue());
    expect(value).toBeGreaterThanOrEqual(40);
    expect(value).toBeLessThanOrEqual(240);
    // Typing a tempo digit by digit must work, not be clamped on the first keystroke.
    await tempo.fill('');
    await tempo.pressSequentially('132');
    await expect(tempo).toHaveValue('132');
    await page.getByRole('button', { name: /try the demo/i }).dblclick();
    await page.getByRole('button', { name: /^stop$/i }).dblclick();
    await expect(page.getByTestId('status')).toHaveText(/not listening|playing the demo/i);
    expect(errors).toEqual([]);
  });

  test('a take exported as JSON imports again, and a bad file is refused', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /try the demo/i }).click();
    await page.getByRole('button', { name: /^record$/i }).click();
    await expect(page.getByTestId('tab')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /stop recording/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-json').click(),
    ]);
    const saved = await readFile(await download.path());
    const before = await page.getByTestId('tab').innerText();

    await page.getByRole('button', { name: /clear take/i }).click();
    await expect(page.getByTestId('tab')).toHaveCount(0);
    await page.getByTestId('import-file').setInputFiles({
      name: 'take.json',
      mimeType: 'application/json',
      buffer: saved,
    });
    await expect(page.getByTestId('tab')).toHaveText(before);

    await page.getByTestId('import-file').setInputFiles({
      name: 'nope.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello":1}'),
    });
    await expect(page.getByRole('alert')).toContainText(/not a guitar cam take/i);
  });
});
