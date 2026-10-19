import { keyInfo, keyLabel } from '../src/keys.ts';
import type { MusicalKey } from '../src/keys.ts';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Dot, StaveConnector, StaveTie } from 'vexflow/bravura';
import { accidentalsForBar, buildRawScore, sourceTimestamp, spellPitch, tickAtTime, timeAtTick, tiedPitches, TICKS_PER_BAR } from '../src/notation.ts';
import type { RawScore, ScoreEvent, SourceNote } from '../src/notation.ts';
interface Placed { event: ScoreEvent; note: StaveNote; }
interface Geometry { bar: number; start: number; top: number; bottom: number; points: { tick: number; x: number }[]; }
const NS = 'http://www.w3.org/2000/svg';
export class ScoreView {
  private score: RawScore = buildRawScore([]);
  private key: MusicalKey | null = null;
  private cursor?: SVGLineElement;
  private geometry: Geometry[] = [];
  private seconds = 0;
  private sourceOffset = 0;
  private align = true;
  private contentHeight = 0;
  private lastRowHeight = 0;
  private host: HTMLDivElement;
  private status: HTMLElement;
  constructor(host: HTMLDivElement, status: HTMLElement) {
    this.host = host; this.status = status;
    new ResizeObserver(() => this.resizeTail()).observe(host);
  }
  private resizeTail() {
    // Extra space lets the final system reach the top, just like every other system.
    const svg = this.host.querySelector('svg');
    if (svg) {
      const height = this.contentHeight + Math.max(0, this.host.clientHeight - this.lastRowHeight - 20);
      svg.setAttribute('height', String(height)); svg.style.height = `${height}px`;
      svg.setAttribute('viewBox', `0 0 ${svg.getAttribute('width')} ${height}`);
    }
  }
  clear() {
    this.score = buildRawScore([]); this.geometry = []; this.cursor = undefined;
    this.contentHeight = 0; this.lastRowHeight = 0; this.host.replaceChildren(); this.host.scrollTop = this.host.scrollLeft = 0;
  }
  async load(notes: readonly SourceNote[], key: MusicalKey | null = null, sourceOffset = 0) {
    this.key = key; this.sourceOffset = sourceOffset;
    this.clear();
    this.score = buildRawScore(notes); this.seconds = 0; this.align = true;
    await document.fonts.ready; // Bravura entry bundles its FontFace data; no CDN requests.
    this.render(); this.update(0, false);
  }
  setKey(key: MusicalKey | null) { this.key = key; this.align = true; this.render(); this.update(this.seconds, false); }
  follow() { this.align = true; }
  private makeNotes(events: ScoreEvent[], clef: string): Placed[] {
    const signs = accidentalsForBar(events, this.key);
    return events.map((event, e) => {
      const rest = event.tones.length === 0;
      const note = new StaveNote({ clef, keys: rest ? [clef === 'treble' ? 'b/4' : 'd/3'] : event.tones.map(tone => spellPitch(tone.midi, this.key).key), duration: event.duration + (rest ? 'r' : ''), dots: event.dotted ? 1 : 0, autoStem: true });
      if (event.dotted) Dot.buildAndAttach([note]);
      if (!rest) for (const [index, sign] of signs[e].entries()) if (sign) note.addModifier(new Accidental(sign), index);
      return { event, note };
    });
  }
  private render() {
    this.host.replaceChildren(); this.geometry = []; this.cursor = undefined;
    const bars = this.score.bars;
    if (!bars.length) { this.host.textContent = 'No notes to render. Transcribe a clip or open a MIDI file.'; this.status.textContent = 'No score loaded'; return; }
    const rows = bars.map(bar => {
      const all = [...bar.treble, ...bar.bass].flatMap(e => e.tones.map(t => t.midi));
      const high = Math.max(84, ...all), low = Math.min(36, ...all);
      return { bar, treble: this.makeNotes(bar.treble, 'treble'), bass: this.makeNotes(bar.bass, 'bass'), upper: 45 + (high - 84) * 4, extraBottom: (36 - low) * 4 };
    });
    const width = Math.max(760, this.host.clientWidth - 20, ...rows.map(row => {
      const voices = [row.treble, row.bass].map(notes => new Voice({ numBeats: 4, beatValue: 4 }).addTickables(notes.map(p => p.note)));
      return (this.key ? 260 : 155) + new Formatter().joinVoices([voices[0]]).joinVoices([voices[1]]).preCalculateMinTotalWidth(voices);
    }));
    const height = rows.reduce((sum, row) => sum + row.upper + 215 + row.extraBottom, 0);
    this.contentHeight = height;
    const lastRow = rows[rows.length - 1]; this.lastRowHeight = lastRow.upper + 215 + lastRow.extraBottom;
    const renderer = new Renderer(this.host, Renderer.Backends.SVG); renderer.resize(width, height);
    const context = renderer.getContext();
    const svg = this.host.querySelector('svg')!;
    svg.dataset.keySignature = this.key ? keyInfo(this.key).signature : 'unknown';
    svg.dataset.key = keyLabel(this.key);
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `Grand staff: ${keyLabel(this.key)}, provisional measures`);
    let y = 0;
    const previous: { treble?: Placed; bass?: Placed } = {};
    const tie = (first: Placed | undefined, last: Placed | undefined, half: 'left' | 'right' | undefined = undefined) => {
      if (!first || !last) return;
      for (const midi of tiedPitches(first.event, last.event)) {
        new StaveTie({ firstNote: half === 'left' ? undefined : first.note, lastNote: half === 'right' ? undefined : last.note, firstIndexes: [first.event.tones.findIndex(t => t.midi === midi)], lastIndexes: [last.event.tones.findIndex(t => t.midi === midi)] }).setContext(context).draw();
      }
    };
    for (const row of rows) {
      const top = new Stave(28, y + row.upper, width - 45).addClef('treble');
      const bottom = new Stave(28, y + row.upper + 115, width - 45).addClef('bass');
      if (this.key) { top.addKeySignature(keyInfo(this.key).signature); bottom.addKeySignature(keyInfo(this.key).signature); }
      if (row.bar.index === 0) { top.addTimeSignature('4/4'); bottom.addTimeSignature('4/4'); }
      const start = Math.max(top.getNoteStartX(), bottom.getNoteStartX()); top.setNoteStartX(start); bottom.setNoteStartX(start);
      top.setContext(context).draw(); bottom.setContext(context).draw();
      new StaveConnector(top, bottom).setType('brace').setContext(context).draw();
      new StaveConnector(top, bottom).setType('singleLeft').setContext(context).draw();
      new StaveConnector(top, bottom).setType('singleRight').setContext(context).draw();
      const upperVoice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables(row.treble.map(p => p.note));
      const lowerVoice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables(row.bass.map(p => p.note));
      new Formatter().joinVoices([upperVoice]).joinVoices([lowerVoice]).formatToStave([upperVoice, lowerVoice], top);
      upperVoice.draw(context, top); lowerVoice.draw(context, bottom);
      for (const [name, placed] of [['treble', row.treble], ['bass', row.bass]] as const) {
        // Ties across systems draw outgoing/incoming halves instead of a diagonal line.
        if (previous[name]) { tie(previous[name], placed[0], 'right'); tie(previous[name], placed[0], 'left'); }
        for (let i = 1; i < placed.length; i++) tie(placed[i - 1], placed[i]);
        previous[name] = placed[placed.length - 1];
      }
      const points = new Map<number, number>();
      for (const placed of [...row.treble, ...row.bass]) points.set(placed.event.tick, placed.note.getAbsoluteX() + 5);
      points.set((row.bar.index + 1) * TICKS_PER_BAR, top.getNoteEndX() - 3);
      this.geometry.push({ bar: row.bar.index, start: y, top: y + row.upper + 12, bottom: y + row.upper + 200, points: [...points].sort(([a], [b]) => a - b).map(([tick, x]) => ({ tick, x })) });
      const label = document.createElementNS(NS, 'text'); label.setAttribute('x', '28'); label.setAttribute('y', String(y + 20)); label.setAttribute('class', 'bar-label'); label.dataset.bar = String(row.bar.index + 1); label.dataset.seconds = String(this.sourceOffset + timeAtTick(this.score.anchors, row.bar.index * TICKS_PER_BAR)); label.textContent = `Provisional measure ${row.bar.index + 1} · Source ${sourceTimestamp(Number(label.dataset.seconds))}`; svg.append(label);
      y += row.upper + 215 + row.extraBottom;
    }
    this.cursor = document.createElementNS(NS, 'line'); this.cursor.setAttribute('class', 'score-cursor'); this.cursor.setAttribute('aria-hidden', 'true'); svg.append(this.cursor);
    this.resizeTail();
    this.status.textContent = `${bars.length} provisional measures · ${this.score.noteCount} source notes`;
    if (this.score.warnings.length) this.status.textContent += ' · ' + this.score.warnings.join(' ');
  }
  update(seconds: number, playing: boolean) {
    const positionChanged = seconds !== this.seconds;
    this.seconds = seconds;
    if (!this.score.bars.length) return;
    const tick = tickAtTime(this.score.anchors, seconds);
    const bar = Math.min(this.score.bars.length - 1, Math.floor(tick / TICKS_PER_BAR));
    const row = this.geometry.find(g => g.bar === bar);
    if (!this.cursor) return;
    this.cursor.setAttribute('visibility', row ? 'visible' : 'hidden');
    if (!row) return;
    let i = 0; while (i + 1 < row.points.length - 1 && row.points[i + 1].tick <= tick) i++;
    const a = row.points[i], b = row.points[Math.min(i + 1, row.points.length - 1)];
    const fraction = a.tick === b.tick ? 0 : Math.max(0, Math.min(1, (tick - a.tick) / (b.tick - a.tick)));
    const x = a.x + (b.x - a.x) * fraction;
    for (const [key, value] of Object.entries({ x1: x, x2: x, y1: row.top, y2: row.bottom })) this.cursor.setAttribute(key, String(value));
    this.cursor.dataset.seconds = seconds.toFixed(3); this.cursor.dataset.bar = String(bar + 1);
    if (playing || this.align || positionChanged) {
      // The current system stays at the pane's top, including after paused seeks.
      this.host.scrollTop = row.start;
      if (x < this.host.scrollLeft + 20 || x > this.host.scrollLeft + this.host.clientWidth - 30) this.host.scrollLeft = Math.max(0, x - this.host.clientWidth / 2);
      this.align = false;
    }
  }
}
