/*
 * 生存点经济（012 §3.1 / §3.2）的护栏。
 *
 * 背景：生存点原本就是 state.hp —— index.html 把它直接显示成「生存点」，
 * 战斗结束还会用剩余血量把它整个覆盖掉。012 要求把它拆成一门纯货币，
 * 这个脚本锁住拆分之后的五条契约：
 *
 *   1. 新档 240；老档没有 points 字段时读进来自动补 240（不写迁移脚本）；
 *      points 是坏值时也要退回 240，不能让 NaN 顺着加减法污染存档。
 *   2. 只有 add / spend 能改余额；每一次增减都飘字、都进收支明细。
 *   3. spend 余额不足时**不动余额**并返回 false。
 *   4. 生存点与 hp 互不影响 —— 这是拆分的全部意义。
 *   5. 战斗胜利按 012 §4.1 发钱：第十一场（馆长）+50、第二十八场（BOSS）+70。
 *
 * 跑法：node tests/points-economy.cjs
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

  // 用一个不加载 game.js 的页面写种子，否则地图页会把旧 state 写回去覆盖掉。
  const seedRaw = async (mutate) => {
    const sh = await ctx.newPage();
    await sh.goto(BASE() + '/pages/saves.html');
    const info = await sh.evaluate((mutateSource) => {
      localStorage.clear();
      const u = MuseumAuth.register('生存点', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore';
      s.flags = Object.assign({}, s.flags, { scene01Seen: true, scene03Seen: true, scene04Seen: true, scene05Seen: true, scene06Seen: true, hasKey: true });
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      // eslint-disable-next-line no-new-func
      new Function('s', mutateSource)(s);
      MuseumState.save(s, u.id);
      return { userId: u.id };
    }, mutate || '');
    await sh.close();
    return info;
  };

  // 进地图页；返回的 page 上 MuseumPoints 已经 bind 好了。
  const openMap = async (query) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(BASE() + '/index.html' + (query || '?fromSave=1'));
    await p.waitForTimeout(400);
    if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
    await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await p.waitForTimeout(500);
    return p;
  };

  // 从一个干净页面读存档，避开地图页内存里那份快照。
  const readSave = async () => {
    const sh = await ctx.newPage();
    await sh.goto(BASE() + '/pages/saves.html');
    const data = await sh.evaluate(() => MuseumState.load(MuseumAuth.getCurrentUser().id));
    await sh.close();
    return data;
  };

  try {
    // ---------- 1. 新档初值 ----------
    await seedRaw('');
    let p = await openMap();
    let snapshot = await readSave();
    check('新档初始生存点 240（012 §3.1）', snapshot.points === 240, { points: snapshot.points });
    check('新档初始 hp 仍然是 25，没有被动过', snapshot.hp === 25, { hp: snapshot.hp });

    // ---------- 2. 老存档补字段 ----------
    await p.close();
    await seedRaw('delete s.points; delete s.pointsLog;');
    p = await openMap();
    snapshot = await readSave();
    check('老存档（没有 points 字段）读进来补 240', snapshot.points === 240, { points: snapshot.points });

    // ---------- 3. 坏值回退 ----------
    await p.close();
    await seedRaw("s.points = 'not a number'; s.pointsLog = 'nope';");
    p = await openMap();
    snapshot = await readSave();
    check('points 是坏值时退回 240', snapshot.points === 240, { points: snapshot.points });
    check('pointsLog 不是数组时退回空数组', Array.isArray(snapshot.pointsLog) && snapshot.pointsLog.length === 0, { pointsLog: snapshot.pointsLog });

    // ---------- 4. 收入：加钱 + 飘字 + 明细 ----------
    await p.close();
    await seedRaw('');
    p = await openMap();
    const gain = await p.evaluate(() => {
      window.MuseumPoints.add(25, '第一幕结算');
      const item = document.querySelector('.points-float.is-gain');
      return {
        text: item ? item.textContent : null,
        balance: window.MuseumPoints.balance(),
        spoken: document.querySelector('.points-live') ? document.querySelector('.points-live').textContent : null,
        recent: window.MuseumPoints.recent(3)
      };
    });
    check('收入飘字带来源，写作 +25 第一幕结算', gain.text === '+25 第一幕结算', { text: gain.text });
    check('收入后余额 = 240 + 25', gain.balance === 265, { balance: gain.balance });
    check('飘字同时播报给读屏（.points-live）', gain.spoken === '+25 第一幕结算', { spoken: gain.spoken });
    check('收支明细记下这一笔（delta 与来源）', gain.recent.length === 1 && gain.recent[0].delta === 25 && gain.recent[0].source === '第一幕结算', { recent: gain.recent });

    // ---------- 5. 支出 ----------
    const cost = await p.evaluate(() => {
      const ok = window.MuseumPoints.spend(70, '规则豁免');
      const item = document.querySelector('.points-float.is-cost');
      return { ok: ok, text: item ? item.textContent : null, balance: window.MuseumPoints.balance() };
    });
    check('支出成功返回 true', cost.ok === true, cost);
    check('支出飘字用真减号写作 −70 规则豁免', cost.text === '−70 规则豁免', { text: cost.text });
    check('支出后余额 = 265 − 70', cost.balance === 195, { balance: cost.balance });

    // ---------- 6. 余额不足：不动余额 ----------
    const denied = await p.evaluate(() => {
      const before = window.MuseumPoints.balance();
      const ok = window.MuseumPoints.spend(before + 1, '系统助战');
      const item = document.querySelector('.points-float.is-denied');
      return { ok: ok, before: before, after: window.MuseumPoints.balance(), text: item ? item.textContent : null, logLength: window.MuseumPoints.recent(50).length };
    });
    check('余额不足时 spend 返回 false', denied.ok === false, denied);
    check('余额不足时**一分钱都不扣**', denied.after === denied.before, denied);
    check('余额不足不走收支明细（没发生的交易不记账）', denied.logLength === 2, denied);
    check('余额不足给出提示', typeof denied.text === 'string' && denied.text.indexOf('生存点不足') === 0, { text: denied.text });

    const guards = await p.evaluate(() => ({
      negative: window.MuseumPoints.add(-30, '负数收入'),
      zero: window.MuseumPoints.add(0, '零收入'),
      after: window.MuseumPoints.balance(),
      afford: window.MuseumPoints.canAfford(195),
      notAfford: window.MuseumPoints.canAfford(196)
    }));
    check('add 拒绝负数（扣钱只能走 spend）', guards.negative === 195 && guards.after === 195, guards);
    check('add 拒绝 0', guards.zero === 195, guards);
    check('canAfford 在余额线上是对的', guards.afford === true && guards.notAfford === false, guards);

    // ---------- 7. 生存点与 hp 互不影响（拆分的全部意义）----------
    const independent = await p.evaluate(() => {
      const before = MuseumState.load(MuseumAuth.getCurrentUser().id);
      window.MuseumPoints.spend(40, '破绽分析');
      const after = MuseumState.load(MuseumAuth.getCurrentUser().id);
      return { beforePoints: before.points, afterPoints: after.points, beforeHp: before.hp, afterHp: after.hp };
    });
    check('花钱只动生存点', independent.afterPoints === independent.beforePoints - 40, independent);
    check('花钱**一点 hp 都不掉**', independent.afterHp === independent.beforeHp, independent);

    // ---------- 8. 持久化：刷新后余额和明细还在 ----------
    await p.close();
    p = await openMap();
    const persisted = await p.evaluate(() => ({ balance: window.MuseumPoints.balance(), recent: window.MuseumPoints.recent(6) }));
    check('刷新后余额还在（155 = 195 − 40）', persisted.balance === 155, persisted);
    check('刷新后收支明细还在，且最新的在前', persisted.recent.length === 3 && persisted.recent[0].source === '破绽分析' && persisted.recent[2].source === '第一幕结算', { recent: persisted.recent });

    // ---------- 9. 暂停面板显示的是生存点，不是 hp ----------
    const panel = await p.evaluate(() => {
      const dd = document.querySelector('[data-points-value]');
      document.getElementById('pause-overlay').hidden = false;
      return { text: dd ? dd.textContent : null, hpText: document.getElementById('hp-value').textContent, labels: Array.from(document.querySelectorAll('.stat-list dt')).map(d => d.textContent) };
    });
    check('暂停面板的「生存点」显示的是新货币', panel.text === '155', panel);
    check('暂停面板上「生存点」这个标签只出现一次（hp 那格已改叫「生命」）', panel.labels.filter(l => l === '生存点').length === 1, { labels: panel.labels });
    check('面板上两格数字各自独立（生存点 155 / 生命 25）', panel.text === '155' && panel.hpText === '25', panel);

    // ---------- 9b. 违规扣罚：余额不够也照扣，扣到 0 ----------
    // 和 spend 的唯一区别就在这里；走 spend 的话只好剩下 50 点的玩家答错会一分不扣。
    const penalty = await p.evaluate(() => {
      const full = window.MuseumPoints.penalize(60, '违规扣罚');
      const afterFull = window.MuseumPoints.balance();
      const entry = window.MuseumPoints.recent(1)[0];
      const partial = window.MuseumPoints.penalize(9999, '违规扣罚');
      return { full: full, afterFull: afterFull, entry: entry, partial: partial, afterPartial: window.MuseumPoints.balance() };
    });
    check('penalize 返回实际扣掉的数（155 − 60）', penalty.full === 60 && penalty.afterFull === 95, penalty);
    check('扣罚进明细，且记的是实际扣掉的数（明细加起来才等于余额变化）', penalty.entry.delta === -60 && penalty.entry.source === '违规扣罚', { entry: penalty.entry });
    check('余额不够时**扣到 0**，而不是像 spend 那样放弃扣款', penalty.partial === 95 && penalty.afterPartial === 0, penalty);
    const broke = await p.evaluate(() => {
      const before = window.MuseumPoints.recent(50).length;
      const paid = window.MuseumPoints.penalize(60, '违规扣罚');
      const item = document.querySelector('.points-float.is-denied');
      return { paid: paid, balance: window.MuseumPoints.balance(), logLength: window.MuseumPoints.recent(50).length, sameLog: before, text: item ? item.textContent : null };
    });
    check('余额为 0 时扣罚不再产生负数余额', broke.paid === 0 && broke.balance === 0, broke);
    check('余额为 0 时不写明细（没扣成就不记账）', broke.logLength === broke.sameLog, broke);
    check('余额为 0 时给出提示', typeof broke.text === 'string' && broke.text.indexOf('生存点不足') === 0, { text: broke.text });
    await p.close();

    // ---------- 10. 战斗胜利发钱（012 §4.1）----------
    // bonus 是这一场顺带解锁的成就奖励：馆长战会置 battleDemoCompleted，于是【口供】+20；
    // 最终 BOSS 战**不置任何旗标**（applyBattleResult 里 `if (!finalBoss)` 把旗标那一整块跳过了），
    // 所以它没有成就奖励——这也是为什么两个 case 的和刚好都是 310，必须分开写清楚。
    const battleWin = async (context, expected, bonus, label) => {
      const { userId } = await seedRaw('s.battleContext = ' + (context ? JSON.stringify(context) : 'null') + ';');
      const sh = await ctx.newPage();
      await sh.goto(BASE() + '/pages/saves.html');
      await sh.evaluate(({ userId }) => {
        localStorage.setItem('museum_pending_battle_v1', JSON.stringify({ status: 'win', remainingHp: 25, rewards: [], flags: [], userId: userId }));
      }, { userId });
      await sh.close();
      const bp = await ctx.newPage();
      bp.on('pageerror', e => errors.push(e.message));
      await bp.goto(BASE() + '/index.html?fromBattle=1');
      await bp.waitForTimeout(2200); // 结算后会跳去剧情页，等它落定
      const after = await readSave();
      check(label, after.points === 240 + expected + bonus, { points: after.points, expected: 240 + expected + bonus, bonus: bonus });
      // 拆分的意义：hp 仍然是"剩余血量"，和赚到的钱各走各的
      check(label + '：hp 仍按剩余血量覆盖', after.hp === 25, { hp: after.hp });
      await bp.close().catch(() => null);
    };
    await battleWin(null, 50, 20, '第十一场（馆长）胜利 +50，并解锁【口供】+20');
    await battleWin('final-boss', 70, 0, '第二十八场（BOSS）胜利 +70（最终 BOSS 不置旗标，所以没有成就奖励）');

    check('全程没有页面报错', errors.length === 0, errors.slice(0, 3));
  } finally {
    await b.close().catch(() => null);
    server.close();
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  // 地图页有 rAF 循环，不显式退出的话 headless Chromium 会在 close() 之后挂着不退。
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
