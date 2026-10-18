import { randomUUID } from 'node:crypto';
import { mkdir, rm, readdir, stat, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { Guidance, Progress, Report } from './contracts.ts';
import { transcribe } from './transcription.ts';
import { cleanName, ConflictError, generatedName, nameIdentity } from './names.ts';
import { legacyKey, parseMusicalKey } from './keys.ts';
import type { MusicalKey } from './keys.ts';
export interface Job { id: string; name: string; sourceName?: string; notationKey?: MusicalKey | null; createdAt: number; progress: Progress; report?: Report; error?: string; }
export interface NameReservation { name: string; token: symbol; }
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const STORAGE_CAP = 200 * 1024 * 1024;
export class Jobs {
  readonly jobs = new Map<string, Job>();
  private reservations = new Map<string, symbol>();
  private busy = false;
  private closing = false;
  private queue: { job: Job; input: string; guidance: Guidance }[] = [];
  private active?: { id: string; controller: AbortController };
  readonly directory: string;
  private runner: typeof transcribe;
  constructor(directory: string, runner = transcribe) { this.directory = directory; this.runner = runner; }
  async initialize() {
    if (this.pending) throw new Error('Cannot reload clips while processing');
    this.jobs.clear();
    await mkdir(join(this.directory, 'outputs'), { recursive: true });
    await rm(join(this.directory, 'uploads'), { recursive: true, force: true });
    await mkdir(join(this.directory, 'uploads'), { recursive: true });
    await this.prune();
    const used = new Set<string>();
    for (const id of (await readdir(join(this.directory, 'outputs'))).sort()) {
      if (!/^[\da-f-]{36}$/.test(id)) continue;
      try {
        const metadata = JSON.parse(await readFile(join(this.output(id), 'job.json'), 'utf8')) as Job;
        let report: Report | undefined;
        try { report = JSON.parse(await readFile(join(this.output(id), 'report.json'), 'utf8')) as Report; await stat(join(this.output(id), 'transcription.mid')); } catch { report = undefined; }
        // Legacy uploads used filenames as labels and permitted duplicates. Preserve every clip.
        const original = typeof metadata.name === 'string' ? metadata.name : `recovered-${id.slice(0, 8)}`;
        let base: string; try { base = cleanName(original); } catch { base = original.replace(/[\p{Cc}\p{Cf}\/\\]/gu, '-').trim().slice(0, 65) || `recovered-${id.slice(0, 8)}`; }
        let name = base, suffix = 2;
        while (used.has(nameIdentity(name))) name = `${base.slice(0, 65)} (${suffix++})`;
        used.add(nameIdentity(name));
        let notationKey: MusicalKey | null;
        try { notationKey = Object.hasOwn(metadata, 'notationKey') ? parseMusicalKey(metadata.notationKey) : legacyKey(report?.guidance.key); } catch { notationKey = null; }
        const job: Job = { id, name, sourceName: metadata.sourceName ?? original, notationKey, createdAt: Number.isFinite(metadata.createdAt) ? metadata.createdAt : (await stat(this.output(id))).mtimeMs,
          progress: report ? { stage: 'complete' } : { stage: 'failed' }, ...(report ? { report } : { error: metadata.error ?? 'Processing was interrupted. Upload this audio again as a new clip.' }),
        };
        this.jobs.set(id, job); await this.save(job);
        // Remove abandoned worker scratch directories after an interrupted process.
        for (const file of await readdir(this.output(id))) if (file.startsWith('.transcribe-') || file.endsWith('.tmp')) await rm(join(this.output(id), file), { recursive: true, force: true });
      } catch (error) { console.error(`Could not restore clip ${id}; its files were retained:`, error); }
    }
  }
  output(id: string) { return join(this.directory, 'outputs', id); }
  get pending() { return this.queue.length + (this.busy ? 1 : 0); }
  private available(name: string) {
    const normalized = nameIdentity(name);
    return !this.reservations.has(normalized) && ![...this.jobs.values()].some(job => nameIdentity(job.name) === normalized);
  }
  suggestName() { return generatedName(name => this.available(name)); }
  reserveName(value: unknown): NameReservation {
    const name = value === undefined || value === null || value === '' || (typeof value === 'string' && !value.trim()) ? this.suggestName() : cleanName(value);
    if (!this.available(name)) throw new ConflictError('A clip with that name already exists. Choose another name.');
    const token = Symbol(name); this.reservations.set(nameIdentity(name), token); return { name, token };
  }
  releaseName(reservation: NameReservation) {
    const id = nameIdentity(reservation.name);
    if (this.reservations.get(id) === reservation.token) this.reservations.delete(id);
  }
  private async save(job: Job) {
    const directory = this.output(job.id); await mkdir(directory, { recursive: true });
    const path = join(directory, `${randomUUID()}.tmp`);
    const { report: _report, ...metadata } = job;
    try { await writeFile(path, JSON.stringify(metadata, null, 2), { mode: 0o600 }); await rename(path, join(directory, 'job.json')); }
    finally { await rm(path, { force: true }); }
  }
  async add(input: string, name: string, guidance: Guidance, options: { notationKey?: MusicalKey | null; sourceName?: string; reservation?: NameReservation } = {}) {
    if (this.closing) throw new Error('Local server is shutting down');
    const notationKey = parseMusicalKey(options.notationKey);
    const reservation = options.reservation ?? this.reserveName(name);
    if (this.reservations.get(nameIdentity(reservation.name)) !== reservation.token) throw new ConflictError('Clip name reservation expired. Try again.');
    const job: Job = { id: randomUUID(), name: reservation.name, sourceName: options.sourceName ?? name, notationKey, createdAt: Date.now(), progress: { stage: 'queued' } };
    this.jobs.set(job.id, job); this.releaseName(reservation);
    try { await this.save(job); } catch (error) { this.jobs.delete(job.id); await rm(this.output(job.id), { recursive: true, force: true }); throw error; }
    this.queue.push({ job, input, guidance }); void this.runNext().catch(console.error); return job;
  }
  async setKey(id: string, value: unknown) {
    const job = this.jobs.get(id);
    if (!job || job.progress.stage !== 'complete') throw new ConflictError('The clip must finish processing before its key can be changed');
    const updated: Job = { ...job, notationKey: parseMusicalKey(value) };
    await this.save(updated); this.jobs.set(id, updated); return updated;
  }
  private async runNext() {
    if (this.busy) return;
    const item = this.queue.shift(); if (!item) return;
    this.busy = true;
    const { job, input, guidance } = item, controller = new AbortController();
    this.active = { id: job.id, controller };
    try {
      const result = await this.runner({ input, output: this.output(job.id), guidance, signal: controller.signal, onProgress: progress => { if (progress.stage !== 'complete') job.progress = progress; } });
      job.report = result.report; job.progress = { stage: 'complete' }; await this.save(job);
    } catch (err) {
      job.progress = { stage: 'failed' }; job.error = err instanceof Error ? err.message : String(err);
      await rm(this.output(job.id), { recursive: true, force: true }); await this.save(job);
    } finally {
      await rm(input, { force: true }); this.active = undefined; this.busy = false;
      try { await this.prune(); } finally { void this.runNext().catch(console.error); }
    }
  }
  async delete(id: string) {
    const queued = this.queue.find(item => item.job.id === id);
    this.queue = this.queue.filter(item => item.job.id !== id);
    if (queued) await rm(queued.input, { force: true });
    if (this.active?.id === id) { this.active.controller.abort(); while (this.active?.id === id) await new Promise(resolve => setTimeout(resolve, 25)); }
    this.jobs.delete(id); await rm(this.output(id), { recursive: true, force: true });
  }
  async shutdown() {
    this.closing = true;
    const pending = this.queue.map(item => item.job.id); if (this.active) pending.push(this.active.id);
    for (const id of pending) await this.delete(id);
  }
  async prune(now = Date.now(), cap = STORAGE_CAP) {
    const folders = [];
    for (const id of await readdir(join(this.directory, 'outputs'))) {
      const job = this.jobs.get(id);
      if (this.active?.id === id || (job && !['complete', 'failed'].includes(job.progress.stage))) continue;
      const path = this.output(id), info = await stat(path); if (!info.isDirectory()) continue;
      let size = 0, time = job?.createdAt ?? info.mtimeMs;
      try { const meta = JSON.parse(await readFile(join(path, 'job.json'), 'utf8')); if (Number.isFinite(meta.createdAt)) time = meta.createdAt; } catch { /* Legacy folders use mtime. */ }
      for (const name of await readdir(path)) { try { size += (await stat(join(path, name))).size; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } }
      folders.push({ id, time, size });
    }
    folders.sort((a, b) => a.time - b.time);
    let total = folders.reduce((sum, f) => sum + f.size, 0);
    for (const folder of folders) if (folder.time < now - RETENTION_MS || total > cap) {
      await rm(this.output(folder.id), { recursive: true, force: true }); this.jobs.delete(folder.id); total -= folder.size;
    }
  }
}
