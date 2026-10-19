import { MidiPlayer } from './player.ts';
import { ScoreView } from './score.ts';
import { KeyControls } from './key-controls.ts';
import { keyInfo, keyLabel } from '../src/keys.ts';
import type { MusicalKey } from '../src/keys.ts';
import { parseAudioRange, parseSourceTime, MAX_BYTES } from '../src/contracts.ts';
import type { Job } from '../src/jobs.ts';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const format = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const uploadKey = new KeyControls('upload'), scoreKey = new KeyControls('score');
const play = $<HTMLButtonElement>('play'), stop = $<HTMLButtonElement>('stop'), position = $<HTMLInputElement>('position');
const score = new ScoreView($<HTMLDivElement>('score'), $('score-status'));
const player = new MidiPlayer((seconds, playing) => {
  position.value = String(seconds); $('clock').textContent = `${format(seconds)} / ${format(player.duration)}`;
  play.textContent = playing ? 'Pause' : 'Play'; score.update(seconds, playing);
});
let jobs = new Map<string, Job>(), fetched = false, refreshing = false, revision = 0;
let routeKey = '', loadedId = '', loadingId = '', generation = 0, appliedKey: MusicalKey | null = null;
let localPreview: { buffer: ArrayBuffer; name: string; key: MusicalKey | null } | null = null;
let previewUrl = '', previewClip = '', uploadRequest: XMLHttpRequest | null = null, uploadName = '';
let applyingKey = false, navSignature = '';
const labels: Record<string, string> = { queued: 'Waiting for the transcription worker', loading: 'Loading transcription model', decoding: 'Decoding audio', inference: 'Transcribing notes', notes: 'Extracting notes', writing: 'Writing MIDI', complete: 'Ready', failed: 'Needs re-upload' };
async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options); const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Request failed'); return value as T;
}
const selection = () => /^#clips\/([\da-f-]{36})$/.exec(location.hash)?.[1] ?? '';
function navigate(hash: string, replace = false) { if (location.hash === hash) void showRoute(); else if (replace) location.replace(hash); else location.hash = hash; }
function collapsed(value: boolean) {
  document.body.classList.toggle('rail-collapsed', value);
  $('rail-toggle').setAttribute('aria-expanded', String(!value));
  $('rail-toggle').setAttribute('aria-label', value ? 'Expand saved clips' : 'Collapse saved clips');
  try { localStorage.setItem('polyphon-rail-collapsed', String(value)); } catch { /* Private browsing may block preferences. */ }
}
let initialCollapsed = matchMedia('(max-width:700px)').matches;
try { const saved = localStorage.getItem('polyphon-rail-collapsed'); if (saved !== null) initialCollapsed = saved === 'true'; } catch { /* Use responsive default. */ }
collapsed(initialCollapsed);
$('rail-toggle').onclick = () => collapsed(!document.body.classList.contains('rail-collapsed'));
function nav() {
  const sorted = [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
  const signature = JSON.stringify(sorted.map(j => [j.id, j.name, j.progress.stage])) + location.hash;
  if (signature === navSignature) return; navSignature = signature;
  const list = $('clip-list'); list.replaceChildren(); $('clips-empty').hidden = sorted.length > 0;
  for (const job of sorted) {
    const li = document.createElement('li'), link = document.createElement('a'), name = document.createElement('span'), state = document.createElement('small');
    link.href = `#clips/${job.id}`; name.textContent = job.name; state.textContent = labels[job.progress.stage];
    if (selection() === job.id) link.setAttribute('aria-current', 'page');
    link.append(name, state); link.onclick = () => { if (matchMedia('(max-width:700px)').matches) collapsed(true); };
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'clip-delete';
    remove.setAttribute('aria-label', `Delete ${job.name}`); remove.title = `Delete ${job.name}`;
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(icon.namespaceURI, 'path');
    path.setAttribute('d', 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'); icon.append(path); remove.append(icon);
    remove.onclick = async () => { remove.disabled = true; try { await deleteClip(job.id, true); } finally { remove.disabled = false; } };
    li.append(link, remove); list.append(li);
  }
}
function controls(enabled: boolean) { play.disabled = stop.disabled = position.disabled = !enabled; }
function keyCaption(key: MusicalKey | null) {
  if (!key) return 'No key signature yet · chromatic notes shown with explicit accidentals';
  const info = keyInfo(key);
  return keyLabel(key) + (info.enharmonic ? ` · rendered as ${keyLabel({ tonic: info.tonic as MusicalKey['tonic'], mode: key.mode })}, the equivalent conventional key` : '');
}
async function loadMidi(buffer: ArrayBuffer, name: string, key: MusicalKey | null, token: number, sourceOffset = 0) {
  await document.fonts.ready;
  if (token !== generation) return;
  const notes = player.load(buffer); position.max = String(player.duration); controls(player.duration > 0);
  $('playing-name').textContent = player.duration === 0 ? 'No MIDI notes detected.' : '';
  scoreKey.set(key); appliedKey = key; $('key-caption').textContent = keyCaption(key); $('key-status').textContent = '';
  try { await score.load(notes, key, sourceOffset); }
  catch (error) { if (token === generation) { score.clear(); $('score').textContent = 'Notation could not be rendered. MIDI playback is still available.'; $('score-status').textContent = String(error); } }
}
function resultInfo(job?: Job) {
  $('result-title').textContent = job?.name ?? localPreview?.name ?? 'Your score';
  const range = job?.report?.sourceRange;
  $('result-caption').textContent = job ? `Saved clip${range ? ` · Source ${format(range.startSeconds)}–${format(range.endSeconds)}` : ''} · choose its key after inspecting the score.` : 'Local MIDI preview · not saved in your clips.';
  $('preview-original').hidden = !job || previewClip !== job.id || !previewUrl;
  const metrics = job?.report;
  $('result-metrics').textContent = metrics ? `${metrics.noteCount} notes · ${metrics.durationSeconds.toFixed(1)}s audio · ${metrics.runtimeSeconds.toFixed(1)}s processing · ${metrics.peakMemoryMiB.toFixed(0)} MiB peak memory. ${metrics.warnings.join(' ')}` : '';
  for (const artifact of ['midi', 'report']) {
    const link = $<HTMLAnchorElement>(`download-${artifact}`); link.hidden = !job;
    if (job) link.href = `/api/jobs/${job.id}/${artifact}`;
  }
  $('delete-clip').hidden = !job;
}
async function showRoute() {
  const route = location.hash || '#new', id = selection();
  if (route !== routeKey) {
    routeKey = route; generation++; loadedId = ''; loadingId = ''; player.stop(); score.clear(); controls(false);
    $<HTMLAudioElement>('original').pause(); $('result-message').textContent = ''; $('key-status').textContent = '';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  nav();
  for (const page of ['new-page', 'progress-page', 'result-page']) $(page).hidden = true;
  if (route === '#new') { $('new-page').hidden = false; return; }
  if (route === '#uploading' && uploadRequest) {
    $('progress-page').hidden = false; $('progress-title').textContent = 'Uploading your clip'; $('progress-name').textContent = uploadName;
    $<HTMLProgressElement>('progress').hidden = false; $('progress-error').textContent = ''; $('cancel-clip').hidden = false; $('cancel-clip').textContent = 'Cancel upload'; $('retry-clip').hidden = true; return;
  }
  if (route === '#local-midi' && localPreview) {
    $('result-page').hidden = false; resultInfo(); $<HTMLButtonElement>('apply-key').disabled = false;
    if (loadedId !== 'local' && loadingId !== 'local') {
      loadingId = 'local'; const token = generation;
      try { await loadMidi(localPreview.buffer, localPreview.name, localPreview.key, token); if (token === generation) loadedId = 'local'; }
      catch (error) { $('result-message').textContent = String(error); }
      finally { if (token === generation) loadingId = ''; }
    }
    return;
  }
  if (!id) { navigate('#new', true); return; }
  const job = jobs.get(id);
  if (!job || job.progress.stage !== 'complete') {
    $('progress-page').hidden = false; $('progress-title').textContent = job?.progress.stage === 'failed' ? 'This clip could not be transcribed' : 'Transcribing your clip';
    $('progress-name').textContent = job?.name ?? 'Loading saved clip…';
    $('stage').textContent = job ? labels[job.progress.stage] + (job.progress.percent === undefined ? '' : ` · ${job.progress.percent}% of inference windows (${job.progress.completed}/${job.progress.total})`) : fetched ? 'Clip not found or expired' : 'Loading…';
    const bar = $<HTMLProgressElement>('progress');
    bar.hidden = !job || job.progress.stage === 'failed';
    if (job?.progress.percent === undefined) bar.removeAttribute('value'); else bar.value = job.progress.percent;
    $('progress-error').textContent = job?.error ?? '';
    $('cancel-clip').hidden = !job; $('cancel-clip').textContent = job?.progress.stage === 'failed' ? 'Delete failed clip' : 'Cancel & delete clip';
    $('retry-clip').hidden = job?.progress.stage !== 'failed' && !!job;
    $('stage-hint').textContent = job?.progress.stage === 'failed' ? 'Upload the audio again with a new name, or delete this failed clip to reuse its name.' : 'You can open another saved clip while processing continues.';
    return;
  }
  $('result-page').hidden = false; resultInfo(job);
  if (loadedId !== id && loadingId !== id) {
    loadingId = id; controls(false); $<HTMLButtonElement>('apply-key').disabled = true; $('result-message').textContent = 'Loading MIDI and score…';
    const token = generation;
    try {
      const response = await fetch(`/api/jobs/${id}/midi`); if (!response.ok) throw new Error('MIDI is unavailable or expired.');
      const buffer = await response.arrayBuffer(); if (token !== generation) return;
      await loadMidi(buffer, job.name, job.notationKey ?? null, token, job.report?.sourceRange?.startSeconds ?? 0);
      if (token === generation) { loadedId = id; $('result-message').textContent = ''; }
    } catch (error) { if (token === generation) { loadedId = id; $('result-message').textContent = `Could not load this clip: ${String(error)}. Select another clip and return to retry.`; } }
    finally { if (token === generation) { loadingId = ''; $<HTMLButtonElement>('apply-key').disabled = false; } }
  } else if (loadedId === id && !applyingKey && JSON.stringify(job.notationKey ?? null) !== JSON.stringify(appliedKey)) {
    player.pause(); appliedKey = job.notationKey ?? null; scoreKey.set(appliedKey); score.setKey(appliedKey); $('key-caption').textContent = keyCaption(appliedKey);
  }
}
async function refresh() {
  if (refreshing) return; refreshing = true; const snapshot = revision;
  try {
    const values = await json<Job[]>('/api/jobs'); if (snapshot !== revision) return;
    jobs = new Map(values.map(job => [job.id, job])); fetched = true; $('connection-status').textContent = ''; await showRoute();
  } catch { $('connection-status').textContent = 'Cannot reach the local server. Start it with npm run dev.'; }
  finally { refreshing = false; }
}
async function suggest(force = false) {
  try { const value = await json<{ name: string }>('/api/clip-name'); const input = $<HTMLInputElement>('clip-name'); if (force || !input.value.trim()) input.value = value.name; }
  catch (error) { $('upload-status').textContent = String(error); }
}
function newClip() {
  if (matchMedia('(max-width:700px)').matches) collapsed(true);
  if (!uploadRequest) { $<HTMLFormElement>('upload').reset(); uploadKey.set(null); $('upload-status').textContent = ''; void suggest(true); }
  navigate('#new');
}
$('new-clip').onclick = newClip; $('retry-clip').onclick = newClip; $('generate-name').onclick = () => { void suggest(true); };
play.onclick = async () => {
  try { if (player.playing) player.pause(); else { $<HTMLAudioElement>('original').pause(); await player.play(Number(position.value), Number($<HTMLSelectElement>('speed').value)); } }
  catch (error) { $('result-message').textContent = String(error); }
};
stop.onclick = () => { score.follow(); player.stop(); };
position.oninput = () => { score.follow(); player.seek(Number(position.value)); };
$<HTMLSelectElement>('speed').onchange = () => player.pause();
$<HTMLAudioElement>('original').onplay = () => player.pause();
$<HTMLInputElement>('audio').onchange = event => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; previewClip = '';
  if (file) { previewUrl = URL.createObjectURL(file); $<HTMLAudioElement>('original').src = previewUrl; }
};
$<HTMLInputElement>('midi').onchange = async event => {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
  try { localPreview = { buffer: await file.arrayBuffer(), name: file.name, key: null }; loadedId = ''; navigate('#local-midi'); }
  catch (error) { $('upload-status').textContent = String(error); }
};
$<HTMLFormElement>('upload').onsubmit = async event => {
  event.preventDefault(); if (uploadRequest) return;
  const form = $<HTMLFormElement>('upload'), input = $<HTMLInputElement>('clip-name'), status = $('upload-status');
  if (!input.value.trim()) await suggest(true);
  if (!form.reportValidity()) return;
  const file = $<HTMLInputElement>('audio').files?.[0]; if (!file) return;
  if (file.size === 0 || file.size > MAX_BYTES) { status.textContent = 'Choose a non-empty recording under 64 MiB.'; return; }
  let range;
  try {
    const start = $<HTMLInputElement>('range-start').value.trim(), end = $<HTMLInputElement>('range-end').value.trim();
    range = parseAudioRange({ startSeconds: start ? parseSourceTime(start) : 0, ...(end ? { endSeconds: parseSourceTime(end) } : {}) });
  } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); return; }
  const params = new URLSearchParams({ filename: file.name, name: input.value, key: JSON.stringify(uploadKey.get()), range: JSON.stringify(range) });
  const xhr = new XMLHttpRequest(); uploadRequest = xhr; uploadName = input.value; $<HTMLButtonElement>('submit').disabled = true;
  $<HTMLProgressElement>('progress').value = 0; $('stage').textContent = 'Uploading audio…'; navigate('#uploading');
  const finish = () => { uploadRequest = null; $<HTMLButtonElement>('submit').disabled = false; };
  const failed = (message: string) => { finish(); status.textContent = message; if (location.hash === '#uploading') navigate('#new', true); };
  xhr.open('POST', '/api/jobs?' + params); xhr.setRequestHeader('Content-Type', 'application/octet-stream');
  xhr.upload.onprogress = e => { if (location.hash === '#uploading') { if (e.lengthComputable) $<HTMLProgressElement>('progress').value = e.loaded / e.total * 100; $('stage').textContent = e.lengthComputable ? `Uploading · ${Math.round(e.loaded / e.total * 100)}%` : 'Uploading audio…'; } };
  xhr.onload = () => {
    try {
      const value = JSON.parse(xhr.responseText);
      if (xhr.status !== 202) { failed(value.error || 'Upload failed'); return; }
      finish(); revision++; jobs.set(value.id, value); previewClip = value.id;
      if (location.hash === '#uploading') navigate(`#clips/${value.id}`, true); else nav();
      void refresh();
    } catch { failed('Upload failed. Please try again.'); }
  };
  xhr.onerror = () => failed('Upload failed. Check that the local server is running.');
  xhr.onabort = () => failed('Upload cancelled.'); xhr.send(file);
};
$<HTMLFormElement>('score-key-form').onsubmit = async event => {
  event.preventDefault(); if (applyingKey) return;
  const id = selection(), key = scoreKey.get(), token = generation;
  const button = $<HTMLButtonElement>('apply-key'); applyingKey = true; button.disabled = true;
  player.pause(); $('key-status').textContent = 'Rewriting the score…';
  try {
    if (id) {
      const updated = await json<Job>(`/api/jobs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notationKey: key }) });
      revision++; jobs.set(id, updated);
    } else if (localPreview && location.hash === '#local-midi') localPreview.key = key;
    if (token !== generation) return;
    appliedKey = key; score.setKey(key); $('key-caption').textContent = keyCaption(key);
    $('key-status').textContent = `${id ? 'Saved' : 'Preview updated'} · ${keyLabel(key)}. Press Play to continue.`;
  } catch (error) { if (token === generation) $('key-status').textContent = `Could not rewrite the score: ${String(error)}`; }
  finally { applyingKey = false; button.disabled = false; }
};
async function deleteClip(id = selection(), confirm = false) {
  if (!id) return;
  const job = jobs.get(id);
  if (confirm && !window.confirm(`Delete ${job?.name ?? 'this clip'}?`)) return;
  $('clip-error').textContent = '';
  try {
    await json(`/api/jobs/${id}`, { method: 'DELETE' }); revision++; jobs.delete(id);
    if (selection() === id) { navigate('#new'); void suggest(); }
    nav();
  } catch (error) { $('clip-error').textContent = `Could not delete ${job?.name ?? 'clip'}: ${String(error)}`; }
}
$('delete-clip').onclick = () => { void deleteClip(); };
$('cancel-clip').onclick = () => { if (uploadRequest && location.hash === '#uploading') uploadRequest.abort(); else void deleteClip(); };
window.addEventListener('hashchange', () => { void showRoute(); });
window.addEventListener('pagehide', () => { player.stop(); if (previewUrl) URL.revokeObjectURL(previewUrl); });
if (!location.hash) history.replaceState(null, '', '#new');
void showRoute(); void suggest(); void refresh(); setInterval(() => void refresh(), 1000);
