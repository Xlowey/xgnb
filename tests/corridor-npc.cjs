/*
 * 走廊那段剧情（scene-04 · 午夜巡逻）应当由"和赵灵对话"触发，而不是走出宿舍门就自动播放。
 *
 * 剧本里 scene-04 正是赵灵的自我介绍（"赵灵。""师……师父……"），所以它是一次对话。
 * 这里断言：
 *   1. 走出宿舍门进入走廊时不会自动进入剧情；
 *   2. 赵灵这个 NPC 在走廊可见、可走近、按 E 会进入 scene-04；
 *   3. 谈过之后她就不再出现在走廊（scene04Seen）。
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
  await new Promise(r => server.listen(8839, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });

  // Seed from a page that does not host game.js (its pagehide handler would write the old
  // state back and undo the seed).
  const seed = async (room, x, y, flags) => {
    const shelter = await ctx.newPage();
    await shelter.goto('http://127.0.0.1:8839/pages/saves.html');
    await shelter.evaluate(({ room, x, y, flags }) => {
      localStorage.clear();
      const u = MuseumAuth.register('走廊', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore'; s.roomId = room; s.playerX = x; s.playerY = y;
      s.flags = Object.assign({}, s.flags, { scene03Seen: true, hasKey: true }, flags || {});
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    }, { room, x, y, flags });
    await shelter.close();
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('        [pageerror]', e.message));
    await p.goto('http://127.0.0.1:8839/index.html?fromSave=1');
    await p.waitForTimeout(400);
    if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
    await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await p.waitForTimeout(700);
    return p;
  };
  const state = p => p.evaluate(() => MuseumState.load(MuseumAuth.getCurrentUser().id));

  try {
    // 1. Standing in the corridor next to 赵灵: she must be visible and offer the prompt.
    //    She stands at (1060,445); the dorm gate is at (1000,400), so stand near her but
    //    clear of the gate's 90px radius.
    let p = await seed('corridor', 1120, 470, {});
    await p.waitForTimeout(2500);   // let the load toast clear
    const prompt = await p.evaluate(() => { const e = document.getElementById('interaction-prompt'); return e.hidden ? '' : e.textContent; });
    console.log('prompt next to 赵灵:', JSON.stringify(prompt));
    check('赵灵 offers an interaction in the corridor', /赵灵/.test(prompt), prompt);
    const npcVisible = await p.evaluate(() => {
      const rooms = MuseumMapData.create(); MuseumMapArt(rooms); MuseumChapterMaps(rooms);
      const s = MuseumState.load(MuseumAuth.getCurrentUser().id);
      const o = rooms.corridor.objects.find(x => x.id === 'corridor-zhaoling');
      return { exists: !!o, visible: !!o && MuseumChapterMaps.visible(o, s) };
    });
    check('the npc object exists and is visible', npcVisible.exists && npcVisible.visible, npcVisible);

    // 2. Pressing E there starts scene-04.
    await p.keyboard.press('e');
    await p.waitForTimeout(900);
    check('talking to 赵灵 opens scene-04', /scene=scene-04/.test(p.url()), p.url());
    await p.close();

    // 3. After the conversation she is gone from the corridor.
    p = await seed('corridor', 1120, 470, { scene04Seen: true });
    await p.waitForTimeout(600);
    const after = await p.evaluate(() => {
      const rooms = MuseumMapData.create(); MuseumMapArt(rooms); MuseumChapterMaps(rooms);
      const s = MuseumState.load(MuseumAuth.getCurrentUser().id);
      const o = rooms.corridor.objects.find(x => x.id === 'corridor-zhaoling');
      return { visible: !!o && MuseumChapterMaps.visible(o, s), npcDraw: !!window.MuseumNpc.placeFor('corridor', s) };
    });
    check('after talking she is no longer visible', after.visible === false && after.npcDraw === false, after);
    await p.close();

    // 4. Walking out of the dorm must not auto-play it either.
    p = await seed('dorm', 835, 795, {});
    await p.waitForTimeout(600);
    await p.keyboard.press('e');
    await p.waitForTimeout(900);
    const s4 = await state(p);
    check('leaving the dorm arrives in the corridor without a cutscene', s4.roomId === 'corridor' && s4.mode === 'explore', { room: s4.roomId, mode: s4.mode });
    await p.close();
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
