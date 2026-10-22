---
name: novex-render-quality
description: Verifies NOVEX video edits and exports. Use after modifying a scene, timeline, aspect ratio, subtitles, audio, or rendering pipeline.
---

# NOVEX Render Quality Gate

1. Convert the request into a checklist; every item must have a test.
2. Verify source and output metadata with ffprobe or equivalent: duration, width, height, frame rate, audio/video streams, codecs.
3. Inspect a contact sheet covering start, middle, end, scene cuts, and every modified moment.
4. Detect blank/black frames, unexpected aspect-ratio changes, letterboxing, clipped captions, and incorrect crop.
5. Compare motion before and after at identical timestamps. For reference copying, inspect timing and screen-relative positions.
6. Check audio presence, sync, fades, and peaks; listen when audio review is available.
7. Test web preview and actual Android WebView separately. A successful APK build does not prove export works on device.
8. For failed exports, preserve error details and identify failing stage: fetch, core initialization, media decode, filter, mux, or memory.
9. Re-run relevant checks after changes. File existence alone does not prove a valid render.
10. Report tested facts separately from assumptions and untested behavior.
