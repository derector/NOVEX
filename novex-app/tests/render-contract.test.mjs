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

test('saved source-only plans can be reopened when the source and music are reselected', () => {
  assert.match(main, /sourceName:S\.source\?\.name\|\|null/);
  assert.match(main, /const sourceOk=!!d\.sourceName&&!!S\.source&&S\.source\.name===d\.sourceName/);
  assert.match(main, /\(!matched\.length&&!sourceOk\)/);
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


test('source audio mixing falls back to music-only export when the source has no audio stream', () => {
  assert.ok(main.includes("const mixSourceRequested=$('#mixSourceAudio').checked"));
  assert.ok(main.includes("await ff.exec(['-hide_banner','-i',sourceAudioInput])"));
  assert.ok(main.includes("useSourceAudio=/\\bAudio:\\s/i.test(probeLog)"));
  assert.ok(main.includes("finally{ff.off('log',capture);}"));
  assert.ok(main.includes("if(useSourceAudio){args.push('-filter_complex'"));
  assert.ok(main.includes("}else args.push('-map','1:a:0')"));
  assert.ok(main.includes('В исходном видео нет звуковой дорожки — экспортирую музыку без смешивания.'));
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
  for (const name of ['silent.mp4', 'export.mp4', 'source-video.mov', 'part12.mp4', 'ref2.webm', 'x3.mp4', '3d_0001.png', 'title_0012.png']) {
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
  assert.match(main, /function reset\(\)\{if\(S\.busy\)return toast\('Дождись завершения рендера\.','warn'\);const au=\$\('#trackAudio'\);au\.pause\(\);au\.removeAttribute\('src'\);au\.load\(\);au\.hidden=true/);
  assert.match(main, /if\(S\.trackUrl\)URL\.revokeObjectURL\(S\.trackUrl\)/);
});

test('replacing the source video revokes the previous object URL only after the new video is probed', () => {
  assert.match(main, /const p=await probe\(f\);if\(S\.sourceUrl\)URL\.revokeObjectURL\(S\.sourceUrl\);S\.source=f;S\.sourceUrl=p\.url/);
});


test('successful audio replacement reuses the validated URL and updates track metadata', () => {
  assert.match(main, /au\.src=nextUrl;au\.hidden=false;au\.load\(\)/);
  assert.match(main, /\$\('#trackName'\)\.textContent=f\.name;\$\('#trackMeta'\)\.textContent=clock\(S\.duration\)\+' · '\+size\(f\.size\)/);
  assert.match(main, /e\.target\.value='';stats\(\);library\(\);toast\('Трек загружен\.'\)/);
});


test('media metadata probing has a timeout and releases failed temporary media URLs', () => {
  assert.match(main, /Истекло время чтения '\+file\.name|Истекло время чтения \+file\.name/);
  assert.match(main, /const timer=setTimeout\(\(\)=>finish\(new Error\('Истекло время чтения аудиофайла/);
  assert.match(main, /v\.removeAttribute\('src'\);v\.load\(\);URL\.revokeObjectURL\(u\);throw e/);
  assert.match(main, /candidate\.removeAttribute\('src'\);candidate\.load\(\);URL\.revokeObjectURL\(nextUrl\)/);
});
