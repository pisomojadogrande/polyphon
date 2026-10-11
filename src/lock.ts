import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
/** Prevent a second local server from clearing the first server's active uploads. */
export async function acquireLock(directory: string): Promise<() => Promise<void>> {
  await mkdir(directory, { recursive: true });
  const path = join(directory, 'server.lock');
  try { await mkdir(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    let pid: number;
    try { pid = Number(await readFile(join(path, 'pid'), 'utf8')); }
    catch { throw new Error('Local server lock is being initialized. Retry shortly.'); }
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid local server lock. Remove it only after confirming no Polyphon server is running.');
    let stale = false;
    try { process.kill(pid, 0); } catch (err) { stale = (err as NodeJS.ErrnoException).code === 'ESRCH'; }
    if (!stale) throw new Error('Another Polyphon server is using this data folder. Stop it before starting a second server.');
    await rm(path, { recursive: true, force: true });
    await mkdir(path);
  }
  await writeFile(join(path, 'pid'), String(process.pid));
  return () => rm(path, { recursive: true, force: true });
}
