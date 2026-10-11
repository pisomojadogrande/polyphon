import math
import unittest
from transcribe import window_count, validate_duration, peak_memory_mib


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
