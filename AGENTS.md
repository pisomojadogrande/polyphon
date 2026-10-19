# Polyphon continuation instructions

Read `docs/requirements.md`, `docs/plan.md`, and `docs/progress.md` before changing this project. The original idea is background, not a new request.

The user reviewed raw notation and requested the named-clip workflow and key-signature refinement on 2026-10-18. Read `docs/workflow-plan.md` and `docs/workflow-testing.md`. Latest follow-up: read `docs/scrolling-score-plan.md` for source timestamps, continuous all-line scrolling/following, and optional source start/end selection. These refinements and the workflow are implemented and ready for local testing: optional upload key, progress page, saved clip rail, and repeated key re-engraving. Pause for user feedback. Measure-start input, model improvements, and cloud work remain deferred. Do not deploy AWS resources or request long-term credentials.

Use TypeScript for application/CLI; Python for Basic Pitch. Preserve shared modules and truthful progress. Never commit private recordings, generated audio/MIDI, runtime state, credentials, or dependency environments.

Keep requirements, detailed phase plans, and progress/handoff notes current in the repository, including validations, known limitations, next steps, and decisions. Run checks relevant to any change (`npm run check`, `npm run test:python` after Python setup). Update evaluation evidence honestly; synthetic tests are not representative singing quality evidence.
