import { keySpelling, signatureAccidentals } from './keys.ts';
import type { MusicalKey } from './keys.ts';
/** Display-only notation. Source MIDI times and pitches are never rewritten. */
export interface SourceNote { midi: number; time: number; duration: number; velocity: number; }
export interface Tone { midi: number; ids: number[]; }
export interface ScoreEvent { tick: number; length: number; duration: string; dotted: boolean; tones: Tone[]; }
export interface ScoreBar { index: number; treble: ScoreEvent[]; bass: ScoreEvent[]; }
export interface TimeAnchor { seconds: number; tick: number; }
export interface RawScore { bars: ScoreBar[]; anchors: TimeAnchor[]; duration: number; noteCount: number; warnings: string[]; }
export const TICKS_PER_BAR = 16;
export const TICKS_PER_SECOND = 8; // Sixteenths on a provisional 120 BPM / 4/4 display grid.
const SPELLINGS = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b'];
export function spellPitch(midi: number, key: MusicalKey | null = null) {
  if (key) return keySpelling(midi, key);
  const spelling = SPELLINGS[midi % 12], octave = Math.floor(midi / 12) - 1;
  return { key: `${spelling}/${octave}`, accidental: spelling.slice(1) || 'n', position: `${spelling[0]}/${octave}` };
}
const VALUES = [
  { length: 16, duration: 'w', base: 16 }, { length: 12, duration: 'h', base: 8 },
  { length: 8, duration: 'h', base: 8 }, { length: 6, duration: 'q', base: 4 },
  { length: 4, duration: 'q', base: 4 }, { length: 3, duration: '8', base: 2 },
  { length: 2, duration: '8', base: 2 }, { length: 1, duration: '16', base: 1 },
];
export function splitRhythm(tick: number, length: number, tones: Tone[]): ScoreEvent[] {
  const events: ScoreEvent[] = [];
  while (length > 0) {
    const inBar = tick % TICKS_PER_BAR;
    const value = VALUES.find(v => v.length <= length && inBar + v.length <= TICKS_PER_BAR && inBar % v.base === 0)!;
    events.push({ tick, length: value.length, duration: value.duration, dotted: value.length !== value.base, tones });
    tick += value.length; length -= value.length;
  }
  return events;
}
export function tiedPitches(previous: ScoreEvent, current: ScoreEvent): number[] {
  if (previous.tick + previous.length !== current.tick) return [];
  return current.tones.filter(t => previous.tones.some(p => p.midi === t.midi && p.ids.some(id => t.ids.includes(id)))).map(t => t.midi);
}
export function buildRawScore(source: readonly SourceNote[]): RawScore {
  if (source.length > 50000) throw new Error('This notation experiment supports at most 50,000 MIDI notes. Try a shorter excerpt.');
  const valid = source.filter(n => Number.isInteger(n.midi) && n.midi >= 0 && n.midi <= 127 && Number.isFinite(n.time) && n.time >= 0 && Number.isFinite(n.duration) && n.duration > 0);
  const duration = valid.reduce((end, n) => Math.max(end, n.time + n.duration), 0);
  if (duration > 600) throw new Error('Notation supports excerpts up to 10 minutes. Try a shorter MIDI file.');
  const warnings = [];
  if (valid.length !== source.length) warnings.push('Invalid or zero-length MIDI notes were omitted from notation.');
  if (!valid.length) return { bars: [], anchors: [], duration: 0, noteCount: 0, warnings };
  const notes = valid.map((note, id) => {
    const start = Math.round(note.time * TICKS_PER_SECOND);
    return { ...note, id, start, end: Math.max(start + 1, Math.round((note.time + note.duration) * TICKS_PER_SECOND)) };
  });
  const end = Math.max(...notes.map(n => n.end));
  const barCount = Math.ceil(end / TICKS_PER_BAR);
  // Sweep quantized boundaries independently per staff, avoiding needless ties in the other staff.
  function staffEvents(treble: boolean): ScoreEvent[] {
    const changes = new Map<number, { add: typeof notes; remove: typeof notes }>();
    const change = (tick: number) => { if (!changes.has(tick)) changes.set(tick, { add: [], remove: [] }); return changes.get(tick)!; };
    change(0); change(barCount * TICKS_PER_BAR);
    for (const note of notes) if ((note.midi >= 60) === treble) { change(note.start).add.push(note); change(note.end).remove.push(note); }
    const ticks = [...changes.keys()].sort((a, b) => a - b), active = new Map<number, typeof notes[number]>();
    const result: ScoreEvent[] = [];
    for (let i = 0; i < ticks.length - 1; i++) {
      const tick = ticks[i], delta = changes.get(tick)!;
      for (const note of delta.remove) active.delete(note.id);
      for (const note of delta.add) active.set(note.id, note);
      const pitches = new Map<number, number[]>();
      for (const note of active.values()) { const ids = pitches.get(note.midi) ?? []; ids.push(note.id); pitches.set(note.midi, ids); }
      const tones = [...pitches].sort(([a], [b]) => a - b).map(([midi, ids]) => ({ midi, ids }));
      result.push(...splitRhythm(tick, ticks[i + 1] - tick, tones));
    }
    return result;
  }
  const bars: ScoreBar[] = Array.from({ length: barCount }, (_, index) => ({ index, treble: [], bass: [] }));
  for (const event of staffEvents(true)) bars[Math.floor(event.tick / TICKS_PER_BAR)].treble.push(event);
  for (const event of staffEvents(false)) bars[Math.floor(event.tick / TICKS_PER_BAR)].bass.push(event);
  const anchors: TimeAnchor[] = [{ seconds: 0, tick: 0 }];
  for (const note of [...notes].sort((a, b) => a.time - b.time)) {
    const last = anchors[anchors.length - 1];
    if (note.time > last.seconds) anchors.push({ seconds: note.time, tick: note.start });
  }
  if (duration > anchors[anchors.length - 1].seconds) anchors.push({ seconds: duration, tick: end });
  return { bars, anchors, duration, noteCount: valid.length, warnings };
}
export function tickAtTime(anchors: readonly TimeAnchor[], seconds: number): number {
  if (!anchors.length || seconds <= 0) return 0;
  let low = 0, high = anchors.length - 1;
  if (seconds >= anchors[high].seconds) return anchors[high].tick;
  while (low + 1 < high) { const middle = Math.floor((low + high) / 2); if (anchors[middle].seconds <= seconds) low = middle; else high = middle; }
  const a = anchors[low], b = anchors[high];
  return a.tick + (b.tick - a.tick) * (seconds - a.seconds) / (b.seconds - a.seconds);
}
/** Source time at a displayed tick; plateaus use their earliest source time. */
export function timeAtTick(anchors: readonly TimeAnchor[], tick: number): number {
  if (!anchors.length || tick <= 0) return 0;
  let low = 0, high = anchors.length - 1;
  if (tick > anchors[high].tick) return anchors[high].seconds;
  while (low + 1 < high) { const middle = Math.floor((low + high) / 2); if (anchors[middle].tick < tick) low = middle; else high = middle; }
  const a = anchors[low], b = anchors[high];
  return b.tick === a.tick ? a.seconds : a.seconds + (b.seconds - a.seconds) * (tick - a.tick) / (b.tick - a.tick);
}
export function sourceTimestamp(seconds: number): string {
  const tenths = Math.round(Math.max(0, seconds) * 10);
  return `${Math.floor(tenths / 600)}:${(Math.floor(tenths / 10) % 60).toString().padStart(2, '0')}.${tenths % 10}`;
}
/** Explicit chromatic signs, plus cancellations so C after C# never reads as C#. */
export function accidentalsForBar(events: readonly ScoreEvent[], key: MusicalKey | null = null): (string | null)[][] {
  const defaults = signatureAccidentals(key);
  const state = new Map<string, string>();
  return events.map(event => {
    const previous = new Map(state), simultaneous = new Map<string, Set<string>>();
    for (const tone of event.tones) {
      const p = spellPitch(tone.midi, key), signs = simultaneous.get(p.position) ?? new Set<string>();
      signs.add(p.accidental); simultaneous.set(p.position, signs);
    }
    const result = event.tones.map(tone => {
      const p = spellPitch(tone.midi, key);
      const current = previous.get(p.position) ?? defaults[p.position[0]];
      return simultaneous.get(p.position)!.size > 1 || (key ? p.accidental !== current : p.accidental !== 'n' || current !== 'n') ? p.accidental : null;
    });
    for (const tone of event.tones) { const p = spellPitch(tone.midi, key); state.set(p.position, simultaneous.get(p.position)!.size > 1 ? 'mixed' : p.accidental); }
    return result;
  });
}
