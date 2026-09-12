/*
 * The 导览 minimap draws the OVERVIEW map as its background while the player stands in any
 * other room. With lazy loading, drawRoom() only called load() for the CURRENT room, so the
 * overview art was never requested and the panel silently lost its map background (the
 * labels and dots still drew, which is why a casual look did not catch it).
 *
 * This asserts the overview art is actually painted into the minimap canvas from a
 * non-overview room, by counting distinct colours: a flat fallback fill yields ~36, the
 * real map yields hundreds.
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

(async () => {
  await new Promise(r => server.listen(8825, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });

  const openIn = async room => {
    const seed = await ctx.newPage();
    await seed.goto('http://127.0.0.1:8825/index.html');
    await seed.evaluate(r => {
      localStorage.clear();
      const u = MuseumAuth.register('导览', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore'; s.roomId = r; s.playerX = 400; s.playerY = 400;
      s.flags = Object.assign({}, s.flags, { scene03Seen: true, scene04Seen: true, hasKey: true });
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    }, room);
    await seed.close();
    const p = await ctx.newPage();
    const reqs = [];
    p.on('response', r => { const u = r.url(); if (/\.(png|jpe?g)$/i.test(u)) reqs.push(decodeURIComponent(u.replace(/^.*\/assets\/images\//, ''))); });
    await p.goto('http://127.0.0.1:8825/index.html?fromSave=1');
    await p.waitForTimeout(400);
    if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
    await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await p.waitForTimeout(2200);
    return { page: p, reqs };
  };

  try {
    // Any room where the guide is visible needs the overview art behind it.
    for (const room of ['dorm', 'hall', 'corridor', 'office']) {
      const { page, reqs } = await openIn(room);
      const state = await page.evaluate(() => {
        const g = document.querySelector('.map-guide');
        const guideVisible = !!g && getComputedStyle(g).display !== 'none';
        const c = document.getElementById('mini-map');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4 * 97) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
        return { guideVisible, colours: seen.size };
      });
      if (state.guideVisible) {
        check(`${room}: the overview art is requested for the guide`, reqs.some(r => /museum-overview-map/.test(r)), reqs);
        check(`${room}: the guide actually paints the overview art`, state.colours > 150, state);
      } else {
        check(`${room}: guide hidden, so no overview art needed`, !reqs.some(r => /museum-overview-map/.test(r)), reqs);
      }
      await page.close();
    }

    // And in the overview itself the guide is hidden, so its art is only needed as the room map.
    const { page, reqs } = await openIn('museum');
    const inMuseum = await page.evaluate(() => { const g = document.querySelector('.map-guide'); return !!g && getComputedStyle(g).display !== 'none'; });
    // The guide is shown on the overview too (the player expects a minimap in every room).
    // There it is ALSO the current room's map, so it must still be requested exactly once.
    check('the guide is also shown on the overview page', inMuseum === true, { guideVisible: inMuseum });
    check('the overview map is loaded there', reqs.some(r => /museum-overview-map/.test(r)), reqs);
    check('the overview map is requested exactly once', reqs.filter(r => /museum-overview-map/.test(r)).length === 1, reqs);
    await page.close();
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
