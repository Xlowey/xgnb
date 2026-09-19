/*
 * 接入自检：地牢作为最终 boss 战时的"进 / 出"契约。
 *
 * 进入：  demos/pixel-dungeon-html/index.html?from=novel&user=<id>&returnScene=<scene>
 * 结算：  写 localStorage["museum_pending_battle_v1"] = { status, remainingHp, rewards,
 *         flags, userId }，然后回 ../../index.html?fromBattle=1
 * 主游戏 js/game.js 的 consumeBattleResult() + applyBattleResult() 负责结算：
 *         win  -> 按 hitsTaken 扣人性值，正常存活才进入 returnScene
 *         lose -> 扣生存点后回开战选项重试
 *
 * 写这个测试时踩到的三个坑（照抄约束，别重犯）：
 *   1. 不要在 page.evaluate 里 click 会导航的按钮——导航拆掉执行上下文，返回的 Promise
 *      永不 resolve，整个测试挂死。
 *   2. 不要对跑着地牢 rAF 循环的页面调用 page.reload()——Playwright 会挂住。要重来就开新页面。
 *   3. 结束后必须 process.exit()：rAF 循环会让 headless Chromium 在 browser.close() 之后
 *      仍不退出，看起来像死循环。
 * 另外每个阶段各用一个 context，不在测试中途 close 页面。
 */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': body.length });
  res.end(body);
});
let PORT = 0;
// 用一个函数而不是常量：端口由系统分配（见下面的 listen(0)），避免固定端口被上一次
// 挂掉的进程占住而报 EADDRINUSE。
const DUNGEON = () => 'http://127.0.0.1:' + PORT + '/demos/pixel-dungeon-html/index.html';
const NAV = { timeout: 8000 };
const EVAL = { timeout: 8000 };
let fails = 0;
const LOG = [];
const say = (line) => { LOG.push(line); console.log(line); };
const check = (l, ok, d) => { say((ok ? 'PASS ' : 'FAIL ') + l + (ok || d === undefined ? '' : '  <- ' + JSON.stringify(d))); if (!ok) fails += 1; };
const flush = () => { try { fs.writeFileSync(path.resolve(__dirname, '../tmp/boss-bridge.log'), LOG.join('\n')); } catch (e) { /* ignore */ } };

// Record every pending-battle write from inside the page.
const CAPTURE = () => {
  window.__writes = [];
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (String(k).indexOf('museum_pending_battle') === 0) window.__writes.push(String(v));
    return orig.apply(this, arguments);
  };
};


async function openDungeon(ctx, url, capture) {
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  if (capture) await p.addInitScript(CAPTURE);
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(1400);
  return { p, errors };
}
const lastWrite = (p) => p.evaluate(() => (window.__writes || []).slice(-1)[0] || null, null, EVAL);

// Call the bridge and return what it wrote, WITHOUT losing the value to the navigation.
// report() writes storage and then sets location.href in the same tick, so a separate
// page.evaluate afterwards reads the *new* document and always comes back empty. Resolve from
// inside the page as soon as __writes is populated, and race that against the navigation.
async function finishAndCapture(p, status, hp) {
  return p.evaluate(({ status, hp }) => new Promise((resolve) => {
    const started = Date.now();
    window.__dungeonFinish(status, hp);
    (function poll() {
      if (window.__writes && window.__writes.length) return resolve(window.__writes[window.__writes.length - 1]);
      if (Date.now() - started > 3000) return resolve(null);
      setTimeout(poll, 10);
    }());
  }), { status, hp }).catch(() => null);
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port;
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const V = { viewport: { width: 1366, height: 768 } };

  try {
    // ---------- 1. boss mode, win ----------
    say('PHASE 1 start'); flush();
    let ctx = await b.newContext(V);
    let { p, errors } = await openDungeon(ctx, DUNGEON() + '?from=novel&user=u_test&returnScene=scene-28&battleAttempt=boss-win-1', true);
    say('PHASE 1 page open'); flush();
    const wired = await p.evaluate(() => ({
      hasContinue: !!document.getElementById('result-continue'),
      continueHidden: document.getElementById('result-continue').hidden,
      restartHidden: document.getElementById('result-restart').hidden,
      cardHidden: document.getElementById('result-card').hidden
    }), null, EVAL);
    check('接入后"返回剧情"按钮存在且可见', wired.hasContinue && wired.continueHidden === false, wired);
    check('boss 战里隐藏"重新开始"（剧情已到结局前，重开一局没意义）', wired.restartHidden === true, wired);
    check('开局时结算卡是收起的', wired.cardHidden === true, wired);

    // The dungeon's render loop re-hides the result card every frame while its own HUD status
    // is still 'playing', so a test cannot fake "I finished" by editing the DOM (the card gets
    // hidden again before Playwright can click it). Drive the bridge's own function instead —
    // that is the real contract, and the button calls exactly the same thing.
    const hooked = await p.evaluate(() => typeof window.__dungeonFinish, null, EVAL);
    check('接入层暴露了结算函数（按钮与测试走同一条路）', hooked === 'function', { hooked });

    const captured = await finishAndCapture(p, 'win', 7);
    check('胜负结算会写出 pending result', Boolean(captured), { captured });
    await p.waitForTimeout(1200);
    if (captured) {
      const r = JSON.parse(captured);
      check('结果是 win', r.status === 'win', r);
      // 2026-09-19：主游戏的人性值量纲改成 0–100（013），所以地牢 7 点血满血折算成 100。
      // ⚠️ remainingHp 现在**只是给结算看的**——013 §3.2 起主游戏按 hitsTaken 算损耗。
      check('生存点按地牢 7 点血折算到本作 100 点制（013 量纲），且至少 1 点', r.remainingHp === 100, { remainingHp: r.remainingHp });
      check('结果带 hitsTaken（013 §3.2 的战斗损耗靠它，不是 remainingHp）', r.hitsTaken === 0, { hitsTaken: r.hitsTaken });
      check('结果带 userId（主游戏据此校验账号）', r.userId === 'u_test', { userId: r.userId });
      check('结果带当前战斗 attempt，旧结果不能结算新战斗', r.battleAttempt === 'boss-win-1' && r.source === 'pixel-dungeon', r);
      check('结果带 boss_defeated 旗标', String(r.flags || '').includes('boss_defeated'), { flags: r.flags });
    }
    check('结算后回到主游戏（fromBattle=1）', /fromBattle=1/.test(p.url()), { url: p.url() });
    check('boss 模式下没有页面报错', errors.length === 0, errors.slice(0, 3));
    say('PHASE 1 done, closing ctx'); flush();
    await ctx.close();
    say('PHASE 1 ctx closed'); flush();

    // ---------- 2. boss mode, lose ----------
    say('PHASE 2 start'); flush();
    ctx = await b.newContext(V);
    ({ p, errors } = await openDungeon(ctx, DUNGEON() + '?from=novel&user=u_test&returnScene=scene-28', true));
    const loseCap = await finishAndCapture(p, 'lose', 0);
    await p.waitForTimeout(1200);
    const lr = loseCap ? JSON.parse(loseCap) : null;
    // 契约没变（失败时 remainingHp 仍是 0），但**主游戏不再据此走 ending-d** 了——
    // 013 §3.2 起失败 = 生存点 −300 + 退回存档点重打；结局 D 改由「人性值归零且无【回滚】」触发。
    check('失败结果是 lose 且 remainingHp 为 0（契约字段；但主游戏不再据此判死）', Boolean(lr) && lr.status === 'lose' && lr.remainingHp === 0, lr);
    await ctx.close();

    // Preview results live in sessionStorage and must return to the preview
    // story, since the account map intentionally consumes only localStorage.
    for (const status of ['win', 'lose']) {
      ctx = await b.newContext(V);
      const requests = [];
      ctx.on('request', request => { if (request.isNavigationRequest()) requests.push(request.url()); });
      ({ p } = await openDungeon(ctx, DUNGEON() + '?from=novel&user=class-preview&returnScene=scene-28&preview=1&battleAttempt=preview-' + status, true));
      const previewCapture = await finishAndCapture(p, status, status === 'win' ? 7 : 0);
      await p.waitForTimeout(500);
      const result = previewCapture && JSON.parse(previewCapture);
      check('preview ' + status + ' preserves its attempt in the result', result && result.battleAttempt === 'preview-' + status, result);
      check('preview ' + status + ' returns directly to preview story', requests.some(url => /pages\/novel\.html\?scene=scene-28&preview=1&resume=1/.test(url)) && !requests.some(url => /index\.html\?fromBattle=1/.test(url)), requests);
      await ctx.close();
    }

    // ---------- 3. standalone: no returnScene, unchanged ----------
    say('PHASE 3 start'); flush();
    ctx = await b.newContext(V);
    ({ p, errors } = await openDungeon(ctx, DUNGEON(), false));
    const standalone = await p.evaluate(() => ({
      continueHidden: document.getElementById('result-continue').hidden,
      restartHidden: document.getElementById('result-restart').hidden
    }), null, EVAL);
    check('独立游玩时"返回剧情"不出现（老师双击打开不受影响）', standalone.continueHidden === true, standalone);
    check('独立游玩时"重新开始"仍然可用', standalone.restartHidden === false, standalone);
    check('独立游玩时没有页面报错', errors.length === 0, errors.slice(0, 3));
    await ctx.close();
    say('ALL PHASES done'); flush();
  } finally { await b.close().catch(() => null); server.close(); flush(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
