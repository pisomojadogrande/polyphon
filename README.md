# Polyphon

Local audio → MIDI experiment, with a TypeScript application/CLI and Python Basic Pitch worker. Upload a short clip, listen to the resulting MIDI, compare it with the original, and record feedback before choosing cloud infrastructure or score rendering. **No AWS deployment is included.**

## Setup

Validated on Linux x86-64 with Node.js 24 and Python 3.11. macOS should use the portable requirements file below; native Windows is not supported in this milestone (use WSL2). Allow a few GB for the Python environment: Basic Pitch pulls TensorFlow even though this adapter explicitly uses ONNX. No GPU or model download service is required; the model ships in the package.

```sh
git clone https://github.com/pisomojadogrande/polyphon.git
cd polyphon
npm ci
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r python/requirements-lock.txt
npm run check
npm run test:python
npm run dev
```

Open **http://127.0.0.1:3000** on the same machine. On macOS, install with `-r python/requirements.txt` instead of the Linux dependency snapshot; keep Python 3.11, NumPy 1.26.4, and setuptools 80.9.0. If you use `uv`, `uv venv --python 3.11 .venv` and `uv pip install --python .venv/bin/python -r python/requirements-lock.txt` are equivalent on Linux. Optional compressed-format support may require FFmpeg on your PATH; WAV/FLAC is the most reliable starting point.

`npm run dev` builds the browser bundle and starts the server. After source edits, restart it with that command. `npm start` alone expects a previous build. Override the port with `PORT=3001 npm run dev`, or the worker interpreter with `POLYPHON_PYTHON=/absolute/path/to/python npm run dev`.

## First listening test

1. Choose a **10–30 second** WAV/FLAC clip; start with one clear voice, then try an ensemble and a voice/instrument mix.
2. Enter a known tempo/meter if available. Key and voice descriptions are optional evaluation notes; they do not change Basic Pitch predictions.
3. Click **Transcribe audio**. Upload has measured progress; inference reports completed model windows. Loading, decoding, note extraction, and writing are named stages. First-run compilation can make decoding slower.
4. When ready, click **Load MIDI for playback**, then **Play**. Use pause, seek, playback speed, and stop. Compare with the original audio preview, one at a time.
5. Download MIDI and JSON report. Rate whether melody/harmony are recognizable and note missing, extra, or badly timed notes using [the evaluation guide](docs/evaluation.md).
6. Try two additional short clips. **Stop here and share results** before the cloud or score milestones.

No private recordings are included. To test without one:

```sh
npm run fixture
npm run cli -- work/fixtures/melody.wav --out work/result --tempo 90 --time 3/4
.venv/bin/python python/check_smoke.py work/result
npm run dev
```

Use **Open local MIDI** in the web UI to load `work/result/transcription.mid`. Synthetic fixtures establish mechanics, not singing quality.

## CLI and batch evaluation

```sh
npm run cli -- /path/to/clip.wav --out work/my-experiment \
  --tempo 96 --time 6/8 --key "D minor" --voices "SATB a cappella"
```

Output: `transcription.mid` and `report.json`. The CLI preserves source audio; an existing MIDI/report in the selected output folder is replaced. Choose a different folder for each experiment. Control-C cancels the worker and removes incomplete temporary outputs.

To measure several representative clips, copy `docs/evaluation.example.json` to `work/recordings.json`, replace paths/guidance with your own clips, then run:

```sh
npm run evaluate -- --manifest work/recordings.json --out work/evaluation
```

Paths are relative to your current working directory. Each batch creates its own directory and processes clips serially. `evaluation.json` saves per-clip reports plus empty listening/rating fields, incrementally even if a clip fails. Open each MIDI in the UI, then fill in ratings locally. See [measured synthetic results and evaluation rubric](docs/evaluation.md).

## Limits and storage

- Supported extensions: WAV, FLAC, MP3, OGG, M4A; decoding support varies by installed codecs. Limit: 64 MiB and 600 seconds. Begin with much shorter clips.
- One CPU worker at a time; queue accepts at most three uploads/jobs. A worker is killed after 15 minutes. Failures are visible and retryable.
- Local web uploads live in `.polyphon/uploads` and are deleted after success, failure, or cancellation. Startup clears interrupted uploads. CLI source files are never deleted.
- Web results live in `.polyphon/outputs`, survive server restarts, expire after 7 days, and are capped at 200 MiB (oldest results removed). Cleanup runs at startup, after jobs, and hourly while running. Manual Delete/Cancel removes a result and its pending source. Download anything you want to retain. Closing the browser does not cancel processing. Stopping the server with Control-C cancels pending workers and removes their uploads; completed results remain. A lock prevents simultaneous servers from sharing a data folder.
- Authentication is deferred. Bind only to localhost; do not expose this server on a public interface. Host/Origin checks protect local operations from cross-site requests.
- Basic Pitch does not separate singers, identify parts, infer a reliable musical grid, or render sheet music. Supplied tempo/meter set MIDI metadata without quantization. Synth playback ignores instrument programs and approximates pitch bends as fixed notes; a DAW can play the exported MIDI more faithfully.

## Project map and continuation

- `src/contracts.ts`: shared guidance, progress, and result contracts.
- `src/transcription.ts`: reusable process adapter; `src/cli.ts` and `src/evaluate.ts`: command-line entry points.
- `python/transcribe.py`: pinned Basic Pitch ONNX inference and real window progress.
- `src/jobs.ts` / `src/server.ts`: local queue, lifecycle/storage controls, HTTP API.
- `web/`: browser UI, MIDI parser, and Web Audio playback.
- `tests/` / `python/test_transcribe.py`: validation, process, playback timing, HTTP, and lifecycle tests.
- `.github/workflows/check.yml`: checks and actual Basic Pitch smoke test, **no deployment**.
- [Agreed requirements](docs/requirements.md), [phase plan](docs/plan.md), [current progress and handoff](docs/progress.md), [original idea](docs/original-idea.md).

Run `npm run check` for TypeScript checks, browser build, and Node tests; `npm run test:python` for Python helper tests. CI also generates the melody fixture and validates a real Basic Pitch transcription. No cloud architecture is selected yet; milestone 1 ends with user listening feedback.

## Troubleshooting

- **Cannot start Python worker:** create `.venv` with Python 3.11, install requirements, or set `POLYPHON_PYTHON` to the right interpreter.
- **NumPy/TensorFlow import errors or missing pkg_resources:** recreate the environment using the pinned requirements. Python 3.12/3.13 and latest unpinned NumPy/setuptools are not this project's tested configuration.
- **Cannot decode a clip:** convert it to WAV/FLAC with your audio editor or FFmpeg. File extension alone cannot establish that an upload contains valid audio.
- **No notes:** inspect source volume/content, try a clearer recording, and use the report warning. A valid empty MIDI is a successful result for silence.
- **First run feels slow:** imports and initial audio-processing JIT compilation can dominate short clips. Compare cold and subsequent runs separately; every clip starts a fresh worker process.
- **Playback is silent:** click Play (browsers require a user gesture), check system volume, and ensure the report has notes. MIDI files cannot play directly in an ordinary HTML audio element; use the MIDI player here or your DAW.
