# NOVEX agent instructions

When editing NOVEX, read the relevant skill before implementation:
- .agents/skills/novex-motion-director/SKILL.md for natural-language direction, scene planning, reference matching, and project edits.
- .agents/skills/novex-3d-animation/SKILL.md for real 3D motion graphics and camera/material animation.
- .agents/skills/novex-render-quality/SKILL.md after any render or preview changes.

## Architecture truth
The current app is a Vite vanilla-JS app with a client-side FFmpeg.wasm export path. Its montage plan is heuristic. It is not yet a connected general-purpose LLM editor, and the existing FFmpeg render path does not yet composite Three.js 3D scenes into exported MP4. Do not describe those capabilities as implemented until code and tests prove them.

## Change policy
- Preserve user footage unless a request explicitly asks to edit the cut.
- Keep aspect ratio and center composition responsive.
- Use typed, validated scene/layer patches for future natural-language edits; never execute arbitrary generated code.
- Make changes reversible and inspect affected frames before claiming completion.
- Keep API keys and secrets out of client bundles and Git.
