"""Protect model provenance and the unchanged note extraction algorithm."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parent / 'vendor/basic-pitch-onnx'


class ProvenanceTests(unittest.TestCase):
    def test_model_and_constants_match_the_upstream_release(self):
        hashes = json.loads((ROOT / 'upstream-sha256.json').read_text())['files']
        for relative in ['constants.py', 'saved_models/icassp_2022/nmp.onnx']:
            self.assertEqual(hashlib.sha256((ROOT / 'polyphon_basic_pitch' / relative).read_bytes()).hexdigest(), hashes['basic_pitch/' + relative])

    def test_note_extraction_only_changes_the_package_import(self):
        hashes = json.loads((ROOT / 'upstream-sha256.json').read_text())['files']
        text = (ROOT / 'polyphon_basic_pitch/note_creation.py').read_text()
        restored = text.removeprefix('# Polyphon modification: import constants from the ONNX-only package namespace.\n').replace('from .constants import (', 'from basic_pitch.constants import (')
        self.assertEqual(hashlib.sha256(restored.encode()).hexdigest(), hashes['basic_pitch/note_creation.py'])
