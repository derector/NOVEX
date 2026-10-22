# NOVEX Motion Studio — roadmap

## Product direction

NOVEX is a reference-driven music-video studio. The core promise is: upload visual references and a music track, select how closely to follow the references, inspect a preview, and export a finished video or Android build.

## Canonical project guidance

- `/MASTERSKILL.md` is the master motion-director specification.
- `/ANGSKILL.md` contains the motion engine skill and its bundled source.
- Keep these documents versioned with the app. Treat them as product requirements and workflow guidance, not as optional marketing copy.
- User-provided reference videos are research inputs, not assets to bundle into the production app by default. Preserve them in the project/reference library only when explicitly requested and when licensing/privacy permit.

## Reference-driven workflow (Claude-style skills + search)

1. **Intake and requirements**
   - Collect the reference clips, music/audio, optional text, output format, duration, and intended publishing destination.
   - Read the user's exact instructions and convert them into a checklist before rendering.
   - If earlier chats or project files contain approved references or decisions, search them before asking the user to resend them.
2. **Analyze references**
   - Extract metadata (duration, resolution, frame rate, orientation).
   - Sample frames and create a contact sheet; identify cuts, typography, overlays, transitions, motion timing, and composition.
   - Analyze audio tempo, energy, waveform, speech/transcript, and notable sound events when relevant.
   - Keep measured facts separate from inferred design interpretations.
3. **Use skills as modular instructions**
   - Select the applicable skill/workflow (exact reference copy, inspired-by, or from-scratch).
   - Load only the relevant skill instructions and bundled engine files; follow their checks rather than improvising new rules.
   - Track skill versions and source references so future changes are reproducible.
4. **Search when a reference needs matching assets**
   - Search for suitable images, footage, fonts, icons, and factual context when requested.
   - Prefer original/appropriately licensed assets; record source URLs, creator/license, and retrieval date.
   - Never silently replace a required photo insert with a flat card or icon. If a required asset cannot be found, report the gap and offer a concrete next step.
5. **Plan and render**
   - Generate a scene/timeline plan with timestamps, elements, transitions, audio cues, and the source reference for each decision.
   - Keep the user's original edit intact unless they explicitly ask for a recut.
   - Render a low-cost draft first; inspect it before the final render.
6. **Validate**
   - Run syntax checks, app build, visual/browser smoke tests, and export checks.
   - Compare key frames and motion against the reference; detect sudden jumps/cuts and audio/video duration mismatch.
   - Do not report success until CI artifacts exist and the relevant checks have passed.
7. **Export and preserve provenance**
   - Provide the web build and Android APK as separate downloadable CI artifacts.
   - Save the project settings, timeline, input asset manifest, reference notes, and validation report so the project can be resumed later.

## Implementation priorities

### P0 — Build reliability
- Keep GitHub Actions as the source of truth for web and Android builds.
- Run `node --check src/main.js` before `npm run build`.
- Upload `dist/` and the debug APK as workflow artifacts.
- Keep Android SDK package setup deterministic and inspect failing step logs before changing dependencies.

### P1 — Complete the source integration
- Compare the GitHub tree against the latest source archive shared in chat; do not assume an earlier partial copy is the newest version.
- Ensure all required app files are committed: `index.html`, `src/main.js`, `src/style.css`, `public/manifest.webmanifest`, `public/sw.js`, `public/novex.svg`, `capacitor.config.json`, `vite.config.js`, `package.json`, and the build documentation.
- Keep CI workflows under repository-root `.github/workflows/`; nested workflows inside `novex-app/` are not discovered by GitHub Actions.
- Add a lockfile and move to `npm ci` once the dependency graph is validated.

### P2 — Reference library
- Add a first-class reference library with upload, preview, metadata, tags, and project association.
- Store reference manifests and analysis output per project; avoid embedding large user clips into the production web bundle.
- Add search across saved projects, user-provided documents, and permitted web sources, with citations/provenance.

### P3 — Skill/workflow orchestration
- Implement explicit workflow modes: exact copy, inspired by reference, and original concept.
- Each skill should declare its purpose, required inputs, steps, output artifacts, checks, and dependencies.
- Show which references and skill version influenced a result; let users review the plan before rendering.
- Support resumable jobs and clear error reports instead of a generic failed state.

### P4 — Quality and release
- Add browser smoke tests for upload, preview, project save/load, and export.
- Test Android APK install/launch and permissions on a real device or emulator.
- Add release versioning, checksums, artifact retention, and a short release note per successful build.

## Current known caveats

- A previous CI run exposed an escaped newline in `src/main.js`; it has been corrected in the GitHub copy.
- A previous Android CI run failed during Android SDK package installation; the workflow package delimiter has been corrected and must be revalidated by a fresh run.
- The web build has passed in a subsequent run, but the Android APK is not yet confirmed.
- The source archive `novex-motion-studio-source.zip` shared in chat contains a newer, more complete app source than the first partial GitHub transfer. Compare and integrate it before treating source synchronization as complete.
- The design mockup `NOVEX: Музыкальные видео будущего.png` is a product reference. It should guide layout and visual QA; it is not automatically a production asset.

## Definition of done

- [ ] Latest shared source archive has been reconciled with the repository.
- [ ] Web build passes and its artifact is downloadable.
- [ ] Android build passes and its APK artifact is downloadable.
- [ ] Skills and reference workflow are discoverable from the README.
- [ ] A reference can be uploaded, analyzed, reviewed, and associated with a project.
- [ ] Validation is based on actual CI logs and artifact availability, not assumptions.
