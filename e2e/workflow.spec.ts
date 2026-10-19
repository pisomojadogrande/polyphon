import { test, expect } from '@playwright/test';
import midiPackage from '@tonejs/midi';
const { Midi } = midiPackage;
function midiBytes() {
  const midi = new Midi(), track = midi.addTrack();
  for (const [i, pitch] of [54, 66, 68, 69, 71, 73, 74, 76].entries()) track.addNote({ midi: pitch, time: i * 0.3, duration: 0.5, velocity: 0.6 });
  return Buffer.from(midi.toArray());
}
const a = '11111111-1111-1111-1111-111111111111', b = '22222222-2222-2222-2222-222222222222';
function clip(id: string, name: string) {
  return { id, name, createdAt: Date.now(), notationKey: null as { tonic: string; mode: string } | null, progress: { stage: 'complete', percent: undefined as number | undefined, completed: undefined as number | undefined, total: undefined as number | undefined }, report: { schemaVersion: 1, engine: 'fixture', backend: 'ONNX', durationSeconds: 2.6, noteCount: 8, runtimeSeconds: 1, peakMemoryMiB: 100, stageSeconds: {}, guidance: { tempo: 120, timeSignature: [4, 4] }, warnings: [] } };
}
test('upload → progress → keyed score; rail navigation and key edits survive reload', async ({ page }) => {
  const first = clip(a, 'F sharp test'), second = clip(b, 'Older clip'); let uploaded = false, completed = false, postCount = 0, patchCount = 0;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/clip-name', route => route.fulfill({ json: { name: 'gentle-willow' } }));
  await page.route(/\/api\/jobs(\?.*)?$/, async route => {
    if (route.request().method() === 'POST') {
      postCount++;
      const params = new URL(route.request().url()).searchParams;
      expect(params.get('name')).toBe('F sharp test'); expect(params.get('filename')).toBe('source.wav'); expect(JSON.parse(params.get('key')!)).toBeNull();
      expect(params.has('guidance')).toBeFalsy(); uploaded = true; first.progress.stage = 'loading';
      await route.fulfill({ status: 202, json: first });
    } else {
      if (completed) { first.progress = { stage: 'complete', percent: undefined, completed: undefined, total: undefined }; }
      await route.fulfill({ json: uploaded ? [first, second] : [second] });
    }
  });
  await page.route(/\/api\/jobs\/[^/]+$/, async route => {
    const item = route.request().url().endsWith(a) ? first : second;
    if (route.request().method() === 'PATCH') { patchCount++; item.notationKey = route.request().postDataJSON().notationKey; }
    await route.fulfill({ json: item });
  });
  await page.route('**/api/jobs/*/midi', route => route.fulfill({ contentType: 'audio/midi', body: midiBytes() }));
  await page.goto('/');
  await expect(page.locator('#clip-name')).toHaveValue('gentle-willow');
  await expect(page.locator('#upload-tonic')).toHaveValue('');
  await expect(page.locator('#new-page')).toBeVisible();
  await expect(page.locator('#new-page input[type=number]')).toHaveCount(0);
  await page.locator('#clip-name').fill('F sharp test');
  await page.locator('#audio').setInputFiles({ name: 'source.wav', mimeType: 'audio/wav', buffer: Buffer.from('audio; processing mocked') });
  await page.getByRole('button', { name: 'Upload & transcribe', exact: true }).click();
  await expect(page.locator('#progress-page')).toBeVisible();
  await expect(page.locator('#stage')).toContainText('Loading transcription model');
  first.progress = { stage: 'inference', percent: 50, completed: 2, total: 4 };
  await expect(page.locator('#stage')).toContainText('50% of inference windows');
  completed = true;
  await expect(page.locator('#result-page')).toBeVisible();
  await expect(page.locator('#result-title')).toHaveText('F sharp test');
  await expect(page.locator('#score svg')).toHaveAttribute('data-key-signature', 'unknown');
  await page.goBack(); await expect(page.locator('#new-page')).toBeVisible();
  await page.goForward(); await expect(page.locator('#score svg')).toHaveAttribute('data-key-signature', 'unknown');
  await page.locator('#score-tonic').selectOption('F#'); await page.locator('#score-minor').check();
  await page.getByRole('button', { name: 'Re-transcribe', exact: true }).click();
  await expect(page.locator('#score svg')).toHaveAttribute('data-key-signature', 'F#m');
  await expect(page.locator('#key-status')).toContainText('Saved');
  expect(await page.locator('#score svg .vf-keysignature').count()).toBeGreaterThan(0);
  await page.locator('#play').click();
  await expect.poll(async () => Number(await page.locator('.score-cursor').getAttribute('data-seconds'))).toBeGreaterThan(0.1);
  await page.locator('#stop').click();
  await page.locator('#rail-toggle').click(); await expect(page.locator('#clip-nav')).toBeHidden();
  await page.locator('#rail-toggle').click();
  await page.locator(`#clip-list a[href="#clips/${b}"]`).click();
  await expect(page.locator('#result-title')).toHaveText('Older clip');
  await expect(page.locator('#score svg')).toHaveAttribute('data-key-signature', 'unknown');
  await page.goBack();
  await expect(page.locator('#result-title')).toHaveText('F sharp test');
  await expect(page.locator('#score svg')).toHaveAttribute('data-key-signature', 'F#m');
  await page.reload(); await expect(page.locator('#score svg')).toHaveAttribute('data-key-signature', 'F#m');
  await expect(page.locator('#score-tonic')).toHaveValue('F#'); await expect(page.locator('#score-minor')).toBeChecked();
  await page.locator('#score-tonic').selectOption('F'); await page.locator('#score-major').check();
  await page.getByRole('button', { name: 'Re-transcribe', exact: true }).click();
  await expect(page.locator('#score svg')).toHaveAttribute('data-key-signature', 'F');
  expect(postCount).toBe(1); expect(patchCount).toBe(2); expect(errors).toEqual([]);
  await page.screenshot({ path: 'work/workflow-desktop.png', fullPage: true });
});
test('duplicate names are rejected visibly and an optional initial key reaches upload', async ({ page }) => {
  await page.route('**/api/clip-name', route => route.fulfill({ json: { name: 'bright-river' } }));
  await page.route(/\/api\/jobs(\?.*)?$/, async route => {
    if (route.request().method() === 'GET') await route.fulfill({ json: [] });
    else {
      const params = new URL(route.request().url()).searchParams;
      expect(JSON.parse(params.get('key')!)).toEqual({ tonic: 'F#', mode: 'minor' });
      await route.fulfill({ status: 409, json: { error: 'A clip with that name already exists. Choose another name.' } });
    }
  });
  await page.goto('/'); await expect(page.locator('#clip-name')).toHaveValue('bright-river');
  await page.locator('#upload-tonic').selectOption('F#'); await page.locator('#upload-minor').check();
  await page.locator('#audio').setInputFiles({ name: 'source.wav', mimeType: 'audio/wav', buffer: Buffer.from('audio') });
  await page.getByRole('button', { name: 'Upload & transcribe', exact: true }).click();
  await expect(page.locator('#new-page')).toBeVisible(); await expect(page.locator('#upload-status')).toContainText('already exists');
  await expect(page.locator('#clip-name')).toHaveValue('bright-river');
});
test('mobile rail expands and selecting a saved clip closes it without layout overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const item = clip(a, 'Saved harmony'); item.notationKey = { tonic: 'F#', mode: 'minor' };
  await page.route(/\/api\/jobs$/, route => route.fulfill({ json: [item] }));
  await page.route('**/api/jobs/*/midi', route => route.fulfill({ contentType: 'audio/midi', body: midiBytes() }));
  await page.goto('/'); await expect(page.locator('#clip-nav')).toBeHidden();
  await page.locator('#rail-toggle').click(); await page.locator('#clip-list a').click();
  await expect(page.locator('#clip-nav')).toBeHidden();
  await expect(page.locator('#score svg')).toHaveAttribute('data-key-signature', 'F#m');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'work/workflow-mobile.png', fullPage: true });
});
test('a slow previous MIDI response cannot replace the newly selected clip', async ({ page }) => {
  const first = clip(a, 'Slow clip'), second = clip(b, 'Chosen clip');
  second.notationKey = { tonic: 'G', mode: 'major' };
  let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/api\/jobs$/, route => route.fulfill({ json: [first, second] }));
  await page.route(`**/api/jobs/${a}/midi`, async route => { await waiting; await route.fulfill({ contentType: 'audio/midi', body: midiBytes() }); });
  await page.route(`**/api/jobs/${b}/midi`, route => route.fulfill({ contentType: 'audio/midi', body: midiBytes() }));
  await page.goto(`/#clips/${a}`); await expect(page.locator('#result-title')).toHaveText('Slow clip');
  await page.locator(`#clip-list a[href="#clips/${b}"]`).click();
  await expect(page.locator('#score svg')).toHaveAttribute('data-key-signature', 'G');
  release(); await page.waitForTimeout(150);
  await expect(page.locator('#result-title')).toHaveText('Chosen clip');
  await expect(page.locator('#score svg')).toHaveAttribute('data-key-signature', 'G');
});

test('optional source times are validated before upload and retained in source measure labels', async ({ page }) => {
  let uploaded = false;
  const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const item = { id, name: 'cropped-clip', createdAt: Date.now(), notationKey: null, progress: { stage: 'complete' }, report: { noteCount: 3, durationSeconds: 30, runtimeSeconds: 1, peakMemoryMiB: 1, warnings: [], sourceRange: { startSeconds: 90, endSeconds: 120, sourceDurationSeconds: 180 } } };
  await page.route('**/api/clip-name', route => route.fulfill({ json: { name: 'cropped-clip' } }));
  await page.route(/\/api\/jobs(\?.*)?$/, route => {
    if (route.request().method() === 'POST') {
      const params = new URL(route.request().url()).searchParams;
      expect(JSON.parse(params.get('range')!)).toEqual({ startSeconds: 90, endSeconds: 120 });
      uploaded = true; return route.fulfill({ status: 202, json: item });
    }
    return route.fulfill({ json: uploaded ? [item] : [] });
  });
  await page.route('**/api/jobs/*/midi', route => route.fulfill({ contentType: 'audio/midi', body: midiBytes() }));
  await page.goto('/'); await expect(page.locator('#clip-name')).toHaveValue('cropped-clip');
  await page.locator('#range-options summary').click();
  await page.locator('#range-start').fill('1:30'); await page.locator('#range-end').fill('1:00');
  await page.locator('#audio').setInputFiles({ name: 'full.wav', mimeType: 'audio/wav', buffer: Buffer.from('mocked audio') });
  await page.getByRole('button', { name: 'Upload & transcribe', exact: true }).click();
  await expect(page.locator('#upload-status')).toContainText('End time must be after'); expect(uploaded).toBe(false);
  await page.locator('#range-end').fill('2:00');
  await page.getByRole('button', { name: 'Upload & transcribe', exact: true }).click();
  await expect(page.locator('.bar-label').first()).toHaveText('Provisional measure 1 · Source 1:30.0');
  await page.reload(); await expect(page.locator('.bar-label').first()).toContainText('Source 1:30.0');
});

test('rail trash confirms the clip name, cancellation preserves it, and deleting another clip keeps current playback', async ({ page }) => {
  const a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const saved = (id: string, name: string) => ({ id, name, createdAt: Date.now(), progress: { stage: 'complete' }, notationKey: null });
  let items = [saved(a, 'gentle-willow'), saved(b, 'bright-river')], deletions = 0;
  await page.route(/\/api\/jobs$/, route => route.fulfill({ json: items }));
  await page.route(/\/api\/jobs\/[^/]+$/, route => {
    expect(route.request().method()).toBe('DELETE'); deletions++;
    items = items.filter(item => !route.request().url().endsWith(item.id));
    return route.fulfill({ json: { deleted: true } });
  });
  await page.route('**/api/jobs/*/midi', route => route.fulfill({ contentType: 'audio/midi', body: midiBytes() }));
  await page.goto(`/#clips/${a}`); await expect(page.locator('#score svg')).toBeVisible();
  page.once('dialog', async dialog => { expect(dialog.message()).toBe('Delete bright-river?'); await dialog.dismiss(); });
  await page.getByRole('button', { name: 'Delete bright-river', exact: true }).click();
  expect(deletions).toBe(0); await expect(page.locator(`#clip-list a[href="#clips/${b}"]`)).toBeVisible();
  await page.locator('#play').click();
  page.once('dialog', async dialog => { expect(dialog.message()).toBe('Delete bright-river?'); await dialog.accept(); });
  await page.getByRole('button', { name: 'Delete bright-river', exact: true }).click();
  await expect(page.locator(`#clip-list a[href="#clips/${b}"]`)).toHaveCount(0);
  await expect(page.locator('#result-title')).toHaveText('gentle-willow'); await expect(page.locator('#play')).toHaveText('Pause');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete gentle-willow', exact: true }).click();
  await expect(page.locator('#new-page')).toBeVisible(); expect(deletions).toBe(2);
  await expect(page.locator('#clips-empty')).toBeVisible();
});
