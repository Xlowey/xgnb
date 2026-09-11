/*
 * Regression for the two responsive blockers found by the map audit:
 *  1. clicking the canvas must map to the world point where the object is DRAWN
 *     (this asserts the click inverse, at several viewport shapes, by clicking the
 *     drawn centre of a marker and checking that the game reacts to that marker);
 *  2. the touch D-pad must be reachable (inside the viewport and the hit target).
 * Also asserts no horizontal overflow and that the map box stays 16:9.
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
const SIZES = [[1366, 768], [2560, 1440], [1920, 1200], [1024, 768], [390, 844], [844, 390]];

(async () => {
  await new Promise(r => server.listen(8802, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  try {
    await page.goto('http://127.0.0.1:8802/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('响应式', 'x').user;
      const s = MuseumState.create(u);
      // Stand next to the 食堂展厅 gate, which is gated so a hit is observable as a toast.
      s.roomId = 'hall'; s.playerX = 430; s.playerY = 620; s.mode = 'explore';
      s.flags = Object.assign({}, s.flags, { scene03Seen: true, scene04Seen: true, scene05Seen: true });
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    });

    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('http://127.0.0.1:8802/index.html?fromSave=1');
      await page.waitForTimeout(350);
      if (await page.isVisible('#cover-screen')) { await page.click('#continue-button'); await page.waitForTimeout(300); }
      // The engine shows "已载入所选存档。" for ~2.6 s; wait it out so it cannot be
      // mistaken for the result of our click.
      await page.waitForTimeout(2800);
      // Pick a marker that is actually visible at this stage; a completed or gated
      // object is correctly ignored by the engine and would look like a miss.
      await page.evaluate(() => {
        const s = MuseumState.load(MuseumAuth.getCurrentUser().id);
        const rooms = MuseumMapData.create(); MuseumMapArt(rooms); MuseumChapterMaps(rooms);
        const room = rooms[s.roomId];
        const vis = room.objects.filter(o => MuseumChapterMaps.visible(o, s));
        const target = vis.find(o => o.scene) || vis[0];
        window.__probeTarget = target ? target.id : null;
      });

      const geo = await page.evaluate(() => {
        const c = document.getElementById('explore-canvas'), r = c.getBoundingClientRect();
        return {
          rect: { w: +r.width.toFixed(1), h: +r.height.toFixed(1), left: +r.left.toFixed(1), top: +r.top.toFixed(1) },
          bitmap: { w: c.width, h: c.height },
          ratio: +(r.width / r.height).toFixed(3),
          overlap: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          pad: (() => {
            const p = document.querySelector('.touch-controls button');
            if (!p) return null;
            const q = p.getBoundingClientRect();
            // The D-pad is intentionally display:none on a fine pointer; only a visible
            // pad is required to be reachable.
            const shown = getComputedStyle(p).display !== 'none' && q.height > 0;
            return { shown, top: +q.top.toFixed(0), bottom: +q.bottom.toFixed(0), hit: shown ? document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2) === p : null };
          })()
        };
      });
      const fits = Math.abs(geo.ratio - 16 / 9) < 0.02;
      check(`${w}x${h}: map box stays 16:9 (no cropping)`, fits, geo);
      check(`${w}x${h}: no horizontal overflow`, geo.overlap <= 1, geo.overlap);
      if (geo.pad && geo.pad.shown) {
        check(`${w}x${h}: touch pad is inside the viewport`, geo.pad.bottom <= h && geo.pad.top >= 0, geo.pad);
        check(`${w}x${h}: touch pad is the hit target`, geo.pad.hit === true, geo.pad);
      }

      // Click the marker exactly where it is DRAWN and require the game to react to it.
      // The hall gate 食堂展厅 (430,620) is gated, so a correct hit produces a toast
      // while a wrong hit lands on empty floor and produces nothing.
      const clickPoint = await page.evaluate(() => {
        const c = document.getElementById('explore-canvas'), r = c.getBoundingClientRect();
        // Walk every object center in the current room, convert with the SHIPPING
        // transform (re-derived exactly as game.js:drawRoom does), and return the one
        // whose centre lands inside the canvas box. We then click it and require the
        // game to react to THAT object.
        const s = MuseumState.load(MuseumAuth.getCurrentUser().id);
        const rooms = MuseumMapData.create(); MuseumMapArt(rooms); MuseumChapterMaps(rooms);
        const room = rooms[s.roomId];
        const scale = Math.min(c.width / room.width, c.height / room.height);
        const offsetX = Math.max(0, (c.width - room.width * scale) / 2);
        const offsetY = Math.max(0, (c.height - room.height * scale) / 2);
        const viewW = c.width / scale, viewH = c.height / scale;
        const camX = Math.max(0, Math.min(Math.max(0, room.width - viewW), s.playerX - viewW / 2));
        const camY = Math.max(0, Math.min(Math.max(0, room.height - viewH), s.playerY - viewH / 2));
        const target = room.objects.find(o => o.id === window.__probeTarget) || room.objects[0];
        const bx = offsetX + (target.x - camX) * scale, by = offsetY + (target.y - camY) * scale;
        const sx = bx * (r.width / c.width), sy = by * (r.height / c.height);
        return {
          cssX: r.left + sx, cssY: r.top + sy,
          inBox: sx >= 0 && sx <= r.width && sy >= 0 && sy <= r.height,
          target: target.id, targetLabel: target.label,
          scale: +scale.toFixed(4), cam: { x: +camX.toFixed(1), y: +camY.toFixed(1) }
        };
      });
      await page.mouse.click(clickPoint.cssX, clickPoint.cssY);
      await page.waitForTimeout(400);
      const reacted = await page.evaluate(() => {
        const t = document.getElementById('map-toast');
        const p = document.getElementById('interaction-prompt');
        return { toast: (t && t.classList.contains('visible')) ? t.textContent.trim() : '', prompt: (p && !p.hidden) ? p.textContent.trim() : '' };
      });
      // Either the prompt names the clicked object, or a toast explains its gate.
      // A correct hit identifies the clicked marker: either the nearby-prompt names it,
      // or the engine answers "walk closer to <that marker>", or its gate explains itself.
      const named = reacted.prompt.includes(clickPoint.targetLabel) || reacted.toast.includes(clickPoint.targetLabel);
      const gated = /尚未开放|先完成|没有出现/.test(reacted.toast);
      check(`${w}x${h}: click at the drawn marker position hits that marker`, (named || gated) && clickPoint.inBox, { clickPoint, reacted });
      if (w === 390) await page.screenshot({ path: 'tmp/audit-responsive-fixed-390x844.png' });
      if (w === 1366) await page.screenshot({ path: 'tmp/audit-responsive-fixed-1366x768.png' });
    }
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
