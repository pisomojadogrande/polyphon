import { parseArgs } from 'node:util';
import { parseGuidance, parseAudioRange, parseSourceTime } from './contracts.ts';
import { transcribe } from './transcription.ts';
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    out: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, tempo: { type: 'string' }, time: { type: 'string' },
    key: { type: 'string' }, voices: { type: 'string' }, python: { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) console.log('Usage: npm run cli -- clip.wav --out work/result [--start 1:30 --end 2:00] [--tempo 120 --time 4/4 --key "C major" --voices "SATB"]\nExisting transcription.mid/report.json in the output folder are replaced. CLI input is never deleted.');
  else {
    if (positionals.length !== 1 || !values.out) throw new Error('Specify one audio file and --out directory. Use --help for usage.');
    const guidance = parseGuidance({ tempo: values.tempo, timeSignature: values.time?.split('/').map(Number), key: values.key, voices: values.voices });
    const range = parseAudioRange({ startSeconds: values.start === undefined ? 0 : parseSourceTime(values.start), ...(values.end === undefined ? {} : { endSeconds: parseSourceTime(values.end) }) });
    const controller = new AbortController();
    process.once('SIGINT', () => controller.abort());
    const result = await transcribe({ input: positionals[0], output: values.out, python: values.python, guidance, range, signal: controller.signal, onProgress: p => console.error(p.stage + (p.percent === undefined ? '' : ` ${p.percent}% (${p.completed}/${p.total} windows)`)) });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
