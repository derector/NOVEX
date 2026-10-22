# NOVEX reference inventory

These items were found in the files shared in the ChatGPT project conversation on 2026-10-22. This inventory records their purpose so work can resume without asking the user to resend them.

## Product/design reference

- `NOVEX: Музыкальные видео будущего.png` — product mockup showing the dark navy/purple NOVEX visual identity, desktop editor, mobile player, reference upload, audio/text controls, director modes, timeline, preview, and MP4 export.
- `novex-motion-studio-source.zip` — source archive containing a fuller app snapshot than the first partial GitHub transfer. It includes `src/main.js`, `src/style.css`, `index.html`, Capacitor/Vite configs, public assets, build status, and two workflows nested under `novex-app/.github/workflows/`. Reconcile this archive against the GitHub source before declaring the transfer complete. GitHub Actions only discovers workflows in repository-root `.github/workflows/`.

## User-provided video references

The following files were present in the shared Library. Treat them as analysis/reference inputs, not production assets to ship to every app user. Do not silently rename or modify them; associate them with a project/reference record if the user wants them persisted in NOVEX.

- `tfxbedits_2026-10-22-16-31-03_1792675863239.mp4`
- `dlatgmietr0_2026-10-22-12-25-33_1792661133932.mp4`
- `s0unds_wave_2026-10-22-12-25-09_1792661109786.mp4`
- `teforax_2026-10-21-20-34-15_1792604055325.mp4`
- `gotcloser_2026-10-21-20-34-09_1792604049089.mp4`
- `novex.aep_2026-10-22-16-30-52_1792675852396.mp4`
- `demnsey_2026-10-22-12-24-22_1792661062285.mp4`

## Skills/specifications already in the repository

- `MASTERSKILL.md` — authoritative motion-director requirements and reference-analysis workflow.
- `ANGSKILL.md` — motion-engine skill and bundled source/technical procedures.

Keep both files alongside the application. Before making a reference-driven output, search previous project files/conversation materials, identify the applicable workflow mode, measure the reference, document asset provenance, and validate the rendered result against the reference.

## Handling policy

- Keep reference files out of `public/` unless a user explicitly chooses to ship an asset with the app.
- Prefer metadata, contact sheets, extracted timestamps, and per-project manifests over copying large video files into the app bundle.
- Record search source/license and retrieval date for externally found assets.
- The image is a design target, not proof that the current UI already matches it.
