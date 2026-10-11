# Polyphon continuation instructions

Read `docs/requirements.md`, `docs/plan.md`, and `docs/progress.md` before changing this project. The original idea is background, not a new request.

The current phase is local audio-to-MIDI evaluation. Stop for user testing at milestone 1. Do not deploy AWS resources or request long-term credentials. Later cloud and score phases require feedback from the milestone pauses.

Use TypeScript for application/CLI; Python for Basic Pitch. Preserve shared modules and truthful progress. Never commit private recordings, generated audio/MIDI, runtime state, credentials, or dependency environments.

Keep requirements, detailed phase plans, and progress/handoff notes current in the repository, including validations, known limitations, next steps, and decisions. Run checks relevant to any change (`npm run check`, `npm run test:python` after Python setup). Update evaluation evidence honestly; synthetic tests are not representative singing quality evidence.
