import { test, expect } from '@playwright/test';
import midiPackage from '@tonejs/midi';
const { Midi } = midiPackage;
function example(empty = false) {
  const midi = new Midi(); const track = midi.addTrack();
  if (!empty) for (const note of [
    { midi: 48, time: 0, duration: 4.5 }, { midi: 61, time: 0, duration: 0.5 },
    { midi: 60, time: 0.5, duration: 0.5 }, { midi: 63, time: 1, duration: 0.5 },
    { midi: 70, time: 1, duration: 0.5 }, { midi: 60, time: 1, duration: 0.5 },
    { midi: 60, time: 1.5, duration: 0.5 }, { midi: 61, time: 1.5, duration: 0.5 },
    { midi: 72, time: 6.1, duration: 0.5 }, { midi: 59, time: 8.1, duration: 1 },
    { midi: 66, time: 10, duration: 0.75 },
  ]) track.addNote({ ...note, velocity: 0.6 });
  return Buffer.from(midi.toArray());
}
test('notation, fonts and synchronized transport work without external services', async ({ page }) => {
  const errors: string[] = [], external: string[] = [], csp: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.text().includes('Content Security Policy')) csp.push(m.text()); });
  page.on('request', req => { if (req.url().startsWith('http') && new URL(req.url()).hostname !== '127.0.0.1') external.push(req.url()); });
  await page.goto('/');
  await expect(page.locator('#tempo')).toHaveValue('');
  await page.locator('#midi').setInputFiles({ name: 'notation.mid', mimeType: 'audio/midi', buffer: example() });
  await expect(page.locator('#score-status')).toContainText('Measures 1–4 of 6');
  await expect(page.locator('#score svg')).toBeVisible();
  expect(await page.evaluate(() => document.fonts.check('16px Bravura'))).toBeTruthy();
  const cursor = page.locator('.score-cursor');
  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveText('Pause');
  await expect.poll(async () => Number(await cursor.getAttribute('data-seconds'))).toBeGreaterThan(0.15);
  const before = Number(await cursor.getAttribute('x1'));
  await expect.poll(async () => Number(await cursor.getAttribute('x1'))).toBeGreaterThan(before);
  await page.locator('#play').click();
  const paused = await cursor.getAttribute('data-seconds');
  await page.waitForTimeout(150); expect(await cursor.getAttribute('data-seconds')).toBe(paused);
  await page.locator('#play').click();
  await expect.poll(async () => Number(await cursor.getAttribute('data-seconds'))).toBeGreaterThan(Number(paused));
  await page.locator('#position').fill('8.2'); await page.locator('#position').dispatchEvent('input');
  await expect(page.locator('#play')).toHaveText('Play');
  await expect(page.locator('#score-status')).toContainText('Measures 5–6 of 6');
  await expect(cursor).toHaveAttribute('data-bar', '5');
  await page.locator('#speed').selectOption('0.5');
  expect(Number(await page.locator('#position').inputValue())).toBeCloseTo(8.2, 1);
  await page.locator('#play').click();
  const slowStart = Number(await cursor.getAttribute('data-seconds'));
  await page.waitForTimeout(300);
  const elapsed = Number(await cursor.getAttribute('data-seconds')) - slowStart;
  expect(elapsed).toBeGreaterThan(0.03); expect(elapsed).toBeLessThan(0.35);
  await page.locator('#stop').click();
  await expect(page.locator('#position')).toHaveValue('0');
  await expect(cursor).toHaveAttribute('data-seconds', '0.000');
  await expect(page.locator('#score-status')).toContainText('Measures 1–4');
  await page.locator('#score-next').click(); await expect(page.locator('#score-status')).toContainText('Measures 5–6');
  await page.locator('#stop').click(); await expect(page.locator('#score-status')).toContainText('Measures 1–4');
  await page.locator('#position').fill('7.8'); await page.locator('#position').dispatchEvent('input');
  await page.locator('#speed').selectOption('1'); await page.locator('#play').click();
  await expect(page.locator('#score-status')).toContainText('Measures 5–6', { timeout: 3000 });
  await page.locator('#stop').click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'work/notation-mobile.png', fullPage: true });
  expect(errors).toEqual([]); expect(external).toEqual([]); expect(csp).toEqual([]);
});
test('empty MIDI clears notation and disables playback', async ({ page }) => {
  await page.goto('/');
  await page.locator('#midi').setInputFiles({ name: 'empty.mid', mimeType: 'audio/midi', buffer: example(true) });
  await expect(page.locator('#score')).toContainText('No notes to render');
  await expect(page.locator('#play')).toBeDisabled();
  await expect(page.locator('.score-cursor')).toHaveCount(0);
});
test('upload needs no tempo/key and completed MIDI opens the notation view', async ({ page }) => {
  const job = { id: '12345678-1234-1234-1234-123456789abc', name: 'phrase.wav', createdAt: Date.now(), progress: { stage: 'complete' }, report: { schemaVersion: 1, engine: 'fixture', backend: 'ONNX', durationSeconds: 10.75, noteCount: 11, runtimeSeconds: 1, peakMemoryMiB: 100, stageSeconds: {}, guidance: { tempo: 120, timeSignature: [4, 4] }, warnings: [] } };
  let uploaded = false;
  await page.route(/\/api\/jobs(\?.*)?$/, async route => {
    if (route.request().method() === 'POST') {
      const guidance = JSON.parse(new URL(route.request().url()).searchParams.get('guidance')!);
      expect(guidance.tempo).toBeUndefined(); expect(guidance.key).toBe('');
      uploaded = true; await route.fulfill({ status: 202, json: job });
    } else await route.fulfill({ json: uploaded ? [job] : [] });
  });
  await page.route(`**/api/jobs/${job.id}/midi`, route => route.fulfill({ contentType: 'audio/midi', body: example() }));
  await page.goto('/');
  await page.locator('#audio').setInputFiles({ name: 'phrase.wav', mimeType: 'audio/wav', buffer: Buffer.from('synthetic upload; worker mocked') });
  await page.getByRole('button', { name: 'Transcribe audio', exact: true }).click();
  await page.getByRole('button', { name: 'View notation & MIDI playback', exact: true }).click();
  await expect(page.locator('#score-status')).toContainText('11 source notes');
  await expect(page.locator('#score svg')).toBeVisible();
});
test('display-limit errors clear the previous score while leaving MIDI playback usable', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#midi').setInputFiles({ name: 'short.mid', mimeType: 'audio/midi', buffer: example() });
  await expect(page.locator('#score svg')).toBeVisible();
  const long = new Midi(); long.addTrack().addNote({ midi: 60, time: 0, duration: 601, velocity: 0.5 });
  await page.locator('#midi').setInputFiles({ name: 'long.mid', mimeType: 'audio/midi', buffer: Buffer.from(long.toArray()) });
  await expect(page.locator('#score-status')).toContainText('up to 10 minutes');
  await expect(page.locator('#score svg')).toHaveCount(0);
  await page.locator('#play').click(); await expect(page.locator('#play')).toHaveText('Pause');
  await page.locator('#stop').click();
  expect(errors).toEqual([]);
});
