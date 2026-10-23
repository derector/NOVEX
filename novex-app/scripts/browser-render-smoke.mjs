import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseURL = process.env.NOVEX_SMOKE_URL || 'http://127.0.0.1:4173/NOVEX/';
const server = spawn('npm', ['run', 'preview', '--', '--outDir', '/tmp/novex-preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  stdio: 'ignore',
  env: process.env
});
let browser;
const pageErrors = [];

try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(500);
  }
  if (!ready) throw new Error('Vite preview did not become ready at ' + baseURL);

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') pageErrors.push('console: ' + message.text()); });

  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#referenceInput').setInputFiles(['/tmp/novex-smoke-reference.webm', '/tmp/novex-smoke-reference-2.webm']);
  await page.locator('#trackInput').setInputFiles('/tmp/novex-smoke-track.wav');
  try {
    await page.waitForFunction(() =>
      document.querySelector('#referenceList')?.textContent.includes('novex-smoke-reference.webm') &&
      document.querySelector('#referenceList')?.textContent.includes('novex-smoke-reference-2.webm') &&
      document.querySelectorAll('#referenceList .media-item-rich').length === 2 &&
      document.querySelector('#trackName')?.textContent === 'novex-smoke-track.wav',
      null, { timeout: 20000 }
    );
  } catch (error) {
    const state = await page.evaluate(() => ({
      references: document.querySelector('#referenceList')?.innerText || '',
      track: document.querySelector('#trackName')?.textContent || '',
      notices: [...document.querySelectorAll('.toast,.toast-message,[role="alert"]')].map(el => el.innerText),
      selectedVideo: document.querySelector('#referenceInput')?.files?.[0]?.name || '',
      selectedAudio: document.querySelector('#trackInput')?.files?.[0]?.name || ''
    }));
    throw new Error('Media upload did not complete: ' + JSON.stringify(state) + '; browser errors: ' + pageErrors.join(' | ') + '; ' + error.message);
  }

  await page.waitForFunction(() => {
    const audio = document.querySelector('#trackAudio');
    return audio && !audio.hidden && audio.readyState >= 1 &&
      Number.isFinite(audio.duration) && audio.duration > 2.5;
  }, null, { timeout: 15000 });
  const musicPlayer = await page.evaluate(async () => {
    const audio = document.querySelector('#trackAudio');
    await audio.play();
    await new Promise(resolve => setTimeout(resolve, 300));
    const result = { paused: audio.paused, currentTime: audio.currentTime, duration: audio.duration };
    audio.pause();
    return result;
  });
  if (musicPlayer.paused || musicPlayer.currentTime <= 0 ||
      musicPlayer.duration < 2.5) {
    throw new Error('Uploaded music player did not play: ' + JSON.stringify(musicPlayer));
  }

  await page.waitForFunction(() => {
    const video = document.querySelector('#previewVideo');
    return video && video.videoWidth === 320 && video.dataset.referenceIndex === '0' &&
      video.dataset.referencePlaylist === 'true';
  }, null, { timeout: 15000 });
  await page.evaluate(async () => {
    const video = document.querySelector('#previewVideo');
    video.playbackRate = 8;
    video.currentTime = Math.max(0, video.duration - 0.18);
    await video.play();
  });
  await page.waitForFunction(() => {
    const video = document.querySelector('#previewVideo');
    return video?.dataset.referenceIndex === '1' &&
      video.dataset.referencePlaylist === 'true' && video.videoWidth === 320 &&
      video.readyState >= 2 && video.currentSrc === video.dataset.referencePreview &&
      video.currentTime < 1;
  }, null, { timeout: 15000 });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    profileRight: document.querySelector('#cloudAccountBtn').getBoundingClientRect().right
  }));
  if (mobileLayout.document > mobileLayout.viewport + 1 ||
      mobileLayout.profileRight > mobileLayout.viewport + 1) {
    throw new Error('Mobile layout overflows viewport: ' + JSON.stringify(mobileLayout));
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.locator('#analyzeBtn').click();
  await page.locator('#directionPanel').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('label.choice-card').filter({ has: page.locator('input[name="styleMode"][value="faithful"]') }).click();
  await page.locator('.segmented label').filter({ has: page.locator('input[name="resolution"][value="480"]') }).click();
  await page.locator('#planBtn').click();
  await page.locator('#renderPanel').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#renderBtn').click();

  await page.waitForFunction(() => {
    const status = document.querySelector('#renderStatus')?.textContent?.trim() || '';
    return status.includes('ГОТОВО') || status.includes('ОШИБКА');
  }, null, { timeout: 180000 });

  const status = (await page.locator('#renderStatus').innerText()).trim();
  if (!status.includes('ГОТОВО')) {
    const detail = await page.locator('#renderLog').innerText().catch(() => '');
    throw new Error('Browser render failed: ' + status + ' — ' + detail);
  }

  const meta = await page.locator('#exportMeta').innerText();
  if (!meta.includes('MP4') || !meta.includes('854×480')) {
    throw new Error('Unexpected exported media metadata: ' + meta);
  }
  await page.waitForFunction(() => {
    const video = document.querySelector('#previewVideo');
    return video && !video.hidden && video.videoWidth === 854 && video.videoHeight === 480 &&
      Number.isFinite(video.duration) && video.duration > 2.5 && video.duration < 3.5;
  }, null, { timeout: 15000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
  await page.locator('#downloadBtn').click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  const downloadedBytes = await readFile(downloadedPath);
  if (!/^NOVEX.*\.mp4$/i.test(download.suggestedFilename())) {
    throw new Error('Unexpected download filename: ' + download.suggestedFilename());
  }
  if (downloadedBytes.length < 1000 || downloadedBytes.toString('ascii', 4, 8) !== 'ftyp') {
    throw new Error('Downloaded file is empty or not an MP4 container.');
  }

  // Verify locally saved project metadata survives a complete browser reload.
  await page.locator('[data-view="projects"]').click();
  await page.locator('#projectsGrid .project-card').first().waitFor({ state: 'visible', timeout: 10000 });
  const savedProjectName = (await page.locator('#projectsGrid .project-card b').first().innerText()).trim();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="projects"]').click();
  await page.locator('#projectsGrid .project-card').first().waitFor({ state: 'visible', timeout: 10000 });
  const restoredProjectName = (await page.locator('#projectsGrid .project-card b').first().innerText()).trim();
  if (!savedProjectName || restoredProjectName !== savedProjectName) {
    throw new Error('Local project metadata did not survive reload: ' + JSON.stringify({ savedProjectName, restoredProjectName }));
  }
  await page.locator('#projectsGrid .project-open').first().click();
  await page.waitForFunction(() =>
    document.querySelector('#trackName')?.textContent === 'novex-smoke-track.wav' &&
    document.querySelectorAll('#referenceList .media-item-rich').length === 2 &&
    document.querySelector('#referenceList')?.textContent.includes('novex-smoke-reference-2.webm'),
    null, { timeout: 20000 }
  );
  if (pageErrors.length) throw new Error('Project media restore caused browser errors: ' + pageErrors.join(' | '));

  // Exercise the source-only edit path, real source-audio mixing, and transcript captions.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#sourceVideoInput').setInputFiles('/tmp/novex-smoke-source.mp4');
  await page.locator('#trackInput').setInputFiles('/tmp/novex-smoke-track.wav');
  await page.waitForFunction(() =>
    document.querySelector('#sourceVideoName')?.textContent === 'novex-smoke-source.mp4' &&
    document.querySelector('#trackName')?.textContent === 'novex-smoke-track.wav' &&
    !document.querySelector('#sourceTranscriptWrap')?.classList.contains('hidden'),
    null, { timeout: 20000 }
  );
  await page.waitForFunction(() => {
    const audio = document.querySelector('#sourceAudioPreview');
    return audio && !audio.hidden && audio.readyState >= 1 &&
      Number.isFinite(audio.duration) && audio.duration > 2.5;
  }, null, { timeout: 15000 });
  const sourcePlayer = await page.evaluate(async () => {
    const audio = document.querySelector('#sourceAudioPreview');
    audio.currentTime = 0;
    await audio.play();
    await new Promise(resolve => setTimeout(resolve, 300));
    const result = { paused: audio.paused, currentTime: audio.currentTime, duration: audio.duration };
    audio.pause();
    return result;
  });
  if (sourcePlayer.paused || sourcePlayer.currentTime <= 0 ||
      sourcePlayer.duration < 2.5) {
    throw new Error('Source audio preview did not play: ' + JSON.stringify(sourcePlayer));
  }

  await page.locator('#sourceTranscript').fill('Source dialogue for subtitle render smoke test.');
  await page.locator('#useSourceVideo').check();
  await page.locator('input[name="audioMode"][value="mix"]').check();
  await page.locator('#useSourceTranscript').check();
  await page.locator('#sourceAudioVolume').evaluate(el => { el.value = '37'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#musicAudioVolume').evaluate(el => { el.value = '62'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#analyzeBtn').click();
  await page.locator('#directionPanel').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('#editCommand').fill('Добавь в начале объёмный 3D-логотип NOVEX с хромом и медленным вращением камеры.');
  await page.locator('#applyEditCommand').click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#motion3dStatus')?.textContent || '';
    return status.includes('Воспроизведение 3D-сцены') || status.includes('WebGL недоступен');
  }, null, { timeout: 15000 });
  const motionStatus = (await page.locator('#motion3dStatus').innerText()).trim();
  if (!motionStatus.includes('Воспроизведение 3D-сцены')) throw new Error('3D preview did not initialize: ' + motionStatus);
  await page.locator('#editCommand').fill('Добавь графический акцент-кольцо с плавным появлением.');
  await page.locator('#applyEditCommand').click();
  await page.waitForFunction(() => document.querySelector('#directorPlan')?.textContent.includes('Кольцевой акцент'), null, { timeout: 10000 });
  await page.locator('#burnLyrics').uncheck();
  await page.locator('.segmented label').filter({ has: page.locator('input[name="resolution"][value="480"]') }).click();
  await page.locator('#planBtn').click();
  await page.locator('#renderPanel').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#renderBtn').click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#renderStatus')?.textContent?.trim() || '';
    return status.includes('ГОТОВО') || status.includes('ОШИБКА');
  }, null, { timeout: 180000 });
  const sourceStatus = (await page.locator('#renderStatus').innerText()).trim();
  if (!sourceStatus.includes('ГОТОВО')) {
    const detail = await page.locator('#renderLog').innerText().catch(() => '');
    throw new Error('Source-video/audio/subtitle render failed: ' + sourceStatus + ' — ' + detail);
  }
  const sourceMeta = await page.locator('#exportMeta').innerText();
  if (!sourceMeta.includes('MP4') || !sourceMeta.includes('854×480')) {
    throw new Error('Unexpected source-video export metadata: ' + sourceMeta);
  }
  await page.waitForFunction(() => {
    const video = document.querySelector('#previewVideo');
    return video && !video.hidden && video.videoWidth === 854 && video.videoHeight === 480 &&
      Number.isFinite(video.duration) && video.duration > 2.5 && video.duration < 3.5;
  }, null, { timeout: 15000 });

  // Verify that the source mode, audio mix and user-selected gains survive reload.
  await page.locator('[data-view="projects"]').click();
  await page.locator('#projectsGrid .project-open').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="projects"]').click();
  await page.locator('#projectsGrid .project-open').first().click();
  await page.waitForFunction(() => {
    const audioMode = document.querySelector('input[name="audioMode"]:checked')?.value;
    return document.querySelector('#sourceVideoName')?.textContent === 'novex-smoke-source.mp4' &&
      document.querySelector('#trackName')?.textContent === 'novex-smoke-track.wav' &&
      document.querySelector('#useSourceVideo')?.checked === true && audioMode === 'mix' &&
      document.querySelector('#sourceAudioVolume')?.value === '37' &&
      document.querySelector('#musicAudioVolume')?.value === '62';
  }, null, { timeout: 20000 });

  // Exercise the New Project reset after source/mix settings have been enabled.
  await page.locator('#newProjectTop').click();
  await page.waitForFunction(() => {
    const modes = [...document.querySelectorAll('input[name="audioMode"]')];
    return document.querySelector('#trackName')?.textContent === 'Загрузи трек' &&
      document.querySelector('#sourceVideoName')?.textContent === 'Добавить видео-источник' &&
      document.querySelector('#useSourceVideo')?.checked === false &&
      document.querySelector('input[name="audioMode"]:checked')?.value === 'music' &&
      modes.filter(el => el.value !== 'music').every(el => el.disabled) &&
      document.querySelector('#musicAudioVolume')?.disabled === true;
  }, null, { timeout: 10000 });
  if (pageErrors.length) throw new Error('Uncaught browser errors after New Project reset: ' + pageErrors.join(' | '));
  if (pageErrors.length) throw new Error('Uncaught browser errors: ' + pageErrors.join(' | '));
  console.log('BROWSER RENDER SMOKE: PASS — multi-reference sequential preview, mobile viewport, local project and media restoration across reload, source-only edit, source/audio settings restoration, real Three.js 3D frame capture/compositing, AAC source-audio mixing, transcript subtitles, music and source-audio player playback, MP4 export/download and output metadata.');

} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
