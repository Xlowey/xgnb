/*
 * Verifies the five reported bugs together:
 *  1. the map canvas fills the viewport (buffer == box) so the map never renders shrunk;
 *  2. the guide/minimap is hidden on the 馆内总览 page and present in other rooms;
 *  3. the hospital investigation plays its recording when the TV hotspot is clicked;
 *  4. the corridor's reachable feet region matches the painted floor.
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

const SHAPES = [[2560, 1380], [1366, 768], [3440, 1440], [1024, 768], [390, 844]];

(async () => {
  await new Promise(r => server.listen(8816, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  try {
    await page.goto('http://127.0.0.1:8816/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('复核', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore'; s.roomId = 'corridor'; s.playerX = 1300; s.playerY = 420;
      s.flags = Object.assign({}, s.flags, { scene03Seen: true, scene04Seen: true, hasKey: true });
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    });

    // 1. canvas geometry at every window shape
    for (const [w, h] of SHAPES) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('http://127.0.0.1:8816/index.html?fromSave=1');
      await page.waitForTimeout(400);
      if (await page.isVisible('#cover-screen')) await page.click('#continue-button');
      await page.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
      await page.waitForTimeout(700);
      const g = await page.evaluate(() => {
        const c = document.getElementById('explore-canvas'), r = c.getBoundingClientRect();
        return { buf: c.width + 'x' + c.height, box: Math.round(r.width) + 'x' + Math.round(r.height), fill: getComputedStyle(c).objectFit, inner: innerWidth + 'x' + innerHeight, dpr: devicePixelRatio };
      });
      const boxOk = g.box === g.inner;
      const [bw, bh] = g.buf.split('x').map(Number), [xw, xh] = g.box.split('x').map(Number);
      const bufOk = Math.abs(bw - xw * g.dpr) <= 2 && Math.abs(bh - xh * g.dpr) <= 2;
      check(`${w}x${h}: the map fills the viewport (box == window)`, boxOk, g);
      check(`${w}x${h}: the drawing buffer matches the box x DPR (clicks exact)`, bufOk, g);
      if (w === 2560) await page.screenshot({ path: 'tmp/audit-fix-2560x1380.png' });
      if (w === 390) await page.screenshot({ path: 'tmp/audit-fix-390x844.png' });
    }

    // 2. the guide panel: hidden on the overview, shown elsewhere
    await page.setViewportSize({ width: 1366, height: 768 });
    for (const [room, expectShown] of [['corridor', true], ['museum', false]]) {
      await page.goto('http://127.0.0.1:8816/index.html?fromSave=1');
      await page.waitForTimeout(300);
      await page.evaluate(r => { const u = MuseumAuth.getCurrentUser().id; const s = MuseumState.load(u); s.roomId = r; s.playerX = 1300; s.playerY = 420; MuseumState.save(s, u); }, room);
      const fresh = await ctx.newPage();
      await fresh.goto('http://127.0.0.1:8816/index.html?fromSave=1');
      await fresh.waitForTimeout(400);
      if (await fresh.isVisible('#cover-screen')) await fresh.click('#continue-button');
      await fresh.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
      await fresh.waitForTimeout(700);
      const shown = await fresh.evaluate(() => { const g = document.querySelector('.map-guide'); return !!g && getComputedStyle(g).display !== 'none'; });
      check(`提示面板在 ${room} 房间${expectShown ? '显示' : '隐藏'}`, shown === expectShown, { room, shown });
      if (room === 'museum') await fresh.screenshot({ path: 'tmp/audit-fix-museum.png' });
      await fresh.close();
    }

    // 3. the hospital investigation plays the recording
    const fresh = await ctx.newPage();
    fresh.on('pageerror', e => console.log('        [pageerror]', e.message));
    await fresh.goto('http://127.0.0.1:8816/pages/novel.html?scene=scene-05');
    await fresh.waitForSelector('#novel-progress', { state: 'attached' });
    await fresh.waitForTimeout(700);
    const btn = fresh.locator('.hotspot-investigation > button[data-hotspot="tv"]');
    check('the TV hotspot is present', await btn.count() > 0);
    const beforeText = await fresh.evaluate(() => document.querySelector('.investigation-feedback') ? document.querySelector('.investigation-feedback').textContent : null);
    await btn.click();
    await fresh.waitForTimeout(600);
    const after = await fresh.evaluate(() => ({
      recording: !!document.getElementById('recording'),
      feedback: document.querySelector('.investigation-feedback') ? document.querySelector('.investigation-feedback').textContent : null,
      progress: document.querySelector('.investigation-progress') ? document.querySelector('.investigation-progress').textContent : null,
      buttonLabel: (document.querySelector('.hotspot-investigation > button[data-hotspot="tv"]') || {}).textContent
    }));
    check('clicking the TV hotspot plays the recording', after.recording === true, after);
    check('the hotspot shows its own description as feedback', /录像|亮/.test(after.feedback || '') && after.feedback !== beforeText, after);
    check('progress text is separate from the description', /已调查/.test(after.progress || ''), after);
    await fresh.keyboard.press('Escape');
    await fresh.waitForTimeout(300);
    await fresh.screenshot({ path: 'tmp/audit-fix-investigation.png' });
    await fresh.close();

    // 4. corridor feet region vs the painted floor
    const feet = await page.evaluate(() => {
      const rooms = MuseumMapData.create(); MuseumMapArt(rooms); MuseumChapterMaps(rooms);
      const room = rooms.corridor;
      const inside = (x, y) => room.walkable.some(a => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h);
      const blocked = (x, y) => {
        const rad = 22;
        if (x < rad || y < rad || x > room.width - rad || y > room.height - rad) return true;
        if (![[x - rad, y], [x + rad, y], [x, y - rad], [x, y + rad]].every(p => inside(p[0], p[1]))) return true;
        return (room.colliders || []).some(r => x + rad > r.x && x - rad < r.x + r.w && y + rad > r.y && y - rad < r.y + r.h);
      };
      let minY = 1e9, maxY = -1e9;
      for (let x = 0; x < room.width; x += 6) for (let y = 0; y < room.height; y += 6) if (!blocked(x, y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      return { minY, maxY };
    });
    check('corridor feet reach the painted floor band (y 337..565)', feet.maxY >= 560 && feet.maxY <= 640, feet);
    check('corridor feet no longer float above the wall (minY >= ~220)', feet.minY >= 210, feet);
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
