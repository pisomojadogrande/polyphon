# Current progress / clean-context handoff

Updated: 2026-10-18. **Named-clip workflow and key-signature re-engraving are implemented and ready for local user testing. Stop here.**

## Current workflow handoff (2026-10-18)
- Requirements/design saved in `workflow-plan.md`; user instructions in `workflow-testing.md` and README. Previous raw-notation notes below are historical and superseded where they defer key input.
- Upload now asks for audio, an editable generated dictionary-pair name, and optional tonic/mode only. Hash routes move through upload/progress/results and support back/forward/refresh.
- Collapsible responsive left rail lists saved clips. Names are normalized and unique, including concurrent uploads and failed clips. Failed/interrupted clips persist explicitly; delete to reuse names. Legacy duplicate filenames migrate with suffixes without losing MIDI.
- Typed musical keys drive signatures, enharmonic octave handling, minor leading-tone spelling and accidental cancellation. F-sharp minor renders three sharps. Unsupported theoretical signatures show their conventional enharmonic rendering explicitly.
- Re-transcribe saves notation metadata and re-engraves without another model run or MIDI mutation. Playback pauses at its position. Source timing, cursor, page following, seek, speed, and downloads remain available. MIDI-file preview is secondary and unsaved.
- `npm run check`: 34 Node tests pass. Browser suite: 7 tests pass, including upload/progress/results, repeated key edits, history/reload, duplicates, mobile rail, and stale MIDI response protection. Pitch spelling is checked for all offered tonic/mode combinations across all 128 MIDI pitches.
- Actual Basic Pitch F-sharp-minor synthetic fixture passed upload → score → key edit → moving-cursor playback; MIDI bytes remained identical. Real server restart restored clip/name/key/MIDI; duplicate uppercase name was rejected. Generated test clip then deleted. No new human musical-quality claim is made.
- Python dependencies unchanged. No AWS actions. Existing 7-day expiry/200 MiB cap remain; changing a key does not renew retention. Key changes affect the displayed score, not exported MIDI/report guidance.
- Remaining limits: provisional 120 BPM/4/4/sixteenth grid, pitch-based treble/bass split, imperfect Basic Pitch notes, no measure-start editing or voice identification. Next action is user testing of this workflow, not automatic cloud or score refinement.

## Latest user feedback and next phase
- User reports imperfect MIDI transcription that captures many, but not all, harmonies. They want to explore the result rather than assume a full accurate score is achievable.
- Users usually cannot supply BPM/key up front; they can identify key and measure starts after seeing staff notation. Record this as product guidance, not a prerequisite to transcription.
- User requests raw MIDI on musical staves with explicit accidentals, play/pause/stop, and a moving vertical playback marker, still on localhost.
- This changes the sequence: first local score rendering now; AWS/cloud stays deferred. Later key-signature input and measure-start annotations follow the first raw-score review. No AI note completion requested.
- User accepted the combined grand staff. They could not tell which rhythm option was simpler, so we chose a fixed display grid, explained the choice, and retained original MIDI timing for playback. Updated detailed plan: `docs/raw-notation-plan.md`.
- Implemented shared display conversion (`src/notation.ts`), VexFlow 5 SVG grand staff (`web/score.ts`), and moving vertical cursor from the existing player's AudioContext clock. Added pause/resume/stop/seek/speed synchronization, measure-page following/navigation, rests, chord grouping, ties retaining original IDs, explicit chromatic signs/natural cancellations, and optional unknown-tempo upload.
- Display convention: 120 BPM, 4/4, sixteenths; arbitrary provisional measures and fixed chromatic spellings, not tempo/key inference. Source MIDI remains unchanged; treble/bass is a pitch split at middle C, not voices.
- No key selection, user bar starts, voice inference, note completion, score export, AWS, or new transcription model. These remain deferred.
- Verified locally: 24 Node tests/build/type checks on Node 24 and Node 22 with native TypeScript stripping disabled; 4 Playwright tests in local Chromium. Manual actual no-guidance WAV upload → Basic Pitch → notation/cursor → result deletion passed. Desktop/mobile inspected. Browser tests verify geometry/control mechanics, not perceived audio quality; one upload-result regression mocks processing.
- Added browser CI job, local bundled fonts (no CDN) and scoped font CSP. Test servers use isolated per-run data directories and graceful teardown. `POLYPHON_DATA_DIR` supports data isolation; default local storage remains `.polyphon`.
- Setup/testing and limitations: README and `docs/notation-testing.md`. No Python dependency change. Pushed functional milestone `ccabcee68172a47a438bab939e9b6ed3412fd789` to main; all five CI jobs passed (Node 22/24, browser notation, Python 3.11/3.14 transcription/regression): https://github.com/pisomojadogrande/polyphon/actions/runs/39078192018. The final documentation-only handoff commit skips redundant CI.
- **Next action belongs to the user:** inspect their short MIDI clips and report readability, accidentals, rhythm/tie clutter, and cursor behavior. Stop here before key/measure/cloud refinements.

## Latest repair: TypeScript startup
- User reported `ERR_UNKNOWN_FILE_EXTENSION` for `src/server.ts` during `npm run dev`; the original scripts assumed Node 24's native TypeScript stripping.
- Added a pinned local `tsx` runner for server/CLI/evaluation and test loading. Node support is now 22+, with CI TypeScript checks on 22 and 24. No Python or transcription behavior changed.
- Verified locally: all 16 Node tests/build/type checks pass on Node 24.19.0 and Node 22.23.3. On Node 22 with native TypeScript stripping disabled, `npm run dev` served the HTML and job API successfully and the CLI transcribed the melody fixture to 4 notes. Pinned runner is tsx 4.23.15.
- Pushed to main. CI passed Node 22/24 checks with native stripping disabled and both Python transcription/regression jobs on commit `e101cb55a03c606b6e44f2e3b3098bcd735c8202`: https://github.com/pisomojadogrande/polyphon/actions/runs/39073382258. Final documentation-only handoff skips redundant CI. User should pull, run `npm ci`, and retry `npm run dev`; no Python environment changes are needed. Preserve the milestone 1 listening-test pause.

## Python 3.14 repair
- User reported TensorFlow resolution failures with Python 3.14. Upstream Basic Pitch 0.4.0 requires TensorFlow <2.15.1 even when selecting ONNX; there are no compatible TensorFlow wheels for that requirement.
- Replaced upstream packaging with the attributed local `polyphon-basic-pitch-onnx` distribution, retaining the same model, constants, and note extraction. Its separate module is `polyphon_basic_pitch`; no runtime TensorFlow/CoreML/TFLite imports. License, provenance hashes, and modification notices are in `python/vendor/basic-pitch-onnx`.
- Runtime pins include NumPy 2.4.6, ONNX Runtime 1.31.0, Numba 0.68.0, SciPy 1.17.1, and Resampy 0.4.3 (the old pkg_resources dependency came from Resampy 0.4.2, not Basic Pitch itself).
- Lock regenerated with version markers for removed Python audio standard-library modules. Ordinary pip installation into a fresh CPython 3.14.8 environment and `pip check` pass without TensorFlow.
- All 16 Node tests and 5 Python tests pass. Actual melody/chord/silence transcriptions on 3.14 and 3.11 match the approved pre-migration baseline, including note timings, velocities, 266 melody pitch bends, and supplied tempo/meter. See `python/check_regression.py` and `docs/python314.md`.
- README now uses Python 3.14 and documents recreating the virtual environment; both direct and locked installs require running from the repository root because the ONNX package is local.
- CI passed all three jobs on repair commit `2af0475d5bd5058c62dfad4bed82656ac9c6f310`: TypeScript checks and actual transcription/baseline parity on Python 3.11 and 3.14. Run: https://github.com/pisomojadogrande/polyphon/actions/runs/39072407310. The final documentation-only handoff commit skips redundant CI.
- Scope remains the local milestone only; no AWS/score work. Return to short real-clip listening tests after setup succeeds.


## What is implemented
- TypeScript shared contracts and transcription process adapter; CLI and serial batch evaluation runner.
- Python Basic Pitch 0.4.0, explicit ONNX CPU model, measured inference-window progress, named other stages, MIDI metadata, timing and peak worker RSS report.
- Localhost UI/server: bounded uploads, one-worker queue, original-audio preview, MIDI parse/play/pause/stop/seek/speed, CLI MIDI import, downloads, cancel/delete.
- Temporary uploads deleted on completion/failure/cancellation/startup recovery. Outputs persist across restarts, with 7-day expiry and 200 MiB oldest-first cap. Shutdown cancels pending workers. A data-folder lock prevents concurrent servers from clearing each other's uploads.
- Meaningful tests, CI checks plus real Basic Pitch smoke test, setup/evaluation instructions, agreed requirements, original source document, and saved phase plan.
- No AWS deployment, credentials, authentication, billing, voice separation, or cloud architecture selected. Raw score rendering is now implemented; refined/exportable scores are deferred.

## Original milestone verification (2026-10-11)
- `npm run check`: type-check and browser bundle build; **16 Node tests passed** (guidance/manifest validation, playback seek timing, worker protocol/failure/missing interpreter/timeout/cancellation, queue serialization, audio deletion, restoration, cap/TTL, shutdown, process lock, HTTP guards/upload/result downloads/deletion).
- `npm run test:python`: **3 Python tests passed** (window counting, duration limits, peak memory).
- Actual Basic Pitch: 5s melody → 4 expected notes; 5s chords → 12 expected events plus one extra note; 2s silence → valid empty MIDI with warning. Details and measurements in `docs/evaluation.md`.
- Actual melody MIDI preserved supplied 90 BPM and 3/4 metadata.
- Actual serial batch evaluation passed for melody and silence and saved reports with empty human-rating fields.
- Headless Chromium end-to-end check passed: real upload/transcription, MIDI import/play/pause/seek/speed/stop, download, source deletion, result deletion, and CLI-generated MIDI import; no JavaScript errors. Desktop/mobile layout inspected, including no horizontal overflow at 390px. Automated browser checks verify mechanics, not perceived audio quality.
- Linux x86-64, Node 24.19.0, Python 3.11.17; portable macOS setup is documented but unverified. Windows support uses WSL2.
- GitHub Actions passed both jobs (TypeScript/Python checks and actual Basic Pitch smoke) on code commit `af373980f9f4b4cec99e26af1002f2051bc5b856`: https://github.com/pisomojadogrande/polyphon/actions/runs/38185318835. The final handoff commit changes documentation only and skips redundant CI.

## Historical dependency findings (superseded by the repair above)
- Basic Pitch pulls TensorFlow on Python 3.11 even though this worker uses ONNX. Imports contribute substantially to ~756–862 MiB measured RSS.
- NumPy 2.x is incompatible with the upstream TensorFlow version; pinned 1.26.4.
- The previous stack needed setuptools 80.9.0 for `pkg_resources`; investigation identified the import in Resampy 0.4.2. Current Resampy 0.4.3 removes that requirement.
- `python/requirements-lock.txt` is the validated Linux/3.11 dependency snapshot. `python/requirements.txt` is the portable direct-dependency specification. The worker deliberately targets the installed 0.4.0 API (30-frame overlap), not unreleased upstream main.
- Initial decoding includes JIT compilation and can be much slower than subsequent cached runs.

## Repository and local state
- Repository: `https://github.com/pisomojadogrande/polyphon`. Initially empty. Origin corrected from the old `polyphony` URL.
- Current environment checkout: `/workspace/polyphony` (old directory name only); no product references use the old repository name.
- Generated clips, MIDI, reports, screenshots, Python environment, node_modules, build bundle, caches, and runtime state are ignored. No user recordings were supplied or committed.
- Foundation pushed to `main` and remote commit verified on 2026-10-11. All requirements, plans, setup instructions, tests, and these continuation notes are in the repository.

## Previous milestone testing instructions (retained for reference)
Follow README setup, open localhost, test 10–30 second excerpts of a solo voice, a cappella ensemble, and voice/instrument mix. Download MIDI/reports and supply usefulness ratings and error timestamps using `docs/evaluation.md`. Stop after those results; we should refine this experiment before moving to cloud.

## Continuation guidance (updated by the latest feedback above)
Read `AGENTS.md`, `docs/requirements.md`, `docs/plan.md`, and this file. Do not restart onboarding or implement later phases beyond the requested clip workflow/key-signature milestone automatically. Preserve the milestone pauses. Actual singing quality and representative three-minute runtime/memory remain unknown. Use collected measurements to decide whether preprocessing/source separation/model changes are warranted and only then propose AWS compute within the $5/month target. User handles bootstrap/trust; future deployment must use OIDC, separate accounts and us-east-1, test from main and approval for production.
