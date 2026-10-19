# Test the local clip workflow

Stop any existing server. From your checkout:

```sh
git pull --ff-only
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Keep your current Python environment; there are no Python dependency changes in this phase.

1. Select an existing clip in the left rail, or upload a 10–30 second recording. For a new upload, keep the generated two-word name or supply a unique one; leave key unknown unless you already know it. No tempo/meter information is required. To transcribe part of a file, expand **Transcribe part of the recording (optional)** and enter start/end as seconds or m:ss (for example 1:30 and 2:00). Blank means beginning/end. The whole file uploads, but only the selected range is transcribed. The range must be within the recording and no longer than ten minutes.
2. Watch upload and transcription progress, then the automatic transition to the staff. Named stages have no fabricated overall percentage.
3. Play/pause/stop, seek and change speed; verify the vertical cursor follows. All grand-staff lines are in one scroll pane, with no previous/next buttons. Playback keeps the active line at the top; seeking moves the pane immediately, even while paused. Stop returns to the first line. Scroll manually while paused, then resume to follow again. Test the final line too. Playback uses the original MIDI timing.
4. For your test clip, choose **F-sharp (F♯)** in the key dropdown, select **Minor**, and click **Re-transcribe**. Both staves should show three sharps, with fewer inline accidentals. The key edit pauses playback at its current position; Play resumes.
5. Try another key and switch back. This changes spelling/signatures only: no note transposition, new inference, or exported MIDI changes. Minor raised leading tones can still have accidentals. Theoretical signatures are shown using a labeled conventional enharmonic equivalent.
6. Collapse/expand the rail and switch among saved clips. Refresh, use browser back/forward, and restart the server: names and chosen keys should persist. Existing results are migrated without retranscribing.
7. Check **Provisional measure N · Source m:ss.s** labels. With a 1:30 start selection, the first label should read Source 1:30.0, including after reload and key changes. MIDI playback/position are relative to the selection; the labels refer to the original recording.
8. Try a duplicate name, including different letter case. It should be rejected visibly. Use the small trash icon beside a clip in the left rail. Check that the confirmation names that clip and Cancel preserves it. Confirm deletes it and frees its name; deleting another clip should leave the current playback running. Failures remain listed until deleted; retry by deleting and uploading again.

Local results still expire after seven days and have a 200 MiB oldest-first cap. Download anything you wish to keep. Original uploaded audio is deleted after processing; its browser preview lasts only for the current upload session. Local MIDI preview is unsaved and cannot join the persistent clip list.

The rhythmic grid remains provisional 120 BPM, 4/4, rounded to sixteenths; it does not identify your real measure starts. Staff selection is based on pitch, not singer. Selecting a key cannot fix missing/extra transcription notes.

Please report whether F-sharp minor reads correctly, any confusing accidentals (with timestamps/measures), playback/cursor issues, and whether switching clips and editing keys feels natural. **Pause for this feedback.** Measure guidance, editing, model changes and AWS remain deferred.

## Developer verification

`npm run check` runs type checking, bundling and 37 Node tests. Browser checks:

```sh
npx playwright install chromium
npm run test:browser
```

Linux may need `npx playwright install --with-deps chromium`; alternatively set `POLYPHON_CHROMIUM=/path/to/chromium`. Ten tests use an isolated data directory under ignored `work/`, with mocked workflow processing plus actual MIDI rendering/playback. Separate Python CI checks perform actual Basic Pitch transcription on Python 3.11/3.14. This phase also passed a real local synthetic transcription, key edit with byte-identical MIDI, server-restart persistence check, and a selected-range transcription containing only the expected notes. Seven Python tests include exact window parity with a physically cropped WAV. Synthetic evidence does not establish real singing quality.
