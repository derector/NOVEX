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
  const design = await page.evaluate(() => {
    const drop = document.querySelector('#referenceDrop').getBoundingClientRect();
    const cta = document.querySelector('#referenceDrop .drop-cta').getBoundingClientRect();
    const orbit = document.querySelector('.preview-orbit');
    const orbitBox = orbit.getBoundingClientRect();
    const icon = orbit.querySelector('span').getBoundingClientRect();
    const ring = getComputedStyle(orbit, '::before');
    return {
      lime: getComputedStyle(document.documentElement).getPropertyValue('--lime').trim(),
      bodyColor: getComputedStyle(document.body).backgroundColor,
      heroAnimation: getComputedStyle(document.querySelector('#view-studio .page-heading h1')).animationName,
      previewColor: getComputedStyle(document.querySelector('.preview-panel')).color,
      ctaCenterError: Math.abs((cta.left + cta.width / 2) - (drop.left + drop.width / 2)),
      ctaWithinDrop: cta.left >= drop.left && cta.right <= drop.right && cta.top >= drop.top && cta.bottom <= drop.bottom,
      orbitPosition: getComputedStyle(orbit).position,
      ringPosition: ring.position,
      iconCenterError: Math.abs((icon.left + icon.width / 2) - (orbitBox.left + orbitBox.width / 2))
    };
  });
  const isDarkBody = /^rgb\((?:[0-9]{1,2}),\s*(?:[0-9]{1,2}),\s*(?:[0-9]{1,2})\)$/.test(design.bodyColor) &&
    design.bodyColor.split(/[(),\s]+/).filter(Boolean).slice(1).every(channel => Number(channel) <= 30);
  const previewTextIsReadable = /^rgb\(/.test(design.previewColor) &&
    design.previewColor.split(/[(),\s]+/).filter(Boolean).slice(1).every(channel => Number(channel) >= 180);
  if (!/^#[0-9a-f]{6}$/i.test(design.lime) || !isDarkBody ||
      design.heroAnimation !== 'title-reveal' || !previewTextIsReadable ||
      design.ctaCenterError > 1 || !design.ctaWithinDrop || design.orbitPosition !== 'relative' ||
      design.ringPosition !== 'absolute' || design.iconCenterError > 2) {
    throw new Error('Dark theme, centered upload CTA or play-ring alignment failed: ' + JSON.stringify(design));
  }
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


  // The edit-command field is revealed after the initial reference analysis.
  await page.locator('#analyzeBtn').click();
  await page.locator('#directionPanel').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('#editCommand').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('#editCommand').scrollIntoViewIfNeeded();

  // Exercise the integrated Motion Director command against two real reference clips.
  await page.locator('#editCommand').fill('/motion-director');
  await page.locator('#applyEditCommand').click();
  await page.waitForFunction(() => {
    const panel = document.querySelector('#motionDirectorWorkflow');
    return panel && !panel.classList.contains('hidden') &&
      document.querySelector('#motionDirectorMessage')?.textContent.includes('Результат анализа:') &&
      document.querySelectorAll('#motionDirectorChoices button').length === 3;
  }, null, { timeout: 30000 });
  await page.locator('#motionDirectorChoices button').filter({ hasText: 'По мотивам' }).click();
  await page.waitForFunction(() =>
    document.querySelector('input[name="styleMode"][value="inspired"]')?.checked === true &&
    document.querySelector('#directorStatus')?.textContent.includes('По мотивам'),
    null, { timeout: 10000 }
  );
  const motionDirectorReport = await page.locator('#motionDirectorMessage').innerText();
  if (!motionDirectorReport.includes('novex-smoke-reference.webm') ||
      !motionDirectorReport.includes('novex-smoke-reference-2.webm')) {
    throw new Error('Motion Director did not report both reference clips: ' + motionDirectorReport);
  }

  await page.waitForFunction(() => {
    const audio = document.querySelector('#trackAudio');
    return audio && !audio.hidden && audio.readyState >= 1 &&
      Number.isFinite(audio.duration) && audio.duration > 2.5;
  }, null, { timeout: 15000 });
  await page.locator('#lyrics').fill('Тихий свет приходит к нам сегодня вечером и открывает все дороги для нового движения');
  await page.locator('#syncLyrics').click();
  const lyricResult = await page.evaluate(() => ({
    lines: document.querySelector('#lyrics').value.split('\n').filter(Boolean),
    status: document.querySelector('#lyricsStatus').textContent
  }));
  if (lyricResult.lines.length < 2 || !lyricResult.status.includes('строк готовы')) {
    throw new Error('Lyrics split control did not create editable lines: ' + JSON.stringify(lyricResult));
  }
  await page.locator('#lyrics').fill('');
  const musicPlayer = await page.evaluate(async () => {
    const audio = document.querySelector('#trackAudio');
    audio.pause();
    audio.loop = true;
    audio.currentTime = 0;
    await audio.play();
    // Headless Chromium may need more than one short frame to advance media time.
    // Wait for playback to make measurable progress instead of sampling at 300 ms.
    for (let attempt = 0; attempt < 30 && audio.currentTime <= 0.05 && !audio.paused; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const result = { paused: audio.paused, currentTime: audio.currentTime, duration: audio.duration };
    audio.pause();
    audio.loop = false;
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
  await page.evaluate(() => document.querySelector('#previewVideo').pause());
  await page.locator('.preview-track').focus();
  await page.keyboard.press('End');
  await page.waitForFunction(() => document.querySelector('.preview-track')?.getAttribute('aria-valuenow') === '100');
  await page.keyboard.press('Home');
  await page.waitForFunction(() => document.querySelector('.preview-track')?.getAttribute('aria-valuenow') === '0');
  await page.evaluate(async () => {
    const video = document.querySelector('#previewVideo');
    video.playbackRate = 8;
    video.currentTime = Math.max(0, video.duration - 0.18);
    await video.play().catch(() => {});
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
  await page.locator('#mobileMenu').click();
  await page.waitForFunction(() => document.querySelector('#sidebar')?.classList.contains('open') && document.querySelector('#mobileMenu')?.getAttribute('aria-expanded') === 'true');
  await page.locator('#sidebarBackdrop').click({ position: { x: 380, y: 180 } });
  await page.waitForFunction(() => !document.querySelector('#sidebar')?.classList.contains('open') && document.querySelector('#sidebarBackdrop')?.hidden);
  await page.locator('#mobileMenu').click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#sidebar')?.classList.contains('open') && document.activeElement?.id === 'mobileMenu');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForFunction(() => !document.querySelector('#sidebar')?.inert && !document.querySelector('#sidebar')?.hasAttribute('aria-hidden'));

  await page.locator('#analyzeBtn').click();
  await page.locator('#directionPanel').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('label.choice-card').filter({ has: page.locator('input[name="styleMode"][value="faithful"]') }).click();
  await page.locator('.segmented label').filter({ has: page.locator('input[name="resolution"][value="480"]') }).click();
  await page.locator('#planBtn').click();
  await page.locator('#renderPanel').waitFor({ state: 'visible', timeout: 10000 });
  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  if (duplicateIds.length) throw new Error('Duplicate DOM ids after rendering the timeline editor: ' + duplicateIds.join(', '));
  const plannedClips = await page.locator('#timelineTracks > .timeline-track').first().locator('.timeline-clip').count();
  if (plannedClips < 1) throw new Error('Editable timeline did not contain a video clip.');
  const originalClipDuration = Number(await page.locator('#timelineClipDuration').inputValue());
  const editedClipDuration = Math.max(0.1, originalClipDuration - 0.2);
  await page.locator('#timelineSourceIn').fill('0.2');
  await page.locator('#timelineClipDuration').fill(editedClipDuration.toFixed(2));
  await page.locator('#applyTimelineTrim').click();
  await page.waitForFunction((expected) =>
    Math.abs(Number(document.querySelector('#timelineSourceIn')?.value) - 0.2) < 0.01 &&
    Math.abs(Number(document.querySelector('#timelineClipDuration')?.value) - expected) < 0.01 &&
    document.querySelector('#timelineRuler span:last-child')?.textContent === '00:02',
    editedClipDuration, { timeout: 10000 }
  );
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
    null, { timeout: 10000 }
  );
  if (pageErrors.length) throw new Error('Project media restore caused browser errors: ' + pageErrors.join(' | '));

  // Exercise the source-only edit path, one selected audio source plus automatic motion SFX, and transcript captions.
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
    audio.pause();
    audio.loop = true;
    audio.currentTime = 0;
    await new Promise(resolve => {
      let settled = false, timer;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        audio.removeEventListener('seeked', finish);
        resolve();
      };
      audio.addEventListener('seeked', finish, { once: true });
      timer = setTimeout(finish, 750);
    });
    await audio.play();
    await new Promise(resolve => setTimeout(resolve, 300));
    const result = { paused: audio.paused, currentTime: audio.currentTime, duration: audio.duration };
    audio.pause();
    return result;
  });
  if (sourcePlayer.paused || sourcePlayer.duration < 2.5) {
    throw new Error('Source audio preview did not play: ' + JSON.stringify(sourcePlayer));
  }

  await page.locator('#sourceTranscript').fill('Source dialogue for subtitle render smoke test.');
  await page.locator('#useSourceVideo').check();
  await page.locator('.segmented label').filter({ has: page.locator('input[name="audioMode"][value="source"]') }).click();
  await page.locator('#useSourceTranscript').check();
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

  // Verify that the exclusive video-audio source selection survives reload.
  await page.locator('[data-view="projects"]').click();
  await page.locator('#projectsGrid .project-open').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="projects"]').click();
  await page.locator('#projectsGrid .project-open').first().click();
  await page.waitForFunction(() => {
    const audioMode = document.querySelector('input[name="audioMode"]:checked')?.value;
    return document.querySelector('#sourceVideoName')?.textContent === 'novex-smoke-source.mp4' &&
      document.querySelector('#trackName')?.textContent === 'novex-smoke-track.wav' &&
      document.querySelector('#useSourceVideo')?.checked === true && audioMode === 'source' &&
      document.querySelector('input[name="audioMode"][value="music"]')?.disabled === false &&
      document.querySelector('input[name="audioMode"][value="source"]')?.disabled === false;
  }, null, { timeout: 20000 });

  // Exercise the New Project reset after source-audio mode has been enabled.
  await page.waitForFunction(() => !document.querySelector('#renderBtn')?.disabled, null, { timeout: 10000 });
  await page.locator('#newProjectTop').click();
  await page.waitForFunction(() => {
    const modes = [...document.querySelectorAll('input[name="audioMode"]')];
    return document.querySelector('#trackName')?.textContent === 'Загрузи трек' &&
      document.querySelector('#sourceVideoName')?.textContent === 'Добавить видео-источник' &&
      document.querySelector('#useSourceVideo')?.checked === false &&
      document.querySelector('input[name="audioMode"]:checked')?.value === 'music' &&
      modes.some(el => el.value === 'source' && !el.checked && el.disabled);
  }, null, { timeout: 10000 });
  await page.locator('#referenceInput').setInputFiles('/tmp/novex-smoke-portrait.webm');
  await page.waitForFunction(() => {
    const video = document.querySelector('#previewVideo');
    return document.querySelector('#referenceList')?.textContent.includes('novex-smoke-portrait.webm') &&
      video?.dataset.previewKind === 'reference' && video.videoWidth === 180 && video.videoHeight === 320 &&
      video.readyState >= 2;
  }, null, { timeout: 15000 });
  const portraitFit = await page.evaluate(() => {
    const stage = document.querySelector('#previewStage').getBoundingClientRect();
    const video = document.querySelector('#previewVideo');
    const box = video.getBoundingClientRect();
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      objectFit: getComputedStyle(video).objectFit,
      objectPosition: getComputedStyle(video).objectPosition,
      centerError: Math.max(Math.abs((box.left + box.width / 2) - (stage.left + stage.width / 2)),
        Math.abs((box.top + box.height / 2) - (stage.top + stage.height / 2)))
    };
  });
  if (portraitFit.width !== 180 || portraitFit.height !== 320 || portraitFit.objectFit !== 'contain' ||
      portraitFit.objectPosition !== '50% 50%' || portraitFit.centerError > 1) {
    throw new Error('Portrait reference drifted inside the preview stage: ' + JSON.stringify(portraitFit));
  }
  if (pageErrors.length) throw new Error('Uncaught browser errors after New Project reset: ' + pageErrors.join(' | '));
  console.log('BROWSER RENDER SMOKE: PASS — dark cyberpunk theme, centered upload CTA and aligned animated play ring, real lyrics splitting, keyboard preview seek, mobile menu/backdrop/Escape, landscape and portrait reference fitting, multi-reference sequential preview, editable timeline trim to MP4, mobile viewport, project/media restoration across reload, source-only edit, exclusive audio-source restoration, real Three.js 3D frame capture/compositing, single-source AAC export with automatic motion SFX and transcript subtitles, independent audio playback, two MP4 exports and download metadata.');

} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
