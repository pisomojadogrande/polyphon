"""Generate reproducible diagnostic WAVs, not a substitute for real recordings."""
import argparse
import json
import math
from pathlib import Path
import struct
import wave

SR = 22050
NOTES = [60, 64, 67, 72]


def write_fixture(directory, kind):
    directory.mkdir(parents=True, exist_ok=True)
    expected = []
    if kind == 'silence':
        samples = [0.0] * (2 * SR)
    else:
        samples = [0.0] * (5 * SR)
        for i, pitch in enumerate(NOTES):
            pitches = [pitch] if kind == 'melody' else [pitch, pitch - 12, pitch - 5]
            start, end = i + 0.1, i + 0.85
            for p in pitches:
                expected.append({'midi': p, 'start': start, 'end': end})
            for frame in range(int(start * SR), int(end * SR)):
                t = frame / SR - start
                envelope = min(1, t / 0.02, (end - frame / SR) / 0.03)
                samples[frame] = envelope * sum(math.sin(2 * math.pi * (440 * 2 ** ((p - 69) / 12)) * t) for p in pitches) * 0.18 / len(pitches)
    path = directory / (kind + '.wav')
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(SR)
        wav.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s)) * 32767)) for s in samples))
    (directory / (kind + '.expected.json')).write_text(json.dumps(expected, indent=2))
    return path


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--out', default='work/fixtures')
    args = parser.parse_args()
    for kind in ['melody', 'chords', 'silence']:
        print(write_fixture(Path(args.out), kind))
