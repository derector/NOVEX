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
