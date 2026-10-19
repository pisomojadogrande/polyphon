# Polyphon

Local audio → MIDI → raw staff notation experiment, with a TypeScript application/CLI and Python Basic Pitch worker. Upload a short clip, inspect the grand staff, listen with a moving playback cursor, and record feedback before refining the score. **No AWS deployment is included.**

## Setup

Use **standard CPython 3.14** (not the free-threaded build) and Node.js 22 or 24. Linux x86-64 is validated on Python 3.14 and 3.11. macOS support is not yet validated; the ONNX 1.31 Python 3.14 wheel requires Apple Silicon and macOS 14+. Native Windows is not supported in this milestone (use WSL2). The model is included locally; no GPU, TensorFlow, or runtime model-download service is needed.

```sh
git clone https://github.com/pisomojadogrande/polyphon.git
cd polyphon
npm ci
python3.14 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r python/requirements-lock.txt
.venv/bin/python -m pip check
npm run check
npm run test:python
npm run dev
```

Run installation commands from the **repository root**: the requirements include a local ONNX-only adaptation of Spotify Basic Pitch 0.4.0, with attribution and its unchanged model. The upstream `basic-pitch` distribution still requires obsolete TensorFlow versions and cannot install on Python 3.14. Do not install `basic-pitch[onnx]` separately. [Dependency rationale, provenance, and validation](docs/python314.md).

If you tried the previous setup, first stop Polyphon, deactivate any active virtual environment, and move the old `.venv` out of the way (for example `mv .venv .venv-old`). Then create the new environment and run the commands above. The `.venv-old` backup is ignored by Git; delete that disposable environment after the new setup works. Your recordings and `.polyphon` results are separate from `.venv`. Avoid mixing old TensorFlow packages into the new environment.

Open **http://127.0.0.1:3000** on the same machine. `python/requirements-lock.txt` pins transitive dependencies with Python-version markers and is the recommended setup. `python/requirements.txt` installs the local package's pinned direct runtime dependencies with freshly resolved transitives. With `uv`, `uv venv --python 3.14 .venv` and `uv pip install --python .venv/bin/python -r python/requirements-lock.txt` are equivalent. Optional compressed-format support may require FFmpeg on your PATH; WAV/FLAC is the most reliable starting point.

`npm run dev` builds the browser bundle and starts the server through the locally installed `tsx` runner. Server, CLI, evaluation, and tests do not rely on Node’s native TypeScript stripping. Run `npm ci` after pulling dependency changes. After source edits, restart it with that command. `npm start` alone expects a previous build. Override the port with `PORT=3001 npm run dev`, or the worker interpreter with `POLYPHON_PYTHON=/absolute/path/to/python npm run dev`.

## Try the clip workflow

If upgrading, stop the server, run `git pull --ff-only` and `npm ci`, then `npm run dev`. Your existing Python environment needs no changes for this phase.

1. Open http://127.0.0.1:3000. Choose a **10–30 second** clip. Keep the generated dictionary-word name or enter your own unique name. Key is optional; no tempo/meter/voice questions are asked. After selecting a file, listen and seek using the audio player above the optional range controls to find your start/end times. To transcribe a portion, expand **Transcribe part of the recording (optional)** and enter source start/end times as seconds or m:ss. Blank means beginning/end; the selected range must be within the recording and no longer than ten minutes.
2. Click **Upload & transcribe**. The next page shows measured upload/model-window progress and named processing stages, then opens the score automatically.
3. Play the grand staff and follow the moving cursor. Pause/resume, stop, seek, playback speed, remain available. All lines appear in one scroll pane: the current line stays at the top during playback and seeking. Scroll manually while paused; Stop returns to the first line. Each measure label includes its original-source timestamp, including any selected start offset.
4. After inspecting the notes, choose the actual tonic and major/minor, then click **Re-transcribe**. For your example, choose **F-sharp (F♯)** and **Minor**. The staff gains three sharps. Repeat with another key if desired.
5. This button saves the key and re-engraves the existing notes; it does not rerun Basic Pitch, transpose pitches, or alter downloaded MIDI. Playback pauses at its current position and can resume.
6. Use the expandable left rail to reopen previous named clips. Refresh or restart the server to check that their names and chosen keys persist. Each rail entry has a trash icon; deletion asks for confirmation with that clip’s name. Older saved clips migrate automatically; conflicting old names receive numbered suffixes.
7. **Stop here and share feedback.** Please check the F-sharp-minor spellings, cursor behavior, and clip navigation. [Detailed workflow testing instructions](docs/workflow-testing.md). Measure-start editing and cloud remain deferred.

No private recordings are included. To test without one:

```sh
npm run fixture
npm run cli -- work/fixtures/melody.wav --out work/result --tempo 90 --time 3/4
.venv/bin/python python/check_smoke.py work/result
npm run dev
```

Use **Open local MIDI** under the new-clip page’s secondary MIDI-preview section to load `work/result/transcription.mid` for notation and playback. Synthetic fixtures establish mechanics, not singing quality.

The first rendering uses a fixed **120 BPM, 4/4, sixteenth-note display grid**. Those are provisional engraving choices, not inferred song tempo/bar lines. Playback preserves source MIDI seconds; display quantization does not rewrite MIDI. Unless you select a key, no key is assumed; initial spellings use C♯, E♭, F♯, A♭, B♭ plus natural cancellations. Pitches at/above middle C go to treble, lower pitches to bass—this does not identify singers. Dense notation may require scrolling inside the score pane.

## CLI and batch evaluation

```sh
npm run cli -- /path/to/clip.wav --out work/my-experiment \
  --start 0:30 --end 1:00 --tempo 96 --time 6/8 --key "D minor" --voices "SATB a cappella"
```

Optional `--start`/`--end` accept seconds, m:ss, or h:mm:ss. Output: `transcription.mid` and `report.json`. MIDI starts at zero relative to the selection; report sourceRange records the original start/end/full duration. The CLI preserves source audio; an existing MIDI/report in the selected output folder is replaced. Choose a different folder for each experiment. Control-C cancels the worker and removes incomplete temporary outputs.

To measure several representative clips, copy `docs/evaluation.example.json` to `work/recordings.json`, replace paths/guidance with your own clips, then run:

```sh
npm run evaluate -- --manifest work/recordings.json --out work/evaluation
```

Paths are relative to your current working directory. Each batch creates its own directory and processes clips serially. `evaluation.json` saves per-clip reports plus empty listening/rating fields, incrementally even if a clip fails. Open each MIDI in the UI, then fill in ratings locally. See [measured synthetic results and evaluation rubric](docs/evaluation.md).

## Limits and storage

- Supported extensions: WAV, FLAC, MP3, OGG, M4A; decoding support varies by installed codecs. Limit: 64 MiB uploaded and 600 seconds selected for transcription. Begin with much shorter clips.
- One CPU worker at a time; queue accepts at most three uploads/jobs. A worker is killed after 15 minutes. Failures remain visible; delete the failed clip and upload again.
- Local web uploads live in `.polyphon/uploads` and are deleted after success, failure, or cancellation. Startup clears interrupted uploads. CLI source files are never deleted.
- Names are unique ignoring case and normalized whitespace, including queued/failed clips. Delete a clip to reuse its name. Blank API names get available dictionary-word pairs. Key choices are stored in clip metadata; theoretical key spellings use a labeled conventional enharmonic signature.
- Web results live in `.polyphon/outputs`, survive server restarts, expire after 7 days, and are capped at 200 MiB (oldest results removed). Cleanup runs at startup, after jobs, and hourly while running. Manual Delete/Cancel removes a result and its pending source. Download anything you want to retain. Closing the browser does not cancel processing. Stopping the server with Control-C cancels pending workers and removes their uploads; completed results remain. A lock prevents simultaneous servers from sharing a data folder.
- Authentication is deferred. Bind only to localhost; do not expose this server on a public interface. Host/Origin checks protect local operations from cross-site requests.
- Basic Pitch does not separate singers, identify parts, or infer a reliable musical grid. Polyphon now renders a deliberately rough score from its MIDI, including any transcription errors. Supplied tempo/meter set MIDI metadata without quantization. Synth playback ignores instrument programs and approximates pitch bends as fixed notes; a DAW can play the exported MIDI more faithfully.

## Project map and continuation

- `src/contracts.ts`: shared guidance, progress, and result contracts.
- `src/transcription.ts`: reusable process adapter; `src/cli.ts` and `src/evaluate.ts`: command-line entry points.
- `python/transcribe.py`: pinned Basic Pitch ONNX inference and real window progress.
- `src/jobs.ts` / `src/server.ts`: local queue, lifecycle/storage controls, HTTP API.
- `src/notation.ts`: shared display-only rhythm/pitch/accidental/tie conversion and source-time anchors.
- `web/score.ts`: VexFlow SVG grand staff, bundled local fonts, source timestamps, continuous scrolling, and playback cursor.
- `web/`: browser UI, MIDI parser, and Web Audio playback.
- `tests/` / `python/test_transcribe.py`: validation, process, playback timing, HTTP, and lifecycle tests.
- `.github/workflows/check.yml`: checks and actual Basic Pitch smoke test, **no deployment**.
- [Continuous score/source-range plan](docs/scrolling-score-plan.md).
- [Current workflow plan](docs/workflow-plan.md), [workflow testing](docs/workflow-testing.md), [previous raw notation plan](docs/raw-notation-plan.md).
- [Agreed requirements](docs/requirements.md), [phase plan](docs/plan.md), [current progress and handoff](docs/progress.md), [original idea](docs/original-idea.md).

Run `npm run check` for TypeScript checks, browser build, and Node tests; `npm run test:python` for Python helper tests. CI also generates the melody fixture and validates a real Basic Pitch transcription. The clip workflow milestone ends with user feedback; cloud architecture remains deferred. For engraving/browser regression tests, run `npx playwright install chromium` then `npm run test:browser` (Linux may also need `npx playwright install --with-deps chromium`). To use an existing Chromium, set `POLYPHON_CHROMIUM=/path/to/chromium`. The browser tests start an isolated localhost server and use data under ignored `work/`.

## Troubleshooting

- **Unknown file extension ".ts":** pull the latest changes and run `npm ci`, then `npm run dev`. All TypeScript commands now use `tsx`. Use Node 22 or newer (`node --version`); direct `node src/server.ts` is not the supported launch command.

- **Cannot start Python worker:** create `.venv` with Python 3.14, install requirements, or set `POLYPHON_PYTHON` to the right interpreter.
- **TensorFlow resolution errors or missing pkg_resources:** pull the latest repository and recreate `.venv` with Python 3.14 using the current lock file. The ONNX-only package excludes TensorFlow and uses Resampy 0.4.3, which no longer imports `pkg_resources`. Do not reuse the old NumPy 1.26/TensorFlow requirements.
- **Cannot decode a clip:** convert it to WAV/FLAC with your audio editor or FFmpeg. File extension alone cannot establish that an upload contains valid audio.
- **No notes:** inspect source volume/content, try a clearer recording, and use the report warning. A valid empty MIDI is a successful result for silence.
- **First run feels slow:** imports and initial audio-processing JIT compilation can dominate short clips. Compare cold and subsequent runs separately; every clip starts a fresh worker process.
- **Playback is silent:** click Play (browsers require a user gesture), check system volume, and ensure the report has notes. MIDI files cannot play directly in an ordinary HTML audio element; use the MIDI player here or your DAW.
