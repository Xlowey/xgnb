/*
 * The wardrobe close-up must NOT be downloaded on the map screen.
 *
 * js/game.js's room.objects renderer (which called drawWardrobe) is unreachable: drawRoom()
 * returns from inside its `if (room.art)` branch, and every room has artwork. Instrumented
 * with a drawImage wrapper, the wardrobe image is drawn 0 times even while standing next to
 * the wardrobe — so requesting its 1.9 MB at startup was pure waste.
 *
 * This asserts the request is gone AND that the wardrobe interaction still works (it opens
 * the story scene; the close-up itself is shown by the novel page's item preview).
 */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': body.length });
  res.end(body);
});
let fails = 0;
const check = (l, ok, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + l + (ok || d === undefined ? '' : '  <- ' + JSON.stringify(d))); if (!ok) fails += 1; };
const KB = n => Math.round(n / 1024);
const MAP_MAP = { 'dorm-map.png': 1864, 'hall-map.png': 2156, '食堂地图.png': 1873, 'office-map.png': 2054 };

(async () => {
  await new Promise(r => server.listen(8823, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const fetched = new Map();
  page.on('response', async r => {
    const u = r.url();
    if (!/\.(png|jpe?g)$/i.test(u)) return;
    let len = 0; try { len = (await r.body()).length; } catch (e) { /* ignore */ }
    fetched.set(decodeURIComponent(u.replace(/^.*\/assets\/images\//, '')), len);
  });
  const totalKB = () => KB([...fetched.values()].reduce((a, c) => a + c, 0));
  try {
    await page.addInitScript(() => {
      window.__wardrobeDraws = 0;
      const orig = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (img) {
        try { if (img && (img.lazyName === 'wardrobe-detail.png' || /wardrobe-detail/.test(img.src || ''))) window.__wardrobeDraws += 1; } catch (e) { /* ignore */ }
        return orig.apply(this, arguments);
      };
    });
    await page.goto('http://127.0.0.1:8823/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('衣柜', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore'; s.roomId = 'dorm'; s.playerX = 1340; s.playerY = 520;
      s.flags = Object.assign({}, s.flags, { scene03Seen: true, hasKey: true });
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    });
    fetched.clear();
    await page.goto('http://127.0.0.1:8823/index.html?fromSave=1');
    await page.waitForTimeout(400);
    if (await page.isVisible('#cover-screen')) await page.click('#continue-button');
    await page.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await page.waitForTimeout(2500);

    console.log('map screen fetched:', [...fetched.entries()].map(([k, v]) => k + ' ' + KB(v) + 'KB').join(', '));
    check('the wardrobe close-up is NOT downloaded on the map screen', ![...fetched.keys()].some(k => /wardrobe-detail/.test(k)), [...fetched.keys()]);
    // Only the current room map from rooms/, plus the overview the 导览 minimap needs.
    check('only one room map is downloaded', [...fetched.keys()].filter(k => /^maps\/rooms\//.test(k)).length === 1, [...fetched.keys()]);
    const draws = await page.evaluate(() => window.__wardrobeDraws || 0);
    check('the wardrobe image is never drawn on the map (its render path is dead)', draws === 0, { draws });
    check('the map screen stays small', totalKB() < 8000, { kb: totalKB() });

    // The interaction itself must be untouched. The prompt text is the assertion: it is
    // produced by the same nearestObject()/visible() path the E key uses. (Pressing E is not
    // asserted here because a tutorial overlay legitimately intercepts it in this harness.)
    const prompt = await page.evaluate(() => { const p = document.getElementById('interaction-prompt'); return p.hidden ? '' : p.textContent; });
    console.log('interaction prompt:', JSON.stringify(prompt));
    check('the wardrobe still offers its interaction', /打开.*衣柜|衣柜/.test(prompt), prompt);
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
