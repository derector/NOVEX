# NOVEX Motion Studio

NOVEX is a mobile-first editor for composing short music videos from supplied references. It uses Vite, Capacitor, browser media APIs and FFmpeg WebAssembly for local MP4 output.

## Current implementation
- Multi-reference and extra source-video import; metadata + sampled-frame heuristic analysis.
- Music import; Web Audio duration/energy/approximate BPM estimate.
- Editable lyrics/transcript text and estimated caption timecodes.
- The lyrics action splits supplied text into editable short lines; it does not generate lyrics or perform speech recognition/alignment.
- Full track or excerpt, aspect ratio, export resolution, faithful/inspired/original cut sequencing.
- Interactive montage timeline: select a segment, adjust its source in-point and duration, drag or move clips, duplicate/delete reference clips; source-only projects can trim the source window. Changes feed the FFmpeg export plan.
- Editorial motion interface: warm paper surfaces, ink-dark panels, lime/orange accents, animated section and headline entrances, responsive mobile navigation, keyboard-operable seeking, and reduced-motion support.
- Reference/source preview, local FFmpeg H.264/AAC MP4 export and download/share button.
- Local project metadata and media are restored from IndexedDB when the browser permits it; projects remain usable if the media is still available or reselected. Cloud and local-only project lists coexist.
- PWA shell and Capacitor Android integration.

## Build
Requires Node 22, Android SDK for APK, and network access to npm:
```sh
npm ci --no-audit --no-fund
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
- Only one base audio source is selected (music or source-video sound); procedural motion SFX can be mixed over it. Caption timing remains approximate and editable. Browser WASM rendering may need lower resolution/shorter excerpts on memory-limited devices.
- Media restoration depends on browser IndexedDB storage and quota; if a saved asset is unavailable, the user must select it again. Project settings persist locally.
- Live web app: https://derector.github.io/NOVEX/ (GitHub Pages publishes successful updates from `main`).
