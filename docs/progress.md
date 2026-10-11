# Current progress / clean-context handoff

Updated: 2026-10-11. **Milestone 1 is ready for user testing. Stop here.**

## What is implemented
- TypeScript shared contracts and transcription process adapter; CLI and serial batch evaluation runner.
- Python Basic Pitch 0.4.0, explicit ONNX CPU model, measured inference-window progress, named other stages, MIDI metadata, timing and peak worker RSS report.
- Localhost UI/server: bounded uploads, one-worker queue, original-audio preview, MIDI parse/play/pause/stop/seek/speed, CLI MIDI import, downloads, cancel/delete.
- Temporary uploads deleted on completion/failure/cancellation/startup recovery. Outputs persist across restarts, with 7-day expiry and 200 MiB oldest-first cap. Shutdown cancels pending workers. A data-folder lock prevents concurrent servers from clearing each other's uploads.
- Meaningful tests, CI checks plus real Basic Pitch smoke test, setup/evaluation instructions, agreed requirements, original source document, and saved phase plan.
- No AWS deployment, credentials, authentication, billing, voice separation, score rendering, or cloud architecture selected.

## Verified
- `npm run check`: type-check and browser bundle build; **16 Node tests passed** (guidance/manifest validation, playback seek timing, worker protocol/failure/missing interpreter/timeout/cancellation, queue serialization, audio deletion, restoration, cap/TTL, shutdown, process lock, HTTP guards/upload/result downloads/deletion).
- `npm run test:python`: **3 Python tests passed** (window counting, duration limits, peak memory).
- Actual Basic Pitch: 5s melody → 4 expected notes; 5s chords → 12 expected events plus one extra note; 2s silence → valid empty MIDI with warning. Details and measurements in `docs/evaluation.md`.
- Actual melody MIDI preserved supplied 90 BPM and 3/4 metadata.
- Actual serial batch evaluation passed for melody and silence and saved reports with empty human-rating fields.
- Headless Chromium end-to-end check passed: real upload/transcription, MIDI import/play/pause/seek/speed/stop, download, source deletion, result deletion, and CLI-generated MIDI import; no JavaScript errors. Desktop/mobile layout inspected, including no horizontal overflow at 390px. Automated browser checks verify mechanics, not perceived audio quality.
- Linux x86-64, Node 24.19.0, Python 3.11.17; portable macOS setup is documented but unverified. Windows support uses WSL2.
- GitHub Actions passed both jobs (TypeScript/Python checks and actual Basic Pitch smoke) on code commit `af373980f9f4b4cec99e26af1002f2051bc5b856`: https://github.com/pisomojadogrande/polyphon/actions/runs/38185318835. The final handoff commit changes documentation only and skips redundant CI.

## Important dependency findings
- Basic Pitch pulls TensorFlow on Python 3.11 even though this worker uses ONNX. Imports contribute substantially to ~756–862 MiB measured RSS.
- NumPy 2.x is incompatible with the upstream TensorFlow version; pinned 1.26.4.
- Basic Pitch imports `pkg_resources`; setuptools 81+ removes it. Pinned setuptools 80.9.0.
- `python/requirements-lock.txt` is the validated Linux/3.11 dependency snapshot. `python/requirements.txt` is the portable direct-dependency specification. The worker deliberately targets the installed 0.4.0 API (30-frame overlap), not unreleased upstream main.
- Initial decoding includes JIT compilation and can be much slower than subsequent cached runs.

## Repository and local state
- Repository: `https://github.com/pisomojadogrande/polyphon`. Initially empty. Origin corrected from the old `polyphony` URL.
- Current environment checkout: `/workspace/polyphony` (old directory name only); no product references use the old repository name.
- Generated clips, MIDI, reports, screenshots, Python environment, node_modules, build bundle, caches, and runtime state are ignored. No user recordings were supplied or committed.
- Foundation pushed to `main` and remote commit verified on 2026-10-11. All requirements, plans, setup instructions, tests, and these continuation notes are in the repository.

## User's next step
Follow README setup, open localhost, test 10–30 second excerpts of a solo voice, a cappella ensemble, and voice/instrument mix. Download MIDI/reports and supply usefulness ratings and error timestamps using `docs/evaluation.md`. Stop after those results; we should refine this experiment before moving to cloud.

## Resume only after user feedback
Read `AGENTS.md`, `docs/requirements.md`, `docs/plan.md`, and this file. Do not restart onboarding or implement later phases automatically. Preserve the milestone pauses. Actual singing quality and representative three-minute runtime/memory remain unknown. Use collected measurements to decide whether preprocessing/source separation/model changes are warranted and only then propose AWS compute within the $5/month target. User handles bootstrap/trust; future deployment must use OIDC, separate accounts and us-east-1, test from main and approval for production.
