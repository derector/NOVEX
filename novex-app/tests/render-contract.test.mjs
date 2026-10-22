import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const motion3d = await readFile(new URL('../src/motion3d.js', import.meta.url), 'utf8');

test('FFmpeg ESM core is loaded through MIME-typed module URLs for WebView compatibility', async () => {
  assert.match(main, /import \{ fetchFile, toBlobURL \} from '@ffmpeg\/util'/);
  assert.match(main, /toBlobURL\(URL\.createObjectURL\(coreBlob\), 'text\/javascript'\)/);
  assert.match(main, /toBlobURL\(URL\.createObjectURL\(wasmBlob\), 'application\/wasm'\)/);
  assert.match(main, /ff\.load\(\{coreURL:coreModuleUrl,wasmURL:wasmModuleUrl\}\)/);
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts['copy-core'], /dist\/esm\/ffmpeg-core\.js/);
  assert.match(pkg.scripts['copy-core'], /dist\/esm\/ffmpeg-core\.wasm/);
});

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


test('startup does not iterate a single querySelector result', () => {
  assert.doesNotMatch(main, /(?<!\$)\$\('\[data-command\]'\)\.forEach/);
  assert.match(main, /\$\$\('\[data-command\]'\)\.forEach/);
  assert.match(main, /\$\('#cloudAccountBtn'\)\.onclick=openCloudDialog/);
});

test('profile menu and email registration are reachable from the top-right app header', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="cloudAccountBtn"[^>]*profile-button/);
  assert.match(html, /id="cloudTitle">Профиль NOVEX/);
  assert.match(html, /id="cloudEmail" type="email"/);
  assert.match(html, /id="cloudSignup"/);
  assert.match(html, /id="cloudEmailLink"/);
  assert.match(html, /id="cloudResetPassword"/);
  const cloudSource = await readFile(new URL('../src/cloud.js', import.meta.url), 'utf8');
  assert.match(cloudSource, /resetPasswordForEmail/);
  assert.match(cloudSource, /updateUser\(\{ password \}\)/);
  assert.match(html, /id="cloudRecoverySave"/);
});

test('render progress reports completed and remaining percentages with red-to-green gradient', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(html, /id="renderPercent">0% готово/);
  assert.match(html, /id="renderRemaining">100% осталось/);
  assert.match(css, /linear-gradient\(90deg,#ff435c 0%,#ff8b55 28%,#f4d45d 58%,#8fe77c 82%,#2be0a2 100%\)/);
  assert.match(main, /renderRemaining/);
});


test('preview hides placeholder when media is active and mobile keeps profile accessible', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(html, /id="previewStage"[\s\S]*id="previewVideo"/);
  assert.match(css, /\.preview-stage\.has-preview \.preview-placeholder\{display:none!important\}/);
  assert.match(css, /\.preview-stage video\[hidden\],\.preview-placeholder\[hidden\]\{display:none!important\}/);
  assert.match(css, /\.topbar-right \.btn-secondary\{display:inline-flex\}/);
});


test('startup and navigation use querySelectorAll for collection loops', () => {
  assert.doesNotMatch(main, /(?<!\$)\$\('\.view'\)\.forEach/);
  assert.doesNotMatch(main, /(?<!\$)\$\('\.nav-item'\)\.forEach/);
  assert.match(main, /\$\$\('\.view'\)\.forEach/);
  assert.match(main, /\$\$\('\.nav-item'\)\.forEach/);
  assert.match(main, /\$\('#cloudAccountBtn'\)\.onclick=openCloudDialog/);
});

test('reference montage samples varied portions of full source clips instead of repeating the first 35 percent', () => {
  assert.match(main, /sourceStart/);
  assert.match(main, /sourceDuration:clipDuration/);
  assert.match(main, /const start=Math\.max\(0,Number\(s\.sourceStart\)\|\|0\)/);
  assert.doesNotMatch(main, /s\.start%Math\.max\(1,s\.ref\.duration\*\.35\)/);
  assert.match(main, /tpad=stop_mode=clone:stop_duration=\$\{dur\}/);
  assert.match(main, /mode==='original'\).*refOrder\.sort/s);
});

test('reference scene analysis feeds detected cut points into segment selection', () => {
  assert.match(main, /const scenePoints=\[\]/);
  assert.match(main, /scenePoints\.push\(/);
  assert.match(main, /scenePoints:\[\.\.\.new Set\(scenePoints\)\]/);
  assert.match(main, /const sceneTime=scenePoints\.length\?scenePoints\[occurrence%scenePoints\.length\]:null/);
  assert.match(main, /sceneTime-clipDuration\*\.15/);
});

test('reference shots receive subtle per-shot cinematic camera movement instead of static crops', () => {
  assert.match(main, /zoompan=z='min\(1\.025\+on\*0\.0003,1\.06\)'/);
  assert.match(main, /sin\(on\/18\+\$\{i\}\)\*iw\*0\.005/);
  assert.match(main, /cos\(on\/24\+\$\{i\}\)\*ih\*0\.005/);
});
