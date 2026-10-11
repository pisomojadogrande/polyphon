import { parseArgs } from 'node:util';
import { parseGuidance } from './contracts.ts';
import { transcribe } from './transcription.ts';
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    out: { type: 'string' }, tempo: { type: 'string' }, time: { type: 'string' },
    key: { type: 'string' }, voices: { type: 'string' }, python: { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) console.log('Usage: npm run cli -- clip.wav --out work/result [--tempo 120 --time 4/4 --key "C major" --voices "SATB"]\nExisting transcription.mid/report.json in the output folder are replaced. CLI input is never deleted.');
  else {
    if (positionals.length !== 1 || !values.out) throw new Error('Specify one audio file and --out directory. Use --help for usage.');
    const guidance = parseGuidance({ tempo: values.tempo, timeSignature: values.time?.split('/').map(Number), key: values.key, voices: values.voices });
    const controller = new AbortController();
    process.once('SIGINT', () => controller.abort());
    const result = await transcribe({ input: positionals[0], output: values.out, python: values.python, guidance, signal: controller.signal, onProgress: p => console.error(p.stage + (p.percent === undefined ? '' : ` ${p.percent}% (${p.completed}/${p.total} windows)`)) });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
