import { ScoreView } from './score.ts';
import { MidiPlayer } from './player.ts';
import { MAX_BYTES } from '../src/contracts.ts';
import type { Job } from '../src/jobs.ts';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const format = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const play = $<HTMLButtonElement>('play'), stop = $<HTMLButtonElement>('stop'), position = $<HTMLInputElement>('position');
const score = new ScoreView($<HTMLDivElement>('score'), $('score-status'), $<HTMLButtonElement>('score-previous'), $<HTMLButtonElement>('score-next'));
const player = new MidiPlayer((seconds, playing) => {
  position.value = String(seconds); $('clock').textContent = `${format(seconds)} / ${format(player.duration)}`;
  play.textContent = playing ? 'Pause' : 'Play';
  score.update(seconds, playing);
});
async function loadMidi(buffer: ArrayBuffer, name: string) {
  const notes = player.load(buffer); position.max = String(player.duration);
  play.disabled = stop.disabled = position.disabled = player.duration === 0;
  $('playing-name').textContent = name + (player.duration === 0 ? ' · No notes detected.' : '');
  try { await score.load(notes); } catch (error) { score.clear(); $('score').textContent = 'Notation could not be rendered. MIDI playback is still available.'; $('score-status').textContent = String(error); }
}
play.onclick = async () => {
  try { if (player.playing) player.pause(); else { $<HTMLAudioElement>('original').pause(); await player.play(Number(position.value), Number($<HTMLSelectElement>('speed').value)); } }
  catch (err) { $('playing-name').textContent = String(err); }
};
stop.onclick = () => { score.follow(); player.stop(); };
position.oninput = () => { score.follow(); player.seek(Number(position.value)); };
$<HTMLSelectElement>('speed').onchange = () => player.pause();
$<HTMLInputElement>('midi').onchange = async event => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) try { await loadMidi(await file.arrayBuffer(), file.name); } catch { $('playing-name').textContent = 'Could not read this MIDI file.'; }
};
let previewUrl = '';
$<HTMLInputElement>('audio').onchange = event => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  if (file) { previewUrl = URL.createObjectURL(file); $<HTMLAudioElement>('original').src = previewUrl; }
};
$<HTMLFormElement>('upload').onsubmit = async event => {
  event.preventDefault();
  const file = $<HTMLInputElement>('audio').files?.[0]; if (!file) return;
  const status = $('upload-status');
  if (file.size > MAX_BYTES || file.size === 0) { status.textContent = 'Choose a non-empty file under 64 MiB.'; return; }
  const submit = $<HTMLButtonElement>('submit'); submit.disabled = true;
  const params = new URLSearchParams({ name: file.name, guidance: JSON.stringify({ tempo: $<HTMLInputElement>('tempo').value ? Number($<HTMLInputElement>('tempo').value) : undefined, timeSignature: $<HTMLSelectElement>('time').value.split('/').map(Number), key: $<HTMLInputElement>('key').value, voices: $<HTMLInputElement>('voices').value }) });
  const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/jobs?' + params); xhr.setRequestHeader('Content-Type', 'application/octet-stream');
  xhr.upload.onprogress = e => { status.textContent = e.lengthComputable ? `Uploading ${Math.round(e.loaded / e.total * 100)}%` : 'Uploading audio…'; };
  xhr.onload = () => { submit.disabled = false; try { const response = JSON.parse(xhr.responseText); status.textContent = xhr.status === 202 ? 'Uploaded. Processing stages appear below.' : response.error; } catch { status.textContent = 'Upload failed.'; } void refresh(); };
  xhr.onerror = () => { submit.disabled = false; status.textContent = 'Upload failed. Check that the local server is running.'; };
  xhr.send(file);
};
const cards = new Map<string, HTMLElement>();
const labels: Record<string, string> = { queued: 'Waiting for worker', loading: 'Loading model', decoding: 'Decoding audio', inference: 'Transcribing', notes: 'Extracting notes', writing: 'Writing MIDI', complete: 'Ready to evaluate', failed: 'Failed' };
function node(tag: string, text = '') { const element = document.createElement(tag); element.textContent = text; return element; }
function render(job: Job) {
  const card = node('article'); card.className = 'job';
  card.append(node('h3', job.name));
  card.append(node('p', labels[job.progress.stage] + (job.progress.percent === undefined ? '' : ` · ${job.progress.percent}% of inference windows (${job.progress.completed}/${job.progress.total})`)));
  if (job.progress.stage === 'inference') { const progress = document.createElement('progress'); progress.max = 100; progress.value = job.progress.percent ?? 0; progress.setAttribute('aria-label', 'Inference progress'); card.append(progress); }
  if (job.error) { const error = node('p', job.error); error.className = 'error'; card.append(error); }
  if (job.report) {
    const r = job.report; card.append(node('p', `${r.noteCount} notes · ${r.durationSeconds.toFixed(1)}s audio · ${r.runtimeSeconds.toFixed(1)}s processing · ${r.peakMemoryMiB.toFixed(0)} MiB peak memory`));
    const details = node('details'); details.append(node('summary', 'Guidance and limitations'), node('p', `${r.guidance.tempo} BPM · ${r.guidance.timeSignature.join('/')} · ${r.guidance.key || 'Key unspecified'} · ${r.guidance.voices || 'Voices unspecified'}`));
    for (const warning of r.warnings) details.append(node('p', warning)); card.append(details);
  }
  const actions = node('div'); actions.className = 'actions';
  if (job.progress.stage === 'complete') {
    const listen = node('button', 'View notation & MIDI playback') as HTMLButtonElement;
    listen.onclick = async () => { try { const res = await fetch(`/api/jobs/${job.id}/midi`); if (!res.ok) throw new Error('Result expired'); await loadMidi(await res.arrayBuffer(), job.name); $('playing-name').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (err) { $('playing-name').textContent = String(err); } }; actions.append(listen);
    for (const artifact of ['midi', 'report']) { const link = node('a', `Download ${artifact.toUpperCase()}`) as HTMLAnchorElement; link.href = `/api/jobs/${job.id}/${artifact}`; actions.append(link); }
  }
  const remove = node('button', ['complete', 'failed'].includes(job.progress.stage) ? 'Delete' : 'Cancel & delete') as HTMLButtonElement;
  remove.onclick = async () => { remove.disabled = true; try { const res = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' }); if (!res.ok) throw new Error('Could not delete result'); await refresh(); } catch (err) { remove.disabled = false; $('upload-status').textContent = String(err); } }; actions.append(remove); card.append(actions);
  return card;
}
const signatures = new Map<string, string>();
async function refresh() {
  try {
    const res = await fetch('/api/jobs'); if (!res.ok) throw new Error('Could not read experiments');
    const jobs = await res.json() as Job[];
    const ids = new Set(jobs.map(j => j.id));
    for (const [id, card] of cards) if (!ids.has(id)) { card.remove(); cards.delete(id); signatures.delete(id); }
    for (const job of jobs) {
      const signature = JSON.stringify(job);
      if (signatures.get(job.id) === signature) continue;
      const card = render(job), previous = cards.get(job.id);
      if (previous) previous.replaceWith(card); else $('jobs').prepend(card);
      cards.set(job.id, card); signatures.set(job.id, signature);
    }
  } catch { $('upload-status').textContent = 'Cannot reach the local server. Start it with npm run dev.'; }
}
void refresh(); setInterval(() => void refresh(), 1000);
window.addEventListener('pagehide', () => { player.stop(); if (previewUrl) URL.revokeObjectURL(previewUrl); });
