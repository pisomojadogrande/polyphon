export const TONICS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cb'] as const;
export type Tonic = typeof TONICS[number];
export interface MusicalKey { tonic: Tonic; mode: 'major' | 'minor'; }
export function parseMusicalKey(value: unknown): MusicalKey | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Choose a tonic and major or minor');
  const v = value as Record<string, unknown>;
  if (!TONICS.includes(v.tonic as Tonic) || !['major', 'minor'].includes(v.mode as string)) throw new Error('Choose a valid tonic and major or minor');
  return { tonic: v.tonic as Tonic, mode: v.mode as MusicalKey['mode'] };
}
const MAJOR: Record<string, number> = { Cb: -7, Gb: -6, Db: -5, Ab: -4, Eb: -3, Bb: -2, F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7 };
const MINOR: Record<string, number> = { Ab: -7, Eb: -6, Bb: -5, F: -4, C: -3, G: -2, D: -1, A: 0, E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6, 'A#': 7 };
const ENHARMONIC: Record<string, string> = { 'D#': 'Eb', 'G#': 'Ab', 'A#': 'Bb', Db: 'C#', Gb: 'F#', Cb: 'B' };
export function keyInfo(key: MusicalKey) {
  const table = key.mode === 'major' ? MAJOR : MINOR;
  const tonic = Object.hasOwn(table, key.tonic) ? key.tonic : ENHARMONIC[key.tonic];
  return { tonic, mode: key.mode, fifths: table[tonic], signature: tonic + (key.mode === 'minor' ? 'm' : ''), enharmonic: tonic !== key.tonic };
}
export function keyLabel(key: MusicalKey | null): string { return key ? `${key.tonic.replace('#', '♯').replace('b', '♭')} ${key.mode}` : 'Unknown key'; }
export function signatureAccidentals(key: MusicalKey | null): Record<string, string> {
  const result: Record<string, string> = { c: 'n', d: 'n', e: 'n', f: 'n', g: 'n', a: 'n', b: 'n' };
  if (key) {
    const fifths = keyInfo(key).fifths, order = fifths >= 0 ? ['f', 'c', 'g', 'd', 'a', 'e', 'b'] : ['b', 'e', 'a', 'd', 'g', 'c', 'f'];
    for (const letter of order.slice(0, Math.abs(fifths))) result[letter] = fifths > 0 ? '#' : 'b';
  }
  return result;
}
const NATURAL: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const OFFSETS: Record<string, number> = { n: 0, '#': 1, b: -1, '##': 2, bb: -2 };
const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
export function keySpelling(midi: number, key: MusicalKey) {
  const defaults = signatureAccidentals(key), info = keyInfo(key), pc = midi % 12;
  let letter = LETTERS.find(l => (NATURAL[l] + OFFSETS[defaults[l]] + 12) % 12 === pc);
  let accidental = letter ? defaults[letter] : 'n';
  if (!letter && key.mode === 'minor') {
    // Prefer the raised seventh's spelling, e.g. E# in F# minor, without altering its pitch.
    const tonicLetter = info.tonic[0].toLowerCase();
    const tonicPc = (NATURAL[tonicLetter] + (info.tonic.includes('#') ? 1 : info.tonic.includes('b') ? -1 : 0) + 12) % 12;
    if (pc === (tonicPc + 11) % 12) {
      letter = LETTERS[(LETTERS.indexOf(tonicLetter) + 6) % 7];
      const offset = OFFSETS[defaults[letter]] + 1;
      accidental = offset === 0 ? 'n' : offset === 1 ? '#' : '##';
    }
  }
  if (!letter) {
    const candidates = LETTERS.flatMap(l => [-1, 0, 1].filter(offset => (NATURAL[l] + offset + 12) % 12 === pc).map(offset => ({ letter: l, offset })));
    candidates.sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset) || (info.fifths < 0 ? a.offset - b.offset : b.offset - a.offset));
    letter = candidates[0].letter; accidental = candidates[0].offset === 0 ? 'n' : candidates[0].offset > 0 ? '#' : 'b';
  }
  const octave = (midi - NATURAL[letter] - OFFSETS[accidental]) / 12 - 1;
  return { key: `${letter}${accidental === 'n' ? '' : accidental}/${octave}`, accidental, position: `${letter}/${octave}` };
}
export function legacyKey(text: unknown): MusicalKey | null {
  if (typeof text !== 'string') return null;
  const normalized = text.trim().replace(/[- ]?sharp/gi, '#').replace(/[- ]?flat/gi, 'b').replaceAll('♯', '#').replaceAll('♭', 'b');
  const match = /^([A-G](?:#|b)?)\s+(major|minor)$/i.exec(normalized);
  if (!match) return null;
  try { return parseMusicalKey({ tonic: match[1][0].toUpperCase() + match[1].slice(1), mode: match[2].toLowerCase() }); } catch { return null; }
}
