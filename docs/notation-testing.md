# Raw notation milestone: testing and handoff

## Run it

Stop any existing Polyphon server, then from the checkout:

```sh
git pull --ff-only
npm ci
npm run dev
```

Use your existing Python 3.14 environment; no Python dependency changes are needed for this phase. Open http://127.0.0.1:3000.

1. **Fastest test:** use **Open local MIDI** under **Raw musical notation & playback** to select a MIDI from your earlier listening tests. This does not retranscribe anything.
2. Alternatively choose a 10–30 second audio clip, leave tempo/key blank, transcribe, and click **View notation & MIDI playback** on the result. Existing saved results have the same button.
3. Inspect the treble/bass grand staff. The grid is provisionally 4/4 at 120 display BPM, rounded to sixteenths. This is not an estimate of your song's tempo/meter or true bar starts. No key signature is assumed. Chromatic spellings initially use C♯, E♭, F♯, A♭, B♭, with natural cancellations as needed.
4. **Play** and watch the vertical cursor. Pause freezes both sound and position; Play resumes. Stop resets to the beginning. Seek pauses at the chosen source time; playback speed changes the sound and cursor together. Original MIDI note timing is used, even though the displayed rhythm is approximate.
5. The view follows through four-measure pages. While paused, inspect other pages with Previous/Next; scroll within the score for wide/dense bars. On resuming, the view follows the current source position again.
6. Compare with the original audio preview, one at a time. The notes come directly from the imperfect MIDI; no missing notes are filled in. Source MIDI is unchanged.

Empty MIDI displays an explicit no-notes state. Notation is bounded at 10 minutes and 50,000 notes. Outside that display limit, the UI reports the notation problem and preserves MIDI playback where possible.

## What to report

- Can you identify the likely key from this rendering?
- Are harmonies visible enough to be useful? Where do overlapping notes or ledger lines become unreadable?
- Are the provisional rhythm and ties tolerable for inspecting pitches, or do they obscure them? Include source timestamps and/or provisional measure numbers.
- Any confusing accidentals, natural cancellations, or enharmonic spellings?
- Does the cursor follow the notes, including after pause/resume, seeking, rests, page changes, and speed changes?
- Does the score make the next refinement clearer: key-signature selection, marking bar starts, or something else?

This is the planned **first rendered-score pause**. Do not assume key selection or bar annotations exist yet. We will choose that next iteration from your feedback. Cloud remains deferred; nothing is deployed to AWS.

## Reproducible checks

`npm run check` covers type checking, bundling, and 24 Node tests, including polyphony, rests, tie continuity versus repeated attacks, unisons, rhythm splitting, chromatic/natural signs, display limits, input immutability, and source-time cursor anchors.

For browser regressions:

```sh
npx playwright install chromium
npm run test:browser
```

On Linux, browser system packages may require `npx playwright install --with-deps chromium`. To use an installed Chromium, set `POLYPHON_CHROMIUM=/path/to/chromium`. The tests use a separate port/data directory under ignored `work/`, without touching the normal `.polyphon` results. Four tests cover actual SVG/font rendering, controls and cursor following across pages, speed/seek/stop, mobile containment, empty/oversized MIDI, and an upload/result path without tempo/key (processing mocked in that test). Browser tests assert no external font/service requests or CSP violations. CI runs the same tests; actual Basic Pitch transcription still has its separate Python-version checks.

Additional local check completed: a real generated WAV with no musical guidance was transcribed by Basic Pitch, displayed on the staff, played with a moving cursor, and deleted. No human evaluation of new score quality is claimed. Private user recordings and generated MIDI/screenshots were not committed.
