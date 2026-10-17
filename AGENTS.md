# Polyphon continuation instructions

Read `docs/requirements.md`, `docs/plan.md`, and `docs/progress.md` before changing this project. The original idea is background, not a new request.

The user has tested milestone 1 and requested raw MIDI staff notation on localhost next. Read `docs/raw-notation-plan.md`. Clarify staff layout and rhythm presentation before implementation; pause again when the first rendered score with synchronized playback is usable. Cloud work remains deferred. Do not deploy AWS resources or request long-term credentials.

Use TypeScript for application/CLI; Python for Basic Pitch. Preserve shared modules and truthful progress. Never commit private recordings, generated audio/MIDI, runtime state, credentials, or dependency environments.

Keep requirements, detailed phase plans, and progress/handoff notes current in the repository, including validations, known limitations, next steps, and decisions. Run checks relevant to any change (`npm run check`, `npm run test:python` after Python setup). Update evaluation evidence honestly; synthetic tests are not representative singing quality evidence.
