---
name: novex-3d-animation
description: Creates real 3D motion graphics for NOVEX: volumetric typography, camera moves, lighting, materials, particles, product scenes, and 3D compositing. Use whenever the user asks for 3D, depth, camera orbit, extruded text, cinematic materials, or 3D effects.
---

# NOVEX 3D Animation

This skill is part of NOVEX's motion-director system. It specifies how 3D scenes should be authored and rendered; it does not claim a runtime exists until the renderer is integrated and tested.

## Select the right tool
- Three.js: default for real-time 3D scenes, cameras, geometry, materials, lights, particles, environment maps, post-processing, and browser/WebGL previews.
- GSAP: orchestration and easing for authored timelines. For frame-accurate export, seek a paused timeline to explicit composition time or implement pure functions of time. Never let wall-clock playback determine exported frames.
- React Three Fiber: optional if the host app is React-based; NOVEX is currently Vite/vanilla JS, so prefer Three.js directly unless architecture changes.
- Blender: complex simulations, character animation, rigs, and offline rendering beyond browser constraints.
- Remotion: optional composition/rendering framework for deterministic React-based video output; evaluate as a separate architecture, not a drop-in package in the existing vanilla app.
- FFmpeg: final mux/encode, audio mix, resize/format conversion. FFmpeg alone does not create interactive Three.js geometry.

## Scene contract
Every 3D scene declares canvas width, height, frame rate, duration, color space, camera type/FOV/transforms/focus target, geometry/materials/lights/shadows, animation timeline/easing, background/alpha/compositing rules, asset dependencies, and a fallback when WebGL is unavailable.

All animated values derive from deterministic timestamp t or frame index. The same scene and timestamp must produce the same frame. Seed randomness; never use unseeded random values in frame rendering.

## Recommended workflow
1. Translate the request into concise art direction and a scene graph.
2. Create a shot list/storyboard with timestamps and camera intent.
3. Build a minimal 3D blockout first; confirm composition and readable silhouette.
4. Add materials, lighting, particles, typography, and secondary motion.
5. Preview keyframes and transitions at start, midpoint, end, and scene boundaries.
6. Test 16:9, 9:16, and 1:1 without stretching. Adapt camera/composition per ratio.
7. Check mobile GPU/memory budget and provide a static fallback if WebGL fails.
8. Export a draft of the affected section, inspect frames, then produce the final output.

## Motion and visual standards
- Prefer coherent camera movement, restrained acceleration, and clear focal hierarchy.
- Use real geometry/extrusion for genuinely volumetric typography when supported; bevel, material, shadows, and reflections must support legibility.
- Use particles and glow with a performance budget; avoid expensive bloom/reflections/shadows without need.
- Avoid unbounded render loops during export. Render only requested frames.
- Never use CSS transitions, requestAnimationFrame, wall-clock time, or live video playback as the source of exported animation timing.
- Use plausible light/material relationships when realism is requested and stylized materials when the art direction calls for it.
- Include fallback and error reporting for WebGL context loss, missing fonts, and missing textures.

## Export integration requirements
A browser WebGL preview is not by itself a finished video export. Before advertising 3D export as supported, implement a deterministic frame-capture path at exact frame times and composite it with source footage and 2D layers. Preserve source audio and encode a valid MP4. Test desktop browser and Android WebView/device conditions. Do not capture a continuously playing canvas with arbitrary delays; set exact time, render the frame, wait for GPU completion where possible, then capture.
