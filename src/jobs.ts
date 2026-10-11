import { randomUUID } from 'node:crypto';
import { mkdir, rm, readdir, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Guidance, Progress, Report } from './contracts.ts';
import { transcribe } from './transcription.ts';
export interface Job { id: string; name: string; createdAt: number; progress: Progress; report?: Report; error?: string; }
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const STORAGE_CAP = 200 * 1024 * 1024;
export class Jobs {
  readonly jobs = new Map<string, Job>();
  private busy = false;
  private closing = false;
  private queue: { job: Job; input: string; guidance: Guidance }[] = [];
  private active?: { id: string; controller: AbortController };
  readonly directory: string;
  private runner: typeof transcribe;
  constructor(directory: string, runner = transcribe) { this.directory = directory; this.runner = runner; }
  async initialize() {
    await mkdir(join(this.directory, 'outputs'), { recursive: true });
    // Uploaded inputs from interrupted runs cannot be resumed and are removed.
    await rm(join(this.directory, 'uploads'), { recursive: true, force: true });
    await mkdir(join(this.directory, 'uploads'), { recursive: true });
    await this.prune();
    for (const id of await readdir(join(this.directory, 'outputs'))) {
      if (!/^[\da-f-]{36}$/.test(id)) continue;
      try {
        const report = JSON.parse(await readFile(join(this.output(id), 'report.json'), 'utf8')) as Report;
        const metadata = JSON.parse(await readFile(join(this.output(id), 'job.json'), 'utf8')) as { name: string; createdAt: number };
        this.jobs.set(id, { id, ...metadata, progress: { stage: 'complete' }, report });
      } catch { await rm(this.output(id), { recursive: true, force: true }); }
    }
  }
  output(id: string) { return join(this.directory, 'outputs', id); }
  get pending() { return this.queue.length + (this.busy ? 1 : 0); }
  async add(input: string, name: string, guidance: Guidance) {
    if (this.closing) throw new Error('Local server is shutting down');
    const job: Job = { id: randomUUID(), name, createdAt: Date.now(), progress: { stage: 'queued' } };
    this.jobs.set(job.id, job);
    this.queue.push({ job, input, guidance });
    void this.runNext();
    return job;
  }
  private async runNext() {
    if (this.busy) return;
    const item = this.queue.shift();
    if (!item) return;
    this.busy = true;
    const { job, input, guidance } = item;
    const controller = new AbortController();
    this.active = { id: job.id, controller };
    try {
      const result = await this.runner({ input, output: this.output(job.id), guidance, signal: controller.signal, onProgress: progress => { job.progress = progress; } });
      job.report = result.report;
      job.progress = { stage: 'complete' };
      const { writeFile } = await import('node:fs/promises');
      await writeFile(join(this.output(job.id), 'job.json'), JSON.stringify({ name: job.name, createdAt: job.createdAt }));
    } catch (err) {
      job.progress = { stage: 'failed' };
      job.error = err instanceof Error ? err.message : String(err);
      await rm(this.output(job.id), { recursive: true, force: true });
    } finally {
      await rm(input, { force: true });
      this.active = undefined; this.busy = false;
      await this.prune();
      void this.runNext();
    }
  }
  async delete(id: string) {
    const queued = this.queue.find(item => item.job.id === id);
    this.queue = this.queue.filter(item => item.job.id !== id);
    if (queued) await rm(queued.input, { force: true });
    if (this.active?.id === id) {
      this.active.controller.abort();
      // Do not remove files while worker is still writing. It cleans up on exit.
      while (this.active?.id === id) await new Promise(resolve => setTimeout(resolve, 25));
    }
    this.jobs.delete(id);
    await rm(this.output(id), { recursive: true, force: true });
  }
  async shutdown() {
    this.closing = true;
    const pending = this.queue.map(item => item.job.id);
    if (this.active) pending.push(this.active.id);
    for (const id of pending) await this.delete(id);
  }
  async prune(now = Date.now(), cap = STORAGE_CAP) {
    const folders = [];
    for (const id of await readdir(join(this.directory, 'outputs'))) {
      if (this.active?.id === id) continue;
      const path = this.output(id);
      const info = await stat(path);
      if (!info.isDirectory()) continue;
      let size = 0;
      for (const name of await readdir(path)) size += (await stat(join(path, name))).size;
      folders.push({ id, time: info.mtimeMs, size });
    }
    folders.sort((a, b) => a.time - b.time);
    let total = folders.reduce((sum, f) => sum + f.size, 0);
    for (const folder of folders) {
      if (folder.time < now - RETENTION_MS || total > cap) {
        await rm(this.output(folder.id), { recursive: true, force: true });
        this.jobs.delete(folder.id); total -= folder.size;
      }
    }
    // Failed jobs contain no artifacts; prevent unbounded in-memory history.
    for (const [id, job] of this.jobs) if (job.progress.stage === 'failed' && job.createdAt < now - RETENTION_MS) this.jobs.delete(id);
  }
}
