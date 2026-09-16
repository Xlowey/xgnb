const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const check = (label, ok, detail) => console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : ' <- ' + JSON.stringify(detail)));
let failures = 0;
const expect = (label, ok, detail) => { check(label, ok, detail); if (!ok) failures += 1; };

(async () => {
  await new Promise(resolve => server.listen(8810, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => { if (/portrait|novel-portraits/.test(request.url())) errors.push('portrait request failed: ' + request.url()); });
  async function openUntil(scene, speaker, label) {
    await page.goto('http://127.0.0.1:8810/pages/novel.html?scene=' + scene + '&preview=1');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    await page.waitForTimeout(500);
    if (!await page.locator('#novel-speaker').count()) return null;
    for (let i = 0; i < 24; i += 1) {
      if (!await page.locator('#novel-speaker').count()) return null;
      const current = await page.evaluate(() => ({ speaker: document.getElementById('novel-speaker').textContent.trim(), event: !document.getElementById('event-next').hidden, choices: document.querySelectorAll('.novel-choice').length }));
      if (current.speaker === speaker) {
        const state = await page.evaluate(() => ({ images: Array.from(document.querySelectorAll('.novel-portrait')).map(img => ({ cls: img.className, hidden: img.hidden, width: img.naturalWidth, src: img.currentSrc || img.src })), layerHidden: document.querySelector('.novel-portraits').hidden, active: document.querySelector('.novel-portraits').dataset.speaker }));
        expect(label + ' has loaded portrait assets', state.images.every(img => img.width > 0), state.images);
        expect(label + ' shows the matching active portrait', state.images.some(img => img.cls.includes('portrait-') && img.cls.includes('is-speaking') && !img.hidden), state);
        return state;
      }
      if (current.choices) break;
      if (current.event) await page.click('#event-next'); else await page.keyboard.press('e');
      await page.waitForTimeout(100);
    }
    expect(label + ' reaches speaker ' + speaker, false, await page.evaluate(() => document.getElementById('novel-speaker').textContent));
    return null;
  }
  try {
    await openUntil('scene-09-b', '体验者', 'scene-09-b 主角');
    await openUntil('scene-17', '聂馆长', 'scene-17 聂馆长');
    await openUntil('scene-29-boss', '梦魇', 'scene-29-boss 梦魇');
    await openUntil('ending-c', '赵灵', 'ending-c 赵灵');
    const mapping = await page.evaluate(() => ({ director: MuseumPortraits.character('聂馆长'), diary: MuseumPortraits.character('馆长的日记本') }));
    expect('聂馆长 maps to the director portrait', mapping.director === 'director', mapping);
    expect('馆长的日记本 does not map to a person portrait', mapping.diary === null, mapping);
    await page.goto('http://127.0.0.1:8810/pages/novel.html?scene=scene-07&preview=1');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    await page.waitForTimeout(500);
    const crowd = await page.evaluate(() => {
      const layer = document.querySelector('.novel-portraits');
      return { className: layer.className, offsets: Array.from(layer.querySelectorAll('.novel-portrait:not([hidden]):not(.portrait-hero)')).map(img => getComputedStyle(img).right) };
    });
    expect('group scene gives listeners distinct horizontal slots', crowd.offsets.length >= 2 && new Set(crowd.offsets).size === crowd.offsets.length, crowd);
    expect('no portrait page errors', errors.length === 0, errors);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? '\n' + failures + ' FAILED' : '\nOK');
  process.exitCode = failures ? 1 : 0;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
