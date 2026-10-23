import test from 'node:test';
import assert from 'node:assert/strict';
import {
  duplicateTimelineClip,
  moveTimelineClip,
  moveTimelineClipTo,
  removeTimelineClip,
  reflowTimeline,
  timelineDuration,
  trimTimelineClip,
} from '../src/timeline.js';

const makeTimeline = () => [
  { id: 'a', start: 0, end: 2, sourceStart: 1, ref: { id: 'ref-a' } },
  { id: 'b', start: 2, end: 5, sourceStart: 4, ref: { id: 'ref-b' } },
  { id: 'c', start: 5, end: 6.5, sourceStart: 0, ref: { id: 'ref-c' } },
];

test('reflow creates a gap-free timeline and retains each clip duration', () => {
  const timeline = reflowTimeline(makeTimeline());
  assert.deepEqual(timeline.map(({ start, end }) => [start, end]), [
    [0, 2],
    [2, 5],
    [5, 6.5],
  ]);
  assert.equal(timelineDuration(timeline), 6.5);
});

test('clips can move left, right, or to a dragged target and preserve their source in-points', () => {
  const movedLeft = moveTimelineClip(makeTimeline(), 1, -1);
  assert.deepEqual(movedLeft.map((clip) => clip.id), ['b', 'a', 'c']);
  assert.deepEqual(movedLeft.map(({ start, end }) => [start, end]), [
    [0, 3],
    [3, 5],
    [5, 6.5],
  ]);
  assert.equal(movedLeft[0].sourceStart, 4);

  const movedRight = moveTimelineClip(makeTimeline(), 0, 1);
  assert.deepEqual(movedRight.map((clip) => clip.id), ['b', 'a', 'c']);
  const dragged = moveTimelineClipTo(makeTimeline(), 2, 0);
  assert.deepEqual(dragged.map((clip) => clip.id), ['c', 'a', 'b']);
});

test('trim changes the source window, minimum duration is enforced, and later clips close the gap', () => {
  const trimmed = trimTimelineClip(makeTimeline(), 0, {
    sourceStart: 2.5,
    duration: 1.25,
    maxSourceDuration: 10,
  });
  assert.equal(trimmed[0].sourceStart, 2.5);
  assert.deepEqual(trimmed.map(({ start, end }) => [start, end]), [
    [0, 1.25],
    [1.25, 4.25],
    [4.25, 5.75],
  ]);
  assert.equal(timelineDuration(trimmed), 5.75);
  assert.throws(
    () => trimTimelineClip(makeTimeline(), 0, { sourceStart: 0, duration: 0.05 }),
    /0,1 секунды/,
  );
  assert.throws(
    () => trimTimelineClip(makeTimeline(), 0, {
      sourceStart: 10.1,
      duration: 2,
      maxSourceDuration: 10,
    }),
    /исходного видео/,
  );
});

test('duplicate inserts a separate repeated segment and remove prevents an empty video track', () => {
  const duplicated = duplicateTimelineClip(makeTimeline(), 1);
  assert.deepEqual(duplicated.map((clip) => clip.id), ['a', 'b', 'b', 'c']);
  assert.deepEqual(duplicated.map(({ start, end }) => end - start), [2, 3, 3, 1.5]);
  assert.equal(timelineDuration(duplicated), 9.5);

  const removed = removeTimelineClip(duplicated, 2);
  assert.deepEqual(removed.map((clip) => clip.id), ['a', 'b', 'c']);
  assert.throws(() => removeTimelineClip([makeTimeline()[0]], 0), /хотя бы один/);
});

test('invalid clip indexes and timeline directions fail with readable errors', () => {
  assert.throws(() => moveTimelineClip(makeTimeline(), 0, -2), /Направление/);
  assert.throws(() => duplicateTimelineClip(makeTimeline(), 8), /не существует/);
  assert.throws(
    () => reflowTimeline([{ start: 0, end: 0.01 }]),
    /не меньше 0,1 секунды/,
  );
});
