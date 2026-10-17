# Polyphon continuation instructions

Read `docs/requirements.md`, `docs/plan.md`, and `docs/progress.md` before changing this project. The original idea is background, not a new request.

The user has tested milestone 1 and requested raw MIDI staff notation on localhost next. Read `docs/raw-notation-plan.md`. The user accepted a combined grand staff; use the simpler readable fixed-grid rhythm approximation with original-time playback. The first raw score with synchronized playback is now implemented and ready for testing. Pause for user review; do not automatically add key-signature or measure-start input. Cloud work remains deferred. Do not deploy AWS resources or request long-term credentials.

Use TypeScript for application/CLI; Python for Basic Pitch. Preserve shared modules and truthful progress. Never commit private recordings, generated audio/MIDI, runtime state, credentials, or dependency environments.

Keep requirements, detailed phase plans, and progress/handoff notes current in the repository, including validations, known limitations, next steps, and decisions. Run checks relevant to any change (`npm run check`, `npm run test:python` after Python setup). Update evaluation evidence honestly; synthetic tests are not representative singing quality evidence.
