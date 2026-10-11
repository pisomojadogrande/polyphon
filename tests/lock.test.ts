import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock } from '../src/lock.ts';
test('second local server cannot clear an active server data folder', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'polyphon-lock-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const release = await acquireLock(dir);
  await assert.rejects(acquireLock(dir), /Another Polyphon server/);
  assert.equal(await readFile(join(dir, 'server.lock/pid'), 'utf8'), String(process.pid));
  await release(); const releaseAgain = await acquireLock(dir); await releaseAgain();
});
