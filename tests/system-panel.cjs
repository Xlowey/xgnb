/*
 * 系统面板（012 §3.2）的护栏。
 *
 * 012 对这块面板的硬要求是「**只用已经存在的东西组成，不新增任何未定案机制**」，
 * 以及那句警告——「面板三格必须全部有变量托底」。009 第四场印的是
 * 「玩家等级 Lv.03、生存点 240、NPC 信任度 31%」，这三个数只要有一个是写死的，
 * 面板就会在剧情推进之后开始说谎。
 *
 * 这个脚本锁住：
 *   1. M 开、Esc 关；开着的时候再按 M 也关。
 *   2. 五格全部读的是活变量 —— 把 state 改了，面板必须跟着变。
 *   3. 点生存点展开收支明细，只显示最近 6 条、最新的在前（012 §3.2 规则二）。
 *   4. 券机入口旁那行券机的账读的是 machine.*（012 §3.2 规则三）。
 *   5. 商城 / 券机两个入口在接完之前是**真的禁用**，不做点了没反应的假按钮。
 *   6. 面板是浮层：开着的时候背包 / 成就打不开，Esc 也不会顺手把暂停菜单打开。
 *   7. 老存档缺 level / npcTrust / machine 时补 012 的初值。
 *
 * 跑法：node tests/system-panel.cjs
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

  const seed = async (mutate) => {
    const sh = await ctx.newPage();
    await sh.goto(BASE() + '/pages/saves.html');
    const info = await sh.evaluate((mutateSource) => {
      localStorage.clear();
      const u = MuseumAuth.register('面板', 'x').user;
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

  const readPanel = (p) => p.evaluate(() => {
    const q = (sel) => { const el = document.querySelector(sel); return el ? el.textContent : null; };
    return {
      open: window.MuseumPanel.isOpen(),
      level: q('#panel-title'),
      points: q('.panel-points .panel-value'),
      human: q('.panel-stat .panel-value'),
      trust: q('.panel-trust .panel-value'),
      machine: q('.panel-machine'),
      tasks: Array.from(document.querySelectorAll('.panel-task')).map(t => t.textContent),
      entries: Array.from(document.querySelectorAll('.panel-entry')).map(b => ({ text: b.textContent, disabled: b.disabled })),
      ledgerHidden: document.querySelector('.panel-ledger').hidden,
      ledger: Array.from(document.querySelectorAll('.panel-ledger-item')).map(i => ({
        source: i.querySelector('.panel-ledger-copy strong').textContent,
        amount: i.querySelector('.panel-ledger-amount').textContent
      }))
    };
  });

  try {
    // ---------- 1. 开关 ----------
    await seed('');
    let p = await openMap();
    await p.keyboard.press('m');
    await p.waitForTimeout(300);
    check('按 M 打开系统面板', (await readPanel(p)).open === true, {});
    await p.keyboard.press('m');
    await p.waitForTimeout(300);
    check('面板开着时再按 M 会关掉', (await readPanel(p)).open === false, {});
    // 地图 HUD 上的按钮走同一条路
    await p.click('#map-panel-button');
    await p.waitForTimeout(300);
    check('地图上的「系统 · M」按钮也能打开', (await readPanel(p)).open === true, {});
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    const afterEsc = await p.evaluate(() => ({ panel: MuseumPanel.isOpen(), pause: !document.getElementById('pause-overlay').hidden }));
    check('Esc 关面板，且不会顺手把暂停菜单也打开', afterEsc.panel === false && afterEsc.pause === false, afterEsc);

    // ---------- 2. 五格初值 ----------
    await p.keyboard.press('m');
    await p.waitForTimeout(300);
    let panel = await readPanel(p);
    check('等级显示 Lv.03（state.level = 3）', panel.level === 'Lv.03', { level: panel.level });
    check('生存点读的是 points（240）', panel.points === '240', { points: panel.points });
    check('生命读的是 hp（25）', panel.human === '25', { human: panel.human });
    check('NPC 信任度读的是 npcTrust（31%）', panel.trust === '31%', { trust: panel.trust });
    check('任务列表是 009 的三条 + 隐藏任务「？？？？？」', panel.tasks.length === 4 && /存活三天/.test(panel.tasks[0]) && /找出异变源头/.test(panel.tasks[1]) && /找出唯一活人/.test(panel.tasks[2]) && /？？？？？/.test(panel.tasks[3]), { tasks: panel.tasks });
    check('明细默认收起', panel.ledgerHidden === true, {});
    check('券机的账默认是 0', panel.machine === '已购 0 张 · 累计 0 点', { machine: panel.machine });
    await p.close();

    // ---------- 3. 写死的数字过不了这一关 ----------
    // 面板读的是 game.js 内存里那份 state；MuseumState.load() 返回的是另一个新对象，
    // 改它不会动到面板。所以要改完存档再重开页面，才验得到"面板读的是活变量"。
    await seed('s.level = 7; s.npcTrust = 12; s.hp = 80; s.machine = { tickets: 23, spent: 187, bestNet: 64 };');
    p = await openMap();
    await p.evaluate(() => window.MuseumPoints.add(60, '测试加款'));
    await p.keyboard.press('m');
    await p.waitForTimeout(300);
    panel = await readPanel(p);
    check('改 level 后面板跟着变（Lv.07）', panel.level === 'Lv.07', { level: panel.level });
    check('改 npcTrust 后面板跟着变（12%）', panel.trust === '12%', { trust: panel.trust });
    check('改 hp 后面板跟着变（80）', panel.human === '80', { human: panel.human });
    check('加钱后面板跟着变（300）', panel.points === '300', { points: panel.points });
    // 012 §3.2 规则三：券机入口旁这行账，而且它应该一直是负的
    check('券机的账读的是 machine.tickets / machine.spent', panel.machine === '已购 23 张 · 累计 −187 点', { machine: panel.machine });

    // ---------- 4. 收支明细（012 §3.2 规则二）----------
    await p.click('.panel-points');
    await p.waitForTimeout(250);
    panel = await readPanel(p);
    check('点生存点展开明细', panel.ledgerHidden === false, {});
    check('明细记的是刚才那笔，带来源与金额', panel.ledger.length === 1 && panel.ledger[0].source === '测试加款' && panel.ledger[0].amount === '+60', { ledger: panel.ledger });
    // 面板**开着**的时候继续改钱：数字和明细都必须跟着走。商城和券机就是在面板里改钱的，
    // 只刷新余额不刷新明细的话，玩家会看到余额变了、最近记录还是旧的。
    await p.evaluate(() => { for (let i = 1; i <= 10; i += 1) window.MuseumPoints.add(i, '第' + i + '笔'); });
    await p.waitForTimeout(200);
    panel = await readPanel(p);
    check('面板开着时改钱：明细跟着刷新，且最多只露最近 6 条', panel.ledger.length === 6, { count: panel.ledger.length });
    check('显示的是最近 6 条，最新的在最前', panel.ledger[0].source === '第10笔' && panel.ledger[5].source === '第5笔', { ledger: panel.ledger.map(e => e.source) });
    await p.click('.panel-points');
    await p.waitForTimeout(250);
    check('再点一次收起明细', (await readPanel(p)).ledgerHidden === true, {});

    // ---------- 5. 入口的可用状态 ----------
    // 商城第 3 步已经接了；券机要等第 4 步，在接完之前是**真的禁用**，不做点了没反应的假按钮。
    check('商城入口已可用', panel.entries[1] && panel.entries[1].disabled === false, { entries: panel.entries });
    check('券机入口已可用（第 4 步已接）', panel.entries[0] && panel.entries[0].disabled === false, { entries: panel.entries });

    // ---------- 6. 是浮层：互斥、且不吞按键 ----------
    const exclusive = await p.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
      return { bag: window.MuseumInventory.isOpen(), achievements: window.MuseumAchievements.isOpen(), panel: window.MuseumPanel.isOpen() };
    });
    check('面板开着时背包与成就都打不开（浮层互斥）', exclusive.bag === false && exclusive.achievements === false && exclusive.panel === true, exclusive);
    await p.close();

    // ---------- 7. 老存档补初值 ----------
    await seed('delete s.level; delete s.npcTrust; delete s.machine;');
    p = await openMap();
    const migrated = await p.evaluate(() => {
      const s = MuseumState.load(MuseumAuth.getCurrentUser().id);
      return { level: s.level, npcTrust: s.npcTrust, machine: s.machine };
    });
    check('老存档补 level = 3', migrated.level === 3, migrated);
    check('老存档补 npcTrust = 31', migrated.npcTrust === 31, migrated);
    check('老存档补 machine 三个计数', migrated.machine && migrated.machine.tickets === 0 && migrated.machine.spent === 0 && migrated.machine.bestNet === 0, migrated);
    await p.keyboard.press('m');
    await p.waitForTimeout(300);
    panel = await readPanel(p);
    check('补完初值后面板正常显示', panel.level === 'Lv.03' && panel.trust === '31%' && panel.machine === '已购 0 张 · 累计 0 点', panel);
    await p.close();

    // ---------- 8. 剧情页也挂上了 ----------
    const n = await ctx.newPage();
    n.on('pageerror', e => errors.push(e.message));
    await n.goto(BASE() + '/pages/novel.html?scene=scene-01&preview=1');
    await n.waitForTimeout(2400);
    const novelPanel = await n.evaluate(() => {
      const btn = document.getElementById('novel-panel-button');
      return { hasButton: Boolean(btn), bound: typeof window.MuseumPanel === 'object' };
    });
    check('剧情页工具栏有「系统」按钮', novelPanel.hasButton === true && novelPanel.bound === true, novelPanel);
    await n.close();

    check('全程没有页面报错', errors.length === 0, errors.slice(0, 3));
  } finally {
    await b.close().catch(() => null);
    server.close();
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
