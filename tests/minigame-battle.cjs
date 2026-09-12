/*
 * 两个直接计分的功能，此前只有间接覆盖，这个脚本专门测：
 *   1) 小游戏（js/game.js openRules —— 员工守则判断）：三个选项各自的结算、只发一次奖励、
 *      结算后关闭、以及"已完成"之后不能再刷分。
 *   2) 战斗流程（demos/battle → applyBattleResult）：胜利推进剧情、失败走到 ending-d、
 *      战斗结果只结算一次、结算后回到地图而不是卡在 demo 里。
 *
 * 评分标准里"至少一个 mini-game"和战斗演示都是明确要求，所以这两条要单独有护栏。
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
  await new Promise(r => server.listen(8843, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });

  // Seed in a page without game.js so the seed survives (a game page writes old state back).
  const seed = async (room, x, y, flags) => {
    const sh = await ctx.newPage();
    await sh.goto('http://127.0.0.1:8843/pages/saves.html');
    await sh.evaluate(({ room, x, y, flags }) => {
      localStorage.clear();
      const u = MuseumAuth.register('小游戏', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore'; s.roomId = room; s.playerX = x; s.playerY = y;
      s.flags = Object.assign({}, s.flags, { scene01Seen: true, scene03Seen: true, scene04Seen: true, scene05Seen: true, scene06Seen: true, scene07Seen: true, hasKey: true }, flags || {});
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    }, { room, x, y, flags });
    await sh.close();
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('        [pageerror]', e.message));
    await p.goto('http://127.0.0.1:8843/index.html?fromSave=1');
    await p.waitForTimeout(400);
    if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
    await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await p.waitForTimeout(700);
    return p;
  };
  const st = p => p.evaluate(() => MuseumState.load(MuseumAuth.getCurrentUser().id));

  try {
    // ---------------- mini-game: the rules engine ----------------
    // The rules sign lives in the dorm.
    let p = await seed('hall', 1240, 640, {});
    const hasRules = await p.evaluate(() => {
      const rooms = MuseumMapData.create(); MuseumMapArt(rooms); MuseumChapterMaps(rooms);
      return rooms.hall.objects.some(o => o.type === 'rules');
    });
    check('宿舍里有小游戏入口（员工守则）', hasRules === true, { hasRules });

    // Walk to the sign and open it with the mouse/keyboard path the player uses.
    const opened = await p.evaluate(() => {
      const rooms = MuseumMapData.create(); MuseumMapArt(rooms); MuseumChapterMaps(rooms);
      const sign = rooms.hall.objects.find(o => o.type === 'rules');
      if (!sign) return { ok: false };
      const s = MuseumState.load(MuseumAuth.getCurrentUser().id);
      s.playerX = sign.x; s.playerY = sign.y + 30; MuseumState.save(s, MuseumAuth.getCurrentUser().id);
      return { ok: true, x: sign.x, y: sign.y };
    });
    await p.reload(); await p.waitForTimeout(1400);
    await p.keyboard.press('e'); await p.waitForTimeout(600);
    const rulesOpen = await p.evaluate(() => {
      const el = document.getElementById('rules-overlay');
      return { open: el && !el.hidden, options: document.getElementById('rules-options').children.length, mode: MuseumState.load(MuseumAuth.getCurrentUser().id).mode };
    });
    check('按 E 打开小游戏', rulesOpen.open === true, rulesOpen);
    check('小游戏提供 3 个选项', rulesOpen.options === 3, rulesOpen);

    // Wrong answer: costs hp, does not award the flag.
    const before = await st(p);
    await p.evaluate(() => document.getElementById('rules-options').children[2].click());
    await p.waitForTimeout(400);
    const wrong = await st(p);
    check('选错会扣生存点', wrong.hp < before.hp, { hp: before.hp + ' -> ' + wrong.hp });
    check('选错不发通关旗标', wrong.flags.rulesGameCompleted !== true, { flag: wrong.flags.rulesGameCompleted });
    const feedback = await p.evaluate(() => document.getElementById('rules-feedback').textContent);
    check('选错有文字反馈', /生存点|无法解释/.test(feedback), feedback);
    await p.close();

    // Correct answer: awards the flag + a clue, exactly once.
    p = await seed('hall', 1240, 640, {});
    await p.evaluate(() => {
      const rooms = MuseumMapData.create(); MuseumMapArt(rooms); MuseumChapterMaps(rooms);
      const sign = rooms.hall.objects.find(o => o.type === 'rules');
      const s = MuseumState.load(MuseumAuth.getCurrentUser().id);
      s.playerX = sign.x; s.playerY = sign.y + 30; MuseumState.save(s, MuseumAuth.getCurrentUser().id);
    });
    await p.reload(); await p.waitForTimeout(1400);
    await p.keyboard.press('e'); await p.waitForTimeout(600);
    const hpBefore = (await st(p)).hp;
    await p.evaluate(() => document.getElementById('rules-options').children[0].click());
    await p.waitForTimeout(400);
    const right = await st(p);
    check('选对发通关旗标', right.flags.rulesGameCompleted === true, { flag: right.flags.rulesGameCompleted });
    check('选对给线索', right.clues.some(c => /rule-red/.test(String(c))), { clues: right.clues });
    check('选对不扣生存点', right.hp === hpBefore, { hp: hpBefore + ' -> ' + right.hp });
    // Clicking again must not double-count.
    const cluesAfter = (await st(p)).clues.length;
    await p.evaluate(() => document.getElementById('rules-options').children[0].click());
    await p.waitForTimeout(300);
    check('重复点击不会重复发奖', (await st(p)).clues.length === cluesAfter, { before: cluesAfter });
    // Reopening after completion must not reset the game.
    await p.reload(); await p.waitForTimeout(1400);
    await p.keyboard.press('e'); await p.waitForTimeout(600);
    const reopen = await p.evaluate(() => ({ open: !document.getElementById('rules-overlay').hidden, feedback: document.getElementById('rules-feedback').textContent }));
    check('通关后重开不会重置（回到已记住状态）', reopen.open === false, reopen);
    await p.close();

    // ---------------- battle flow ----------------
    // The battle demo is entered from the STORY (scene-11's battle choice jumps to
    // demos/battle in js/novel.js), not from the map. game.js's goBattle() was dead code
    // and has been removed; this checks the real path.
    const shelter2 = await ctx.newPage();
    await shelter2.goto('http://127.0.0.1:8843/pages/saves.html');
    await shelter2.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('战斗', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'novel'; s.narrativeNode = 'scene-11';
      s.flags = Object.assign({}, s.flags, { scene01Seen: true, scene03Seen: true, scene04Seen: true, scene05Seen: true, scene06Seen: true, scene07Seen: true, scene08Seen: true, scene09Seen: true, scene10Seen: true, hasKey: true });
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    });
    await shelter2.close();
    p = await ctx.newPage();
    p.on('pageerror', e => console.log('        [pageerror]', e.message));
    await p.goto('http://127.0.0.1:8843/pages/novel.html?scene=scene-11');
    await p.waitForTimeout(1500);
    const battleChoice = await p.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')].map(b => b.textContent.trim());
      const target = [...document.querySelectorAll('button')].find(b => /战斗|交涉|动手/.test(b.textContent));
      return { buttons: buttons.slice(0, 8), found: !!target, label: target && target.textContent.trim() };
    });
    check('scene-11 提供战斗选项', battleChoice.found === true, battleChoice);
    if (battleChoice.found) {
      await p.evaluate(() => { const t = [...document.querySelectorAll('button')].find(b => /战斗|交涉|动手/.test(b.textContent)); t.click(); });
      await p.waitForTimeout(1500);
      const went = await p.evaluate(() => ({ url: location.href, s: (() => { const st = window.MuseumState ? MuseumState.load(MuseumAuth.getCurrentUser().id) : (window.MuseumStory && window.MuseumStory.state) || {}; return { mode: st.mode, node: st.narrativeNode, ret: st.returnScene }; })() }));
      check('战斗选项跳到战斗演示页', /demos\/battle/.test(went.url), { url: went.url, state: went.s });
      // The demo page receives the return scene in its URL; that is the contract with the story.\n      check('战斗页拿到了返回场次（URL 参数）', /returnScene=guard-after-battle|returnScene=scene-11/.test(went.url), { url: went.url });
    }
    await p.close();

    // Simulate a WIN by writing the pending result the demo would leave behind, then loading the map.
    p = await seed('hall', 1490, 700, { scene07Seen: true, battleDemoCompleted: false, waxDoorUnlocked: true });
    await p.evaluate(() => {
      localStorage.setItem('museum_pending_battle_v1', JSON.stringify({ status: 'win', remainingHp: 7 }));
    });
    await p.reload(); await p.waitForTimeout(1500);
    const win = await st(p);
    check('战斗胜利会结算：hp 采用战斗结果', win.hp === 7, { hp: win.hp });
    check('战斗胜利会解锁蜡像馆', String(win.unlockedRooms).includes('wax'), { rooms: win.unlockedRooms });
    check('战斗胜利会标记 demo 完成', win.flags.battleDemoCompleted === true, { flag: win.flags.battleDemoCompleted });
    check('结算后待处理结果被清掉（不会重复结算）', await p.evaluate(() => localStorage.getItem('museum_pending_battle_v1')) === null, { pending: await p.evaluate(() => localStorage.getItem('museum_pending_battle_v1')) });
    await p.close();

    // Simulate a LOSS -> ending-d.
    p = await seed('hall', 1490, 700, { scene07Seen: true, battleDemoCompleted: false, waxDoorUnlocked: true });
    await p.evaluate(() => {
      localStorage.setItem('museum_pending_battle_v1', JSON.stringify({ status: 'lose', remainingHp: 0 }));
    });
    await p.reload(); await p.waitForTimeout(1500);
    const lose = await p.evaluate(() => ({ url: location.href, s: MuseumState.load(MuseumAuth.getCurrentUser().id) }));
    check('战斗失败走到 ending-d（死亡）', /ending-d/.test(String(lose.s.narrativeNode || lose.s.ending || '')) || /ending-d/.test(lose.url), { node: lose.s.narrativeNode, ending: lose.s.ending, url: lose.url });
    check('战斗失败把 hp 记为 0', lose.s.hp === 0, { hp: lose.s.hp });
    await p.close();
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
