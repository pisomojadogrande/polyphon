export type Stage = 'queued' | 'loading' | 'decoding' | 'inference' | 'notes' | 'writing' | 'complete' | 'failed';
export interface Progress { stage: Stage; percent?: number; completed?: number; total?: number; }
export interface Guidance { tempo: number; timeSignature: [number, number]; key?: string; voices?: string; }
export interface AudioRange { startSeconds: number; endSeconds?: number; }
export interface Report {
  sourceRange?: { startSeconds: number; endSeconds: number; sourceDurationSeconds: number };
  schemaVersion: 1; engine: string; backend: string; durationSeconds: number; noteCount: number;
  runtimeSeconds: number; peakMemoryMiB: number; stageSeconds: Record<string, number>;
  guidance: Guidance; warnings: string[];
}
export interface Result { midiPath: string; reportPath: string; report: Report; }
export const MAX_BYTES = 64 * 1024 * 1024;
export const MAX_SECONDS = 600;
export const EXTENSIONS = new Set(['.wav', '.flac', '.mp3', '.ogg', '.m4a']);
export function parseGuidance(value: unknown): Guidance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Guidance must be an object');
  const v = value as Record<string, unknown>;
  const tempo = v.tempo === undefined ? 120 : Number(v.tempo);
  if (!Number.isFinite(tempo) || tempo < 20 || tempo > 300) throw new Error('Tempo must be 20–300 BPM');
  const ts = v.timeSignature ?? [4, 4];
  if (!Array.isArray(ts) || ts.length !== 2 || !Number.isInteger(ts[0]) || ts[0] < 1 || ts[0] > 32 || ![1, 2, 4, 8, 16, 32].includes(ts[1])) throw new Error('Invalid time signature');
  for (const key of ['key', 'voices']) if (v[key] !== undefined && (typeof v[key] !== 'string' || (v[key] as string).length > 200)) throw new Error(`${key} must be at most 200 characters`);
  return { tempo, timeSignature: [ts[0], ts[1]], ...(v.key ? { key: v.key as string } : {}), ...(v.voices ? { voices: v.voices as string } : {}) };
}

/** Accept source seconds in the API and seconds or m:ss / h:mm:ss in text inputs. */
export function parseSourceTime(value: string): number {
  const text = value.trim();
  if (!/^(?:\d+:)?(?:\d+:)?\d+(?:\.\d+)?$/.test(text)) throw new Error('Use seconds, m:ss, or h:mm:ss for source times');
  const parts = text.split(':').map(Number);
  if (parts.length > 1 && parts.slice(1).some(n => n >= 60)) throw new Error('Minutes/seconds after a colon must be below 60');
  return parts.reduce((total, part) => total * 60 + part, 0);
}
export function parseAudioRange(value: unknown): AudioRange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Source range must be an object');
  const v = value as Record<string, unknown>, start = v.startSeconds ?? 0, end = v.endSeconds;
  if (typeof start !== 'number' || !Number.isFinite(start) || start < 0) throw new Error('Start time must be non-negative seconds');
  if (end !== undefined && (typeof end !== 'number' || !Number.isFinite(end) || end <= start)) throw new Error('End time must be after start time');
  if (typeof end === 'number' && end - start > MAX_SECONDS) throw new Error('Select at most 10 minutes to transcribe');
  return { startSeconds: start, ...(typeof end === 'number' ? { endSeconds: end } : {}) };
}
