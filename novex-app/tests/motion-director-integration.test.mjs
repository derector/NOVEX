import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

test('Motion Director workflow is integrated without replacing the main editor', () => {
  assert.match(main, /async function runMotionDirector\(raw\)/);
  assert.match(main, /function motionDirectorMessage\(/);
  assert.match(main, /function chooseMotionStyle\(/);
  assert.match(main, /if\(\/\^\\\/motion-director\\b\/i\.test\(raw\)\)/);
  assert.match(main, /applyDirectorCommand\(raw\)/);
  assert.match(main, /function renderTimelineEditor\(/);
  assert.match(main, /function applyDirectorCommand\(/);
});

test('Motion Director progress and choice panel has accessible live announcements', () => {
  assert.match(html, /id="motionDirectorWorkflow"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="motionDirectorMessage"/);
  assert.match(html, /id="motionDirectorChoices"/);
  assert.match(css, /\.motion-director-workflow\{/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
