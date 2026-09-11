/*
 * Two-tab stale-write race: does a stale map page silently overwrite newer
 * progress written by another tab?  game.js loads `state` once at page load and
 * the frame loop / pagehide handlers write that snapshot back unconditionally.
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
const AUTO = id => 'museum_save_v5_auto_' + encodeURIComponent(id);

(async () => {
  await new Promise(r => server.listen(8801, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  try {
    const a = await ctx.newPage();
    await a.goto('http://127.0.0.1:8801/index.html');
    const uid = await a.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('竞态', 'x').user;
      const s = MuseumState.create(u);
      s.roomId = 'dorm'; s.playerX = 835; s.playerY = 795; s.mode = 'explore';
      s.flags = Object.assign({}, s.flags, { scene03Seen: true, hasKey: true });
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
      return u.id;
    });

    // Tab A: the stale map page.
    await a.goto('http://127.0.0.1:8801/index.html?fromSave=1');
    await a.waitForTimeout(400);

    // Tab B: a second tab that makes real progress (reads the dorm note).
    const tabB = await ctx.newPage();
    await tabB.goto('http://127.0.0.1:8801/index.html?fromSave=1');
    await tabB.waitForTimeout(300);
    if (await tabB.isVisible('#cover-screen')) await tabB.click('#continue-button');
    await tabB.waitForSelector('#game-screen:not([hidden])');
    await tabB.keyboard.press('e');
    await tabB.waitForTimeout(900);
    const afterB = await tabB.evaluate(id => { const r = JSON.parse(localStorage.getItem('museum_save_v5_auto_' + encodeURIComponent(id))); return { mode: r.mode, node: r.narrativeNode }; }, uid);
    console.log('tab B progress:', JSON.stringify(afterB));
    // Either the dorm note or the corridor patrol may start first, depending on seed
    // flags; what matters is that tab B reached a story state.
    check('tab B reached a story state', afterB.mode === 'novel' && !!afterB.node, afterB);
    await tabB.close();

    // Now tab A (stale) is left alone: its 6s autosave tick fires.
    await a.waitForTimeout(7000);
    const afterTick = await a.evaluate(id => { const r = JSON.parse(localStorage.getItem('museum_save_v5_auto_' + encodeURIComponent(id))); return { mode: r.mode, node: r.narrativeNode }; }, uid);
    console.log('store after A idle 7s:', JSON.stringify(afterTick));
    check('a stale tab does NOT overwrite newer progress', afterTick.mode === afterB.mode && afterTick.node === afterB.node, { expected: afterB, staleTabWrote: afterTick });

    // And the pagehide path.
    const before = await a.evaluate(id => JSON.parse(localStorage.getItem('museum_save_v5_auto_' + encodeURIComponent(id))).mode, uid);
    if (before === 'novel') {
      await a.evaluate(id => { const s = MuseumState.load(MuseumAuth.getCurrentUser().id); s.narrativeNode = 'scene-05'; MuseumState.save(s, MuseumAuth.getCurrentUser().id); }, uid);
      await a.goto('http://127.0.0.1:8801/pages/help.html');
      await a.waitForTimeout(600);
      const afterLeave = await a.evaluate(id => { const r = JSON.parse(localStorage.getItem('museum_save_v5_auto_' + encodeURIComponent(id))); return { mode: r.mode, node: r.narrativeNode }; }, uid);
      check('leaving the stale tab does NOT overwrite newer progress', afterLeave.node === 'scene-05', afterLeave);
    }
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
