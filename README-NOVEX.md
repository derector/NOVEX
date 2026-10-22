# NOVEX Motion Studio

A local-first web app and Android wrapper for building music videos from user-provided motion references.

## What works in the app

- Multiple animation references, sampled-frame/palette/cut-rate analysis, and FFmpeg fallback for HEVC clips that the browser cannot decode.
- Audio import, duration/channel analysis, approximate tempo and energy-peak detection.
- Full-track or custom excerpt selection, reference sequencing modes, aspect ratio and 720p/1080p output settings.
- Three procedural motion directions (kinetic neon, editorial grid, liquid forms), a source-video overlay mode, and a reference-footage montage mode.
- Editable text overlays and approximate lyric timing, with optional transcript text and an explicit optional outro field.
- Browser preview, montage timeline, FFmpeg WebAssembly rendering to H.264/AAC MP4, and file download.
- PWA manifest and service-worker shell caching; Capacitor Android build with native save/share fallback.

## Build

Node.js 22 and Java 17 are recommended.

    npm install
    npm run build
    npx cap add android
    npx cap sync android
    cd android && ./gradlew assembleDebug

The build downloads the pinned FFmpeg WebAssembly runtime into the generated www/ffmpeg folder. The first render is CPU- and memory-intensive. Rendering happens on the user's device; video files are not uploaded to an application server.

## Honest limitations

- Lyric timecodes are estimated from text length and duration, not ASR word alignment. They can be edited before export.
- The default mode creates new procedural motion graphics from lyrics, timing and reference palettes. It does not generate photorealistic AI footage or reproduce an After Effects project pixel-for-pixel. The “1:1” option prioritizes reference cadence and visual language, not a guaranteed exact copy.
- Motion recording uses the browser's MP4 MediaRecorder when available; otherwise WebM is transcoded to MP4 with FFmpeg WebAssembly and can take significantly longer on phones.
- HEVC decoding, long-form renders and 1080p output depend on the browser/device's FFmpeg build and available memory.