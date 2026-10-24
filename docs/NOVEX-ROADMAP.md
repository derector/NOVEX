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

## Execution ledger — 2026-10-24

This ledger is the operational checklist for the current implementation pass. A checked item means the required source/configuration is present or the specified verification has actually passed; it does not imply unrelated runtime behavior is verified.

### Present in the repository (source-level review)
- [x] Canonical full product contract exists at `docs/NOVEX-FULL-SPEC.md`; it explicitly separates requirements from proven functionality.
- [x] Main Vite + Capacitor app and npm lockfile are present under `novex-app/`.
- [x] Contract tests exist at `novex-app/tests/render-contract.test.mjs` and are wired to `npm test`.
- [x] Browser render smoke test exists at `novex-app/scripts/browser-render-smoke.mjs`; the web workflow invokes it and checks FFmpeg JS/WASM assets.
- [x] Web build workflow uploads the web artifact and deploys GitHub Pages only after the web job succeeds.
- [x] A dedicated Android job has now been added on branch `chore/novex-verification-ledger`; it installs locked dependencies, runs tests, generates the Capacitor project, assembles a debug APK, checks the APK file, and uploads it as `NOVEX-Android-APK`.
- [x] This change is isolated on a branch and has not been merged into `main`.

### Must still be verified or implemented
- [ ] Run the updated GitHub Actions workflow and inspect each failed step's actual logs; no success is inferred from editing the YAML.
- [ ] Confirm the Android job can generate the native project on a clean runner and produces a non-empty APK artifact.
- [ ] Confirm the web job passes the full contract suite, Chromium smoke test, FFmpeg core checks, and creates the expected artifact.
- [ ] Confirm the GitHub Pages deploy job succeeds and test the resulting public URL, including base-path assets and FFmpeg WASM loading.
- [ ] Run the browser flow end-to-end: upload multiple videos and audio, metadata, sequential preview, project save/load/reload, timeline edits, director commands, draft render, final MP4 download, and error/cancel behavior.
- [ ] Inspect a real exported MP4 with ffprobe/FFmpeg: video/audio streams, dimensions, duration, frame rate, audio synchronization, and successful decode.
- [ ] Test on Android emulator or device: first launch, media picker, long clips, storage/Share, export, and memory/error recovery.
- [ ] Implement and verify resumable render checkpoints/retries, long-project safeguards, and a persistent server-side queue for heavyweight jobs. These are requirements, not confirmed features.
- [ ] Reconcile the latest user-provided source archive with the canonical repository before declaring source synchronization complete.
- [ ] Check asset provenance/licensing and ensure reference assets are not silently bundled into production.
- [ ] After all blocking checks pass, merge the reviewed branch, verify the production deployment, and share only verified site/APK links.

### Release gate
**No release link is considered final until the corresponding GitHub Actions job is green, its artifact exists, and the deployed site or installed APK passes the relevant smoke test.** If a runner fails, fix the specific logged cause and rerun; do not mark the step complete from source inspection alone.

### CI failure analysis and corrective pass — 2026-10-24
- [x] Retrieved the full job logs for run `40048043675` (run #429); the failure was reproducible and not a generic runner/log outage.
- [x] Confirmed the web syntax checks, contract tests, Vite build, FFmpeg core checks, fixture generation, and Chromium installation all passed.
- [x] Identified the web smoke-test failure: the music player had `paused: false` but `currentTime: 0` at the fixed 300 ms sample. Changed the test to wait up to 3 seconds for measurable playback progress before judging the player.
- [x] Identified the Android SDK failure: `android-actions/setup-android@v3` requested the retired `tools` package, and sdkmanager returned `Failed to find package 'tools'`. Updated the job to `android-actions/setup-android@v4` and explicitly request `platform-tools`, consistent with the action's current guidance.
- [ ] Re-run the corrected workflow and confirm the music player test passes; if it still fails, inspect browser playback state and fix the product behavior rather than weakening the assertion.
- [ ] Confirm Android SDK setup, Capacitor project generation, Gradle build, APK artifact upload, and installation smoke test.
- [ ] Check dependency audit warnings from the CI log (2 npm audit findings were reported during temporary browser-test tool installation) and determine exact affected packages before changing dependency versions.



### Browser smoke test follow-up — 2026-10-24
- [x] Confirmed Android debug APK build and artifact upload succeeded in run #434. Artifact: `NOVEX-Android-APK` (debug build, not a signed production release).
- [x] Retrieved the exact web smoke failure: the mobile navigation backdrop was unstyled, so the test could not confirm backdrop dismissal after tapping outside the sidebar.
- [x] Added a fixed, viewport-covering mobile backdrop with explicit stacking, topbar clearance, and hidden-state rules in `novex-app/src/style.css`.
- [ ] Re-run browser smoke test and confirm backdrop tap, Escape focus restoration, and all later render checks pass.
- [ ] Only publish Pages after the full web smoke test passes; APK artifact alone does not establish app runtime correctness.


### Preview aspect-ratio regression — 2026-10-24
- [x] Inspected the failed browser smoke test from run #438: a portrait reference video was centered but rendered with `object-fit: cover`, contradicting the required full-frame preview behavior.
- [x] Added a narrowly scoped rule for `#previewVideo[data-preview-kind="reference"]` to use `object-fit: contain` and centered positioning; source/output preview rules remain unchanged.
- [ ] Re-run browser smoke test to confirm portrait/landscape fit, navigation, project restore, and actual MP4 export all pass.
- [ ] Publish the web build only after all browser checks pass; the latest Android build succeeded but remains a debug APK.


### Follow-up verification — 2026-10-24

- [x] Android debug APK build succeeded in workflow run #442; artifact `NOVEX-Android-APK` exists and is not expired.
- [x] Inspected the browser-smoke failure from run #442: the portrait preview computed `object-fit: cover` despite the narrower reference-only rule.
- [x] Corrected the CSS cascade by using the more specific `#previewStage #previewVideo[data-preview-kind="reference"]` selector and explicit `!important` for fit and position.
- [ ] Re-run browser smoke test and verify the full end-to-end render/export sequence passes.
- [ ] Only after all checks pass, merge the draft PR with approval and verify the published Pages URL.


### Latest verification pass — workflow run 40050186964
- [x] Web job passed: locked install, syntax checks, render-contract tests, Vite build, FFmpeg checks, Chromium browser render smoke, web artifact upload, and Pages artifact creation.
- [x] Android job passed on a clean GitHub runner: locked install, contract tests, web build, Capacitor project generation/sync, Gradle `assembleDebug`, non-empty APK gate, and artifact upload.
- [x] Downloaded the actual `NOVEX-Android-APK` artifact and verified ZIP integrity and APK structure; the APK contains `AndroidManifest.xml`, DEX files, app web assets, and FFmpeg JS/WASM assets. APK SHA-256: `f71428b9934cb8b235a45e3d7e80fe169c444eb4745e791d74f26030b94be746`.
- [x] Confirmed APK signer is the standard Android Debug certificate. This is a debug build, not a production-signed release; no emulator/device installation test has been performed.
- [x] Compared the saved `novex-motion-studio-source.zip` against the current branch inventory. The archive is 35,267 bytes and has only 21 entries; its `index.html`, `src/main.js`, and `src/style.css` are materially smaller than the branch versions, and it lacks the current lockfile and several current source modules. Do not overwrite the branch with this archive; reconcile by file-level diff if a newer archive is supplied.
- [ ] Install and launch the APK on an emulator or physical Android device; test media picker, storage/share, render/export, long clips, and memory/error recovery.
- [ ] Test the exported MP4 outside the smoke harness with ffprobe/FFmpeg for streams, dimensions, duration, frame rate, synchronization, and complete decode.
- [ ] Audit the two npm audit findings previously seen in the temporary browser-test tooling and record exact package paths before changing dependencies.
- [ ] Resolve PR review/release gate, merge only with explicit approval, then verify GitHub Pages deployment and public URL.


### Dependency audit isolation — 2026-10-24
- [x] Traced the earlier `2 vulnerabilities (1 high, 1 critical)` summary to the web job's browser-smoke setup sequence: `npm ci --no-audit --no-fund` followed by `npm install --no-save --package-lock=false playwright ffmpeg-static ffprobe-static`. The original log does not identify affected packages, so no dependency was upgraded speculatively.
- [x] Added diagnostic `npm audit --json` summaries for the locked app dependency tree before temporary test tools are installed, and for the combined tree after they are installed. Each summary prints package names, severity, advisory title/URL/range, and fix availability while preserving the build's existing non-blocking audit behavior.
- [ ] Inspect the next CI run's two audit summaries, determine whether the high/critical findings exist in the locked app tree or only in temporary browser-test tooling, then update only the affected dependency path and rerun tests.
- [ ] Confirm a fresh workflow run includes the workflow and roadmap commits; the last verified run predates these audit-diagnostic changes.
