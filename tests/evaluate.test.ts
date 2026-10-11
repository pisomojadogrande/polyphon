import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSamples } from '../src/evaluate.ts';
test('evaluation validates all samples before beginning any transcription', () => {
  assert.equal(parseSamples([{ name: 'solo', category: 'voice', input: 'solo.wav' }])[0].guidance.tempo, 120);
  for (const manifest of [[], {}, [{ name: 'solo', category: 'voice' }], [{ name: 'solo', category: 'voice', input: 'solo.wav', guidance: { tempo: 0 } }]]) assert.throws(() => parseSamples(manifest));
});
