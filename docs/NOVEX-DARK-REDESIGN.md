# NOVEX — Dark Cyberpunk Redesign

## Design read

- **Mode:** visual overhaul with the existing product and editing behavior preserved.
- **Audience:** creators assembling reference footage, a music track, captions, and an editable timeline.
- **Visual language:** dark post-production control room; deep ink surfaces, restrained neon cyan/violet/magenta, the existing NOVEX lime/coral identity accents, crisp editorial labels, and a stable grid.
- **Dials:** visual variance 6/10, motion 4/10, information density 7/10, asset dependence 2/10, brand fidelity 8/10.
- **Assets:** keep the real NOVEX app mark at `public/novex.svg`; do not replace the product with a decorative mockup.

## Preserve / improve / remove

- **Preserve:** Russian interface, current routes and section names, three-step editing journey, browser-local FFmpeg render, local/cloud projects, media restoration, director commands, and current NOVEX mark.
- **Improve:** dark non-white surfaces, legible contrast, reference upload alignment, centered aspect-ratio-aware video preview, motion alignment, mobile navigation focus, and persistence correctness.
- **Remove:** overlapping dropzone text/CTA, off-center orbit styling, stale preview state, duplicate-name file ambiguity, stale shell cache behavior, and silent loss of timeline/director edits.

## Protected contracts and highest-risk change

No route, existing form input name, project table, or export-engine contract is intentionally replaced. Existing project data remains readable; new media identity and timeline references are additive. The highest-risk areas are asynchronous media/project restoration and cloud/local identity. They are guarded by operation generations, stable local media IDs, and regression tests.

## Verification

Use the existing unit/contract suite, production build, and Chromium acceptance at desktop and mobile widths. Exercise portrait and landscape reference previews, dropzone geometry, timeline trim and caption timing, local project restore, director edits, mobile navigation, and PWA cache behavior. Respect reduced-motion preferences.
