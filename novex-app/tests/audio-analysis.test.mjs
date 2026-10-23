import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBeatGrid, snapCutToBeat } from '../src/audio-analysis.js';

test('beat grid returns stable positions from a pulsed RMS envelope', () => {
  const hop = 0.05;
  const env = Array.from({ length: 240 }, (_, i) => 0.1 + (i % 10 === 0 ? 1 : 0));
  const result = analyzeBeatGrid(env, hop, 120);
  assert.ok(result.beats.length >= 10);
  assert.ok(result.beats.every((t, i, arr) => Number.isFinite(t) && (!i || t > arr[i - 1])));
  assert.ok(result.peaks.length > 0);
});

test('flat or insufficient audio envelope does not invent beats', () => {
  assert.deepEqual(analyzeBeatGrid(Array(40).fill(0.2)).beats, []);
  assert.deepEqual(analyzeBeatGrid([0, 1, 0]).beats, []);
});

test('cut snapping respects bounds and tolerance', () => {
  assert.equal(snapCutToBeat(1.04, [0.5, 1, 1.5], 0.8, 1.2, 0.1), 1);
  assert.equal(snapCutToBeat(1.3, [0.5, 1, 1.5], 0.8, 1.2, 0.1), 1.3);
});
