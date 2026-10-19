"""Verify the real 1–3s slice of the deterministic melody fixture."""
import json
from pathlib import Path
import sys
import pretty_midi

root = Path(sys.argv[1])
report = json.loads((root / 'report.json').read_text())
assert report['durationSeconds'] == 2
assert report['sourceRange'] == {'startSeconds': 1, 'endSeconds': 3, 'sourceDurationSeconds': 5}
midi = pretty_midi.PrettyMIDI(str(root / 'transcription.mid'))
notes = [note for track in midi.instruments for note in track.notes]
assert [note.pitch for note in notes] == [64, 67], 'Only the middle two fixture notes belong in the selected range'
assert all(0 <= note.start < note.end <= 2 for note in notes), 'MIDI timing must be relative to the selected range'
print('Selected source 1–3s: two expected notes; relative MIDI timing and source metadata verified')
