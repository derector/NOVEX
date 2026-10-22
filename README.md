# NOVEX Motion Studio

Reference-driven music-video creation studio. The project contains a Vite web app, a Capacitor Android app configuration, CI builds, and the motion-design skills used to guide reference analysis and rendering.

## Project map

- `novex-app/` — main Vite + Capacitor app.
- `.github/workflows/novex-build.yml` — GitHub Actions web build and Android APK build.
- `MASTERSKILL.md` — master specification for reference-driven motion work.
- `ANGSKILL.md` — motion-engine skill and bundled rendering guidance.
- `docs/NOVEX-ROADMAP.md` — product direction, reference/search workflow, implementation priorities, and definition of done.
- `README-NOVEX.md` — NOVEX project overview.
- `THIRD-PARTY-NOTICES.md` — third-party notices.

## Build locally

```bash
cd novex-app
npm install
npm run build
```

The web output is generated in `novex-app/dist/`.

For Android, run the web build first, then generate/sync the Capacitor Android project and build a debug APK:

```bash
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug --no-daemon
```

## CI artifacts

Open [GitHub Actions](https://github.com/derector/NOVEX/actions). A successful run publishes:
- `NOVEX-Web-Build` — built web app files.
- `NOVEX-Android-APK` — installable debug APK.

Do not treat a queued or failed workflow as a completed build; check the run and confirm artifacts are present.

## Reference-driven workflow

The skills are part of the project and should be consulted before implementing reference-analysis or motion-rendering changes. Search previous project materials before asking for assets again; distinguish observed facts from interpretation; keep source links/provenance for assets found through search; and validate the result against the actual reference before claiming completion.

See [the roadmap](docs/NOVEX-ROADMAP.md) for the full plan and current caveats.
