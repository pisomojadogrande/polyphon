import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { transcribe } from '../src/transcription.ts';
const metrics = { schemaVersion: 1, engine: 'fixture', backend: 'fixture', durationSeconds: 1, runtimeSeconds: 1, noteCount: 0, peakMemoryMiB: 1, stageSeconds: {}, warnings: [] };
async function setup(t: { after: (fn: () => Promise<void>) => void }, code: string) {
  const dir = await mkdtemp(join(tmpdir(), 'polyphon-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, 'clip.wav'), worker = join(dir, 'worker.cjs'), output = join(dir, 'out');
  await writeFile(input, 'audio'); await writeFile(worker, code);
  return { dir, input, worker, output, python: process.execPath };
}
test('process protocol delivers progress, writes MIDI/report, preserves CLI source', async t => {
  const options = await setup(t, `const fs=require('node:fs');const out=process.argv[process.argv.indexOf('--output')+1];fs.writeFileSync(out,Buffer.from('4d546864000000060000000100604d54726b0000000400ff2f00','hex'));console.log(JSON.stringify({stage:'inference',percent:100,completed:2,total:2}));console.log(JSON.stringify({stage:'complete',metrics:${JSON.stringify(metrics)}}));`);
  const progress: string[] = [];
  const result = await transcribe({ ...options, onProgress: p => progress.push(p.stage) });
  assert.deepEqual(progress, ['inference', 'complete']);
  assert.equal((await readFile(result.midiPath)).subarray(0, 4).toString(), 'MThd');
  assert.equal(JSON.parse(await readFile(result.reportPath, 'utf8')).guidance.tempo, 120);
  assert.equal(await readFile(options.input, 'utf8'), 'audio');
  assert.deepEqual((await readdir(options.output)).sort(), ['report.json', 'transcription.mid']);
});
test('worker failure cleans temporary artifacts and reports error', async t => {
  const options = await setup(t, `console.log(JSON.stringify({stage:'failed',error:'Cannot decode audio'}));process.exit(1);`);
  await assert.rejects(transcribe(options), /Cannot decode audio/);
  assert.deepEqual(await readdir(options.output), []);
});
test('missing Python produces actionable setup error', async t => {
  const options = await setup(t, '');
  await assert.rejects(transcribe({ ...options, python: '/missing/polyphon-python' }), /Follow README setup/);
});
test('timeout kills worker and cleans temporary files', async t => {
  const options = await setup(t, 'setInterval(()=>{},1000)');
  await assert.rejects(transcribe({ ...options, timeoutMs: 100 }), /timed out/);
  assert.deepEqual(await readdir(options.output), []);
});
test('cancelled transcription rejects without publishing artifacts', async t => {
  const options = await setup(t, 'setInterval(()=>{},1000)');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(transcribe({ ...options, signal: controller.signal }), /cancelled/);
  assert.deepEqual(await readdir(options.output), []);
});
test('unsupported or empty inputs are rejected before worker starts', async t => {
  const options = await setup(t, 'throw new Error("should not run")');
  await writeFile(options.input, '');
  await assert.rejects(transcribe(options), /non-empty/);
  await assert.rejects(transcribe({ ...options, input: join(options.dir, 'clip.txt') }), /Supported files/);
});

test('source range reaches the worker before inference', async t => {
  const options = await setup(t, `const args=process.argv;if(args[args.indexOf('--start')+1]!=='90'||args[args.indexOf('--end')+1]!=='120')throw new Error('Missing range');console.log(JSON.stringify({stage:'failed',error:'Range delivered'}));process.exit(1);`);
  await assert.rejects(transcribe({ ...options, range: { startSeconds: 90, endSeconds: 120 } }), /Range delivered/);
  await assert.rejects(transcribe({ ...options, range: { startSeconds: 120, endSeconds: 90 } }), /End time/);
});
