/*
 * Browser regression for the map <-> story round trip.
 *
 * The project intentionally ships without a package.json or node_modules, so
 * Playwright is resolved from an explicit candidate list and the script starts its
 * own static server.  Override with:
 *
 *   PLAYWRIGHT_MODULE=<path to playwright>  CHROME_PATH=<exe>  PORT=<port>
 *
 *   node tests/world-flow-browser.cjs
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find(p => fs.existsSync(p));

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),
    'playwright',
    'playwright-core'
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) { /* try the next candidate */ }
  }
  throw new Error('Playwright not found. Set PLAYWRIGHT_MODULE to a playwright install.');
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

let failures = 0;
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : '  <- ' + JSON.stringify(detail)));
  if (!ok) failures += 1;
}

// A dev server for this project is often already running on the default port, so
// take the first free one instead of failing the whole run.
function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = err => { server.removeListener('listening', onOk); err.code === 'EADDRINUSE' ? resolve(listen(port + 1)) : reject(err); };
    const onOk = () => { server.removeListener('error', onError); resolve(port); };
    server.once('error', onError); server.once('listening', onOk);
    server.listen(port, '127.0.0.1');
  });
}

(async () => {
  const { chromium } = loadPlaywright();
  const port = await listen(Number(process.env.PORT || 8765));
  const base = 'http://127.0.0.1:' + port;
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  // One context for the whole run: every page shares the account storage the game
  // expects, while each assertion still starts from its own clean seed.
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const pageErrors = [];
  const consoleErrors = [];
  const missing = [];
  let page = null;

  try {
    async function open(url) {
      if (page) { await page.close(); }
      page = await context.newPage();
      page.on('pageerror', e => pageErrors.push('uncaught: ' + String(e && e.message || e)));
      // Console noise is tracked separately: a failed subresource logs an error but
      // is not an uncaught exception, and the real cause is asserted through `missing`.
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      cdp.on('Network.responseReceived', p => { if (p.response && p.response.status >= 400) missing.push(p.response.status + ' ' + p.response.url + ' while at ' + page.url()); });
      await page.goto(url);
      await page.waitForLoadState('load');
      return page;
    }

    // Seed an isolated account, then open the map the way a returning player does.
    // mode "explore" makes game.js render the map directly; a story mode would make
    // ?fromSave=1 redirect into pages/novel.html instead.
    async function seed(room, x, y, flags, extra) {
      await open(base + '/index.html');
      await page.evaluate(({ room, x, y, flags, extra }) => {
        localStorage.clear();
        const u = MuseumAuth.register('回归', 'x').user;
        const s = MuseumState.create(u);
        s.roomId = room; s.playerX = x; s.playerY = y;
        s.mode = 'explore'; s.narrativeNode = null; s.narrativeIndex = 0;
        s.returnRoom = null; s.returnX = null; s.returnY = null;
        s.flags = Object.assign({}, s.flags, flags);
        delete s.flags.narrativeTextRevision;
        Object.assign(s, extra || {});
        Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
        MuseumState.save(s, u.id);
      }, { room, x, y, flags, extra });
      await page.goto(base + '/index.html?fromSave=1');
      await page.waitForTimeout(250);
    }

    const state = () => page.evaluate(() => MuseumState.load(MuseumAuth.getCurrentUser().id));
    const enterGame = async () => {
      if (await page.isVisible('#cover-screen')) { await page.click('#continue-button'); }
      await page.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
      await page.waitForTimeout(300);
    };
    const press = async k => { await page.keyboard.press(k); await page.waitForTimeout(250); };

    // 1. Reading the note must leave the player in the dorm with the museum and hall
    //    still locked: walking out of the dorm door is the actual progression step.
    await seed('dorm', 835, 795, { scene03Seen: true, hasKey: true });
    await enterGame();
    let s = await state();
    check('start enters the dorm map', s.roomId === 'dorm' && await page.isVisible('#game-screen'), s.roomId);
    check('the startup save stays in the dorm', s.returnRoom !== 'museum', s.returnRoom);
    check('the hall is not unlocked by reading the note', s.unlockedRooms.indexOf('hall') === -1, s.unlockedRooms);

    // 2. The dorm door is the only exit. Walking out must NOT auto-play scene-04 any more:
    //    that scene is 赵灵 introducing herself, so it starts by talking to her in the
    //    corridor (the npc object). See tests/corridor-npc.cjs.
    await press('e');
    s = await state();
    check('the dorm door walks into the corridor', s.roomId === 'corridor', s.roomId);
    check('leaving the dorm does not auto-play scene-04', s.narrativeNode !== 'scene-04' && s.mode === 'explore', { node: s.narrativeNode, mode: s.mode });

    // 3. The overview -> corridor -> dorm -> corridor round trip, through real pages.
    // Seed on a confirmed standing spot inside the overview dorm gate's radius (the
    // reachability test prints these); (320,330) is on the walkable band's edge and is
    // blocked, so the prompt never appears there.
    await seed('museum', 345, 352, { scene03Seen: true, scene04Seen: true, hasKey: true });
    await enterGame();
    await press('e'); check('the overview dorm gate walks into the corridor', (await state()).roomId === 'corridor', (await state()).roomId);
    await press('e'); check('the corridor gate walks into the dorm', (await state()).roomId === 'dorm', (await state()).roomId);
    await press('e'); check('the dorm door walks back out to the corridor', (await state()).roomId === 'corridor', (await state()).roomId);

    // 4. Hidden future markers must not be interactive.
    await seed('dorm', 420, 740, { scene05Seen: true });
    await enterGame();
    check('a future plot marker shows no prompt', await page.locator('#interaction-prompt').isHidden());
    await press('e');
    check('a future plot marker cannot start a scene', (await state()).roomId === 'dorm');

    // 5. An active scene must beat the repeat inspection at the same spot.
    await seed('dorm', 1370, 475, { scene24Seen: true, hasKey: true });
    await enterGame();
    await press('e');
    check('the uniform story wins over the repeat wardrobe', /scene=scene-25/.test(page.url()), page.url());

    // 6. Recorded inspections must not replay the prologue.
    await seed('dorm', 285, 805, { scene03Seen: true, hasKey: true, readNote: true });
    await enterGame();
    await press('e');
    check('re-reading the note opens the recorded note', /scene=note-repeat/.test(page.url()), page.url());
    const repeatTypes = await page.evaluate(() => MuseumStory.scenes['note-repeat'].events.map(e => e.type).join(','));
    check('the recorded note has no prologue pages', repeatTypes === 'document,document', repeatTypes);

    // 7. Ending the recorded note returns to the recorded position, not the overview.
    await seed('dorm', 610, 470, { scene03Seen: true, hasKey: true, readNote: true });
    await enterGame();
    const before = await state();
    await page.evaluate(() => { const u = MuseumAuth.getCurrentUser().id, s = MuseumState.load(u); MuseumTransition.enterStory(s, 'note-repeat'); MuseumState.save(s, u); });
    await page.goto(base + '/pages/novel.html?scene=note-repeat');
    await page.evaluate(() => { const u = MuseumAuth.getCurrentUser().id, s = MuseumState.load(u); MuseumTransition.leaveStory(s); MuseumState.save(s, u); });
    await page.goto(base + '/index.html?fromStory=1');
    s = await state();
    check('finishing the recorded note returns to the dorm spot', s.roomId === 'dorm' && s.playerX === before.playerX && s.playerY === before.playerY, { room: s.roomId, x: s.playerX, y: s.playerY, before: { x: before.playerX, y: before.playerY } });

    // 8. The regression that matters most: finishing scene-03 in the real story page
    //    must keep the return point inside the dorm.  It used to be rewritten to the
    //    museum overview, which teleported the player past the corridor.
    await seed('dorm', 660, 470, { scene01Seen: true, scene02Seen: true, hasKey: true, cabinetOpen: true, cabinetKeyTaken: true }, { returnRoom: 'dorm', returnX: 660, returnY: 470, prologueVideoPlaying: false });
    await page.evaluate(() => { const u = MuseumAuth.getCurrentUser().id, s = MuseumState.load(u); MuseumTransition.enterStory(s, 'scene-03'); MuseumState.save(s, u); });
    await open(base + '/pages/novel.html?scene=scene-03');
    await page.waitForSelector('#novel-progress', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(400);
    // Record what the story page persists on every save, then stash the trace in
    // localStorage so it survives the navigation back to the map.
    await page.evaluate(() => {
      window.__trace = [];
      const original = MuseumState.save;
      MuseumState.save = function (st, id) {
        const result = original.apply(this, arguments);
        if (result) window.__trace.push(st.returnRoom + '|' + st.unlockedRooms.join('+') + '|' + st.roomId);
        try { localStorage.setItem('__trace', JSON.stringify(window.__trace)); } catch (error) { /* ignore */ }
        return result;
      };
    });
    // Read and act in one evaluation so a re-render cannot invalidate the choice.
    const dump = [];
    for (let i = 0; i < 40; i += 1) {
      if (!/novel\.html/.test(page.url())) break;
      const step = await page.evaluate(() => {
        const el = id => document.getElementById(id);
        const shown = node => Boolean(node && !node.hidden);
        const play = Array.from(document.querySelectorAll('.novel-stage button')).find(b => /播放录像/.test(b.textContent) && b.offsetParent !== null);
        const info = {
          end: shown(el('novel-end')),
          page: el('novel-progress').textContent,
          event: document.body.dataset.event,
          action: play ? 'play' : shown(el('event-next')) ? 'event' : shown(el('novel-dialogue')) ? 'dialogue' : 'stuck'
        };
        if (info.action === 'play') play.click();
        return info;
      });
      dump.push(i + ':' + JSON.stringify(step));
      await page.waitForTimeout(170);
      if (step.end) break;
      if (step.action === 'event') await page.click('#event-next');
      else if (step.action === 'dialogue') await page.keyboard.press('e');
      else if (step.action === 'stuck') break;
      await page.waitForTimeout(170);
    }
    s = await state();
    const seenFlag = await page.evaluate(() => {
      const raw = localStorage.getItem('museum_save_v5_auto_' + encodeURIComponent(MuseumAuth.getCurrentUser().id));
      return Boolean(raw && raw.indexOf('scene03Seen') !== -1);
    });
    check('scene-03 records its own completion', s.flags.scene03Seen === true || seenFlag, { seen: s.flags.scene03Seen, stored: seenFlag, tail: dump.slice(-3) });
    const trace = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('__trace') || 'null'); } catch (error) { return null; } }) || [];
    // Each row is returnRoom|unlockedRooms|roomId for a save the story page made.
    // leaveStory clears the return point by design, so the trace is where the
    // invariant "the return point stayed in the dorm" is actually observable.
    const returnPoints = trace.map(row => String(row).split('|')[0]);
    check('every save during scene-03 kept the return point in the dorm', returnPoints.length > 0 && returnPoints.every(r => r === 'dorm' || r === 'null'), { trace, tail: dump.slice(-3) });
    check('the last story save before returning still pointed at the dorm', returnPoints.length > 1 && returnPoints[returnPoints.length - 2] === 'dorm', trace);
    check('scene-03 does not unlock the museum or the hall', trace.every(row => String(row).split('|')[1] === 'dorm'), { trace, rooms: s.unlockedRooms });
    check('scene-03 ends without chaining into scene-04', !s.flags.scene04Seen, { seen: s.flags.scene04Seen, node: s.narrativeNode });

    // 9. Manual save / load restores position, facing and inventory.
    await seed('dorm', 610, 470, { hasKey: true }, { facing: 'left', inventory: ['dorm-key', 'blood-note'] });
    await enterGame();
    const saved = await page.evaluate(() => { const u = MuseumAuth.getCurrentUser().id, s = MuseumState.load(u); MuseumState.saveSlot(s, u, 3); return { x: s.playerX, y: s.playerY, facing: s.facing, inv: s.inventory.slice() }; });
    await page.evaluate(() => { const u = MuseumAuth.getCurrentUser().id, s = MuseumState.loadSlot(u, 3); MuseumState.save(s, u); });
    await page.goto(base + '/index.html?fromSave=1');
    s = await state();
    check('slot load restores position, facing and inventory', s.playerX === saved.x && s.playerY === saved.y && s.facing === saved.facing && s.inventory.join() === saved.inv.join(), { loaded: { x: s.playerX, y: s.playerY, facing: s.facing, inv: s.inventory }, saved });

    // 10. The classroom preview must stay isolated from account saves.
    await open(base + '/index.html');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('museum_class_preview', JSON.stringify({ roomId: 'wax', preview: true })); });
    await page.goto(base + '/pages/novel.html?scene=scene-01&preview=1');
    await page.waitForTimeout(400);
    const preview = await page.evaluate(() => ({
      accountSaves: Object.keys(localStorage).filter(k => k.indexOf('museum_save') === 0).length,
      preview: Boolean(sessionStorage.getItem('museum_class_preview'))
    }));
    check('the preview writes session state, not account saves', preview.accountSaves === 0 && preview.preview, preview);

    check('no uncaught page errors during the whole run', pageErrors.length === 0, pageErrors.slice(0, 5));
    check('every asset the pages request exists', missing.length === 0, [...new Set(missing)].slice(0, 6));
    check('no failed subresources reached the console', consoleErrors.length === 0, consoleErrors.slice(0, 4));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? '\n' + failures + ' CHECK(S) FAILED' : '\nALL BROWSER CHECKS PASSED');
  process.exitCode = failures ? 1 : 0;
})().catch(err => { console.error(err); server.close(); process.exitCode = 1; });
