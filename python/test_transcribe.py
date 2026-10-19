import math
import unittest
from transcribe import window_count, validate_duration, peak_memory_mib, selected_range


class WorkerContractTests(unittest.TestCase):
    def test_window_count_includes_leading_half_overlap_and_partial_window(self):
        self.assertEqual(window_count(1000, 100, 300), 4)
        self.assertEqual(window_count(850, 100, 300), 3)
        self.assertEqual(window_count(851, 100, 300), 4)

    def test_duration_rejects_invalid_and_long_audio(self):
        for value in [0, -1, 600.01, math.inf, math.nan]:
            with self.assertRaises(ValueError): validate_duration(value)
        validate_duration(600)
        validate_duration(0.1)

    def test_memory_is_positive(self):
        self.assertGreater(peak_memory_mib(), 0)

    def test_selected_range_defaults_and_bounds(self):
        self.assertEqual(selected_range(30), (0, 30))
        self.assertEqual(selected_range(1200, 900, 930), (900, 930))
        self.assertEqual(selected_range(30, 10), (10, 30))
        for source, start, end in [(0, 0, None), (30, -1, 10), (30, 30, None), (30, 5, 5), (30, 5, 31), (1200, 0, None), (30, math.nan, 10), (30, 0, math.inf)]:
            with self.assertRaises(ValueError): selected_range(source, start, end)

    def test_range_windows_match_a_physically_cropped_wav(self):
        import tempfile
        import wave
        from pathlib import Path
        import numpy as np
        from polyphon_basic_pitch import inference
        from polyphon_basic_pitch.constants import AUDIO_SAMPLE_RATE, AUDIO_N_SAMPLES, FFT_HOP
        from transcribe import range_windows
        rate = AUDIO_SAMPLE_RATE
        samples = (np.sin(2 * np.pi * 440 * np.arange(rate * 3) / rate) * 10000).astype('<i2')
        with tempfile.TemporaryDirectory() as directory:
            source, crop = Path(directory) / 'source.wav', Path(directory) / 'crop.wav'
            for path, data in [(source, samples), (crop, samples[rate:rate * 2])]:
                with wave.open(str(path), 'wb') as output:
                    output.setnchannels(1); output.setsampwidth(2); output.setframerate(rate); output.writeframes(data.tobytes())
            overlap = 30 * FFT_HOP; hop = AUDIO_N_SAMPLES - overlap
            actual = list(range_windows(source, 1, 1, overlap, hop, rate))
            expected = list(inference.get_audio_input(crop, overlap, hop))
            self.assertEqual(len(actual), len(expected))
            for (window, timing, length), (reference, ref_timing, ref_length) in zip(actual, expected):
                np.testing.assert_array_equal(window, reference)
                self.assertEqual(timing, ref_timing); self.assertEqual(length, ref_length)
