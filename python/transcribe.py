"""Pinned Basic Pitch 0.4 ONNX adapter. stdout is exclusively JSON-lines protocol.
Window iteration follows Spotify basic-pitch 0.4.0 inference.py (Apache-2.0).
"""
import argparse
import contextlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import sys
import time


def emit(stage, **values):
    print(json.dumps({"stage": stage, **values}), flush=True)


def window_count(original_samples, overlap_samples, hop_samples):
    return math.ceil((original_samples + overlap_samples // 2) / hop_samples)


def peak_memory_mib():
    # ru_maxrss includes native inference allocations; Linux KiB, macOS bytes.
    import resource
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return peak / (1024 * 1024 if sys.platform == "darwin" else 1024)


def validate_duration(seconds):
    if not math.isfinite(seconds) or seconds <= 0 or seconds > 600:
        raise ValueError("Audio must contain between 0 and 600 seconds (non-empty)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--tempo", type=float, default=120)
    parser.add_argument("--numerator", type=int, default=4)
    parser.add_argument("--denominator", type=int, default=4)
    args = parser.parse_args()
    started = time.perf_counter()
    stages = {}
    emit("loading")
    # Third-party messages go to stderr so they cannot corrupt the event protocol.
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        import librosa
        import pretty_midi
        import polyphon_basic_pitch as basic_pitch
        from polyphon_basic_pitch import inference, note_creation
        from polyphon_basic_pitch.constants import AUDIO_N_SAMPLES, AUDIO_SAMPLE_RATE, FFT_HOP
        model_path = Path(basic_pitch.__file__).parent / "saved_models" / "icassp_2022" / "nmp.onnx"
        model = inference.Model(model_path)
    stages["loading"] = time.perf_counter() - started
    emit("decoding")
    decode_start = time.perf_counter()
    with contextlib.redirect_stdout(sys.stderr):
        duration = float(librosa.get_duration(path=args.input))
    validate_duration(duration)
    # Basic Pitch 0.4.0 run_inference uses a fixed 30-frame overlap.
    overlap_frames = 30
    overlap = overlap_frames * FFT_HOP
    hop = AUDIO_N_SAMPLES - overlap
    output = {"note": [], "onset": [], "contour": []}
    windows = inference.get_audio_input(args.input, overlap, hop)
    with contextlib.redirect_stdout(sys.stderr):
        first = next(windows)
    validate_duration(first[2] / AUDIO_SAMPLE_RATE)
    stages["decoding"] = time.perf_counter() - decode_start
    import itertools
    inference_start = time.perf_counter()
    total = window_count(first[2], overlap, hop)
    emit("inference", percent=0, completed=0, total=total)
    for index, (window, _, original_length) in enumerate(itertools.chain([first], windows), 1):
        with contextlib.redirect_stdout(sys.stderr):
            prediction = model.predict(window)
        for key, data in prediction.items():
            output[key].append(data)
        emit("inference", percent=round(index / total * 100, 1), completed=index, total=total)
    output = {k: inference.unwrap_output(np.concatenate(v), original_length, overlap_frames) for k, v in output.items()}
    stages["inference"] = time.perf_counter() - inference_start
    emit("notes")
    note_start = time.perf_counter()
    with contextlib.redirect_stdout(sys.stderr):
        midi, events = note_creation.model_output_to_notes(
            output, onset_thresh=0.5,
            frame_thresh=0.3,
            min_note_len=int(np.round(127.70 / 1000 * AUDIO_SAMPLE_RATE / FFT_HOP)),
            midi_tempo=args.tempo, multiple_pitch_bends=False,
        )
    stages["notes"] = time.perf_counter() - note_start
    # Fixed tempo supplies a MIDI grid without quantizing or changing note timing.
    midi.time_signature_changes = [pretty_midi.TimeSignature(args.numerator, args.denominator, 0)]
    emit("writing")
    write_start = time.perf_counter()
    midi.write(args.output)
    stages["writing"] = time.perf_counter() - write_start
    emit("complete", metrics={
        "schemaVersion": 1, "engine": f"basic-pitch {basic_pitch.UPSTREAM_VERSION} (Polyphon ONNX {importlib.metadata.version('polyphon-basic-pitch-onnx')})",
        "backend": "ONNX", "durationSeconds": duration, "noteCount": len(events),
        "runtimeSeconds": time.perf_counter() - started, "peakMemoryMiB": peak_memory_mib(),
        "stageSeconds": stages,
        "warnings": ["Basic Pitch does not identify singers or separate voice parts.", "Key and voice guidance are recorded, not applied to inference.", "Playback uses a simple synth and approximates pitch bends."] + (["No notes detected; try a louder or clearer clip."] if not events else []),
    })


if __name__ == "__main__":
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
    try:
        main()
    except Exception as exc:
        emit("failed", error=str(exc))
        print(str(exc), file=sys.stderr)
        sys.exit(1)
