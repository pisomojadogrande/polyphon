# Continuous score following

Requested after workflow testing. Keep this refinement local and pause for user testing.

- Label every provisional measure with its source timestamp, derived by inverting the existing source-time/display-tick anchors. This keeps labels aligned with the playback cursor despite rhythm rounding; no new tempo/bar detection.
- Render all systems in one vertically scrollable score pane. Remove previous/next measure controls and page state.
- Align the active system's label and grand staff to the top of the pane during playback. Seek/stop/key re-render also align immediately while paused. Keep manual scrolling available when paused. Follow horizontally when dense systems exceed the pane width.
- Include enough trailing space to align the last system at the top too. Never scroll the outer document as a side effect.
- Preserve source MIDI, key controls, clip persistence, and playback timing. No Python, model, AWS, or measure-editing work.
- Verify inverse time mapping, all-line rendering, playback across systems, forward/backward seeks, stop/reset, paused manual scrolling, last-line alignment, and mobile containment. Update continuation/testing notes and stop for user feedback.

## Optional source range (additional request)
- Add optional start/end fields on upload, accepting seconds, m:ss, or h:mm:ss. Blank means beginning/end. Validate non-negative finite times, end after start, and a selected duration no longer than ten minutes; check source-file bounds after decoding metadata.
- Entire file still uploads under the existing 64 MiB limit and is deleted afterward. Decode/window/infer only the selected segment, using the existing Basic Pitch windowing. Keep the full-file inference path unchanged.
- MIDI starts at zero relative to the selected segment. Store actual source start/end/full duration in report metadata; score labels add the source offset, including after reload and key edits. Existing reports without range metadata use offset zero. Local MIDI import has no original recording offset.
- Expose the same range through the composable transcribe module and CLI --start/--end. Do not modify the attributed vendored package or dependency versions.
- Verify input/API/worker propagation, Python bounds and exact window parity against a physically cropped WAV, browser validation and offset labels/reload, and actual Basic Pitch crop in both Python CI jobs.

## Completion
Implemented; local checks: 37 Node tests, 10 browser tests, 7 Python tests. Actual 1–3s crop of the five-second melody gives only the expected middle two notes and two-second MIDI-relative timing, with correct original-source metadata. CI evidence and publication are recorded in progress.md. Pause for local user testing.

## Sidebar deletion (additional request)
Each saved-clip row now has a small accessible trash icon beside its link. A browser confirmation names the clip (`Delete word1-word2?`); cancel leaves it intact. Confirm uses existing server deletion/cancellation and storage cleanup. Deleting the selected clip returns to upload; deleting a different clip preserves current playback/selection. Errors remain visible in the rail. Browser regression checks cancellation and both deletion paths.
