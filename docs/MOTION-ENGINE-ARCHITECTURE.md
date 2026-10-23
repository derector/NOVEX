# NOVEX Motion Engine and repository-aware coding agent

## Deterministic animation core
`src/motion-engine.js` exposes `createMotionEngine({ duration, fps, onFrame })`, named easing curves, timeline tracks, a `sampleAt(t)` / `seekFrame(frame)` API, and composable frame hooks. A frame depends only on its timestamp: no timers, browser animation loop, or unseeded randomness. The kinetic-title MP4 exporter uses this timeline for opacity, scale, rise, and per-line reveal, so the same timestamp can be rendered repeatedly during preview and export.

## Refreshing GitHub skill references
From `novex-app/`, run `npm run skills:sync`. The script downloads selected Markdown reference files and license/attribution documents from these approved public repositories:
- https://github.com/jakubkrehel/skills
- https://github.com/kaankiziltug/logo-design-skill

It records the exact upstream commit SHA for each source in `.cache/motion-skills/manifest.json`. The cache is gitignored. Downloaded code is never executed and is not included in the app bundle.

## Repository-aware coding agent
The **Motion Engine Agent** workflow is manually triggered in GitHub Actions with a concrete task. It refreshes the skill references, calls the OpenAI Responses API using the `OPENAI_API_KEY` repository secret, applies a bounded patch only to allowed app source/tests/docs paths, runs syntax checks, contract tests, and a production build, then opens a pull request. It does not auto-merge. Configure the `OPENAI_API_KEY` secret; optionally set the `NOVEX_AGENT_MODEL` repository variable.

Every generated patch has a visible diff and must pass CI/review before merge.


## Motion Director API
`src/motion-director.js` builds a serializable scene/cue plan on top of the deterministic engine:
- `M.start(({ tl, f, D, M }) => ...)` and `tl.to/fromTo/set` for timestamped tracks.
- `M.seq` and `M.scene` for scene timing and transition overlap.
- `M.text`, `M.textOut`, `M.show`, `M.count`, `M.captions` for text and content cues.
- `M.float`, `M.shake`, `M.camera`, `M.win`, `M.chart` for motion and composition descriptors.
- `M.draw.underline/circle/arrow/ring/burst` for graphics cues.
- `M.sfx`, `M.hit`, `M.onFrame`, `M.renderAt`, `M.seekFrame`, `M.compile`, and `M.check` for sound cue scheduling, hooks, frame state, exportable plans, and timing validation.

The director returns deterministic frame-state descriptors; the actual audio synthesis and DOM/SVG renderer remain separate integration stages.


Procedural audio: Motion Director can synthesize scheduled SFX cues into deterministic PCM WAV using generated oscillators and envelopes. MP4 export mixes this sound-effects track with the selected music and/or original audio.
