/**
 * Lightweight, deterministic beat-grid analysis for NOVEX.
 * Input is a short-time RMS envelope (default hop: 50 ms), not raw PCM.
 */
export function analyzeBeatGrid(envelope, hopSeconds = 0.05, bpm = null) {
  const values = Array.from(envelope || [], v => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
  if (values.length < 8 || !(hopSeconds > 0)) return { beats: [], peaks: [], confidence: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const deviation = Math.sqrt(variance);
  if (deviation < 1e-8) return { beats: [], peaks: [], confidence: 0 };
  const onset = values.map((v, i) => i ? Math.max(0, v - values[i - 1]) : 0);
  const sorted = [...onset].sort((a, b) => a - b);
  const threshold = Math.max(sorted[Math.floor(sorted.length * 0.72)] || 0, deviation * 0.08);
  const minGap = bpm && bpm >= 50 && bpm <= 220 ? Math.max(3, Math.round(30 / bpm / hopSeconds)) : Math.max(4, Math.round(0.18 / hopSeconds));
  const peaks = [];
  for (let i = 1; i < onset.length - 1; i++) {
    if (onset[i] < threshold || onset[i] < onset[i - 1] || onset[i] < onset[i + 1]) continue;
    const last = peaks[peaks.length - 1];
    if (last && i - last.index < minGap) {
      if (onset[i] > last.strength) peaks[peaks.length - 1] = { index: i, time: i * hopSeconds, strength: onset[i] };
    } else peaks.push({ index: i, time: i * hopSeconds, strength: onset[i] });
  }
  const beats = [];
  if (bpm && bpm >= 50 && bpm <= 220) {
    const period = 60 / bpm;
    // Anchor the grid to strong detected attacks, then fill a stable beat grid.
    const anchor = peaks[0]?.time ?? 0;
    const end = values.length * hopSeconds;
    for (let t = anchor; t < end; t += period) beats.push(Number(t.toFixed(3)));
  } else {
    beats.push(...peaks.map(p => Number(p.time.toFixed(3))));
  }
  const peakStrength = peaks.reduce((sum, p) => sum + p.strength, 0);
  const confidence = Math.max(0, Math.min(1, peakStrength / Math.max(1e-8, deviation * peaks.length * 2)));
  return { beats, peaks: peaks.map(p => Number(p.time.toFixed(3))), confidence: Number(confidence.toFixed(3)) };
}

/** Snap a desired cut to a nearby detected beat without creating tiny clips. */
export function snapCutToBeat(target, beats, minTime, maxTime, tolerance = 0.18) {
  if (!Array.isArray(beats) || !beats.length) return target;
  let best = target, distance = Infinity;
  for (const beat of beats) {
    if (beat < minTime || beat > maxTime) continue;
    const d = Math.abs(beat - target);
    if (d <= tolerance && d < distance) { best = beat; distance = d; }
  }
  return best;
}
