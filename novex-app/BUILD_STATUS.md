# NOVEX build status

Updated: 2026-10-23

## Verified by GitHub Actions

- Latest successful run #39900578837: [run details](https://github.com/derector/NOVEX/actions/runs/39900578837).
- Vite web build and FFmpeg WASM asset checks passed.
- Real Chromium render smoke passed for sequential multi-reference preview, mobile viewport, source-only editing, AAC source-audio mixing, transcript subtitle export, MP4 metadata validation, and download.
- GitHub Pages deployment completed successfully.
- Android Gradle debug APK built and was uploaded as `NOVEX-Android-APK` (about 15.2 MB).
- Android emulator installed and launched `studio.novex.motion`; the app remained in the foreground and the runtime check found no fatal exception.
- `Motion Engine Self-Test` passed.

## Changes awaiting verification in the next run

- Deterministic Three.js frame capture: pause the live preview during frame capture, render explicit timestamps, and composite the transparent frames into the final MP4.
- The Chromium smoke now requests a real 3D logo export as part of the source-video/audio/subtitle scenario. Do not mark the 3D path verified until that run passes.

## Remaining limits

- Physical Android device QA has not been performed.
- Android emulator smoke verifies installation and launch, not a complete MP4 export inside Android WebView.
- Exact reference-video matching, automatic lyric transcription/timing, and all planned motion/transition effects are not complete or guaranteed.

## Build and architecture notes

- The canonical application source is under `novex-app/`; the repository root also contains project documentation and legacy files.
- The app uses FFmpeg WebAssembly for MP4 export. Large/long renders can be limited by browser or WebView memory.
- The Android artifact is a debug APK for testing, not a signed production release.
- Do not claim device-level QA or pixel-perfect reference matching based on a successful compilation alone.
