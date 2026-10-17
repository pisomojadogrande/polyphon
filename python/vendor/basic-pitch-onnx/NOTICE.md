# Basic Pitch ONNX-only package

Derived from Spotify AB's **Basic Pitch 0.4.0**, licensed under Apache-2.0; see `LICENSE` and the original copyright headers. This is a Polyphon adaptation, not an upstream release. Original project: https://github.com/spotify/basic-pitch

Source: the PyPI wheel `basic_pitch-0.4.0-py2.py3-none-any.whl` from https://pypi.org/project/basic-pitch/0.4.0/. Its SHA-256 and per-file hashes are recorded in `upstream-sha256.json`. The wheel was verified before extraction.

Polyphon modifications (2026-10-17):
- Package/module renamed to `polyphon-basic-pitch-onnx` / `polyphon_basic_pitch` to avoid pretending to be or colliding with the upstream distribution.
- Packaging declares the runtime dependencies actually used by ONNX inference, with versions supporting standard CPython 3.14. TensorFlow, CoreML, TFLite, training tools, and unused CLI helpers are excluded.
- `__init__.py` reports the upstream version without probing or importing unused backends.
- `inference.py` retains upstream audio windowing and output unwrapping unchanged, with a minimal ONNX-only `Model` preserving the original input/output tensor mapping. Unused backend loading and upstream CLI/export code are removed.
- Resampy is updated to 0.4.3 to remove its obsolete `pkg_resources` import; this is used only by the unused optional sonification helper, not note extraction or audio loading.
- `note_creation.py` changes only its constants import to the new package namespace and adds a modification notice. `constants.py` and the ONNX model are byte-for-byte unchanged.

The model (approximately 226 KiB) ships with this package; there is no model download at runtime. Transcription thresholds, pitch bends, overlap, and note extraction behavior are preserved. Python dependencies are modernized, so fixture/parity regression checks accompany the change. No TensorFlow version override, `--no-deps`, or broken dependency metadata is needed; `pip check` must pass.
