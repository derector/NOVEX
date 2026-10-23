# NOVEX agent instructions

When editing NOVEX, read the relevant skill before implementation:
- .agents/skills/novex-motion-director/SKILL.md for natural-language direction, scene planning, reference matching, and project edits.
- .agents/skills/novex-3d-animation/SKILL.md for real 3D motion graphics and camera/material animation.
- .agents/skills/novex-render-quality/SKILL.md after any render or preview changes.

## Architecture truth
The current app is a Vite vanilla-JS app with a client-side FFmpeg.wasm export path. Its montage plan is heuristic and it is not a connected general-purpose LLM editor. A Three.js frame-export path is implemented and composited by FFmpeg; keep the real Chromium 3D-export smoke test as a release gate and do not mark the path verified unless that test passes.

## Change policy
- Preserve user footage unless a request explicitly asks to edit the cut.
- Keep aspect ratio and center composition responsive.
- Use typed, validated scene/layer patches for future natural-language edits; never execute arbitrary generated code.
- Make changes reversible and inspect affected frames before claiming completion.
- Keep API keys and secrets out of client bundles and Git.
