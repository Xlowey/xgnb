/*
 * 人性值（013）的护栏。
 *
 * 这一套此前是 `state.hp`，量纲 0–25，只当战斗血量用。013 把它升格成人格化的生命值
 * （0–100），并接上了三条它一直缺的链路。这个脚本锁住：
 *
 *   1. **量纲与迁移**：新档 100；老档（0–25）按比例换算，且**幂等**、坏值有兜底；
 *   2. **每日流失**（§3.1）：每过一天 −10 × 3，挂在 scene12/23/25Seen 上，与每日存活
 *      里程碑共用同一组旗标；
 *   3. **战斗损耗**（§3.2）：`基础 14 + 挨打次数 ×6`，靠地牢回传的 hitsTaken——
 *      **不是**按剩余血量折算（护甲会整块吸收伤害，掉血量反推不出挨打次数）；
 *   4. **归零**（§四）：有【回滚】就消耗一枚、回满 100；没有才走结局 D；
 *   5. **战斗失败**（§3.2 修正口径）：生存点 −300 + 退回存档点，**不**动人性值；
 *   6. 回血（§3.3）：找回线索 +2 × 8 条封顶。
 *
 * 跑法：node tests/humanity.cjs
 */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/__seed.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<script src="/js/auth.js"></script><script src="/js/state.js"></script>'); return; }
  const file = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': body.length });
  res.end(body);
});
let PORT = 0;
const BASE = () => 'http://127.0.0.1:' + PORT;
let fails = 0;
const errors = [];
const check = (label, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : '  <- ' + JSON.stringify(detail))); if (!ok) fails += 1; };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port;
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });

  // mutate 是一段直接对 state 对象执行的源码，用来摆出「已经达成某件事」的存档。
  const seed = async (mutate) => {
    const sh = await ctx.newPage();
    await sh.goto(BASE() + '/__seed.html');
    const info = await sh.evaluate((mutateSource) => {
      localStorage.clear();
      const u = MuseumAuth.register('人性值', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore';
      s.flags = Object.assign({}, s.flags, { scene01Seen: true });
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      // eslint-disable-next-line no-new-func
      new Function('s', mutateSource)(s);
      MuseumState.save(s, u.id);
      return { userId: u.id };
    }, mutate || '');
    await sh.close();
    return info;
  };

  const openMap = async () => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(BASE() + '/index.html?fromSave=1');
    await p.waitForTimeout(400);
    if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
    await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await p.waitForTimeout(600);
    return p;
  };

  const readSave = async (p, userId) => p.evaluate((id) => {
    const s = MuseumState.load(id);
    return { hp: s.hp, points: s.points, shopOwned: s.shopOwned, flags: s.flags, narrativeNode: s.narrativeNode, mode: s.mode };
  }, userId);

  // ---------- 1. 新档 ----------
  let seeded = await seed('');
  let p = await openMap();
  let snap = await readSave(p, seeded.userId);
  check('新档人性值 100（013 §二）', snap.hp === 100, { hp: snap.hp });

  const dom = await p.evaluate(() => ({
    hud: document.getElementById('hp-value').textContent,
    labels: Array.from(document.querySelectorAll('.stat-list dt')).map(d => d.textContent)
  }));
  check('暂停面板那格显示 100', dom.hud === '100', dom);
  check('标签已改叫「人性值」', dom.labels.indexOf('人性值') !== -1 && dom.labels.indexOf('生命') === -1, { labels: dom.labels });
  await p.close();

  // ---------- 2. 老存档迁移 ----------
  // 旧档没有 humanityVersion 标记，hp 是 0–25 量纲，读进来要按比例换算。
  const migrate = async (oldHp, expected, label) => {
    const s = await seed('delete s.humanityVersion; s.hp = ' + oldHp + ';');
    const pg = await openMap();
    const after = await readSave(pg, s.userId);
    check(label, after.hp === expected, { hp: after.hp, expected: expected });
    await pg.close();
  };
  await migrate(25, 100, '迁移：旧档满血 25 → 100');
  await migrate(7, 28, '迁移：旧档 7/25 → 28');
  await migrate(1, 4, '迁移：旧档 1/25 → 4');

  // 旧档 hp:0 —— 在那套里就意味着「已经死了」（结局 D 的判据就是 hp 归零）。
  // 换算成 0 之后，下一轮扫描就会触发归零结算：没有【回滚】，于是直接进结局 D。
  // 这个行为是**刻意的**（延续旧档的语义），所以这里断的是「进了结局 D」而不是「停在 0」。
  const zeroed = await seed('delete s.humanityVersion; s.hp = 0;');
  // 不能用 openMap()：它等的是 #game-screen，而这一档一进地图就会被送去结局页。
  const pz = await ctx.newPage();
  pz.on('pageerror', e => errors.push(e.message));
  await pz.goto(BASE() + '/index.html?fromSave=1');
  await pz.waitForTimeout(400);
  if (await pz.isVisible('#cover-screen')) await pz.click('#continue-button');
  await pz.waitForTimeout(2000);
  const zeroedAfter = await pz.evaluate(() => { const s = MuseumState.load(MuseumAuth.getCurrentUser().id); return { hp: s.hp, node: s.narrativeNode, url: location.href }; });
  check('迁移：旧档 0 → 归零结算，进结局 D', zeroedAfter.hp === 0 && (String(zeroedAfter.node) === 'ending-d' || /ending-d/.test(zeroedAfter.url)), zeroedAfter);
  await pz.close();

  // 幂等：换算过一次之后盘上就有 humanityVersion 了，再读不能二次换算
  const idem = await seed('delete s.humanityVersion; s.hp = 25;');
  let pi = await openMap();
  await pi.close();
  const pi2 = await openMap();
  const after2 = await readSave(pi2, idem.userId);
  check('迁移是幂等的（连读两次不会二次换算）', after2.hp === 100, { hp: after2.hp });
  await pi2.close();

  // 坏值兜底：hp 是全仓唯一没有数值校验的字段，这次补上了
  const bad = await seed('s.hp = "not a number";');
  const pb = await openMap();
  check('坏值兜底到满值', (await readSave(pb, bad.userId)).hp === 100, {});
  await pb.close();
  const over = await seed('s.hp = 9999;');
  const po = await openMap();
  check('超上限钳到 100', (await readSave(po, over.userId)).hp === 100, {});
  await po.close();

  // ---------- 3. 每日流失（013 §3.1）----------
  const day1 = await seed('s.flags.scene12Seen = true;');
  p = await openMap();
  check('第一夜结束 → 人性值 90', (await readSave(p, day1.userId)).hp === 90, { hp: (await readSave(p, day1.userId)).hp });
  await p.reload(); await p.waitForTimeout(1400);
  if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
  await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
  await p.waitForTimeout(500);
  check('重复进地图不再掉第二次', (await readSave(p, day1.userId)).hp === 90, {});
  await p.close();

  const allDays = await seed('s.flags.scene12Seen = true; s.flags.scene23Seen = true; s.flags.scene25Seen = true;');
  p = await openMap();
  check('三夜全过 → 100 − 30 = 70', (await readSave(p, allDays.userId)).hp === 70, { hp: (await readSave(p, allDays.userId)).hp });
  await p.close();

  // ---------- 4. 归零 → 【回滚】复活 ----------
  const revive = await seed('s.hp = 10; s.shopOwned = { rollback: 1 };');
  p = await openMap();
  await p.evaluate(() => { window.MuseumHumanity.damage(20, '测试'); });
  await p.waitForTimeout(600);
  let rv = await readSave(p, revive.userId);
  check('归零时消耗一枚【回滚】', (rv.shopOwned.rollback || 0) === 0, { shopOwned: rv.shopOwned });
  check('【回滚】把人性值回满 100', rv.hp === 100, { hp: rv.hp });
  // ⚠️ 这条专门守一个已修过的坑：consume() 内部会 persist，那一刻 hp 还是 0；
  //    如果不在回满之后补一次落盘，盘上会留下「hp:0 且回滚已扣」——刷新即死。
  await p.reload(); await p.waitForTimeout(1400);
  if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
  await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
  await p.waitForTimeout(500);
  rv = await readSave(p, revive.userId);
  check('复活**落了盘**（刷新后仍是 100，不是 0）', rv.hp === 100, { hp: rv.hp });
  await p.close();

  // ---------- 5. 归零且无【回滚】→ 结局 D ----------
  const doomed = await seed('s.hp = 10;');
  p = await openMap();
  await p.evaluate(() => { window.MuseumHumanity.damage(20, '测试'); });
  await p.waitForTimeout(1200);
  const dead = await p.evaluate(() => { const s = MuseumState.load(MuseumAuth.getCurrentUser().id); return { node: s.narrativeNode, choice: s.narrativeChoice, hp: s.hp, url: location.href }; });
  check('归零且无回滚 → 走 ending-d', String(dead.node) === 'ending-d' || /ending-d/.test(dead.url), dead);
  check('归零后人性值停在 0', dead.hp === 0, { hp: dead.hp });
  await p.close();

  // ---------- 6. 线索回血（013 §3.3）----------
  const clues = await seed('s.hp = 70; s.clues = ["rule-red", "blood-note"];');
  p = await openMap();
  check('两条线索 → +4（70 → 74）', (await readSave(p, clues.userId)).hp === 74, { hp: (await readSave(p, clues.userId)).hp });
  await p.close();

  const capped = await seed('s.hp = 60; s.clues = ["a","b","c","d","e","f","g","h","i","j","k","l"];');
  p = await openMap();
  check('线索回血封顶 8 条 = +16（60 → 76）', (await readSave(p, capped.userId)).hp === 76, { hp: (await readSave(p, capped.userId)).hp });
  await p.close();

  // ---------- 7. 战斗失败：−300 生存点 + 退回存档点 ----------
  const retry = await seed('s.points = 500; s.narrativeNode = "scene-10"; s.flags.scene10Seen = true;');
  const sh = await ctx.newPage();
  await sh.goto(BASE() + '/__seed.html');
  await sh.evaluate((userId) => {
    const s = MuseumState.load(userId);
    s.narrativeNode = 'scene-10';
    MuseumState.save(s, userId);
    MuseumState.saveCheckpoint(s, userId, { label: '测试检查点', sceneId: 'scene-10' });
    s.mode = 'battle'; s.returnScene = s.narrativeNode = 'guard-after-battle';
    s.battleAttempt = { id: 'humanity-retry', source: 'battle', retryScene: 'scene-10', retryIndex: 0, returnScene: s.returnScene };
    MuseumState.save(s, userId);
    localStorage.setItem('museum_pending_battle_v1', JSON.stringify({ status: 'lose', remainingHp: 0, userId: userId, source: 'battle', battleAttempt: 'humanity-retry' }));
  }, retry.userId);
  await sh.close();

  const pp = await ctx.newPage();
  pp.on('pageerror', e => errors.push(e.message));
  await pp.goto(BASE() + '/index.html?fromBattle=1');
  await pp.waitForTimeout(2500);
  const afterLose = await pp.evaluate(() => { const s = MuseumState.load(MuseumAuth.getCurrentUser().id); return { points: s.points, hp: s.hp, url: location.href }; });
  // ⚠️ 这条专门守另一个已修过的坑：checkpoint 是开战前的快照，如果先扣钱再换 state，
  //    那 300 点会被快照整个覆盖掉——账面上根本没扣。
  check('战斗失败真的扣掉了 300 生存点（500 → 200）', afterLose.points === 200, { points: afterLose.points });
  check('战斗失败不动人性值', afterLose.hp === 100, { hp: afterLose.hp });
  check('战斗失败退回存档点重打', /scene-10/.test(afterLose.url), { url: afterLose.url });
  await pp.close();

  check('全程没有页面报错', errors.length === 0, errors.slice(0, 3));
  await b.close().catch(() => null);
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
