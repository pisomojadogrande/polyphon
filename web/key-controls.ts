import { TONICS, parseMusicalKey } from '../src/keys.ts';
import type { MusicalKey } from '../src/keys.ts';
export class KeyControls {
  private select: HTMLSelectElement;
  private major: HTMLInputElement;
  private minor: HTMLInputElement;
  constructor(prefix: string) {
    this.select = document.getElementById(`${prefix}-tonic`) as HTMLSelectElement;
    this.major = document.getElementById(`${prefix}-major`) as HTMLInputElement;
    this.minor = document.getElementById(`${prefix}-minor`) as HTMLInputElement;
    for (const tonic of TONICS) {
      const option = document.createElement('option'); option.value = tonic;
      option.textContent = tonic.replace('#', '-sharp').replace('b', '-flat') + (tonic.length > 1 ? ` (${tonic.replace('#', '♯').replace('b', '♭')})` : '');
      this.select.append(option);
    }
  }
  get(): MusicalKey | null { return this.select.value ? parseMusicalKey({ tonic: this.select.value, mode: this.minor.checked ? 'minor' : 'major' }) : null; }
  set(key: MusicalKey | null) { this.select.value = key?.tonic ?? ''; this.major.checked = key?.mode !== 'minor'; this.minor.checked = key?.mode === 'minor'; }
}
