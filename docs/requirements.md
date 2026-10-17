# Polyphon — agreed requirements

Authority: the user's agreed onboarding requirements (2026-10-11), amended by testing feedback and the local notation request on 2026-10-17. `original-idea.md` preserves the attached idea as background; its request to ask clarifying questions does not override the current instruction to build this milestone.

## Product
- Repository: `pisomojadogrande/polyphon`, renamed from `pisomojadogrande/polyphony`; initially empty.
- Web application: audio → MIDI → eventually editable, exportable sheet music.
- Input includes multiple a cappella voices and voices with instruments. Rough transcription is acceptable.
- The user may supply key, tempo, time signature, and voice information as we discover useful guidance.
- Recordings typically last three minutes and usually under ten minutes. Begin evaluation with much shorter clips.
- Processing may take several minutes. Show real percentage progress where measurable, named stages otherwise.
- Clean, functional interface with visibility into processing.

## Implementation and evaluation
- TypeScript/Node.js application and CLI. Use Python when useful OSS transcription packages require it.
- Composable modules usable by the CLI and web application, with meaningful unit tests.
- Evaluate Basic Pitch locally before choosing cloud processing infrastructure.
- Measure transcription usefulness, runtime, and memory across representative recordings.
- Provide MIDI playback for evaluating short clips, setup instructions, and clear testing instructions.

## Runtime amendment (2026-10-17)
- User has Python 3.14 and requests compatible dependencies. Support standard CPython 3.14 for the local transcription milestone; preserve its existing musical behavior and testing pause.

- Local TypeScript startup uses an explicit runner and supports Node 22/24 without native TypeScript stripping (startup repair, 2026-10-17).

## Future cloud constraints (not authorized in milestone 1)
- AWS, initial target roughly $5/month and minimal idle cost. Separate test and production accounts, region `us-east-1`.
- Prefer CDK, DynamoDB, and serverless services. Decide processing architecture after local measurements; the budget is a target, not a demonstrated guarantee.
- Temporarily store uploaded audio, delete it after processing, use automatic expiry as a backstop.
- Retain MIDI and scores with storage caps and deletion controls.
- Initially one invited user with email/password authentication. Multiple users and Stripe billing later; sandbox in test, live in production.
- GitHub Actions with OIDC temporary credentials. Test deployment from `main`, approval required for production.
- User performs AWS bootstrap and trust configuration. Never request long-term credentials or direct AWS write access.
- Original idea also proposes monthly activity limits/cost cutoff. Refine limits with measured usage before cloud implementation.

## Local notation amendment (2026-10-17)
- Initial audio-to-MIDI playback has been user-tested. Transcription catches many harmonies but misses others; musical completeness is not assumed.
- Users generally do not know tempo or key before transcription. Do not require either up front. They can read music, identify key after viewing notes, and later mark measure starts.
- Next milestone is raw MIDI musical notation on staves, running on localhost. Initially show chromatic notes with explicit accidentals and no assumed key signature.
- Include play/pause/stop controls and a moving vertical indicator synchronized with the notes during playback.
- Keep this experiment limited to viewing the current MIDI; do not invent missing notes or add AI gap filling. Further transcription/model improvements remain exploratory.
- Key-signature input and user-specified measure starts are likely subsequent refinements, after reviewing the raw rendering. They are not part of this first notation pass.
- User accepted the combined grand staff and deferred rhythm complexity to us. Chosen implementation: a simple fixed-grid display approximation, preserving original MIDI timing for playback.

## Work sequence and stopping rules (updated 2026-10-17)
1. Local audio-to-MIDI foundation and playback: implemented and user-tested. Continue recording imperfections and findings.
2. **Current milestone, ready for review:** raw MIDI staff rendering with synchronized playback, on localhost. See `raw-notation-plan.md`. Presentation choices are settled and implementation is ready; pause for user testing.
3. Refine the score from user feedback, likely key signature and measure-start guidance. Do not begin these automatically before the first rendering is reviewed.
4. Cloud transcription remains deferred, with a separate testing pause when eventually usable. The original cloud-before-score ordering is superseded; no AWS deployment is currently authorized.
5. Editing/export, voice refinement, and eventual billing remain future work shaped by results.

Save these requirements and all detailed phase plans to the repository. Keep current progress and continuation notes up to date so work can resume with clean context.
