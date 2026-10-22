# NOVEX build status

Updated: 2026-10-23

## Verified by GitHub Actions

- Workflow run #74 completed successfully: [run details](https://github.com/derector/NOVEX/actions/runs/39859249808).
- Vite web build completed, including checks that the FFmpeg JavaScript and WASM files are present.
- GitHub Pages deployment job completed successfully.
- Android Gradle debug APK build completed successfully and the workflow uploaded the `NOVEX-Android-APK` artifact (about 15.2 MB).
- Web build artifact `NOVEX-Web-Build` and Pages artifact were also uploaded.

## Latest rendering changes awaiting CI verification

- Uploaded source video can now be used as the base footage instead of always assembling a montage from reference clips.
- Added transparent Canvas-generated kinetic-title frames that are composited into the exported MP4.
- Added a color/brightness adjustment to the export path for the corresponding director command.
- Improved title command parsing so a generic kinetic-title request defaults to the visible word `NOVEX`, while quoted or explicitly named text is used as the title.

The latest rendering commits trigger a new Actions run. Do not treat these changes as verified until that run completes successfully.

## Still not verified end-to-end

- Installing and launching the APK on a physical Android device.
- Uploading sample media and completing a real MP4 export in desktop and mobile browsers.
- Confirming the source-video, title-overlay, 3D-overlay, subtitles, and color-grade paths against representative files.
- Exact reference-video matching, automatic lyric transcription/timing, and all planned motion/transition effects are not complete or guaranteed.

## Build and architecture notes

- The canonical application source is under `novex-app/`; the repository root also contains project documentation and legacy files.
- The app currently uses FFmpeg WebAssembly for MP4 export. Large/long renders can be limited by browser or WebView memory.
- The Android artifact is a debug APK for testing, not a signed production release.
- Do not claim device-level QA or pixel-perfect reference matching based on a successful compilation alone.
