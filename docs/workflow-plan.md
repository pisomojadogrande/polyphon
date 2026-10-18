# Local clip workflow and key-signature refinement — 2026-10-18

Requested after the user's first raw-score review. The test clip is identifiable as F-sharp minor once displayed. Build locally and pause for user testing; no AWS work.

## Required experience
1. New clip page asks for audio and a required, editable clip name. Prefill an available `word1-word2` name from recognizable dictionary words; a missing API name is also generated. Reject conflicts with saved or currently uploading clips, comparing normalized case/spacing. Only musical inputs here are optional tonic dropdown and major/minor radios. No tempo, meter, or voice questions.
2. After submit, move to a progress page: upload percentage, then the existing real inference-window percentages and named stages. On completion open results automatically. Failed/interrupted clips have a clear recovery path.
3. Results show the existing grand staff, playback controls, moving cursor, seek/speed, and measure following. Provide tonic dropdown + major/minor radios and **Re-transcribe**. This button saves the selected key and re-engraves the existing MIDI; it does not rerun Basic Pitch or transpose the recording.
4. Expandable/collapsible left rail lists saved named clips. Selection opens processing state or saved score/playback. Use hash URLs for refresh/back/forward and persist the key selection per clip across reload/server restart.

## Decisions
- Add a typed, validated `MusicalKey` shared by server/client/notation. Support sharp/flat tonic choices and major/minor. Standard signatures contain at most seven sharps/flats; theoretical spellings use a clearly identified enharmonic conventional signature.
- Key-aware pitch spelling prefers the selected diatonic letters, handles B-sharp/C-flat octave boundaries and minor raised leading tones, and shows only required in-measure accidentals/cancellations. Unknown key preserves the existing raw accidental policy. Pitch/time/velocity and source MIDI bytes stay unchanged.
- Name storage uses IDs for paths, never user names. Server reserves names before streaming uploads, preventing concurrent collisions; invalid/failed uploads release reservations. Stored job metadata includes name/source filename/chosen notation key. Legacy filename names and duplicate names migrate deterministically, preserving MIDI/report files.
- Persist metadata from queuing onward. Interrupted processing is recovered as an explicit failure after deleting source audio; failed names remain reserved until the clip is deleted. Existing 7-day expiry and 200 MiB cap remain in place.
- Keep local MIDI preview as a secondary diagnostic affordance; clearly mark it as unsaved. Persisted audio clips remain the main workflow.
- Key changes pause playback at its current source position, re-render, and allow resume; changing clips stops the prior clip. Prevent stale fetch/render responses from replacing a newer selection.

## Verification and handoff
- Unit tests for key signatures/spelling/accidentals and unchanged pitches/times; names, concurrent reservations, migration, metadata persistence and interrupted recovery.
- HTTP tests for duplicate rejection and key update/save/reload, confirming no second inference and unchanged MIDI.
- Browser tests for new→upload/progress→result, F-sharp minor rendering/repetition, rail collapse/switching/history/reload, errors and mobile layout, preserving playback/cursor behavior.
- Actual short-clip run locally, then CI and saved progress/testing instructions. Stop and prompt the user to try the workflow. Measure guidance, note editing, source separation, AI completion, cloud/auth/billing remain deferred.

## Completion (2026-10-18)
All required experiences above are implemented. Local checks pass: 34 Node tests, 7 Chromium browser tests, and an actual Basic Pitch synthetic clip with F-sharp-minor key edit, playback, byte-identical MIDI, restart restoration, and duplicate rejection. No Python dependencies changed and no AWS deployment occurred. See `workflow-testing.md` and `progress.md`. Pause for user testing before choosing further work.
