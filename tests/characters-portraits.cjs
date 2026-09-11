/*
 * Do the new character portraits actually render on stage, and does the layout hold
 * when a scene has several speaking characters?
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
  await new Promise(r => server.listen(8809, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const missing = [];
  page.on('response', r => { if (r.status() >= 400) missing.push(r.status() + ' ' + r.url()); });
  try {
    await page.goto('http://127.0.0.1:8809/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('立绘', 'x').user;
      const s = MuseumState.create(u);
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    });

    // The speaker->portrait mapping must cover the new cast.
    await page.goto('http://127.0.0.1:8809/pages/novel.html?scene=scene-07');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    await page.waitForTimeout(400);
    const map = await page.evaluate(() => {
      const c = window.MuseumPortraits.character;
      return { '纸人': c('纸人'), '小女孩': c('小女孩'), '梦魇': c('梦魇'), '保安': c('保安'), '赵灵': c('赵灵'), '馆长': c('馆长'), '主角': c('主角'), '旁白': c('旁白') };
    });
    check('new cast maps to its own portraits', map['纸人'] === 'paperman' && map['小女孩'] === 'girl' && map['梦魇'] === 'nightmare' && map['保安'] === 'maskedguard', map);
    check('existing cast still maps correctly', map['赵灵'] === 'zhaoling' && map['馆长'] === 'director' && map['主角'] === 'hero' && map['旁白'] === null, map);

    // All five new files must load without a 404.
    const loaded = await page.evaluate(async () => {
      const names = ['paper-man-portrait.png', 'masked-girl-portrait.png', 'masked-guard-portrait.png', 'nightmare-portrait.png', 'zhaoling-walk-cycle.png'];
      const out = {};
      for (const n of names) {
        out[n] = await new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth + 'x' + i.naturalHeight); i.onerror = () => res('ERROR'); i.src = MuseumAssets.url(n, 'characters'); });
      }
      return out;
    });
    console.log('loaded:', JSON.stringify(loaded));
    check('all five new assets load from the runtime path', Object.values(loaded).every(v => v !== 'ERROR'), loaded);

    // Drive a scene that actually has the new speakers and confirm the layer shows them.
    for (const [scene, expectId] of [['scene-22', 'nightmare'], ['scene-10', 'girl'], ['scene-07', 'paperman']]) {
      await page.goto('http://127.0.0.1:8809/pages/novel.html?scene=' + scene);
      await page.waitForSelector('#novel-progress', { state: 'attached' });
      await page.waitForTimeout(300);
      let shown = null;
      for (let i = 0; i < 24; i += 1) {
        shown = await page.evaluate(id => {
          const img = document.querySelector('.portrait-' + id);
          if (!img || img.hidden) return null;
          const r = img.getBoundingClientRect();
          return { speaker: document.getElementById('novel-speaker').textContent, w: Math.round(r.width), h: Math.round(r.height), natural: img.naturalWidth };
        }, expectId);
        if (shown && shown.w > 0) break;
        const ev = await page.evaluate(() => !document.getElementById('event-next').hidden);
        if (ev) await page.click('#event-next'); else await page.keyboard.press('e');
        await page.waitForTimeout(220);
      }
      check(`${scene}: the ${expectId} portrait appears while it speaks`, !!shown && shown.w > 0 && shown.natural > 0, shown);
    }

    // No portrait may overlap the hero on a narrow screen.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:8809/pages/novel.html?scene=scene-22');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    for (let i = 0; i < 24; i += 1) {
      const s = await page.evaluate(() => { const n = document.querySelector('.portrait-nightmare'); return n && !n.hidden ? 1 : 0; });
      if (s) break;
      const ev = await page.evaluate(() => !document.getElementById('event-next').hidden);
      if (ev) await page.click('#event-next'); else await page.keyboard.press('e');
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: 'tmp/audit-portraits-new-390x844.png' });
    const overlap = await page.evaluate(() => {
      const rects = Array.from(document.querySelectorAll('.novel-portrait')).filter(i => !i.hidden).map(i => ({ id: i.className, r: i.getBoundingClientRect() }));
      let worst = 0;
      for (let i = 0; i < rects.length; i += 1) for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i].r, c = rects[j].r;
        const ox = Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left));
        worst = Math.max(worst, ox);
      }
      return { count: rects.length, worstOverlapPx: Math.round(worst) };
    });
    check('portraits do not overlap each other on a phone', overlap.worstOverlapPx < 20, overlap);

    check('no missing asset while the new portraits are used', missing.filter(m => !/favicon/.test(m)).length === 0, [...new Set(missing)].slice(0, 6));
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
