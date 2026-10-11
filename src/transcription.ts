import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { stat, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { extname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTENSIONS, MAX_BYTES, parseGuidance } from './contracts.ts';
import type { Guidance, Progress, Report, Result } from './contracts.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
export interface TranscribeOptions {
  input: string; output: string; guidance?: Guidance; python?: string;
  onProgress?: (progress: Progress) => void; signal?: AbortSignal;
  /** Dependency seam for process/protocol tests, never exposed by the web API. */
  worker?: string; timeoutMs?: number;
}
export async function transcribe(options: TranscribeOptions): Promise<Result> {
  const input = resolve(options.input), output = resolve(options.output);
  const guidance = parseGuidance(options.guidance ?? {});
  if (!EXTENSIONS.has(extname(input).toLowerCase())) throw new Error('Supported files: WAV, FLAC, MP3, OGG, M4A');
  const info = await stat(input);
  if (!info.isFile() || info.size === 0 || info.size > MAX_BYTES) throw new Error('Audio must be a non-empty file of at most 64 MiB');
  await mkdir(output, { recursive: true });
  const temporary = await import('node:fs/promises').then(fs => fs.mkdtemp(join(output, '.transcribe-')));
  const tempMidi = join(temporary, 'transcription.mid');
  try {
    const metrics = await new Promise<Omit<Report, 'guidance'>>((resolvePromise, reject) => {
      const child = spawn(options.python ?? process.env.POLYPHON_PYTHON ?? join(root, '.venv/bin/python'), [options.worker ?? join(root, 'python/transcribe.py'), '--input', input, '--output', tempMidi, '--tempo', String(guidance.tempo), '--numerator', String(guidance.timeSignature[0]), '--denominator', String(guidance.timeSignature[1])], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TF_CPP_MIN_LOG_LEVEL: '3', OMP_NUM_THREADS: '2' } });
      let stderr = '', result: Omit<Report, 'guidance'> | undefined, error = '', killed = '';
      const terminate = (reason: string) => { killed = reason; child.kill('SIGKILL'); };
      const timer = setTimeout(() => terminate('Transcription timed out after 15 minutes'), options.timeoutMs ?? 15 * 60 * 1000);
      const abort = () => terminate('Transcription cancelled');
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
      child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-8000); });
      createInterface({ input: child.stdout }).on('line', line => {
        try {
          const event = JSON.parse(line);
          if (event.stage === 'failed') error = String(event.error);
          else if (event.stage === 'complete') result = event.metrics;
          else if (['loading', 'decoding', 'inference', 'notes', 'writing'].includes(event.stage)) options.onProgress?.(event as Progress);
        } catch { error = 'Worker emitted invalid progress data'; }
      });
      child.on('error', err => { error = `Cannot start Python worker: ${err.message}. Follow README setup instructions.`; });
      child.on('close', code => {
        clearTimeout(timer); options.signal?.removeEventListener('abort', abort);
        if (killed || code !== 0 || error || !result) reject(new Error(killed || error || `Python worker failed (${code}): ${stderr.slice(-2000)}`));
        else resolvePromise(result);
      });
    });
    const midi = await readFile(tempMidi);
    if (midi.length < 14 || midi.subarray(0, 4).toString() !== 'MThd') throw new Error('Worker did not produce a valid MIDI file');
    const report: Report = { ...metrics, guidance };
    const midiPath = join(output, 'transcription.mid'), reportPath = join(output, 'report.json');
    await writeFile(join(temporary, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await rename(tempMidi, midiPath);
    await rename(join(temporary, 'report.json'), reportPath);
    options.onProgress?.({ stage: 'complete' });
    return { midiPath, reportPath, report };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
