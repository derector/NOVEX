# NOVEX Motion Studio

NOVEX is a mobile-first editor for composing short music videos from supplied references. It uses Vite, Capacitor, browser media APIs and FFmpeg WebAssembly for local MP4 output.

## Current implementation
- Multi-reference and extra source-video import; metadata + sampled-frame heuristic analysis.
- Music import; Web Audio duration/energy/approximate BPM estimate.
- Editable lyrics/transcript text and estimated caption timecodes.
- Full track or excerpt, aspect ratio, export resolution, faithful/inspired/original cut sequencing.
- Sequential montage preview, timeline, local FFmpeg H.264/AAC MP4 export and download/share button.
- Local project metadata persists across reloads; cloud and local-only project lists coexist. Media files remain in the browser session and must be reselected to reopen a plan after reload.
- PWA shell and Capacitor Android integration.

## Build
Requires Node 22, Android SDK for APK, and network access to npm:
```sh
npm install --no-audit --no-fund
npm run build
npm run dev
```
Build copies `@ffmpeg/core` into `public/ffmpeg`.

For Android:
```sh
npm run build
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```
GitHub Actions is configured to upload a debug APK when its workflow succeeds.

## Important limits
- Lyrics timings are approximate text-length allocations, **not automatic speech recognition or forced alignment**.
- Visual analysis samples frames to estimate color/brightness and changes; it is not a learned scene model or motion-curve extraction.
- Faithful mode is a sequencing approximation, not frame-accurate After Effects replication.
- Additional video audio can be mixed when selected and detected; captions remain editable. Browser WASM rendering may need lower resolution/shorter excerpts on memory-limited devices.
- Source files are held in the live session; project settings persist locally but media must be reselected after reload.
- A stable live URL and APK artifact require successful hosting/CI build; neither is claimed until verified.
