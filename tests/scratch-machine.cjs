/*
 * 员工福利券机接入（012 §6 / §11）的护栏。
 *
 * 券机原本是 `网站开发/怪谈博物馆_员工福利券机.html` —— 一个自带 localStorage 余额的
 * 独立 demo，012 §11 把「余额读写改成走主游戏的 points」列成了待办。现在它住在
 * `demos/scratch/`，带 `?from=panel&user=<id>` 打开就接上主游戏。这个脚本锁住：
 *
 *   1. **单开时行为不变**：老师双击打开还是演示模式，余额 200、没有「返回游戏」按钮。
 *   2. **接入后余额改走主游戏 points**：买券扣的是 points，不是本页的 localStorage。
 *   3. **012 §3.1 的 machine.\***：累计购券张数 / 累计购券支出 / 单张最高净收益。
 *   4. **012 §6.4 那个漏洞已经修掉**：风险天赋减益 250% / 360%，天赋代价 = 该档票价的一半。
 *      修之前 60 点档抽天赋的 RTP 是 140.6% —— 那是台印钞机。
 *
 * 跑法：node tests/scratch-machine.cjs
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
const SCRATCH = () => BASE() + '/demos/scratch/index.html';
let fails = 0;
const errors = [];
const check = (label, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : '  <- ' + JSON.stringify(detail))); if (!ok) fails += 1; };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port;
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });

  // 主游戏那边的存档 + 券机自己那份 localStorage，都在一个不加载 game.js 的页面上写。
  const seed = async (options) => {
    const sh = await ctx.newPage();
    await sh.goto(BASE() + '/pages/saves.html');
    const info = await sh.evaluate((opts) => {
      localStorage.clear();
      const u = MuseumAuth.register('券机', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore';
      s.flags = Object.assign({}, s.flags, { scene01Seen: true });
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      s.points = opts.points;
      MuseumState.save(s, u.id);
      localStorage.setItem('museumScratchGame.v1', JSON.stringify({
        version: 3, balance: 200, soundEnabled: false, activeTicket: null,
        talentOffers: [], equippedTalent: opts.talent || null, history: []
      }));
      return { userId: u.id };
    }, options);
    await sh.close();
    return info;
  };

  const openScratch = async (query) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(SCRATCH() + (query || ''), { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(900);
    return p;
  };

  // 券机页不加载 auth.js（它只认 URL 上的 user 参数），所以这里显式把 userId 传进去。
  const save = (p, userId) => p.evaluate((id) => MuseumState.load(id), userId);

  const options = (p) => p.evaluate(() => Array.from(document.querySelectorAll('.ticket-option')).map(b => ({
    name: b.querySelector('h2').textContent,
    price: b.querySelector('.option-price').textContent,
    reserve: (b.querySelector('.option-bottom span:last-child') || {}).textContent || '',
    disabled: b.disabled
  })));

  try {
    // ---------- 1. 单开：行为不变 ----------
    await seed({ points: 1000 });
    let p = await openScratch();
    let solo = await p.evaluate(() => ({
      bridged: window.MuseumScratchGame.isBridged(),
      balance: window.MuseumScratchGame.getBalance(),
      backHidden: document.getElementById('backToGameButton').hidden,
      resetLabel: document.getElementById('resetButton').textContent
    }));
    check('单开时 bridge 不激活', solo.bridged === false, solo);
    check('单开时余额还是演示值 200', solo.balance === 200, solo);
    check('单开时不显示「返回游戏」', solo.backHidden === true, solo);
    check('单开时按钮仍叫「重置演示」', solo.resetLabel === '重置演示', solo);
    await p.close();

    // ---------- 2. 从面板进：余额接上主游戏 ----------
    // 每次 seed 都会 localStorage.clear() 并新建一个账号，所以 userId 必须跟着更新，
    // 否则后面几段会拿着已经作废的 id 去 load，bridge 静默失效、面板看着还是好的。
    let seeded = await seed({ points: 1000 });
    let userId = seeded.userId;
    p = await openScratch('?from=panel&user=' + encodeURIComponent(userId) + '&returnTo=' + encodeURIComponent(BASE() + '/index.html'));
    let bridged = await p.evaluate(() => ({
      bridged: window.MuseumScratchGame.isBridged(),
      balance: window.MuseumScratchGame.getBalance(),
      shownBalance: document.getElementById('balanceValue').textContent,
      backHidden: document.getElementById('backToGameButton').hidden,
      resetLabel: document.getElementById('resetButton').textContent
    }));
    check('带 ?from=panel 打开时 bridge 激活', bridged.bridged === true, bridged);
    check('余额以主游戏的 points 为准（1000，不是 200）', bridged.balance === 1000 && bridged.shownBalance === '1000', bridged);
    check('接入后显示「返回游戏」', bridged.backHidden === false, bridged);
    check('接入后按钮改名「重置券机记录」', bridged.resetLabel === '重置券机记录', bridged);

    // ---------- 3. §6.4：天赋代价与风险预留 ----------
    let cards = await options(p);
    check('没装天赋时：馆长珍藏券 60 点、无预留', cards.length === 3 && /^60/.test(cards[2].price) && /最高奖励/.test(cards[2].reserve), { cards: cards });
    await p.close();

    // 装上「四倍异常」（高危，012 §6.4 把它的 NONE 减益从 100% 提到 360%）
    seeded = await seed({ points: 1000, talent: 'quadrupleRisk' });
    userId = seeded.userId;
    p = await openScratch('?from=panel&user=' + encodeURIComponent(userId));
    cards = await options(p);
    // 60 点档：券 60 + 天赋代价 30 = 实付 90；预留 = 60 × 360% = 216
    check('装天赋后实付 = 票价 × 1.5（券 60 + 天赋 30 = 90）', /^90/.test(cards[2].price) && /券 60 \+ 天赋 30/.test(cards[2].price), { price: cards[2].price });
    check('风险预留按 360% 算（60 → 216），不是旧的 100%（60）', /216/.test(cards[2].reserve), { reserve: cards[2].reserve });
    check('基础档的预留也跟着上来（10 × 250% 不适用、360% → 36）', /36/.test(cards[0].reserve), { reserve: cards[0].reserve });
    await p.close();

    // 孤注一掷是 250%
    seeded = await seed({ points: 1000, talent: 'tripleRisk' });
    userId = seeded.userId;
    p = await openScratch('?from=panel&user=' + encodeURIComponent(userId));
    cards = await options(p);
    check('孤注一掷按 250% 算预留（60 → 150）', /150/.test(cards[2].reserve), { reserve: cards[2].reserve });
    await p.close();

    // ---------- 4. 买券扣主游戏的 points，并记 machine.* ----------
    seeded = await seed({ points: 1000 });
    userId = seeded.userId;
    p = await openScratch('?from=panel&user=' + encodeURIComponent(userId));
    const before = await save(p, userId);
    await p.evaluate(() => {
      // 点「员工福利券」（第一张，10 点）
      Array.from(document.querySelectorAll('.ticket-option'))[0].click();
    });
    await p.waitForTimeout(600);
    let after = await save(p, userId);
    check('买券扣的是主游戏的 points（1000 → 990）', before.points === 1000 && after.points === 990, { points: after.points });
    check('machine.tickets 记了 1 张', after.machine.tickets === 1, { machine: after.machine });
    check('machine.spent 记了这笔支出（10）', after.machine.spent === 10, { machine: after.machine });
    const entry = await p.evaluate(() => window.MuseumPoints.recent(1)[0]);
    check('购券进主游戏的收支明细，来源写得清楚', entry && entry.delta === -10 && /福利券机/.test(entry.source) && /员工福利券/.test(entry.source), { entry: entry });
    check('页面上的余额跟着走（990）', await p.evaluate(() => document.getElementById('balanceValue').textContent) === '990', {});

    // ---------- 5. 结算：奖金回到 points ----------
    await p.evaluate(() => document.getElementById('autoButton').click());
    await p.waitForTimeout(6000);
    const settled = await p.evaluate(() => {
      const s = window.MuseumScratchGame.getState();
      return { status: s.activeTicket ? s.activeTicket.status : null, reward: s.activeTicket ? s.activeTicket.reward : null, net: s.activeTicket ? s.activeTicket.net : null, history: s.history.length };
    });
    check('自动翻开后这张券已结算', settled.status === 'settled', settled);
    after = await save(p, userId);
    check('结算后余额 = 990 + 奖金', after.points === 990 + settled.reward, { points: after.points, reward: settled.reward, settled: settled });
    if (settled.reward > 0) {
      const win = await p.evaluate(() => window.MuseumPoints.recent(1)[0]);
      check('中奖进收支明细', win && win.delta > 0 && /中奖/.test(win.source), { win: win });
    }
    check('兑奖记录写进了券机自己的历史', settled.history === 1, settled);

    // ---------- 6. 重置券机记录不许动玩家的生存点 ----------
    p.on('dialog', d => d.accept());
    const rebalanced = await save(p, userId);
    await p.evaluate(() => document.getElementById('resetButton').click());
    await p.waitForTimeout(700);
    const afterReset = await save(p, userId);
    const pageState = await p.evaluate(() => ({ history: window.MuseumScratchGame.getState().history.length, balance: window.MuseumScratchGame.getBalance() }));
    check('重置券机记录会清掉兑奖历史', pageState.history === 0, pageState);
    check('重置**不动**主游戏的生存点', afterReset.points === rebalanced.points, { before: rebalanced.points, after: afterReset.points });

    // ---------- 7. 返回游戏 ----------
    await p.evaluate(() => document.getElementById('backToGameButton').click());
    await p.waitForTimeout(1200);
    check('「返回游戏」回到 returnTo 指定的地址', /\/index\.html$/.test(new URL(p.url()).pathname), { url: p.url() });
    await p.close();

    check('全程没有页面报错', errors.length === 0, errors.slice(0, 3));
  } finally {
    await b.close().catch(() => null);
    server.close();
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
