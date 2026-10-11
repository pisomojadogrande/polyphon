import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transcribe } from './transcription.ts';
import { parseGuidance } from './contracts.ts';
import type { Guidance } from './contracts.ts';
interface Sample { name: string; category: string; input: string; guidance: Guidance; }
export function parseSamples(value: unknown): Sample[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error('Manifest must contain 1–20 samples');
  return value.map((v: Record<string, unknown>) => {
    if (!v || typeof v.input !== 'string' || !v.input || typeof v.name !== 'string' || !v.name || typeof v.category !== 'string') throw new Error('Each sample needs name, category, and input strings');
    return { input: v.input, name: v.name, category: v.category, guidance: parseGuidance(v.guidance ?? {}) };
  });
}
async function main() {
  const { values } = parseArgs({ options: { manifest: { type: 'string' }, out: { type: 'string' }, python: { type: 'string' } } });
  if (!values.manifest || !values.out) throw new Error('Usage: npm run evaluate -- --manifest work/recordings.json --out work/evaluation');
  const samples = parseSamples(JSON.parse(await readFile(values.manifest, 'utf8')));
  const batch = resolve(values.out, `batch-${Date.now()}`); await mkdir(batch, { recursive: true });
  const summary: unknown[] = [];
  const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
  for (const [index, sample] of samples.entries()) {
    if (controller.signal.aborted) break;
    console.error(`Evaluating ${index + 1}/${samples.length}: ${sample.name}`);
    try {
      const result = await transcribe({ input: sample.input, output: join(batch, String(index + 1).padStart(2, '0')), guidance: sample.guidance, python: values.python, signal: controller.signal, onProgress: p => console.error(`${p.stage}${p.percent === undefined ? '' : ` ${p.percent}%`}`) });
      summary.push({ name: sample.name, category: sample.category, status: 'complete', ...result, usefulnessRating: null, listeningNotes: '' });
    } catch (error) { summary.push({ name: sample.name, category: sample.category, status: 'failed', error: error instanceof Error ? error.message : String(error) }); }
    await writeFile(join(batch, 'evaluation.json'), JSON.stringify(summary, null, 2) + '\n');
  }
  console.log(`Evaluation saved in ${batch}. Listen to each MIDI and fill usefulnessRating (1–5) and listeningNotes; see docs/evaluation.md.`);
  if (controller.signal.aborted || summary.some(row => (row as { status: string }).status === 'failed')) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
