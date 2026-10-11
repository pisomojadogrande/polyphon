import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGuidance } from '../src/contracts.ts';
import { scheduleNotes } from '../web/player.ts';
test('guidance preserves hints and validates MIDI grid', () => {
  assert.deepEqual(parseGuidance({}), { tempo: 120, timeSignature: [4, 4] });
  assert.deepEqual(parseGuidance({ tempo: '88', timeSignature: [6, 8], key: 'D minor', voices: 'SATB' }), { tempo: 88, timeSignature: [6, 8], key: 'D minor', voices: 'SATB' });
  for (const value of [{ tempo: 'bad' }, { tempo: 301 }, { timeSignature: [3, 3] }, { timeSignature: [0, 4] }, { timeSignature: [4.5, 4] }, { voices: 'a'.repeat(201) }, null]) assert.throws(() => parseGuidance(value));
});
test('playback seeking retains sustained notes, skips ended notes, scales time', () => {
  const scheduled = scheduleNotes([
    { midi: 60, time: 0, duration: 1, velocity: 1 },
    { midi: 64, time: 1, duration: 3, velocity: 0.5 },
    { midi: 67, time: 3, duration: 1, velocity: 0.5 },
  ], 2, 0.5);
  assert.equal(scheduled.length, 2);
  assert.equal(scheduled[0].delay, 0); assert.equal(scheduled[0].length, 4);
  assert.equal(scheduled[1].delay, 2); assert.equal(scheduled[1].length, 2);
});
