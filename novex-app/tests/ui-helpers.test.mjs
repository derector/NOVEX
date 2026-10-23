import test from 'node:test';
import assert from 'node:assert/strict';
import { splitLyricsIntoLines } from '../src/ui-helpers.js';

test('lyrics splitter returns no lines for blank input', () => {
  assert.deepEqual(splitLyricsIntoLines('  \n  '), []);
});

test('lyrics splitter preserves every word, punctuation and explicit paragraph break', () => {
  const input = 'Мы слышим этот город.\nОн просыпается сейчас';
  const lines = splitLyricsIntoLines(input);
  assert.deepEqual(lines, ['Мы слышим этот город.', 'Он просыпается сейчас']);
  const normalized = (value) => value.replace(/[.!?…]/gu, '').replace(/\s+/gu, ' ').trim();
  assert.equal(normalized(lines.join(' ')), normalized(input));
});

test('long lines are split into short readable groups and a tiny tail is merged when safe', () => {
  const lines = splitLyricsIntoLines('Раз два три четыре пять шесть семь восемь девять десять');
  assert.deepEqual(lines, ['Раз два три четыре пять шесть', 'семь восемь девять десять']);
});

test('sentence punctuation can end a line before the word limit', () => {
  assert.deepEqual(splitLyricsIntoLines('Тихий свет пришёл. Мы идём дальше вместе'), [
    'Тихий свет пришёл.',
    'Мы идём дальше вместе',
  ]);
});
