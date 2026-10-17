# Next phase: raw MIDI staff notation on localhost

Requested 2026-10-17 after the user's first listening tests. Status: **planned, presentation questions pending; no renderer implemented yet**.

## Feedback driving this experiment

MIDI catches many harmonies but misses some. We should show what exists and learn how useful the result is; a complete or accurate song score is not promised. Users can read music but generally cannot supply BPM or key before transcription. After seeing the notes, they can identify the key and indicate measure starts.

This phase moves the first rendered score ahead of cloud transcription. Keep running on localhost. Retain existing MIDI transcription/playback, setup fixes, and composable TypeScript modules.

## Scope

- Render MIDI from a completed transcription or local MIDI import as standard staff notation.
- Use no assumed key signature; show the necessary chromatic accidentals. Choose a documented initial enharmonic spelling policy without claiming the song is in C major. Later key input can improve spelling.
- Provide play, pause/resume, and stop beside the notation.
- Show a moving vertical cursor at the corresponding musical position during playback. Keep score position and playback on one transport clock; map score events back to source MIDI seconds. Handle rests, chords, sustained/tied notes, and system changes without accumulating timer drift.
- Preserve the original MIDI and source timing for playback; any display rhythm approximation belongs to the notation representation. Playback should not silently become a performance of a different quantized MIDI.
- Do not require users to guess tempo/key. If a grid/meter is necessary for conventional engraving, treat it as an explicitly provisional display convention. Existing Basic Pitch MIDI tempo is synthetic metadata, not evidence of the song's true BPM. User-supplied measure boundaries come later.
- Keep the first rendering functional and inspectable, including a clear statement about approximate rhythm/provisional measures and imperfect source notes.
- Keep library-specific engraving separate from the shared MIDI/notation event representation, so later key/measure guidance can recompute presentation without retranscribing the audio.

## Questions sent to user

1. Is a combined treble/bass grand staff, with simultaneous notes grouped as chords and provisional measures, acceptable? Or should this phase attempt separate voice staves?
   - Recommendation: combined grand staff. MIDI has not separated singers; separate musical voices would add inference beyond raw rendering. A simple pitch split should not be described as voice identification.
2. Should notation prioritize readable approximate rhythms or preserve timing as closely as notation permits?
   - Recommendation: readable approximation, with original MIDI timing preserved for playback in either case.

These are proposals, not accepted answers. Do not pick a notation library or finalize the rhythm/staff strategy before incorporating the user's response. No extra questions are needed about AWS, authentication, key inference, or missing-note AI for this bounded phase.

## Implementation outline after answers

1. Inspect the existing MIDI player/transport and parsed MIDI data. Select a TypeScript/browser engraving library appropriate for the agreed display; record the choice and tradeoffs here.
2. Build a shared representation of source pitches/onsets/durations and display events. Preserve an explicit mapping between original timing and engraving positions. Document pitch splitting, accidental spelling, chord grouping, rests, ties, and any rhythm approximation.
3. Add the notation view to completed-result/local-MIDI flows, reusing one playback transport for audio and cursor updates. Pause freezes the cursor; resume continues; stop resets playback and cursor. Coordinate system/page changes and viewport visibility.
4. Add meaningful musical conversion tests and browser checks for controls/cursor synchronization. Exercise polyphony, accidentals, rests, sustained notes, irregular onsets, and empty MIDI. Reuse synthetic fixtures; do not commit private recordings.
5. Update setup/testing/limitations and progress notes. Save implementation and test evidence to the repository.
6. **Stop for user testing at the first usable rendered-score milestone.** Do not automatically implement the likely next key-signature/measure-input iteration.

## Deferred

Key-signature selection, user-defined bar starts and meter refinement, voice separation, note editing, note completion/AI, source-model changes, score export, cloud processing, authentication, billing, and AWS deployment. Refine these from the user's reaction to the raw score.

## Acceptance

A short transcribed or imported MIDI is visible on staves with accidentals, play/pause/stop work, and a moving vertical indicator follows source playback through the displayed notes. The user can evaluate how messy/useful it looks without knowing the key or BPM first. Source MIDI is unchanged; provisional display choices are clear. Pause for feedback with instructions and durable continuation notes.
