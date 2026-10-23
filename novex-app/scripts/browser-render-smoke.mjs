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

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
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

  await page.locator('#referenceList .remove-btn').nth(1).click();
  await page.waitForFunction(() => {
    const video = document.querySelector('#previewVideo');
    return video?.dataset.referenceIndex === '0' &&
      video.dataset.referencePlaylist === 'true' &&
      video.dataset.referencePreview?.includes('novex-smoke-reference.webm') &&
      video.readyState >= 2;
  }, null, { timeout: 15000 });
  await page.locator('#referenceList .remove-btn').first().click();
  await page.waitForFunction(() => {
    const video = document.querySelector('#previewVideo');
    return video?.hidden && !video.dataset.referencePlaylist &&
      !video.dataset.referenceIndex && !video.dataset.referencePreview &&
      !video.getAttribute('src') &&
      !document.querySelector('#previewStage .preview-placeholder')?.hidden;
  }, null, { timeout: 10000 });
  await page.locator('#referenceInput').evaluate(input => { input.value = ''; });
  await page.locator('#referenceInput').setInputFiles(['/tmp/novex-smoke-reference.webm', '/tmp/novex-smoke-reference-2.webm']);
  await page.waitForFunction(() => document.querySelectorAll('#referenceList .media-item-rich').length === 2, null, { timeout: 15000 });

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

  await page.locator('.nav-item[data-view="projects"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#projectsGrid .project-card').length === 1, null, { timeout: 10000 });
  if (!(await page.locator('#projectsGrid').innerText()).includes('novex-smoke-track')) {
    throw new Error('Created project is not listed before reload.');
  }
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('.nav-item[data-view="projects"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#projectsGrid .project-card').length === 1, null, { timeout: 10000 });
  if (!(await page.locator('#projectsGrid').innerText()).includes('novex-smoke-track')) {
    throw new Error('Local project metadata did not survive page reload.');
  }

  if (pageErrors.length) throw new Error('Uncaught browser errors: ' + pageErrors.join(' | '));
  console.log('BROWSER RENDER SMOKE: PASS — two-reference playlist handoff/removal, mobile viewport, persistent project metadata, analysis, plan, FFmpeg MP4 export, stream/metadata validation and download.');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
