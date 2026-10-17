import { createServer } from 'node:http';
import { createReadStream, createWriteStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Jobs } from './jobs.ts';
import { transcribe } from './transcription.ts';
import { acquireLock } from './lock.ts';
import { MAX_BYTES, EXTENSIONS, parseGuidance } from './contracts.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function createApp(directory = resolve(root, '.polyphon'), runner = transcribe) {
  const releaseLock = await acquireLock(directory);
  const jobs = new Jobs(directory, runner);
  try { await jobs.initialize(); } catch (err) { await releaseLock(); throw err; }
  let uploads = 0;
  const timer = setInterval(() => { void jobs.prune().catch(console.error); }, 60 * 60 * 1000); timer.unref();
  const server = createServer(async (req, res) => {
    const send = (code: number, value: unknown) => { if (!res.destroyed && !res.headersSent) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); } };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      // Loopback binding plus Host/Origin validation blocks DNS rebinding and cross-site writes.
      const host = req.headers.host ?? '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return send(403, { error: 'Use localhost or 127.0.0.1' });
      if (req.headers.origin && req.headers.origin !== `http://${host}`) return send(403, { error: 'Origin not allowed' });
      const url = new URL(req.url ?? '/', `http://${host}`);
      if (req.method === 'GET' && url.pathname === '/api/jobs') return send(200, [...jobs.jobs.values()].sort((a, b) => b.createdAt - a.createdAt));
      if (req.method === 'POST' && url.pathname === '/api/jobs') {
        if (jobs.pending + uploads >= 3) return send(429, { error: 'Queue full. Wait for a clip to finish.' });
        if (req.headers['content-type'] !== 'application/octet-stream') return send(415, { error: 'Use an audio file upload' });
        const name = url.searchParams.get('name') ?? 'clip.wav', ext = extname(name).toLowerCase();
        if (!EXTENSIONS.has(ext) || name.length > 200) return send(400, { error: 'Choose WAV, FLAC, MP3, OGG, or M4A' });
        const guidance = parseGuidance(JSON.parse(url.searchParams.get('guidance') ?? '{}'));
        const length = Number(req.headers['content-length']);
        if (Number.isFinite(length) && length > MAX_BYTES) return send(413, { error: 'Maximum upload size is 64 MiB' });
        const input = join(directory, 'uploads', randomUUID() + ext);
        uploads++;
        let bytes = 0;
        try {
          const limit = new Transform({ transform(chunk: Buffer, _encoding, callback) { bytes += chunk.length; callback(bytes > MAX_BYTES ? new Error('Upload exceeds 64 MiB') : null, chunk); } });
          await pipeline(req, limit, createWriteStream(input, { flags: 'wx', mode: 0o600 }));
          if (bytes === 0) throw new Error('Empty upload');
          const job = await jobs.add(input, name, guidance);
          return send(202, job);
        } catch (err) { await rm(input, { force: true }); throw err; }
        finally { uploads--; }
      }
      const match = /^\/api\/jobs\/([\da-f-]{36})(?:\/(midi|report))?$/.exec(url.pathname);
      if (match) {
        const [, id, artifact] = match, job = jobs.jobs.get(id);
        if (!job) return send(404, { error: 'Job not found or expired' });
        if (req.method === 'DELETE' && !artifact) { await jobs.delete(id); return send(200, { deleted: true }); }
        if (req.method === 'GET' && !artifact) return send(200, job);
        if (req.method === 'GET' && artifact && job.progress.stage === 'complete') {
          const path = join(jobs.output(id), artifact === 'midi' ? 'transcription.mid' : 'report.json');
          res.setHeader('Content-Type', artifact === 'midi' ? 'audio/midi' : 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${artifact === 'midi' ? 'transcription.mid' : 'report.json'}"`);
          await pipeline(createReadStream(path), res); return;
        }
        return send(409, { error: 'Result is not ready' });
      }
      const assets: Record<string, [string, string]> = { '/': ['web/index.html', 'text/html'], '/app.js': ['dist/app.js', 'text/javascript'], '/style.css': ['web/style.css', 'text/css'] };
      if (req.method === 'GET' && assets[url.pathname]) {
        const [file, type] = assets[url.pathname]; await stat(join(root, file));
        res.setHeader('Content-Type', type); await pipeline(createReadStream(join(root, file)), res); return;
      }
      send(404, { error: 'Not found' });
    } catch (err) { send(400, { error: err instanceof Error ? err.message : String(err) }); }
  });
  server.requestTimeout = 120_000;
  server.on('close', () => { clearInterval(timer); void releaseLock().catch(console.error); });
  server.on('error', () => { void releaseLock().catch(console.error); });
  return { server, jobs };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server, jobs } = await createApp(resolve(process.env.POLYPHON_DATA_DIR ?? join(root, '.polyphon')));
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, '127.0.0.1', () => console.log(`Polyphon local experiment: http://127.0.0.1:${port}`));
  let closing = false;
  const shutdown = async () => {
    if (closing) return; closing = true;
    const closed = new Promise<void>(resolve => server.close(() => resolve()));
    server.closeAllConnections();
    await jobs.shutdown(); await closed;
  };
  process.once('SIGINT', () => { void shutdown().catch(console.error); });
  process.once('SIGTERM', () => { void shutdown().catch(console.error); });
}
