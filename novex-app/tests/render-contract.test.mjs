import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const motion3d = await readFile(new URL('../src/motion3d.js', import.meta.url), 'utf8');

test('FFmpeg ESM core is loaded through MIME-typed module URLs for WebView compatibility', async () => {
  assert.match(main, /import \{ fetchFile, toBlobURL \} from '@ffmpeg\/util'/);
  assert.match(main, /const coreSourceUrl=URL\.createObjectURL\(coreBlob\),wasmSourceUrl=URL\.createObjectURL\(wasmBlob\)/);
  assert.match(main, /toBlobURL\(coreSourceUrl,'text\/javascript'\)/);
  assert.match(main, /toBlobURL\(wasmSourceUrl,'application\/wasm'\)/);
  assert.match(main, /URL\.revokeObjectURL\(coreSourceUrl\)/);
  assert.match(main, /URL\.revokeObjectURL\(wasmSourceUrl\)/);
  assert.match(main, /URL\.revokeObjectURL\(coreModuleUrl\)/);
  assert.match(main, /URL\.revokeObjectURL\(wasmModuleUrl\)/);
  assert.match(main, /finally\{[\s\S]*URL\.revokeObjectURL\(coreModuleUrl\)/);
  assert.match(main, /Promise\.allSettled\(/);
  assert.match(main, /ff\.load\(\{coreURL:coreModuleUrl,wasmURL:wasmModuleUrl\}\)/);
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts['copy-core'], /dist\/esm\/ffmpeg-core\.js/);
  assert.match(pkg.scripts['copy-core'], /dist\/esm\/ffmpeg-core\.wasm/);
});

test('uploaded source footage enters the MP4 render path', () => {
  assert.match(main, /const sourceInput='source-video\.'\+sourceExt/);
  assert.match(main, /await ff\.writeFile\(sourceInput,await fetchFile\(S\.source\)\)/);
  assert.match(main, /const sourceArgs=\['-ss',String\(sourceSeek\),'-i',sourceInput/);
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
  assert.match(main, /Движение камеры сейчас доступно только для загруженного исходного видео/);
  assert.match(main, /if\(S\.plan\)\{S\.plan=makePlan\(\);S\.plan\.edits=S\.edits\.map/);
});

test('source-video editing mode can build a plan without reference clips', () => {
  assert.match(main, /if\(!S\.track\)throw Error\('Сначала добавь музыкальный трек\.'\)/);
  assert.match(main, /let refOrder=useSourceVideo\?\[\]:\[\.\.\.S\.refs\]/);
  assert.match(main, /if\(!refOrder\.length&&useSourceVideo\)timeline\.push\(\{start:0,end:range\.duration,ref:null/);
});


test('email OTP flow verifies codes and hidden form sections do not block submission', async () => { const cloud=await readFile(new URL('../src/cloud.js',import.meta.url),'utf8'); const html=await readFile(new URL('../index.html',import.meta.url),'utf8'); assert.match(cloud,/cloud\.auth\.verifyOtp\(\{ email, token, type: 'email' \}\)/); assert.match(main,/cloudVerifyEmailCode\(email,token\)/); assert.match(html,/id="cloudOtpWrap" class="cloud-support hidden"/); assert.doesNotMatch(html,/id="cloudRecoveryPassword"[^>]*required/); assert.doesNotMatch(html,/id="cloudSupportSubject"[^>]*required/); });

test('source video rendering seeks to the selected source offset', () => {
  assert.match(main, /const sourceSeek=Math\.max\(0,Math\.min\(r\.start,Math\.max\(0,sourceDuration-0\.1\)\)\)/);
  assert.match(main, /sourceAudioSeek=sourceSeek/);
  assert.match(main, /const sourceArgs=\['-ss',String\(sourceSeek\),'-i',sourceInput/);
});

test('saved projects persist media in IndexedDB and restore reference, track and source files after reload', () => {
  assert.match(main, /const MEDIA_DB_NAME='novex\.projectMedia\.v1'/);
  assert.match(main, /function openMediaDb\(/);
  assert.match(main, /async function saveProjectMedia\(/);
  assert.match(main, /async function readProjectMedia\(/);
  assert.match(main, /async function restoreProjectMedia\(project,referenceNames\)/);
  assert.match(main, /saveProjectMedia\(project\)\.then/);
  assert.match(main, /let sourceOk=!!d\.sourceName&&!!S\.source&&S\.source\.name===d\.sourceName/);
  assert.match(main, /const restored=await restoreProjectMedia\(p,refs\)/);
  assert.match(main, /\.filter\(x=>x\.ref\|\|sourceOk\)/);
});

test('multiple reference videos play sequentially in preview with a soft handoff', async () => { const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8'); assert.match(main,/function playReferenceAt\(index,autoplay=true,fade=true\)/); assert.match(main,/dataset\.previewSwitch/); assert.match(main,/v\.addEventListener\('loadeddata',reveal,\{once:true\}\);v\.src=item\.url;v\.load\(\)/); assert.match(main,/v\.dataset\.referencePlaylist='true'/); assert.match(main,/playReferenceAt\(current\+1,true,true\)/); assert.match(css,/#previewVideo\.preview-fade-out\{opacity:0\}/); assert.match(main,/d\.querySelector\('\.ref-preview'\)\.onclick=d\.querySelector\('\.ref-open'\)\.onclick=\(\)=>playReferenceAt/); });
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
  assert.match(main, /const sourceDuration=Number\(S\.sourceMeta\?\.duration\)\|\|r\.duration/);
  assert.match(main, /Math\.max\(0,sourceDuration-0\.1\)/);
  assert.match(main, /sourceAudioSeek=sourceSeek/);
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



test('audio uploads validate replacement before releasing the current track', () => {
  assert.match(main, /candidate\.onerror=\(\)=>finish\(new Error\(/);
  assert.match(main, /Не удалось прочитать аудиофайл\. Попробуй MP3 или WAV/);
  assert.match(main, /candidate\.removeAttribute\('src'\);candidate\.load\(\);URL\.revokeObjectURL\(nextUrl\);e\.target\.value='';\s*toast\(err\.message,'error'\);return/);
  assert.match(main, /au\.pause\(\);if\(S\.trackUrl\)URL\.revokeObjectURL\(S\.trackUrl\);\s*S\.track=f;S\.trackUrl=nextUrl/);
  assert.match(main, /candidate\.removeAttribute\('src'\);candidate\.load\(\);\s*au\.pause\(\)/);
});


test('reference preview recovers visibly when a selected video fails to load', () => {
  assert.match(main, /const fail=\(\)=>\{if\(v\.dataset\.previewSwitch!==switchToken\|\|v\.dataset\.referencePreview!==item\.url\)return/);
  assert.match(main, /v\.addEventListener\('error',fail,\{once:true\}\)/);
  assert.match(main, /v\.removeEventListener\('error',fail\)/);
  assert.match(main, /v\.removeEventListener\('loadeddata',reveal\);v\.removeEventListener\('error',fail\);v\.pause\(\)/);
  assert.match(main, /v\.hidden=true;v\.removeAttribute\('src'\);v\.load\(\);delete v\.dataset\.referencePlaylist;delete v\.dataset\.referencePreview/);
  assert.match(main, /\$\('#previewStage'\)\.classList\.remove\('has-preview'\);\$\('#previewStage \.preview-placeholder'\)\.hidden=false/);
  assert.match(main, /\$\('#previewClock'\)\.textContent='00:00 \/ 00:00';\$\('#previewSeekFill'\)\.style\.width='0%'/);
  assert.match(main, /Не удалось открыть видео '\+item\.file\.name/);
  assert.match(main, /v\.classList\.remove\('preview-fade-out'\)/);
  assert.match(main, /\$\('#playPreview'\)\.textContent='▶'/);
});


test('invalid audio replacement preserves the last valid track and player', () => {
  assert.match(main, /const nextUrl=URL\.createObjectURL\(f\),candidate=document\.createElement\('audio'\);candidate\.preload='metadata';candidate\.src=nextUrl/);
  assert.match(main, /catch\(err\)\{\s*candidate\.removeAttribute\('src'\);candidate\.load\(\);URL\.revokeObjectURL\(nextUrl\);e\.target\.value='';\s*toast\(err\.message,'error'\);return;\s*\}/);
  assert.match(main, /const au=\$\('#trackAudio'\),duration=Number\.isFinite\(candidate\.duration\)\?candidate\.duration:0/);
  assert.match(main, /au\.pause\(\);if\(S\.trackUrl\)URL\.revokeObjectURL\(S\.trackUrl\);\s*S\.track=f;S\.trackUrl=nextUrl;S\.duration=duration/);
});


test('reference preview advances only when multiple videos are queued', () => {
  assert.match(main, /\$\('#previewVideo'\)\.onended=\(\)=>\{const v=\$\('#previewVideo'\);if\(v\.dataset\.referencePlaylist==='true'&&S\.refs\.length>1\)\{const current=Number\(v\.dataset\.referenceIndex\)\|\|0;playReferenceAt\(current\+1,true,true\);return;\}\$\('#playPreview'\)\.textContent='▶';\};/);
});


test('video or music remains the only base audio source; animation SFX are mixed on top', () => {
  assert.match(main, /const audioMode=radio\('audioMode'\)\|\|'music'/);
  assert.match(main, /if\(audioMode==='source'&&!S\.source\)/);
  assert.match(main, /await ff\.exec\(\['-hide_banner','-i',sourceAudioInput\]\)/);
  assert.match(main, /В выбранном видео-источнике нет доступной аудиодорожки/);
  assert.match(main, /args\.push\('-map','1:a:0','-af'/);
  assert.match(main, /motionAudio\.synthesizeAudio\(\{sampleRate:24000,masterGain:\.24\}\)/);
  assert.match(main, /motionAudio\.hit\(cueAt\(threeDEdit\.start\),'l'\)/);
  assert.match(main, /motionTransitionCues\.push\(offset\)/);
  assert.match(main, /for\(const at of motionTransitionCues\)motionAudio\.sfx\('whoosh',at/);
  assert.match(main, /motionAudio\.sfx\('pop',cueAt\(edit\.start\)/);
  assert.match(main, /\[base\]\[sfx\]amix=inputs=2:duration=first/);
  assert.doesNotMatch(main, /mixSourceRequested|musicAudioIndex|sourceAudioIndex/);
  assert.match(main, /sourceAudioSeek=sourceSeek/);
});

test('multi-reference MP4 export uses smooth crossfades and preserves target duration', () => {
  assert.match(main, /const transition=Math\.max\(1\/30,Math\.floor\(Math\.min\(\.35,\.\.\.segmentDurations\.map\(d=>d\*\.45\)\)\*30\)\/30\)/);
  assert.match(main, /xfade=transition=fade:duration=/);
  assert.match(main, /const next='x'\+i,offset=Math\.max\(0,elapsed-transition\*\(i-1\)-transition\)/);
  assert.match(main, /tpad=stop_mode=clone:stop_duration='\+padding\.toFixed\(6\)/);
  assert.match(main, /Не удалось собрать плавные переходы между клипами/);
  assert.match(main, /if\(segmentDurations\.length===1\)/);
});

test('render temporary files are cleaned after success or failure and reference cache is reset', () => {
  assert.match(main, /async function cleanupRenderArtifacts\(\)/);
  assert.match(main, /const entries=await ff\.listDir\('\/'\)/);
  assert.match(main, /await ff\.deleteFile\(name\)/);
  assert.match(main, /finally\{S\.refs\.forEach\(ref=>\{delete ref\._ff;\}\);\}/);
  assert.match(main, /finally\{await cleanupRenderArtifacts\(\);S\.busy=false;busy\(b,false\);\}/);
  assert.match(main, /ref\[0-9\]\+\|x\[0-9\]\+/);
  const cleanupPattern = main.match(/if\(!\/(.+?)\/i\.test\(name\)\)continue;/);
  assert.ok(cleanupPattern, 'cleanup must have a narrow temporary-file allowlist');
  const allowed = new RegExp(cleanupPattern[1], 'i');
  for (const name of ['silent.mp4', 'export.mp4', 'source-video.mov', 'part12.mp4', 'ref2.webm', 'x3.mp4', '3d_0001.png', 'title_0012.png', 'graphic_0001.png', 'graphic-composite.mp4', 'motion-sfx.wav']) {
    assert.match(name, allowed, name + ' should be cleaned');
  }
  for (const name of ['notes.txt', 'source-video-backup.mp4', 'my-export.mp4', 'user-photo.png']) {
    assert.doesNotMatch(name, allowed, name + ' must not be deleted');
  }
});

test('mobile navigation exposes state and closes with Escape', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="mobileMenu"[^>]*aria-label="Открыть меню навигации"/);
  assert.match(html, /id="mobileMenu"[^>]*aria-controls="sidebar"/);
  assert.match(html, /id="mobileMenu"[^>]*aria-expanded="false"/);
  assert.match(main, /const open=\$\('#sidebar'\)\.classList\.toggle\('open'\);\$\('#mobileMenu'\)\.setAttribute\('aria-expanded',String\(open\)\)/);
  assert.match(main, /e\.key==='Escape'[\s\S]*\$\('#mobileMenu'\)\.focus\(\)/);
  assert.match(main, /\$\('#sidebar'\)\.classList\.remove\('open'\);\$\('#mobileMenu'\)\.setAttribute\('aria-expanded','false'\)/);
});

test('keyboard focus indicators remain visible, including forced-colors mode', async () => {
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /:where\(a,button,input,textarea,select,\[tabindex\]\):focus-visible\{outline:2px solid #6ce7ff;outline-offset:3px\}/);
  assert.match(css, /@media\(forced-colors:active\)[\s\S]*outline:2px solid CanvasText/);
});


test('workspace navigation uses a named landmark and announces the active view', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<nav class="sidebar" id="sidebar" aria-label="Основная навигация">/);
  assert.match(html, /class="nav-item active" data-view="studio" aria-current="page"/);
  assert.match(main, /if\(current\)x\.setAttribute\('aria-current','page'\);else x\.removeAttribute\('aria-current'\)/);
});


test('starting a new render releases stale export URLs and clears only the old export preview', () => {
  assert.match(main, /function clearPreviousExportPreview\(\)/);
  assert.match(main, /const previous=S\.output;S\.output=null;URL\.revokeObjectURL\(previous\)/);
  assert.match(main, /if\(v\.src!==previous\)return/);
  assert.match(main, /v\.pause\(\);v\.removeAttribute\('src'\);v\.load\(\);v\.hidden=true/);
  assert.match(main, /\$\('#previewStage'\)\.classList\.remove\('has-preview'\)/);
  assert.match(main, /clearPreviousExportPreview\(\);S\.busy=true/);
});


test('reset stops audio playback and releases the audio element source', () => {
  assert.match(main, /function reset\(\)\{if\(S\.busy\)return toast\('Дождись завершения рендера\.','warn'\);const au=\$\('#trackAudio'\),sourceAudio=\$\('#sourceAudioPreview'\);au\.pause\(\);au\.removeAttribute\('src'\);au\.load\(\);au\.hidden=true;sourceAudio\.pause\(\);sourceAudio\.removeAttribute\('src'\);sourceAudio\.load\(\);sourceAudio\.hidden=true/);
  assert.match(main, /if\(S\.trackUrl\)URL\.revokeObjectURL\(S\.trackUrl\)/);
});

test('replacing the source video revokes the previous object URL only after the new video is probed', () => {
  assert.match(main, /const p=await probe\(f\),audioPreview=\$\('#sourceAudioPreview'\);audioPreview\.pause\(\);audioPreview\.removeAttribute\('src'\);audioPreview\.load\(\);if\(S\.sourceUrl\)URL\.revokeObjectURL\(S\.sourceUrl\);S\.source=f;S\.sourceUrl=p\.url/);
});


test('successful audio replacement reuses the validated URL and updates track metadata', () => {
  assert.match(main, /au\.src=nextUrl;au\.volume=1;au\.hidden=false;au\.load\(\);\$\('#audioExportControls'\)\.hidden=false;syncSourceAudioControls\(\)/);
  assert.match(main, /\$\('#trackName'\)\.textContent=f\.name;\$\('#trackMeta'\)\.textContent=clock\(S\.duration\)\+' · '\+size\(f\.size\)/);
  assert.match(main, /e\.target\.value='';stats\(\);library\(\);toast\('Трек загружен\.'/);
});

test('media metadata probing has a timeout and releases failed temporary media URLs', () => {
  assert.match(main, /Истекло время чтения '\+file\.name|Истекло время чтения \+file\.name/);
  assert.match(main, /const timer=setTimeout\(\(\)=>finish\(new Error\('Истекло время чтения аудиофайла/);
  assert.match(main, /v\.removeAttribute\('src'\);v\.load\(\);URL\.revokeObjectURL\(u\);throw e/);
  assert.match(main, /candidate\.removeAttribute\('src'\);candidate\.load\(\);URL\.revokeObjectURL\(nextUrl\)/);
});


test('export dimensions preserve the selected aspect ratio and use 720p as the long edge for landscape', () => {
  assert.match(main, /baseSize=Math\.max\(2,Math\.round\(p\.resolution\/2\)\*2\)/);
  assert.match(main, /W=p\.aspect==='9:16'\?Math\.max\(2,Math\.round\(baseSize\*9\/16\/2\)\*2\):p\.aspect==='1:1'\?baseSize:Math\.max\(2,Math\.round\(baseSize\*16\/9\/2\)\*2\),H=baseSize/);
});

test('MP4 export validates the ISO base media file signature before presenting a download', () => {
  assert.match(main, /const mp4Head=Array\.from\(data\.slice\(4,8\),x=>String\.fromCharCode\(x\)\)\.join\(''\);if\(mp4Head!=='ftyp'\)throw Error/);
  assert.match(main, /progress\(98,'Проверяю контейнер MP4…'/);
});


test('final MP4 validation checks audio/video streams and decoded dimensions/duration', () => {
  assert.ok(main.includes("async function validateExportMedia(blob,W,H,duration)"));
  assert.ok(main.includes("Video:") && main.includes("Audio:"));
  assert.ok(main.includes("video.videoWidth!==W||video.videoHeight!==H"));
  assert.ok(main.includes("Math.abs(video.duration-duration)>Math.max(1,duration*.03)"));
  assert.ok(main.includes("await validateExportMedia(blob,W,H,r.duration)"));
});


test('removing reference clips preserves active playlist index and clears empty preview state', () => {
  assert.match(main, /const v=\$\('#previewVideo'\),activePlaylist=v\.dataset\.referencePlaylist==='true',removedActive=activePlaylist&&v\.dataset\.referencePreview===x\.url/);
  assert.match(main, /v\.dataset\.referenceIndex=String\(S\.refs\.findIndex\(y=>y\.url===v\.dataset\.referencePreview\)\)/);
  assert.match(main, /if\(!S\.refs\.length\)\{v\.pause\(\);v\.removeAttribute\('src'\);v\.load\(\);delete v\.dataset\.referencePlaylist;delete v\.dataset\.referenceIndex;delete v\.dataset\.referencePreview/);
});


test('reference clips are silent visual inputs and only one base source is selected before SFX', () => {
  assert.match(main, /'-an','-c:v','libx264'/);
  assert.match(main, /'-map','1:a:0','-af'/);
  assert.match(main, /if\(audioMode==='source'\)/);
  assert.match(main, /else\{\s*const ext=/);
  assert.match(main, /motion-sfx\.wav/);
  assert.match(main, /\[base\]\[sfx\]amix=inputs=2:duration=first/);
});

test('director capability note accurately describes implemented export effects', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /3D-логотип и кинетические титры вшиваются в MP4/);
  assert.match(html, /Движение камеры доступно для исходного видео/);
  assert.match(html, /точная синхронизация слов автоматически не выполняются/);
  assert.doesNotMatch(html, /Остальные команды пока добавляют правки в план; их визуальный экспорт ещё не реализован/);
});


test('source transcript checkbox contributes source text to the subtitle render pipeline', () => {
  assert.match(main, /const transcript=\$\('#sourceTranscript'\)\.value\.trim\(\);if\(transcript&&\$\('#useSourceTranscript'\)\.checked\)texts\.push\(transcript\)/);
  assert.match(main, /const subtitlesEdit=\(S\.edits\|\|\[\]\)\.some\(e=>e\.type==='add_subtitles'\)/);
  assert.match(main, /if\(lyrics&&\(\$\('#burnLyrics'\)\.checked\|\|\$\('#useSourceTranscript'\)\.checked\|\|subtitlesEdit\)\)/);
});


test('source transcript option rejects an empty transcript instead of silently omitting subtitles', () => {
  assert.match(main, /if\(\$\('#useSourceTranscript'\)\.checked&&!\$\('#sourceTranscript'\)\.value\.trim\(\)\)throw Error\('Включена опция текста источника, но поле пустое/);
});


test('source-only mode can be selected before analysis when a source video is uploaded', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<div id="sourceTranscriptWrap" class="source-transcript hidden"><label class="check-row"><input type="checkbox" id="useSourceVideo">/);
  assert.match(html, /id="sourceTranscriptWrap"[\s\S]*?id="sourceTranscript"[\s\S]*?id="sourceAudioPreview"/);
  assert.equal((html.match(/id="useSourceVideo"/g) || []).length, 1);
});


test('audio controls expose a mutually exclusive track-or-video source', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="trackAudio" controls preload="metadata" aria-label="Прослушать музыкальный трек"/);
  assert.match(html, /id="sourceAudioPreview" controls preload="metadata" aria-label="Прослушать оригинальный звук видео"/);
  assert.match(html, /name="audioMode" value="music" checked/);
  assert.match(html, /name="audioMode" value="source" disabled/);
  assert.doesNotMatch(html, /name="audioMode" value="(?:mix|original)"|audio-volume-grid|sourceAudioVolume|musicAudioVolume/);
  assert.match(main, /function syncSourceAudioControls\(\)\{const available=!!S\.source/);
  assert.match(main, /if\(sourceMode\)sourceMode\.disabled=!available/);
  assert.doesNotMatch(main, /mixSourceRequested/);
});

test('New Project resets the selected audio source to music', () => {
  assert.match(main, /\$\('input\[name="audioMode"\]\[value="music"\]'\)\.checked=true;syncSourceAudioControls\(\)/);
});

test('3D export pauses the live preview and captures deterministic frame timestamps', () => {
  assert.match(motion3d, /const wasPlaying=playing;\s*if\(wasPlaying\)\{playing=false;cancelAnimationFrame\(raf\);\}/);
  assert.match(motion3d, /const t=start\+Math\.min\(Math\.max\(0,duration\),i\/fps\);/);
  assert.match(motion3d, /if\(wasPlaying&&!disposed\)\{playing=true;started=performance\.now\(\);raf=requestAnimationFrame\(tick\);\}/);
});


test('browser render smoke exercises the real 3D export path with software WebGL', async () => {
  const smoke = await readFile(new URL('../scripts/browser-render-smoke.mjs', import.meta.url), 'utf8');
  assert.match(smoke, /--enable-webgl/);
  assert.match(smoke, /--enable-unsafe-swiftshader/);
  assert.match(smoke, /Добавь в начале объёмный 3D-логотип NOVEX/);
  assert.match(smoke, /3D preview did not initialize/);
  assert.match(smoke, /real Three\.js 3D frame capture\/compositing/);
});


test('local project metadata survives reload and cloud refresh preserves local-only projects', () => {
  assert.match(main, /const LOCAL_PROJECTS_KEY='novex\.localProjects\.v1'/);
  assert.match(main, /function loadLocalProjects\(\)/);
  assert.match(main, /function persistLocalProjects\(\)/);
  assert.match(main, /S\.projects=loadLocalProjects\(\)/);
  assert.match(main, /persistLocalProjects\(\);stats\(\)/);
  assert.match(main, /const local=loadLocalProjects\(\)/);
  assert.match(main, /localStorage\.setItem\(LOCAL_PROJECTS_KEY,JSON\.stringify/);
});


test('Android export writes the MP4 to persistent app Documents and opens the native share sheet', () => {
  assert.ok(main.includes("import { Capacitor } from '@capacitor/core';"));
  assert.ok(main.includes("import { Directory, Filesystem } from '@capacitor/filesystem';"));
  assert.ok(main.includes("import { Share } from '@capacitor/share';"));
  assert.ok(main.includes("if(Capacitor.isNativePlatform())"));
  assert.ok(main.includes("Filesystem.writeFile({path:'NOVEX/'+filename,data,directory:Directory.Documents,recursive:true})"));
  assert.ok(main.includes("Share.share({title:'NOVEX Motion Studio'"));
  assert.ok(main.includes("a.download=S.outputName"));
  assert.ok(main.includes("blob.size>120*1024*1024"));
});


test('saved projects restore source-video mode and the exclusive audio-source selection', () => {
  assert.match(main, /useSourceVideo:\!\!\(S\.source&&\$\('#useSourceVideo'\)\.checked\)/);
  assert.match(main, /audioMode:radio\('audioMode'\)\|\|'music'/);
  assert.match(main, /const savedMode=d\.audioMode==='source'\|\|d\.audioMode==='original'\|\|d\.audioMode==='mix'\?'source':'music'/);
  assert.match(main, /syncSourceAudioControls\(\);const timeline=/);
});

test('browser smoke validates exclusive source-audio selection and no audio mixing', async () => {
  const smoke = await readFile(new URL('../scripts/browser-render-smoke.mjs', import.meta.url), 'utf8');
  assert.match(smoke, /audioMode === 'source'/);
  assert.doesNotMatch(smoke, /sourceAudioVolume|musicAudioVolume|audioMode === 'mix'/);
  assert.match(smoke, /exclusive audio-source restoration/);
  assert.match(smoke, /Uncaught browser errors after New Project reset/);
});

test('automatic motion SFX are synthesized and layered over the single chosen audio source', () => {
  assert.match(main, /const motionAudio=createMotionDirector\(\{duration:r\.duration,fps:30\}\)/);
  assert.match(main, /motionAudio\.synthesizeAudio/);
  assert.match(main, /motion-sfx\.wav/);
  assert.match(main, /\[base\]\[sfx\]amix=inputs=2:duration=first/);
  assert.doesNotMatch(main, /mixSourceRequested/);
});

test('director accepts graphic accent commands and renders them into the final MP4',()=>{
  assert.ok(main.includes("type:'add_motion_graphic'"));
  assert.ok(main.includes("/кольц|обвод|подчерк|стрелк|вспыш|лучи|графическ/.test(q)"));
  assert.ok(main.includes("async function exportMotionGraphic"));
  assert.ok(main.includes("filter(e=>e.type==='add_motion_graphic')"));
  assert.ok(main.includes("ff.writeFile('graphic_'+String(i).padStart(4,'0')+'.png'"));
  assert.ok(main.includes("overlay=0:0:enable='between(t,"));
  assert.ok(main.includes("graphic-composite.mp4"));
  assert.ok(main.includes("graphic-composite|concat"));
});

test('graphic motion accents are available from the Director quick actions',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/data-command="graphic">◌ Графический акцент/);
  assert.ok(main.includes("graphic:'Добавь графический акцент-кольцо с плавным появлением.'"));
});

test('browser render smoke exercises the animated graphic overlay export path',async()=>{
  const smoke=await readFile(new URL('../scripts/browser-render-smoke.mjs',import.meta.url),'utf8');
  assert.match(smoke,/Добавь графический акцент-кольцо с плавным появлением/);
  assert.match(smoke,/directorPlan.*Кольцевой акцент/);
});


test('video audio selection does not require replacing reference visuals with source-video visuals', () => {
  assert.match(main, /if\(\(radio\('audioMode'\)\|\|'music'\)==='source'&&!S\.source\)/);
  assert.doesNotMatch(main, /Выбран звук «Оригинал» или «Смешать»/);
});
