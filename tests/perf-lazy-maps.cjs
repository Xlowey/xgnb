/*
 * Lazy map loading: only the room being drawn may be requested, and switching rooms
 * through the real in-game interaction loads exactly the new room's map.
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

(async () => {
  await new Promise(r => server.listen(8819, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });

  // Track real bytes per asset path, from response bodies (the static server sends no
  // length header for images when streamed, so measure the body).
  const fetched = new Map();
  const track = page => page.on('response', async r => {
    const u = r.url();
    // 素材已改 WebP：过滤里必须带上 webp，否则所有请求都被丢掉、数字全是 0。'`n    if (!/\/assets\/images\/.+\.(png|jpe?g|webp)$/i.test(u)) return;
    const rel = u.replace(/^.*\/assets\/images\//, '');
    try { const buf = await r.body(); fetched.set(rel, Math.max(fetched.get(rel) || 0, buf.length)); } catch (e) { /* body unavailable */ }
  });
  const mapBytes = () => [...fetched.entries()].filter(([k]) => /^maps\//.test(k)).reduce((n, [, v]) => n + v, 0);
  const mapNames = () => [...fetched.keys()].filter(k => /^maps\//.test(k));

  const openAs = async (room, x, y, flags) => {
    // A FRESH page: an already-open map page writes its stale state back on unload.
    const seed = await ctx.newPage();
    await seed.goto('http://127.0.0.1:8819/index.html');
    await seed.evaluate(({ room, x, y, flags }) => {
      localStorage.clear();
      const u = MuseumAuth.register('懒载', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore'; s.roomId = room; s.playerX = x; s.playerY = y;
      s.flags = Object.assign({}, s.flags, { scene03Seen: true, scene04Seen: true, hasKey: true }, flags || {});
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    }, { room, x, y, flags });
    await seed.close();
    const p = await ctx.newPage();
    track(p);
    await p.goto('http://127.0.0.1:8819/index.html?fromSave=1');
    await p.waitForTimeout(400);
    if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
    await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await p.waitForTimeout(1500);
    return p;
  };

  try {
    // ---- the dorm screen pulls only the dorm map -------------------------
    // Stand on the dorm door (835,860, r82) so pressing E walks into the corridor.
    let page = await openAs('dorm', 835, 795);
    console.log('dorm screen fetched:', mapNames().join(', ') || '(none)');
    // Two maps are expected, and no more: the current room, plus the overview that the
    // 导览 minimap paints as its background (see perf-guide-background.cjs).
    const roomMaps = mapNames().filter(n => /rooms\//.test(n));
    check('only the current room map is requested from rooms/', roomMaps.length === 1 && /dorm-map/.test(roomMaps[0]), mapNames());
    check('the only other map is the overview the guide needs', mapNames().filter(n => /world\//.test(n)).length <= 1, mapNames());
    check('map payload is far below the eager 14.5 MB', mapBytes() > 0 && mapBytes() < 4200 * 1024, { kb: KB(mapBytes()) });
    const state = await page.evaluate(() => {
      // Inspect the LIVE room data the game itself built, not a fresh copy.
      const out = [];
      document.querySelectorAll('canvas').length;
      return out;
    });
    // The wardrobe/walk sheets still load (they are needed immediately).
    check('the character sheets still load', [...fetched.keys()].some(k => /hero-walk-cycle/.test(k)), [...fetched.keys()]);

    // ---- switching rooms loads that room's map, once ---------------------
    fetched.clear();
    // From the dorm door: pressing E walks into the corridor.
    await page.keyboard.press('e');
    await page.waitForTimeout(1800);
    const afterDoor = await page.evaluate(() => (MuseumState.load(MuseumAuth.getCurrentUser().id) || {}).roomId);
    console.log('after the dorm door:', afterDoor, '| fetched:', mapNames().join(', ') || '(none)');
    if (afterDoor === 'corridor') {
      // Asset names are Chinese; compare decoded so the assertion is readable.
      const decoded = mapNames().map(n => { try { return decodeURIComponent(n); } catch (e) { return n; } });
      check('entering the corridor loads the corridor map', decoded.some(k => /走廊示意图1/.test(k)), decoded);
    } else {
      check('the dorm door still works (reached the corridor)', false, { afterDoor });
    }
    const mapReqs = mapNames();
    check('no map is requested twice in one room entry', mapReqs.length === new Set(mapReqs).size, mapReqs);

    // ---- the map is actually painted (not blank) ------------------------
    const painted = await page.evaluate(() => {
      const c = document.getElementById('explore-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let varied = 0;
      for (let i = 0; i < d.length; i += 4 * 211) if (Math.abs(d[i] - d[i + 2]) > 10) varied += 1;
      return varied;
    });
    check('the room map is painted, not blank', painted > 40, { samples: painted });
    await page.close();
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
