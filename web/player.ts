import midiPackage from '@tonejs/midi';
const { Midi } = midiPackage;
export interface PlaybackNote { midi: number; time: number; duration: number; velocity: number; }
export function scheduleNotes(notes: PlaybackNote[], offset: number, speed: number) {
  return notes.filter(n => n.time + n.duration > offset).map(n => ({
    ...n, delay: Math.max(0, n.time - offset) / speed,
    length: (n.time + n.duration - Math.max(n.time, offset)) / speed,
  }));
}
export class MidiPlayer {
  private context?: AudioContext;
  private voices = new Set<OscillatorNode>();
  private interval?: ReturnType<typeof setInterval>;
  private notes: PlaybackNote[] = [];
  private started = 0;
  private offset = 0;
  private next = 0;
  private speed = 1;
  duration = 0;
  playing = false;
  private onPosition: (seconds: number, playing: boolean) => void;
  constructor(onPosition: (seconds: number, playing: boolean) => void) { this.onPosition = onPosition; }
  load(buffer: ArrayBuffer) {
    this.stop();
    const midi = new Midi(buffer);
    this.notes = midi.tracks.flatMap(track => track.notes.map(n => ({ midi: n.midi, time: n.time, duration: n.duration, velocity: n.velocity }))).sort((a, b) => a.time - b.time);
    this.duration = midi.duration;
    this.onPosition(0, false);
    return this.notes.map(note => ({ ...note }));
  }
  async play(offset = this.offset, speed = 1) {
    this.stop(false);
    this.offset = offset; this.speed = speed;
    this.context ??= new AudioContext();
    await this.context.resume();
    if (!this.notes.length || offset >= this.duration) { this.offset = 0; this.onPosition(0, false); return; }
    this.started = this.context.currentTime; this.playing = true;
    this.next = this.notes.findIndex(n => n.time + n.duration > offset);
    this.tick(); this.interval = setInterval(() => this.tick(), 30);
  }
  private tick() {
    if (!this.context || !this.playing) return;
    const position = this.offset + (this.context.currentTime - this.started) * this.speed;
    // Schedule only a small lookahead, keeping resource use bounded for long MIDI files.
    while (this.next < this.notes.length && this.notes[this.next].time <= position + 0.2 * this.speed) {
      const note = this.notes[this.next++];
      if (note.time + note.duration <= position) continue;
      const oscillator = this.context.createOscillator(), gain = this.context.createGain();
      oscillator.type = 'triangle'; oscillator.frequency.value = 440 * 2 ** ((note.midi - 69) / 12);
      const scheduled = scheduleNotes([note], position, this.speed)[0];
      const start = this.context.currentTime + scheduled.delay;
      const end = start + scheduled.length;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(Math.min(0.12, note.velocity * 0.09), Math.min(start + 0.01, end));
      gain.gain.setValueAtTime(Math.min(0.12, note.velocity * 0.09), Math.max(start + 0.01, end - 0.03));
      gain.gain.linearRampToValueAtTime(0, end + 0.01);
      oscillator.connect(gain); gain.connect(this.context.destination);
      this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start); oscillator.stop(end + 0.02);
    }
    this.onPosition(Math.min(position, this.duration), true);
    if (position >= this.duration) this.stop();
  }
  seek(seconds: number) {
    this.stop(false); this.offset = Math.max(0, Math.min(this.duration, seconds));
    this.onPosition(this.offset, false);
  }
  pause() {
    if (this.context && this.playing) this.offset += (this.context.currentTime - this.started) * this.speed;
    this.stop(false); this.onPosition(this.offset, false);
  }
  stop(reset = true) {
    clearInterval(this.interval); this.playing = false;
    for (const voice of this.voices) { try { voice.stop(); } catch {} }
    this.voices.clear(); if (reset) this.offset = 0;
    this.onPosition(this.offset, false);
  }
}
