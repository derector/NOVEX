import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

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

test('director commands have real render-path effects instead of silent no-op patches', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /paceBoost=.*motion_timing/);
  assert.match(main, /cameraEdit=.*camera_motion/);
  assert.match(main, /subtitlesEdit=.*add_subtitles/);
  assert.match(main, /subtitlesEdit&&!p\.lines\.length/);
  assert.match(main, /if\(patch\.type==='add_subtitles'\)\$\('#burnLyrics'\)\.checked=true/);
});
test('NOVEX rebrand assets use the current theme across PWA metadata and icon', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  const icon = await readFile(new URL('../public/novex.svg', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.equal(manifest.theme_color, '#05070d');
  assert.equal(manifest.background_color, '#05070d');
  assert.match(icon, /linearGradient id="mark"/);
  assert.match(css, /NOVEX identity system v2/);
  assert.match(css, /\.profile-avatar/);
});

test('director rejects unsupported camera commands instead of silently recording a no-op', () => {
  assert.match(main, /patch\.type==='camera_motion'&&!S\.source/);
  assert.match(main, /Движение камеры сейчас доступно только для загруженного исходного видео/);
  assert.match(main, /if\(S\.plan\)\{S\.plan=makePlan\(\);S\.plan\.edits=S\.edits\.map/);
});

test('source-video editing mode can build a plan without reference clips', () => {
  assert.match(main, /if\(!S\.track\)throw Error\('Сначала добавь музыкальный трек\.'\)/);
  assert.match(main, /if\(!S\.refs\.length&&!S\.source\)throw Error\('Добавь исходное видео для режима A/);
  assert.match(main, /let refOrder=S\.source\?\[\]:\[\.\.\.S\.refs\]/);
  assert.match(main, /if\(!refOrder\.length&&S\.source\)timeline\.push\(\{start:0,end:range\.duration,ref:null/);
  assert.match(main, /s\.ref\?\.file\?\.name\|\|s\.sourceLabel/);
  assert.match(main, /referenceName:x\.ref\?\.file\?\.name\|\|x\.sourceLabel/);
});


test('source video rendering seeks to the selected source offset', () => {
  assert.match(main, /const sourceSeek=Math\.max\(0,Math\.min\(r\.start/);
  assert.match(main, /const sourceArgs=\['-ss',String\(sourceSeek\),'-i',sourceInput/);
});

test('saved source-only plans can be reopened when the source and music are reselected', () => {
  assert.match(main, /const sourceOk=!!d\.sourceName&&!!S\.source&&S\.source\.name===d\.sourceName/);
  assert.match(main, /\(!matched\.length&&!sourceOk\)/);
  assert.match(main, /sourceStart:x\.sourceStart\|\|0,referenceName:x\.ref\?\.file\?\.name\|\|x\.sourceLabel\|\|S\.source\?\.name/);
});

test('preview and app shell are constrained to the viewport on mobile', async () => {
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /html,body,#app\{width:100%;max-width:100%;min-width:0;min-height:100%;overflow-x:clip\}/);
  assert.match(css, /\.preview-stage video\{max-width:100%;max-height:100%;object-fit:contain\}/);
  assert.match(css, /backdrop-filter:blur\(24px\) saturate\(150%\)/);
});


test('the supplied motion director source files are present and cross-linked', async () => {
  const root = new URL('../../', import.meta.url);
  const overview = await readFile(new URL('README_OVERVIEW.md', root), 'utf8');
  const rules = await readFile(new URL('DIRECTOR_RULES.md', root), 'utf8');
  const rulesAlias = await readFile(new URL('DIRECTOR_RUILES.md', root), 'utf8');
  const api = await readFile(new URL('REFERENCE_M_API.md', root), 'utf8');
  const engine = await readFile(new URL('motion_pack/engine/motion.js', root), 'utf8');
  assert.match(overview, /Motion Director/);
  assert.match(rules, /Режим B|режим B/i);
  assert.equal(rulesAlias, rules);
  assert.match(api, /M\.win/);
  assert.match(api, /M\.draw/);
  assert.match(engine, /^\/\* motion\.js v3/);
  assert.doesNotThrow(() => new Script(engine, { filename: 'motion.js' }));
});


test('source video duration metadata is retained for safe source seeking', () => {
  assert.match(main, /S\.sourceMeta=\{duration:p\.duration,w:p\.w,h:p\.h\}/);
  assert.match(main, /const sourceDuration=Number\(S\.sourceMeta\?\.duration\)\|\|r\.duration/);
  assert.match(main, /source:null,sourceUrl:null,sourceMeta:null,duration:0/);
});

test('account errors explain the actionable Supabase configuration cause', () => {
  assert.match(main, /Регистрация по электронной почте отключена в настройках Supabase Auth/);
  assert.match(main, /Проверь SMTP и подтверждённый адрес отправителя/);
  assert.match(main, /Добавь URL сайта NOVEX и адрес приложения в Auth/);
  assert.match(main, /cloudStatus\(cloudErrorMessage\(err,'signup'\),'error'\)/);
});


test('signup distinguishes Supabase obfuscated existing users from newly created accounts', async () => {
  const cloud = await readFile(new URL('../src/cloud.js', import.meta.url), 'utf8');
  assert.match(cloud, /data\.user\?\.identities\) && data\.user\.identities\.length === 0/);
  assert.match(cloud, /alreadyRegistered/);
  assert.match(main, /if\(result\.alreadyRegistered\)/);
  assert.match(main, /Аккаунт с этой почтой уже существует/);
});

test('default Supabase SMTP restriction gives a setup-specific message', () => {
  assert.match(main, /email address not authorized/);
  assert.match(main, /пользовательский SMTP в Supabase по backend\/BREVO-SETUP\.md/);
});
