export type Stage = 'queued' | 'loading' | 'decoding' | 'inference' | 'notes' | 'writing' | 'complete' | 'failed';
export interface Progress { stage: Stage; percent?: number; completed?: number; total?: number; }
export interface Guidance { tempo: number; timeSignature: [number, number]; key?: string; voices?: string; }
export interface Report {
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
