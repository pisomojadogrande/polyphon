import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyInfo, keySpelling, legacyKey, parseMusicalKey, signatureAccidentals, TONICS } from '../src/keys.ts';
import { accidentalsForBar, buildRawScore, spellPitch } from '../src/notation.ts';
const fMinor = { tonic: 'F#', mode: 'minor' } as const;
const n = (midi: number, time = 0) => ({ midi, time, duration: 0.5, velocity: 0.8 });
test('F-sharp minor has three sharps and diatonic notes require no inline signs', () => {
  assert.equal(keyInfo(fMinor).signature, 'F#m'); assert.equal(keyInfo(fMinor).fifths, 3);
  assert.deepEqual(signatureAccidentals(fMinor), { c: '#', d: 'n', e: 'n', f: '#', g: '#', a: 'n', b: 'n' });
  const notes = [66, 68, 69, 71].map((midi, i) => n(midi, i * 0.5)); const copy = structuredClone(notes);
  const events = buildRawScore(notes).bars[0].treble;
  assert.deepEqual(accidentalsForBar(events, fMinor), [[null], [null], [null], [null]]);
  assert.deepEqual(notes, copy);
});
test('key spelling handles minor leading tones, flat keys and enharmonic octave boundaries', () => {
  assert.equal(spellPitch(65, fMinor).key, 'e#/4');
  assert.equal(spellPitch(70, { tonic: 'F', mode: 'major' }).key, 'bb/4');
  assert.equal(spellPitch(60, { tonic: 'C#', mode: 'major' }).key, 'b#/3');
  assert.equal(spellPitch(59, { tonic: 'Cb', mode: 'major' }).key, 'cb/4');
  assert.equal(spellPitch(69, { tonic: 'A#', mode: 'minor' }).key, 'g##/4');
});
test('chromatic alterations cancel correctly inside a key and reset at bar boundaries', () => {
  const events = buildRawScore([n(67, 0), n(68, 0.5), n(65, 1), n(64, 1.5), n(68, 2)]).bars;
  assert.deepEqual(accidentalsForBar(events[0].treble, fMinor), [['n'], ['#'], ['#'], ['n']]);
  assert.equal(accidentalsForBar(events[1].treble, fMinor)[0][0], null);
});
test('every offered key preserves every MIDI pitch when re-spelled', () => {
  const naturals: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const offsets: Record<string, number> = { n: 0, '#': 1, b: -1, '##': 2, bb: -2 };
  for (const tonic of TONICS) for (const mode of ['major', 'minor'] as const) {
    const key = { tonic, mode }; assert.ok(Math.abs(keyInfo(key).fifths) <= 7);
    for (let midi = 0; midi <= 127; midi++) {
      const s = keySpelling(midi, key), octave = Number(s.position.split('/')[1]);
      assert.equal((octave + 1) * 12 + naturals[s.position[0]] + offsets[s.accidental], midi);
    }
  }
});
test('key validation and legacy guidance migration are explicit', () => {
  assert.deepEqual(parseMusicalKey(fMinor), fMinor); assert.equal(parseMusicalKey(null), null);
  for (const value of ['F# minor', {}, { tonic: 'H', mode: 'minor' }, { tonic: 'F#', mode: 'dorian' }]) assert.throws(() => parseMusicalKey(value));
  assert.deepEqual(legacyKey('F-sharp minor'), fMinor); assert.deepEqual(legacyKey('F♯ minor'), fMinor);
  assert.equal(legacyKey('not sure'), null);
  assert.equal(keyInfo({ tonic: 'D#', mode: 'major' }).tonic, 'Eb');
});
