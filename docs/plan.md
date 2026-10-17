# Phase plan

## Current direction (2026-10-17)
The user has completed initial MIDI playback testing and requests **raw staff notation on localhost next**, before cloud infrastructure. The current detailed plan is `raw-notation-plan.md`. The user accepted a combined grand staff and left rhythm complexity to us; the simpler fixed-grid approximation is implemented with original-time playback. The raw notation/cursor milestone is locally verified and paused for user testing. Later key/measure guidance and cloud work remain deferred.


## Milestone 1: local audio → MIDI playback

Deliverables:
- TypeScript shared guidance/result contracts and Python process adapter; TypeScript CLI.
- Basic Pitch 0.4.0 ONNX inference on a CPU. Updated 2026-10-17: support Python 3.14 using the attributed ONNX-only package; NumPy 2.4.6 and no TensorFlow.
- Localhost web server and browser UI: upload, truthful stage/window progress, original-audio comparison, MIDI playback/seek/speed, download MIDI/report, cancel/delete.
- Reports: runtime, stage times, peak worker RSS, audio length, note count, guidance and limitations. Store feedback separately from machine metrics.
- Temporary uploads removed after success/failure/cancellation and startup recovery; output retention/cap and explicit deletion.
- Unit/process/lifecycle tests and deterministic synthetic fixtures. Actual Basic Pitch smoke experiments and browser verification.
- Setup, evaluation, and continuation documentation. CI checks only, no deployment.

Architecture:
`CLI / local HTTP jobs → transcribe(options) → JSON-lines Python worker → Basic Pitch → MIDI + report`
`Browser → downloaded MIDI → MIDI parser → Web Audio synth`

Decisions:
- Local server binds only `127.0.0.1`, with Host/Origin checks. No authentication until a cloud phase. Never expose it to a network.
- File limit 64 MiB, duration limit 600 seconds, one worker, at most three outstanding uploads/jobs, 15-minute worker timeout.
- Inference percent counts actual model windows. Percent resets per measurable stage; no pretend total progress.
- Fixed user tempo and meter are MIDI metadata; note times stay in seconds. Key and voices are recorded, not used by Basic Pitch. No voice separation, score rendering, quantization, or fermata inference.
- Results expire after 7 days with a 200 MiB oldest-first cap. Local periodic/startup cleanup is not an S3 lifecycle guarantee; revisit expiry in cloud design. CLI output retention belongs to the user.
- Playback uses a simple triangle synth and fixed note pitches; export MIDI for full pitch-bend/instrument playback in a DAW.
- Avoid a cloud preview/hosting service because this phase must evaluate local processing and pause for user testing.

Acceptance:
1. A short supported recording yields a readable MIDI and metrics via CLI and UI.
2. UI can play MIDI, pause/stop/seek/change speed, compare original, download, and delete.
3. Unit tests cover validation, seek timing, process errors/timeouts/cancellation, queue cleanup, and retention. HTTP tests cover upload/result flow and local access constraints.
4. Tests, actual experiment results, known limits, and user evaluation steps are documented.
5. Save to repository and stop for user evaluation; do not proceed to cloud or scores.

## Later milestones (historical outline; ordering superseded above)
- After user listens: collect isolated voice, a cappella ensemble, and voice/instrument clips. Compare guidance usefulness, note errors, elapsed time, and RSS. Evaluate whether source separation or another model is needed. Select cloud compute only after scaling measurements and budget calculations.
- Cloud: propose AWS architecture with scale-to-zero, account separation, OIDC approvals, expiry/caps, authentication, and usage limits. User handles bootstrap/trust. Pause when cloud transcription is usable.
- Score: prototype MIDI-to-score conversion and first renderer/export. Pause at first usable score; choose refinements from actual musical artifacts.

## Milestone 1 completion
Implementation and local verification complete on 2026-10-11; see `progress.md`. A batch evaluation runner and data-folder lock/graceful shutdown were added to support repeatable measurements and safe local use. **Initial user listening feedback received 2026-10-17; next phase is local raw notation.** Future refinements remain provisional.


## Python 3.14 compatibility fix (2026-10-17)
- Confirm upstream metadata blocks Python 3.14 independently of ONNX support.
- Package the same model, constants, and note extraction under a separate ONNX-only distribution/module namespace; retain provenance hashes and Apache-2.0 notices. Exclude incompatible unused backends instead of overriding TensorFlow or skipping dependency checks.
- Pin CPython 3.14-compatible runtime versions and regenerate a transitive lock with markers for removed standard-library audio modules.
- Test a clean pip install and pip check; run real melody/chord/silence transcription and compare notes, times, velocities, and pitch bends against the approved upstream baseline. Retest Python 3.11 as a compatibility regression.
- Add CI matrix for 3.11/3.14, update setup and progress notes, save to GitHub, and return to the existing user-testing pause. No cloud/score phase work.


## Node startup compatibility fix (2026-10-17)
Use a pinned `tsx` dependency for every TypeScript entry point, support Node 22/24, and test startup with native TypeScript stripping disabled. Verify CLI transcription and existing checks, update docs/progress, save to GitHub, and return to user testing.
