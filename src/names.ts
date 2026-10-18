import { randomInt } from 'node:crypto';
const FIRST = ['amber', 'autumn', 'bright', 'calm', 'cedar', 'clear', 'coral', 'crimson', 'dawn', 'gentle', 'golden', 'green', 'happy', 'hidden', 'ivory', 'jade', 'kind', 'little', 'lively', 'lucky', 'mellow', 'misty', 'quiet', 'rapid', 'silver', 'soft', 'spring', 'steady', 'sunny', 'sweet', 'warm', 'winter'];
const SECOND = ['badger', 'birch', 'brook', 'cloud', 'comet', 'cricket', 'daisy', 'dolphin', 'falcon', 'fern', 'finch', 'forest', 'fox', 'garden', 'harbor', 'heron', 'island', 'lake', 'lark', 'leaf', 'meadow', 'moon', 'otter', 'owl', 'pebble', 'pine', 'river', 'robin', 'sparrow', 'star', 'valley', 'willow'];
export class ConflictError extends Error { readonly status = 409; }
export function cleanName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Clip name must be text');
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80 || /[\p{Cc}\p{Cf}\/\\]/u.test(name)) throw new Error('Use a clip name of 1–80 characters without slashes or control characters');
  return name;
}
export function nameIdentity(name: string) { return cleanName(name).toLowerCase(); }
export function generatedName(available: (name: string) => boolean): string {
  const first = randomInt(FIRST.length), second = randomInt(SECOND.length);
  for (let i = 0; i < FIRST.length * SECOND.length; i++) {
    const index = (first * SECOND.length + second + i) % (FIRST.length * SECOND.length);
    const name = `${FIRST[Math.floor(index / SECOND.length)]}-${SECOND[index % SECOND.length]}`;
    if (available(name)) return name;
  }
  throw new Error('Generated names are in use. Please enter your own clip name.');
}
