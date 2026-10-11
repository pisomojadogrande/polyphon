"""Validate a real Basic Pitch melody result; used by CI after inference."""
import json
from pathlib import Path
import sys
import pretty_midi

result = Path(sys.argv[1])
report = json.loads((result / 'report.json').read_text())
midi = pretty_midi.PrettyMIDI(str(result / 'transcription.mid'))
notes = [note for track in midi.instruments for note in track.notes]
assert report['backend'] == 'ONNX'
assert report['durationSeconds'] == 5
assert report['peakMemoryMiB'] > 0 and report['runtimeSeconds'] > 0
assert len(notes) == report['noteCount']
assert len({note.pitch for note in notes} & {60, 64, 67, 72}) >= 3, 'Too few expected melody pitches'
assert all(note.end > note.start >= 0 for note in notes)
print(f'Actual Basic Pitch smoke passed: {len(notes)} notes')
