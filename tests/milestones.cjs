/*
 * 里程碑与成就（012 §4.2 的收入：成就 6×20、每日存活）的护栏。
 *
 * 这两笔钱此前**一分都没有落点**——`js/achievements-data.js` 里的定义表是空的，
 * 天数节点也没接。这个脚本锁住：
 *
 *   1. 成就表取并集共 17 条（远端「完成了成就系统」带来的 13 条 + 我们独有的 4 条），
 *      其中恰好 6 条发钱、各 20（012 §4.2 的「6 个 × 20 = 120」）；远端那 13 条
 *      只追踪不发钱，reward 缺省为 0。发钱发生在 unlock() 那一刻；
 *   2. **老存档要能补发**：玩家今天之前就答对过守则、打赢过馆长，旗标已经在存档里了，
 *      扫描一跑就该把成就补上——只在事件点调用的话老存档永远拿不到；
 *   3. 一切只发一次（幂等），重复扫描、重复进地图都不许再发；
 *   4. 每日存活按 **009 原文核过的**两个节点发（不是照抄 012 的转述）。
 *
 * 跑法：node tests/milestones.cjs
 */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
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
    await sh.goto(BASE() + '/pages/saves.html');
    const info = await sh.evaluate((mutateSource) => {
      localStorage.clear();
      const u = MuseumAuth.register('里程碑', 'x').user;
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

  const snapshot = (p, userId) => p.evaluate((id) => {
    const s = MuseumState.load(id);
    return { points: s.points, achievements: s.achievements.slice().sort(), flags: s.flags, log: s.pointsLog.slice() };
  }, userId);

  try {
    // ---------- A. 定义表本身 ----------
    await seed('');
    let p = await openMap();
    const table = await p.evaluate(() => ({
      achievements: window.MuseumAchievementDefinitions.map(d => ({ id: d.id, name: d.name, reward: d.reward })),
      milestones: window.MuseumMilestoneDefinitions.map(m => ({ id: m.id, flag: m.flag, points: m.points, source: m.source }))
    }));
    // 并集口径（2026-09-19 合并 origin/main 时定的）：远端 13 条只追踪不发钱，
    // 我们 6 条各 20。总条数变了，但发钱的口子还是 6 个、合计还是 120。
    const paying = table.achievements.filter(a => a.reward);
    check('成就取并集：远端 13 条 + 我们独有的 4 条 = 17 条', table.achievements.length === 17, { count: table.achievements.length });
    check('其中恰好 6 条发钱、各 20 点，合计 120（012 §4.2）', paying.length === 6 && paying.every(a => a.reward === 20) && paying.reduce((n, a) => n + a.reward, 0) === 120, { paying: paying.map(a => a.id) });
    check('其余 11 条纯追踪，不发钱', table.achievements.length - paying.length === 11 && table.achievements.filter(a => !a.reward).every(a => !a.reward), { free: table.achievements.filter(a => !a.reward).map(a => a.id) });
    check('每日存活有两条，各 20 点', table.milestones.length === 2 && table.milestones.every(m => m.points === 20), { milestones: table.milestones });
    check('每日存活挂在 009 的场次旗标上（scene12Seen / scene23Seen）', JSON.stringify(table.milestones.map(m => m.flag).sort()) === JSON.stringify(['scene12Seen', 'scene23Seen']), { flags: table.milestones.map(m => m.flag) });
    const before = await snapshot(p, (await p.evaluate(() => MuseumAuth.getCurrentUser().id)));
    check('新档一个成就都没解锁', before.achievements.length === 0, before.achievements);
    await p.close();

    // ---------- B. 老存档补发：旗标早就在存档里了 ----------
    const seeded = await seed('s.flags.rulesGameCompleted = true; s.flags.battleDemoCompleted = true;');
    p = await openMap();
    let after = await snapshot(p, seeded.userId);
    // 这两个 id 在合并时改成了远端的命名（rule-keeper → rules-reader、
    // director-account → first-battle），因为远端的代码就是按后者调的。
    check('老存档进地图就补发了【规则记录员】与【夜班交涉】', after.achievements.indexOf('rules-reader') !== -1 && after.achievements.indexOf('first-battle') !== -1, { achievements: after.achievements });
    check('补发是真的发钱（240 + 20 + 20 = 280）', after.points === 280, { points: after.points });
    const srcs = after.log.filter(e => /成就/.test(e.source)).map(e => e.source).sort();
    check('飘字/明细的来源写作「成就 · 名字」', srcs.length === 2 && srcs[0] === '成就 · 夜班交涉' && srcs[1] === '成就 · 规则记录员', { log: srcs });

    // ---------- C. 幂等：再进一次不许重复发 ----------
    await p.reload();
    await p.waitForTimeout(1400);
    if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
    await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await p.waitForTimeout(500);
    const again = await snapshot(p, seeded.userId);
    check('重复进地图不再发第二遍', again.points === 280 && again.achievements.length === 2, { points: again.points, achievements: again.achievements });
    await p.close();

    // ---------- D. 面具那一对是互斥的 ----------
    const masked = await seed('s.flags.remainedMasked = true;');
    p = await openMap();
    const on = await snapshot(p, masked.userId);
    check('只开 remainedMasked → 只解锁【戴着面具】', on.achievements.length === 1 && on.achievements[0] === 'mask-on', { achievements: on.achievements });
    check('【戴着面具】发 20 点（240 → 260）', on.points === 260, { points: on.points });
    await p.close();

    const unmasked = await seed('s.flags.removedMask = true;');
    p = await openMap();
    const off = await snapshot(p, unmasked.userId);
    check('只开 removedMask → 只解锁【摘下面具】', off.achievements.length === 1 && off.achievements[0] === 'mask-off', { achievements: off.achievements });
    await p.close();

    // ---------- E. 券机那两条：门槛是 30 张 / 净收益 200 ----------
    const almost = await seed('s.machine = { tickets: 29, spent: 290, bestNet: 199 };');
    p = await openMap();
    const nearMiss = await snapshot(p, almost.userId);
    check('差一点（29 张 / 净收益 199）不解锁', nearMiss.achievements.length === 0 && nearMiss.points === 240, nearMiss);
    await p.close();

    const reached = await seed('s.machine = { tickets: 30, spent: 300, bestNet: 200 };');
    p = await openMap();
    const hit = await snapshot(p, reached.userId);
    check('达到门槛（30 张 / 净收益 200）解锁两条券机成就', hit.achievements.length === 2 && hit.achievements.indexOf('regular') !== -1 && hit.achievements.indexOf('lucky-one') !== -1, { achievements: hit.achievements });
    check('两条券机成就共发 40 点（240 → 280）', hit.points === 280, { points: hit.points });
    await p.close();

    // ---------- F. 每日存活 ----------
    const night1 = await seed('s.flags.scene12Seen = true;');
    p = await openMap();
    const n1 = await snapshot(p, night1.userId);
    check('第一夜结束（scene12Seen）→ 发 20 点「存活过第一夜」', n1.points === 260 && n1.flags['milestone:survive-night-1'] === true, { points: n1.points, flags: n1.flags['milestone:survive-night-1'] });
    const n1log = n1.log.filter(e => /存活过/.test(e.source));
    check('明细里写清了来源', n1log.length === 1 && n1log[0].source === '存活过第一夜' && n1log[0].delta === 20, { log: n1log });
    await p.close();

    const bothNights = await seed('s.flags.scene12Seen = true; s.flags.scene23Seen = true;');
    p = await openMap();
    const n2 = await snapshot(p, bothNights.userId);
    check('两夜都过 → 共发 40 点（240 → 280）', n2.points === 280, { points: n2.points });
    // 幂等
    await p.reload(); await p.waitForTimeout(1400);
    if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
    await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await p.waitForTimeout(500);
    const n2again = await snapshot(p, bothNights.userId);
    check('每日存活重复进地图也不再发', n2again.points === 280, { points: n2again.points });
    await p.close();

    // ---------- G. 两个机制不互相干扰 ----------
    const mix = await seed('s.flags.rulesGameCompleted = true; s.flags.scene12Seen = true; s.machine = { tickets: 30, spent: 300, bestNet: 0 };');
    p = await openMap();
    const mixed = await snapshot(p, mix.userId);
    check('成就 + 每日存活可以同时结算（20×2 + 20 = 60 → 300）', mixed.points === 300, { points: mixed.points });
    check('该解的都解了，没多解', JSON.stringify(mixed.achievements) === JSON.stringify(['regular', 'rules-reader']), { achievements: mixed.achievements });
    await p.close();

    check('全程没有页面报错', errors.length === 0, errors.slice(0, 3));
  } finally {
    await b.close().catch(() => null);
    server.close();
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
