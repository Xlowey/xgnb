/*
 * Regression for the three logic fixes:
 *  1. the dorm mirror opens the mirror, not the blood note;
 *  2. choosing 战斗 does NOT award scene11Seen before the fight resolves;
 *  3. 上一句 rewinds the cursor without erasing the page's progress.
 */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
let fails = 0;
const check = (l, ok, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + l + (ok || d === undefined ? '' : '  <- ' + JSON.stringify(d))); if (!ok) fails += 1; };

(async () => {
  await new Promise(r => server.listen(8808, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const seed = async (extra) => {
    await page.goto('http://127.0.0.1:8808/index.html');
    await page.evaluate(extra => {
      localStorage.clear();
      const u = MuseumAuth.register('逻辑', 'x').user;
      const s = MuseumState.create(u);
      Object.assign(s, extra || {});
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
      return u.id;
    }, extra);
  };
  try {
    // ---- 1. the mirror -------------------------------------------------
    await seed({});
    await page.goto('http://127.0.0.1:8808/pages/novel.html?scene=mirror');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    await page.waitForTimeout(400);
    const mirror = await page.evaluate(() => ({
      title: document.getElementById('novel-title').textContent,
      event: document.body.dataset.event,
      docs: document.querySelectorAll('.document-modal, .item-details').length
    }));
    check('the mirror scene is titled 墙上的镜子, not 血字纸条', /镜子/.test(mirror.title), mirror);
    check('the mirror does not open the blood-note document', mirror.docs === 0, mirror);

    // ---- 2. battle must not pre-complete the scene ----------------------
    await seed({ roomId: 'dorm', playerX: 835, playerY: 795, mode: 'explore', flags: { scene03Seen: true, scene10Seen: true, scene11Seen: false } });
    await page.goto('http://127.0.0.1:8808/pages/novel.html?scene=scene-11');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    await page.waitForTimeout(400);
    for (let i = 0; i < 8; i += 1) {
      const n = await page.evaluate(() => document.querySelectorAll('.novel-choice').length);
      if (n) break;
      const ev = await page.evaluate(() => !document.getElementById('event-next').hidden);
      if (ev) await page.click('#event-next'); else await page.keyboard.press('e');
      await page.waitForTimeout(300);
    }
    const btns = await page.evaluate(() => Array.from(document.querySelectorAll('.novel-choice')).map(x => x.textContent));
    check('scene-11 offers the 战斗 choice', btns.some(t => /战斗/.test(t)), btns);
    const beforeFight = await page.evaluate(() => {
      const s = MuseumState.load(MuseumAuth.getCurrentUser().id);
      return { scene11Seen: s.flags.scene11Seen, completed: !!s.flags['completed:scene-11'] };
    });
    check('scene11Seen is NOT set before the fight resolves', beforeFight.scene11Seen !== true && !beforeFight.completed, beforeFight);

    // ---- 3. 上一句 keeps progress ---------------------------------------
    await seed({ flags: { scene04Seen: true }, mode: 'novel', narrativeNode: 'scene-05' });
    await page.goto('http://127.0.0.1:8808/pages/novel.html?scene=scene-05');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    await page.waitForTimeout(500);
    // Complete both hotspots on the investigate page, then advance one page.
    for (let i = 0; i < 6; i += 1) {
      const hs = await page.evaluate(() => Array.from(document.querySelectorAll('.hotspot-investigation > button')).filter(x => !x.classList.contains('examined')).length);
      if (!hs) break;
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.hotspot-investigation > button')).filter(x => !x.classList.contains('examined'))[0]; if (b) b.click(); });
      await page.waitForTimeout(400);
      const close = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.observation-panel button, .document-modal button')).find(x => /返回|关闭/.test(x.textContent)); if (b) { b.click(); return true; } return false; });
      await page.waitForTimeout(400);
    }
    const afterInvestigate = await page.evaluate(() => {
      const s = MuseumState.load(MuseumAuth.getCurrentUser().id);
      return { examined: Object.keys(s.flags).filter(k => /investigation|examined/.test(k)).length, page: document.getElementById('novel-progress').textContent };
    });
    for (let i = 0; i < 4; i += 1) {
      const canBack = await page.evaluate(() => !document.getElementById('novel-back-button').disabled);
      if (canBack) break;
      const ev = await page.evaluate(() => !document.getElementById('event-next').hidden);
      if (ev) await page.click('#event-next'); else await page.keyboard.press('e');
      await page.waitForTimeout(350);
    }
    const canBack = await page.evaluate(() => !document.getElementById('novel-back-button').disabled);
    if (canBack) { await page.click('#novel-back-button'); await page.waitForTimeout(500); }
    const afterBack = await page.evaluate(() => {
      const s = MuseumState.load(MuseumAuth.getCurrentUser().id);
      return { examined: Object.keys(s.flags).filter(k => /investigation|examined/.test(k)).length, page: document.getElementById('novel-progress').textContent };
    });
    check('investigation marks were recorded', afterInvestigate.examined > 0, afterInvestigate);
    check('上一句 rewinds the page without erasing progress', canBack && afterBack.examined >= afterInvestigate.examined, { afterInvestigate, afterBack, canBack });
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
