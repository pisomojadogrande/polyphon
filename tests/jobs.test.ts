import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, access, mkdir, utimes, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Jobs, RETENTION_MS } from '../src/jobs.ts';
import type { Report } from '../src/contracts.ts';
const report: Report = { schemaVersion: 1, engine: 'fake', backend: 'fake', durationSeconds: 1, noteCount: 1, runtimeSeconds: 1, peakMemoryMiB: 1, stageSeconds: {}, guidance: { tempo: 120, timeSignature: [4, 4] }, warnings: [] };
async function waitUntil(fn: () => boolean) { const limit = Date.now() + 2000; while (!fn()) { if (Date.now() > limit) throw new Error('Timed out'); await new Promise(r => setTimeout(r, 10)); } }
async function directory(t: { after: (fn: () => Promise<void>) => void }) { const dir = await mkdtemp(join(tmpdir(), 'polyphon-jobs-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }
test('queue is serial and deletes uploads after success and failure; recovers saved results', async t => {
  const dir = await directory(t); let running = 0, peak = 0;
  const jobs = new Jobs(dir, async options => {
    running++; peak = Math.max(peak, running); await new Promise(r => setTimeout(r, 30)); running--;
    if (options.input.endsWith('bad.wav')) throw new Error('bad audio');
    await mkdir(options.output, { recursive: true });
    const midiPath = join(options.output, 'transcription.mid'), reportPath = join(options.output, 'report.json');
    await writeFile(midiPath, 'midi'); await writeFile(reportPath, JSON.stringify(report));
    return { midiPath, reportPath, report };
  });
  await jobs.initialize();
  const good = join(dir, 'uploads/good.wav'), bad = join(dir, 'uploads/bad.wav');
  await writeFile(good, 'good'); await writeFile(bad, 'bad');
  const a = await jobs.add(good, 'good.wav', report.guidance), b = await jobs.add(bad, 'bad.wav', report.guidance);
  await waitUntil(() => jobs.pending === 0);
  assert.equal(peak, 1); assert.equal(a.progress.stage, 'complete'); assert.equal(b.progress.stage, 'failed');
  await assert.rejects(access(good)); await assert.rejects(access(bad));
  const restored = new Jobs(dir); await restored.initialize(); assert.equal(restored.jobs.get(a.id)?.name, 'good.wav');
  await restored.delete(a.id); await assert.rejects(access(jobs.output(a.id)));
});
test('startup clears interrupted uploads, TTL and cap remove oldest results', async t => {
  const dir = await directory(t); await mkdir(join(dir, 'uploads'), { recursive: true }); await writeFile(join(dir, 'uploads/stale.wav'), 'private');
  const jobs = new Jobs(dir); await jobs.initialize(); await assert.rejects(access(join(dir, 'uploads/stale.wav')));
  const old = jobs.output('old'), newer = jobs.output('new');
  for (const path of [old, newer]) { await mkdir(path); await writeFile(join(path, 'file'), '12345'); }
  const now = Date.now(); await utimes(old, new Date(now - 5000), new Date(now - 5000));
  await jobs.prune(now, 5); await assert.rejects(access(old)); assert.equal(await readFile(join(newer, 'file'), 'utf8'), '12345');
  await jobs.prune(now + RETENTION_MS + 1); await assert.rejects(access(newer));
});
test('cancellation removes queued input and aborts active worker', async t => {
  const dir = await directory(t);
  const jobs = new Jobs(dir, options => new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })));
  await jobs.initialize(); const inputs = ['one', 'two'].map(n => join(dir, 'uploads', n + '.wav'));
  for (const input of inputs) await writeFile(input, 'clip');
  const first = await jobs.add(inputs[0], 'one.wav', report.guidance), second = await jobs.add(inputs[1], 'two.wav', report.guidance);
  await jobs.delete(second.id); await jobs.delete(first.id);
  assert.equal(jobs.pending, 0); assert.equal(jobs.jobs.size, 0);
  for (const input of inputs) await assert.rejects(access(input));
});
test('shutdown cancels pending work and refuses new jobs', async t => {
  const dir = await directory(t);
  const jobs = new Jobs(dir, options => new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })));
  await jobs.initialize(); const input = join(dir, 'uploads/clip.wav'); await writeFile(input, 'clip');
  await jobs.add(input, 'clip.wav', report.guidance); await jobs.shutdown();
  assert.equal(jobs.pending, 0); await assert.rejects(access(input));
  await assert.rejects(jobs.add(input, 'clip.wav', report.guidance), /shutting down/);
});
test('names are reserved across concurrent uploads and released only by cancellation/deletion', async t => {
  const dir = await directory(t); const jobs = new Jobs(dir, async () => { throw new Error('Invalid audio'); }); await jobs.initialize();
  const reservation = jobs.reserveName('  My   Clip  '); assert.equal(reservation.name, 'My Clip');
  assert.throws(() => jobs.reserveName('my clip'), /already exists/);
  assert.notEqual(jobs.suggestName(), 'My Clip'); jobs.releaseName(reservation);
  const again = jobs.reserveName('MY CLIP'); jobs.releaseName(again);
  const input = join(dir, 'uploads/bad.wav'); await writeFile(input, 'invalid');
  const job = await jobs.add(input, 'My Clip', report.guidance); await waitUntil(() => jobs.pending === 0);
  assert.throws(() => jobs.reserveName('my clip'), /already exists/);
  await jobs.delete(job.id); const reusable = jobs.reserveName('my clip'); jobs.releaseName(reusable);
});
test('legacy duplicate labels migrate without losing MIDI; interrupted clips recover as failures', async t => {
  const dir = await directory(t);
  const ids = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'];
  for (const [i, id] of ids.entries()) {
    const path = join(dir, 'outputs', id); await mkdir(path, { recursive: true });
    await writeFile(join(path, 'job.json'), JSON.stringify({ name: i < 2 ? 'same.wav' : 'unfinished', createdAt: Date.now(), ...(i === 2 ? { progress: { stage: 'queued' } } : {}) }));
    if (i < 2) { await writeFile(join(path, 'transcription.mid'), 'original MIDI'); await writeFile(join(path, 'report.json'), JSON.stringify({ ...report, guidance: { ...report.guidance, key: 'F-sharp minor' } })); }
  }
  await mkdir(join(dir, 'uploads')); await writeFile(join(dir, 'uploads/private.wav'), 'audio');
  const jobs = new Jobs(dir); await jobs.initialize();
  assert.equal(jobs.jobs.get(ids[0])?.name, 'same.wav'); assert.equal(jobs.jobs.get(ids[1])?.name, 'same.wav (2)');
  assert.deepEqual(jobs.jobs.get(ids[0])?.notationKey, { tonic: 'F#', mode: 'minor' });
  assert.equal(await readFile(join(jobs.output(ids[1]), 'transcription.mid'), 'utf8'), 'original MIDI');
  assert.equal(jobs.jobs.get(ids[2])?.progress.stage, 'failed'); await assert.rejects(access(join(dir, 'uploads/private.wav')));
  assert.throws(() => jobs.reserveName('unfinished'), /already exists/);
  const restored = new Jobs(dir); await restored.initialize(); assert.equal(restored.jobs.get(ids[1])?.name, 'same.wav (2)');
});
