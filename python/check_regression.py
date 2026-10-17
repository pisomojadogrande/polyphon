"""Compare generated diagnostic MIDI against the approved pre-migration baseline."""
import json
from pathlib import Path
import sys
import pretty_midi

baseline = json.loads((Path(__file__).parent / 'fixtures/upstream-0.4.0-reference.json').read_text())
root = Path(sys.argv[1])
for kind, expected in baseline['clips'].items():
    midi = pretty_midi.PrettyMIDI(str(root / kind / 'transcription.mid'))
    notes = [note for track in midi.instruments for note in track.notes]
    bends = [bend for track in midi.instruments for bend in track.pitch_bends]
    assert len(notes) == len(expected['notes']), f'{kind}: changed note count'
    assert len(bends) == len(expected['pitchBends']), f'{kind}: changed pitch bend count'
    # Floating point/library/platform differences get a small tolerance, not a new musical result.
    for actual, reference in zip(notes, expected['notes']):
        assert actual.pitch == reference['pitch'], f'{kind}: changed pitch'
        assert abs(actual.velocity - reference['velocity']) <= 1, f'{kind}: changed velocity'
        assert abs(actual.start - reference['start']) < 0.005, f'{kind}: changed onset'
        assert abs(actual.end - reference['end']) < 0.005, f'{kind}: changed duration'
    for actual, reference in zip(bends, expected['pitchBends']):
        assert abs(actual.pitch - reference['pitch']) <= 2, f'{kind}: changed pitch bend'
        assert abs(actual.time - reference['time']) < 0.005, f'{kind}: changed bend timing'
    report = json.loads((root / kind / 'report.json').read_text())
    assert report['noteCount'] == len(notes)
    assert 'Polyphon ONNX' in report['engine']
    if kind == 'melody':
        assert round(midi.get_tempo_changes()[1][0]) == 90
        assert (midi.time_signature_changes[0].numerator, midi.time_signature_changes[0].denominator) == (3, 4)
    print(f'{kind}: matches upstream baseline ({len(notes)} notes, {len(bends)} pitch bends)')
