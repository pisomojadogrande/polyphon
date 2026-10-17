import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accidentalsForBar, buildRawScore, spellPitch, splitRhythm, tickAtTime, tiedPitches } from '../src/notation.ts';
const n = (midi: number, time: number, duration: number) => ({ midi, time, duration, velocity: 0.8 });
test('grand staff keeps overlapping harmonies and rests without changing source MIDI', () => {
  const notes = [n(48, 0, 2.5), n(60, 0, 1), n(64, 0, 1), n(67, 0.5, 0.5), n(73, 3, 0.3)];
  const copy = structuredClone(notes), score = buildRawScore(notes);
  assert.deepEqual(notes, copy); assert.equal(score.bars.length, 2);
  for (const bar of score.bars) for (const staff of [bar.treble, bar.bass]) {
    assert.equal(staff.reduce((sum, e) => sum + e.length, 0), 16, 'Every provisional measure must be metrically complete');
    assert.ok(staff.every(e => e.tick >= bar.index * 16 && e.tick + e.length <= (bar.index + 1) * 16));
  }
  assert.ok(score.bars[0].treble.some(e => e.tones.length === 3));
  assert.ok(score.bars[1].treble.some(e => e.tones.length === 0));
  assert.ok(score.bars.flatMap(b => b.treble).every(e => e.tones.every(t => t.midi >= 60)));
  assert.ok(score.bars.flatMap(b => b.bass).every(e => e.tones.every(t => t.midi < 60)));
});
test('sustains tie across bars, but repeated notes are rearticulated', () => {
  const score = buildRawScore([n(60, 0, 2.5), n(60, 2.5, 0.5)]);
  const events = score.bars.flatMap(b => b.treble);
  assert.deepEqual(tiedPitches(events[0], events[1]), [60]);
  const repeated = events.findIndex(e => e.tick === 20);
  assert.ok(repeated > 0); assert.deepEqual(tiedPitches(events[repeated - 1], events[repeated]), []);
});
test('unisons are deduplicated while overlapping source IDs preserve continuity', () => {
  const score = buildRawScore([n(60, 0, 1), n(60, 0.5, 1)]);
  const events = score.bars[0].treble;
  assert.equal(events[1].tones.length, 1); assert.equal(events[1].tones[0].ids.length, 2);
  assert.deepEqual(tiedPitches(events[0], events[1]), [60]);
  assert.deepEqual(tiedPitches(events[1], events[2]), [60]);
});
test('rhythm splitting handles dotted values and bar boundaries', () => {
  assert.deepEqual(splitRhythm(0, 6, [])[0], { tick: 0, length: 6, duration: 'q', dotted: true, tones: [] });
  assert.deepEqual(splitRhythm(12, 8, []).map(e => [e.tick, e.length]), [[12, 4], [16, 4]]);
});
test('accidentals include repeated chromatic signs and natural cancellations', () => {
  const score = buildRawScore([n(61, 0, 0.5), n(61, 0.5, 0.5), n(60, 1, 0.5), n(60, 1.5, 0.5)]);
  const events = score.bars[0].treble;
  assert.deepEqual(accidentalsForBar(events), [['#'], ['#'], ['n'], [null]]);
  assert.equal(spellPitch(63).key, 'eb/4'); assert.equal(spellPitch(70).key, 'bb/4');
  assert.equal(spellPitch(0).key, 'c/-1'); assert.equal(spellPitch(127).key, 'g/9');
});
test('cursor reaches displayed onsets at source time, including after long rests', () => {
  const score = buildRawScore([n(60, 0.19, 0.15), n(64, 3.09, 0.1), n(67, 11.12, 0.8)]);
  for (const time of [0.19, 3.09, 11.12]) assert.equal(tickAtTime(score.anchors, time), Math.round(time * 8));
  assert.equal(tickAtTime(score.anchors, -1), 0);
  assert.equal(tickAtTime(score.anchors, 1000), score.anchors.at(-1)?.tick);
  let previous = 0;
  for (let time = 0; time <= score.duration; time += 0.01) { const tick = tickAtTime(score.anchors, time); assert.ok(tick >= previous); previous = tick; }
});
test('empty and invalid MIDI are safe, and oversized notation is bounded', () => {
  assert.deepEqual(buildRawScore([]).bars, []);
  const invalid = buildRawScore([n(60, 0, 0), n(128, 0, 1), n(60, Number.NaN, 1)]);
  assert.equal(invalid.noteCount, 0); assert.equal(invalid.warnings.length, 1);
  assert.throws(() => buildRawScore([n(60, 0, 601)]), /10 minutes/);
  assert.throws(() => buildRawScore(Array.from({ length: 50001 }, () => n(60, 0, 1))), /50,000/);
});
test('simultaneous natural/chromatic unisons explicitly disambiguate both heads', () => {
  const events = buildRawScore([n(60, 0, 0.5), n(61, 0, 0.5), n(60, 0.5, 0.5)]).bars[0].treble;
  const signs = accidentalsForBar(events);
  assert.deepEqual(signs[0], ['n', '#']); assert.deepEqual(signs[1], ['n']);
});
