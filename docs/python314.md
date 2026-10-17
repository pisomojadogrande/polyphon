# Python 3.14 dependency repair — 2026-10-17

## Cause and chosen fix

The user's installation failed because upstream `basic-pitch==0.4.0` unconditionally requires `tensorflow>=2.4.1,<2.15.1` on non-macOS Python 3.11+. Those TensorFlow releases have no Python 3.14 wheels. The `[onnx]` extra **adds** ONNX Runtime; it does not remove TensorFlow. Updating NumPy alone or choosing TensorFlow 2.22 does not satisfy the upstream metadata.

Polyphon already uses only ONNX inference. Its local dependency is now **`polyphon-basic-pitch-onnx==0.4.0.post1`**, built from `python/vendor/basic-pitch-onnx`. This retains Spotify's Basic Pitch 0.4.0 model and note extraction, with an independent distribution/module name and only the required runtime dependencies. It is not an upstream release or a switch to another transcription model.

The package contains the Apache-2.0 license, change notices, upstream wheel/file SHA-256 provenance, unchanged model/constant files, minimally namespaced note extraction, and ONNX-only inference. The unused TensorFlow/CoreML/TFLite/training/CLI code is excluded. See the [third-party notice](../python/vendor/basic-pitch-onnx/NOTICE.md). No `--no-deps`, environment monkeypatch, pre-release TensorFlow, or inconsistent package metadata is used.

## Runtime versions

| Dependency | Selected version | Purpose |
| --- | --- | --- |
| CPython | 3.14 (standard build); also regression-tested 3.11 | Runtime |
| ONNX Runtime | 1.31.0 | Same ONNX model, CPU backend |
| NumPy | 2.4.6 | Python 3.14 wheels, removes obsolete TensorFlow-driven 1.26 restriction |
| SciPy | 1.17.1 | Compatible numerical processing |
| Numba / llvmlite | 0.68.0 / 0.50.0 | Python 3.14-compatible audio JIT stack |
| librosa | 0.11.0 | Preserve existing audio-loading behavior |
| Resampy | 0.4.3 | Removes 0.4.2's obsolete `pkg_resources` import |
| pretty-midi | 0.2.11.post0 | MIDI writing |
| mir-eval | 0.8.2 | Note-processing dependency |

`requirements-lock.txt` includes transitive pins and markers for the Python 3.13+ removals of `audioop`, `aifc`, `chunk`, and `sunau`. The lock supports standard CPython 3.11–3.14; actual end-to-end checks cover 3.11 and 3.14, not 3.12/3.13. Linux x86-64 is tested. The selected ONNX Python 3.14 macOS wheel requires Apple Silicon/macOS 14+; macOS remains unverified. Native Windows remains outside this milestone (WSL2 is the documented route).

## Upgrade an attempted installation

Stop the server and deactivate the old virtual environment if active. From the repository root:

```sh
git pull --ff-only
# If .venv exists, preserve it outside the new environment:
mv .venv .venv-old
python3.14 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r python/requirements-lock.txt
.venv/bin/python -m pip check
npm ci
npm run check
npm run test:python
npm run dev
```

Skip `mv` if `.venv` does not exist; choose another backup name if `.venv-old` already exists. Do not activate the old environment again for Polyphon. Backing up/replacing `.venv` does not remove `.polyphon` results or source recordings. Once the new setup works, the old environment can be deleted.

For direct runtime dependency resolution, `-r python/requirements.txt` also works; the lock is preferred for repeatable installation. Both files contain a local package path, so run installation from the repository root. Do not separately install the upstream `basic-pitch[onnx]` distribution.

## Verification and boundaries

- Actual CPython 3.14.8 installation from the lock with ordinary pip; `pip check` passes and TensorFlow is absent.
- Node checks: 16 tests and the browser bundle/type check. Python: 5 tests, including upstream-model/constant hashes and unchanged note-extraction provenance.
- Real CLI transcriptions on Python 3.14 and 3.11: melody 4 notes, chords 13 notes, silence 0 notes. Outputs match the approved original Python 3.11/Basic Pitch baseline within 5 ms for timing, one velocity unit, and two pitch-bend units. Melody tempo/meter remain 90 BPM and 3/4.
- The regression reference is synthetic, contains no private recordings, and covers notes plus 266 melody pitch-bend events. It is musical-output evidence beyond a dependency resolver succeeding.
- CI now installs from the lock, checks dependency consistency, runs the Python tests, transcribes all three fixtures, and checks the baseline on both 3.11 and 3.14.

This repairs the existing local milestone only. Representative real-recording usefulness remains untested; the pause for user listening tests remains in effect. No AWS deployment or score work is included.

## Maintaining the package

The upstream wheel is `basic_pitch-0.4.0-py2.py3-none-any.whl`, SHA-256 `738adb503aae7fdfc7d1e1511aa0ce35052315f260a19531ef4c356708425db0`. Keep modifications and attribution in the vendor notice. If upgrading the model or algorithms, do not silently regenerate the approved musical baseline: review changed musical results first.

Regenerate the lock from the repository root with `uv pip compile python/requirements.txt --universal --python-version 3.11 --no-annotate --no-header -o python/requirements-lock.txt`, retaining its explanatory header. Test both CI versions afterward. Build-tool versions are managed separately by the local package's PEP 517 build configuration; they do not add runtime setuptools/pkg_resources requirements.
