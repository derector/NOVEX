import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fileMatchesIdentity,
  localMediaProjectId,
  matchProjectReferences,
  retimeCaptionLines,
} from '../src/project-utils.js';

test('cloud records retain the originating local media id', () => {
  assert.equal(localMediaProjectId({ id: 'cloud-uuid', project_data: { localProjectId: 'local-42' } }), 'local-42');
  assert.equal(localMediaProjectId({ localProjectId: 42, id: 'cloud-uuid' }), '42');
  assert.equal(localMediaProjectId({ id: 7 }), '7');
});

test('reference matching uses file identity and consumes duplicate names in upload order', () => {
  const first = { file: { name: 'same.mp4', size: 10, lastModified: 1 }, id: 'a' };
  const second = { file: { name: 'same.mp4', size: 20, lastModified: 2 }, id: 'b' };
  const third = { file: { name: 'other.mp4', size: 30, lastModified: 3 }, id: 'c' };
  const identities = [
    { name: 'same.mp4', size: 20, lastModified: 2 },
    { name: 'same.mp4', size: 10, lastModified: 1 },
    { name: 'missing.mp4', size: 4, lastModified: 4 },
  ];
  assert.deepEqual(matchProjectReferences(['same.mp4', 'same.mp4', 'missing.mp4'], [first, second, third], identities), [second, first, null]);
  assert.deepEqual(matchProjectReferences(['same.mp4', 'same.mp4'], [first, second]), [first, second]);
  assert.equal(fileMatchesIdentity(first.file, identities[0], 'same.mp4'), false);
});

test('caption cue times scale into the edited timeline without escaping its range', () => {
  const lines = [
    { text: 'one', start: 10, end: 12 },
    { text: 'two', start: 12, end: 14 },
    { text: 'three', start: 14, end: 16 },
  ];
  const result = retimeCaptionLines(lines, { start: 10, duration: 6 }, 3);
  assert.deepEqual(result.map(({ start, end }) => [start, end]), [
    [10, 11],
    [11, 12],
    [12, 13],
  ]);
  assert.ok(result.every((line) => line.start >= 10 && line.end <= 13));
  assert.deepEqual(retimeCaptionLines(lines, { start: 10, duration: 6 }, 0), []);
});
