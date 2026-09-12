/*
 * Walk the museum overview in the real browser, WITHOUT the harness artefact that broke the
 * earlier attempt: changing saved state from a page that already hosts game.js lets that
 * page's pagehide save write the OLD state back. So the account is created and seeded in a
 * page that never loads game.js (pages/help.html), then a fresh page opens the game.
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

async function walkTo(page, tx, ty, budgetMs) {
  const started = Date.now();
  let best = 1e9, stall = 0, last = null;
  while (Date.now() - started < budgetMs) {
    const p = await page.evaluate(() => { const s = MuseumState.load(MuseumAuth.getCurrentUser().id); return { x: s.playerX, y: s.playerY }; });
    const d = Math.hypot(p.x - tx, p.y - ty);
    if (d < 20) return { ok: true, at: [Math.round(p.x), Math.round(p.y)], ms: Date.now() - started };
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.4) stall += 1; else stall = 0;
    if (stall > 18) return { ok: false, at: [Math.round(p.x), Math.round(p.y)], stalled: true, best: Math.round(best) };
    last = p; best = Math.min(best, d);
    const dx = tx - p.x, dy = ty - p.y;
    for (const k of [Math.abs(dx) > 8 ? (dx > 0 ? 'd' : 'a') : null, Math.abs(dy) > 8 ? (dy > 0 ? 's' : 'w') : null]) {
      if (!k) continue;
      await page.keyboard.down(k); await page.waitForTimeout(110); await page.keyboard.up(k);
    }
  }
  const p = await page.evaluate(() => { const s = MuseumState.load(MuseumAuth.getCurrentUser().id); return [Math.round(s.playerX), Math.round(s.playerY)]; });
  return { ok: false, at: p, timeout: true };
}

(async () => {
  await new Promise(r => server.listen(8834, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });

  // Seed from a page that loads auth.js + state.js but NOT game.js (pages/saves.html).
  // Seeding from index.html starts game.js, whose pagehide handler then writes the OLD
  // state back when the page closes - that artefact made an earlier walk test look like the
  // player could not move at all.
  const shelter = await ctx.newPage();
  await shelter.goto('http://127.0.0.1:8834/pages/saves.html');
  await shelter.evaluate(() => {
    localStorage.clear();
    const u = MuseumAuth.register('走位', 'x').user;
    const s = MuseumState.create(u);
    s.mode = 'explore'; s.roomId = 'museum'; s.playerX = 615; s.playerY = 610;
    s.flags = Object.assign({}, s.flags, { scene03Seen: true, scene04Seen: true, scene05Seen: true, scene06Seen: true, scene07Seen: true, scene08Seen: true, scene09Seen: true, scene10Seen: true, scene11Seen: true, scene12Seen: true, scene13Seen: true, scene14Seen: true, scene15Seen: true, scene16Seen: true, scene20Seen: true, scene21Seen: true, scene22Seen: true, scene23Seen: true, scene24Seen: true, scene25Seen: true, scene26Seen: true, scene27Seen: true, scene28Seen: true, scene29Seen: true, scene30Seen: true, hasKey: true });
    Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
    MuseumState.save(s, u.id);
  });
  await shelter.close();

  try {
    const targets = [
      ['overview-hall', 615, 465], ['overview-dorm', 320, 330], ['overview-hospital', 335, 240],
      ['overview-class', 650, 250], ['overview-wax', 835, 250], ['overview-canteen', 805, 430],
      ['overview-office', 350, 480], ['overview-silver', 700, 625], ['overview-exit', 610, 642]
    ];
    for (const [id, tx, ty] of targets) {
      const p = await ctx.newPage();
      await p.goto('http://127.0.0.1:8834/index.html?fromSave=1');
      await p.waitForTimeout(500);
      const state = await p.evaluate(() => { const s = MuseumState.load(MuseumAuth.getCurrentUser().id); return { room: s.roomId, x: Math.round(s.playerX), y: Math.round(s.playerY), mode: s.mode }; });
      if (state.room !== 'museum') { check('seed survived for ' + id, false, state); await p.close(); continue; }
      if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
      await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
      await p.waitForTimeout(600);
      const r = await walkTo(p, tx, ty, 12000);
      check('walk to ' + id, r.ok, r);
      await p.close();
    }
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
