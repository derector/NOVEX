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
  await page.locator('#referenceInput').setInputFiles('/tmp/novex-smoke-reference.webm');
  await page.locator('#trackInput').setInputFiles('/tmp/novex-smoke-track.wav');
  try {
    await page.waitForFunction(() =>
      document.querySelector('#referenceList')?.textContent.includes('novex-smoke-reference.webm') &&
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

  if (pageErrors.length) throw new Error('Uncaught browser errors: ' + pageErrors.join(' | '));
  console.log('BROWSER RENDER SMOKE: PASS — uploaded video + audio, analysis, plan, FFmpeg MP4 export, stream/metadata validation, preview playback metadata.');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
