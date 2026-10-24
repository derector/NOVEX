# NOVEX implementation plan — motion-director + motion-engine

This checklist is the active engineering plan. Remove completed tasks from this list only after verifying the implementation and its evidence. Never mark a task complete based only on source edits.

## Current baseline
- Existing application: single-page HTML/JavaScript, Capacitor Android + installable web/PWA.
- Existing AI workflow instructions: `MASTERSKILL.md` (motion-director) and `ANGSKILL.md` (motion-engine v3).
- Existing workflow includes reference analysis, timeline plan, local FFmpeg WASM rendering, MP4 download, local projects/library.
- Previous CI run `39993563365`: web build, real browser-render smoke test, APK build, and Android emulator launch all passed; Pages publication job was skipped because the run used a feature branch.
- A new branch `feat/novex-motion-director-workflow` is used for current work; production publication requires verified merge/deploy from `main`.

## Active checklist
- [ ] Audit the complete app and motion-engine instructions; map actual features to requirements and identify regressions.
- [ ] Implement the `/motion-director` entry point: inspect attached reference video, produce a grounded analysis, ask only essential clarifying questions, then create/modify the project.
- [ ] Ensure reference fidelity rules are enforced in UI and project state: explicit “exact copy” intent overrides inspiration options; preserve source edit/order/duration unless user asks to change them.
- [ ] Implement a real preview/timeline contract for multiple video clips, transitions, text layers, keyframes, and 9:16 / 1:1 / 16:9 composition.
- [ ] Verify audio source selection: one music track OR source-video audio; never accidentally mix reference-video audio; retain automatic animation SFX when appropriate.
- [ ] Add motion QA checks (jumps, pops, facecut, comparison and project validation) where tools are available; block final export for confirmed failures.
- [ ] Verify save/restore and export on browser and Android; check output metadata, duration, audio, orientation, and playback.
- [ ] Run JavaScript syntax checks, project build, real MP4 render smoke test, and Android emulator launch; fix all reproducible errors.
- [ ] Merge the verified branch to `main`, confirm GitHub Pages deployment and provide the latest APK artifact.
