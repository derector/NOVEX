import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const motion3d = await readFile(new URL('../src/motion3d.js', import.meta.url), 'utf8');

test('uploaded source footage enters the MP4 render path', () => {
  assert.match(main, /if\(S\.source\)\s*\{/);
  assert.match(main, /await ff\.writeFile\(sourceInput,await fetchFile\(S\.source\)\)/);
  assert.match(main, /tpad=stop_mode=clone/);
  assert.match(main, /'silent\.mp4'/);
});

test('3D logo frames are composited before final MP4 encoding', () => {
  assert.match(main, /motion3d\.exportFrames\(/);
  assert.match(main, /3d_%04d\.png/);
  assert.match(main, /overlay=0:0:enable=/);
  assert.match(main, /'composite\.mp4'/);
});

test('kinetic titles are rasterized with alpha and composited into video', () => {
  assert.match(main, /async function exportKineticTitle\(/);
  assert.match(main, /canvas\.toBlob\(b=>b\?resolve\(b\):reject/);
  assert.match(main, /type==='add_kinetic_title'/);
  assert.match(main, /title_%04d\.png/);
  assert.match(main, /'title-composite\.mp4'/);
});

test('color grade and optional subtitle filters reach final FFmpeg command', () => {
  assert.match(main, /subtitles=lyrics\.srt:force_style=/);
  assert.match(main, /eq=brightness=0\.035:saturation=1\.22/);
  assert.match(main, /'-c:a','aac'/);
  assert.match(main, /'-movflags','\+faststart'/);
});

test('3D scene supports transparent frame export', () => {
  assert.match(motion3d, /exportFrames/);
  assert.match(motion3d, /preserveDrawingBuffer|toBlob|toDataURL/);
});

test('bundled motion-engine v3 contains seven intact files', async () => {
  const skill = await readFile(new URL('../../.claude/skills/motion-engine/SKILL.md', import.meta.url), 'utf8');
  const manifestMatch = skill.match(/<!-- manifest: (\{.*?\}) -->/);
  assert.ok(manifestMatch, 'motion-engine manifest exists');
  const manifest = JSON.parse(manifestMatch[1]);
  const agentsCopy = await readFile(new URL('../../.agents/skills/motion-engine/SKILL.md', import.meta.url), 'utf8');
  assert.equal(agentsCopy, skill, 'Claude and agent motion-engine copies must stay in sync');
  const blockPattern = /<!-- file: (\S+) -->\n````\w*\n([\s\S]*?)\n````/g;
  const blocks = [...skill.matchAll(blockPattern)];
  assert.equal(manifest.v, 3);
  assert.equal(blocks.length, 7);
  for (const [, name, body] of blocks) {
    const digest = createHash('sha1').update(body.replace(/\s+/g, '')).digest('hex').slice(0, 12);
    assert.equal(digest, manifest[name], name + ' checksum must match');
  }
});


test('profile menu and email registration are reachable from the top-right app header', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="cloudAccountBtn"[^>]*profile-button/);
  assert.match(html, /id="cloudTitle">Профиль NOVEX/);
  assert.match(html, /id="cloudEmail" type="email"/);
  assert.match(html, /id="cloudSignup"/);
  assert.match(html, /id="cloudEmailLink"/);
});

test('render progress reports completed and remaining percentages with red-to-green gradient', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(html, /id="renderPercent">0% готово/);
  assert.match(html, /id="renderRemaining">100% осталось/);
  assert.match(css, /linear-gradient\(90deg,#ff435c 0%,#ff8b55 28%,#f4d45d 58%,#8fe77c 82%,#2be0a2 100%\)/);
  assert.match(main, /renderRemaining/);
});
