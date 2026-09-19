/*
 * 商城（012 §5）的护栏。
 *
 * 两件事分开守：
 *   A. **数字对不对。** 012 §7.1 自己留过一句话：旧版正文写"限购拉满 2550"，但它自己的
 *      五类分项相加是 2650 —— 正文的总数是错的。所以这里不认总数，直接从商品表重算，
 *      再和 012 §5.7 的分类表逐项对账（720 / 490 / 200 / 340 / 900 / 1630 = 4280）。
 *   B. **钱和持有物对不对。** 买一件要真扣点、真记持有、真进明细；
 *      限购到顶就要买不动；买不起就一分不能扣；效果没落点的必须挂「效果待接入」标签。
 *
 * 外加【规则豁免】那条：012 §5.3 说它"免一次违规扣罚"，用途由玩家自己定，
 * 所以答错时应该是**出选择**，而不是自动抵扣。
 *
 * 跑法：node tests/shop.cjs
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

// 012 §5.7 的分类表，逐项对账用。
const EXPECTED_CATEGORY_TOTALS = { battle: 720, intel: 490, rules: 200, humanity: 340, story: 900, minigame: 1630 };

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
      const u = MuseumAuth.register('商城', 'x').user;
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

  // 面板上两个入口现在都能点，必须点名「商城」那一个 —— 用 :not([disabled]) 会点到福利券机上去。
  const openShop = async (p) => {
    await p.keyboard.press('m');
    await p.waitForTimeout(300);
    await p.click('[data-shop-open]');
    await p.waitForTimeout(350);
  };

  const readShop = (p) => p.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.shop-item'));
    return {
      inShopView: !document.querySelector('.panel-view[hidden] .shop-tabs') && Boolean(document.querySelector('.shop-tabs')),
      overviewHidden: document.querySelectorAll('.panel-view')[0].hidden,
      tabs: Array.from(document.querySelectorAll('.shop-tab')).map(t => t.textContent),
      activeTab: (document.querySelector('.shop-tab[aria-pressed="true"]') || {}).textContent,
      hint: (document.querySelector('.shop-hint') || {}).textContent,
      balance: (document.querySelector('.shop-balance strong') || {}).textContent,
      items: items.map(i => ({
        name: i.querySelector('h3').textContent,
        price: i.querySelector('.shop-price').textContent,
        note: i.querySelector('.shop-note').textContent,
        stock: i.querySelector('.shop-stock').textContent,
        tag: i.querySelector('.shop-tag') ? i.querySelector('.shop-tag').textContent : null,
        buyDisabled: i.querySelector('.shop-buy').disabled,
        buyLabel: i.querySelector('.shop-buy').textContent
      }))
    };
  });

  const openTab = async (p, label) => {
    await p.evaluate((label) => {
      const tab = Array.from(document.querySelectorAll('.shop-tab')).find(t => t.textContent === label);
      if (tab) tab.click();
    }, label);
    await p.waitForTimeout(200);
  };

  try {
    // ---------- A. 商品表本身的数字 ----------
    await seed('');
    let p = await openMap();
    const table = await p.evaluate(() => ({
      total: window.MuseumShopData.total(),
      all: window.MuseumShopData.all().length,
      perCategory: window.MuseumShopData.categories.reduce((acc, c) => {
        acc[c.id] = c.items.reduce((sum, i) => sum + i.price * i.limit, 0);
        return acc;
      }, {}),
      // 012 §5.6 标注的两组要能分辨：叠加式 vs 买断
      stacked: window.MuseumShopData.all().filter(i => i.stacked).map(i => i.id)
    }));
    check('商品表限购拉满合计 = 4280（012 §5.7）', table.total === 4280, { total: table.total });
    check('六大类的小计逐项对上 012 §5.7 的分类表', JSON.stringify(table.perCategory) === JSON.stringify(EXPECTED_CATEGORY_TOTALS), { perCategory: table.perCategory });
    check('共 23 件商品（4+5+2+2+1+9）', table.all === 23, { count: table.all });
    check('战斗向的三件是叠加式（012 §5.6）', JSON.stringify(table.stacked.sort()) === JSON.stringify(['elbow', 'mag', 'stamp']), { stacked: table.stacked });

    // ---------- B. 切到商城区 ----------
    await openShop(p);
    let shop = await readShop(p);
    check('点「商城」切进商城视图（概览让位）', shop.overviewHidden === true && shop.tabs.length === 6, { overviewHidden: shop.overviewHidden, tabs: shop.tabs });
    check('默认停在第一个分类（战斗类）', shop.activeTab === '战斗类', { activeTab: shop.activeTab });
    check('战斗类 4 件都列出来了', shop.items.length === 4, { count: shop.items.length });
    // 价格里的 ◆ 是 CSS ::before 生成的，textContent 里只有数字。
    check('每件都有价格和限购', shop.items.every(i => /^\d+$/.test(i.price) && /限购/.test(i.stock)), { items: shop.items });

    // 效果没落点的必须挂标签，不能让人以为买到了什么
    check('效果没落点的商品都带「效果待接入」标签', shop.items.every(i => i.tag && /效果待接入/.test(i.tag)), { tags: shop.items.map(i => i.tag) });
    check('标签里写明了依赖（战斗类挂在暗影地牢上）', shop.items.every(i => /暗影地牢/.test(i.tag)), { tags: shop.items.map(i => i.tag) });

    await openTab(p, '规则类');
    shop = await readShop(p);
    check('规则类 2 件', shop.items.length === 2, { count: shop.items.length });
    const waiver = shop.items[0];
    check('【规则豁免】是唯一已生效的商品，不带「待接入」标签', waiver.name === '规则豁免' && waiver.tag === null, { item: waiver });
    check('【规则豁免】限购 2、单价 70', waiver.price === '70' && /限购 2/.test(waiver.stock), { item: waiver });
    check('【面具修补】仍然标着待接入', /面具修补/.test(shop.items[1].name) && /效果待接入/.test(shop.items[1].tag), { item: shop.items[1] });

    // ---------- C. 买一件：扣点 / 记持有 / 进明细 ----------
    const before = await p.evaluate(() => window.MuseumPoints.balance());
    await p.evaluate(() => { Array.from(document.querySelectorAll('.shop-item')).find(i => /规则豁免/.test(i.textContent)).querySelector('.shop-buy').click(); });
    await p.waitForTimeout(300);
    const afterBuy = await p.evaluate(() => {
      const s = MuseumState.load(MuseumAuth.getCurrentUser().id);
      return { balance: window.MuseumPoints.balance(), owned: s.shopOwned, recent: window.MuseumPoints.recent(1)[0], float: (document.querySelector('.points-float.is-cost') || {}).textContent };
    });
    check('买一件按单价扣点（240 − 70）', before === 240 && afterBuy.balance === 170, { before: before, after: afterBuy });
    check('持有物记下来了（waiver: 1）', afterBuy.owned && afterBuy.owned.waiver === 1, { owned: afterBuy.owned });
    check('购买进收支明细，来源是商品名', afterBuy.recent && afterBuy.recent.delta === -70 && afterBuy.recent.source === '规则豁免', { recent: afterBuy.recent });
    check('购买会飘字', afterBuy.float === '−70 规则豁免', { float: afterBuy.float });

    shop = await readShop(p);
    check('买完列表立刻更新余量（限购 2 · 已购 1）', /限购 2 · 已购 1/.test(shop.items[0].stock), { stock: shop.items[0].stock });
    check('商城的余额行跟着变（170）', shop.balance === '170', { balance: shop.balance });

    // ---------- D. 限购到顶 ----------
    await p.evaluate(() => { Array.from(document.querySelectorAll('.shop-item')).find(i => /规则豁免/.test(i.textContent)).querySelector('.shop-buy').click(); });
    await p.waitForTimeout(300);
    shop = await readShop(p);
    check('买到限购上限后按钮变「已售罄」且禁用', shop.items[0].buyDisabled === true && shop.items[0].buyLabel === '已售罄', { item: shop.items[0] });
    const atLimit = await p.evaluate(() => ({ balance: window.MuseumPoints.balance(), owned: MuseumState.load(MuseumAuth.getCurrentUser().id).shopOwned.waiver }));
    check('售罄后再点不会超买', atLimit.owned === 2 && atLimit.balance === 100, atLimit);

    // ---------- E. 买不起 ----------
    // 100 点，买 300 的【回滚】买不起
    await openTab(p, '剧情类');
    await p.evaluate(() => document.querySelector('.shop-buy').click());
    await p.waitForTimeout(300);
    const broke = await p.evaluate(() => ({
      balance: window.MuseumPoints.balance(),
      owned: MuseumState.load(MuseumAuth.getCurrentUser().id).shopOwned,
      denied: (document.querySelector('.points-float.is-denied') || {}).textContent
    }));
    check('买不起时一分钱都不扣', broke.balance === 100, broke);
    check('买不起时不写持有物', !broke.owned.rollback, broke);
    check('买不起时给出提示', typeof broke.denied === 'string' && broke.denied.indexOf('生存点不足') === 0, { denied: broke.denied });

    // ---------- F. 【规则豁免】在守则小游戏里由玩家自己选 ----------
    // ⚠️ 站位必须**从 seed 阶段**就写好，不能在游戏页上现改坐标：地图页内存里那份
    // state 会在 pagehide 时回写一次，把自己的坐标覆盖回去（guard 挡的是别的标签页，
    // 挡不住自己这一页）。守则告示在大厅 (1240, 610)，站在它下方 30 像素。
    await p.close();
    await seed("s.roomId='hall'; s.currentNode='hall'; s.playerX=1240; s.playerY=640; s.points=100; s.shopOwned={ waiver: 2 };");
    p = await openMap();
    await p.keyboard.press('e');
    await p.waitForTimeout(600);
    const atSign = await p.evaluate(() => ({ open: !document.getElementById('rules-overlay').hidden, options: document.getElementById('rules-options').children.length }));
    check('站到守则告示前，按 E 打开小游戏', atSign.open === true && atSign.options === 3, atSign);
    await p.evaluate(() => document.getElementById('rules-options').children[2].click());
    await p.waitForTimeout(400);
    const offered = await p.evaluate(() => {
      const box = document.getElementById('rules-waiver');
      const options = document.getElementById('rules-options');
      return {
        waiverShown: box && !box.hidden,
        buttons: box ? Array.from(box.children).map(b => b.textContent) : [],
        optionsLocked: Array.from(options.children).every(b => b.disabled),
        feedback: document.getElementById('rules-feedback').textContent,
        balance: window.MuseumPoints.balance(),
        owned: MuseumState.load(MuseumAuth.getCurrentUser().id).shopOwned
      };
    });
    check('答错时持有豁免 → 弹出选择，而不是自动抵扣', offered.waiverShown === true, offered);
    check('选择是两个：用掉一张 / 照扣 60', offered.buttons.length === 2 && /用掉一张/.test(offered.buttons[0]) && /照扣 60/.test(offered.buttons[1]), { buttons: offered.buttons });
    check('选择没落定之前锁住三个规则选项（防连点）', offered.optionsLocked === true, offered);
    check('弹出选择时还没扣钱', offered.balance === 100 && offered.owned.waiver === 2, { balance: offered.balance, owned: offered.owned });

    // 选「用掉一张」
    await p.evaluate(() => document.getElementById('rules-waiver').children[0].click());
    await p.waitForTimeout(400);
    const usedWaiver = await p.evaluate(() => ({
      balance: window.MuseumPoints.balance(),
      owned: MuseumState.load(MuseumAuth.getCurrentUser().id).shopOwned,
      waiverHidden: document.getElementById('rules-waiver').hidden,
      optionsUnlocked: Array.from(document.getElementById('rules-options').children).every(b => !b.disabled),
      feedback: document.getElementById('rules-feedback').textContent,
      floats: Array.from(document.querySelectorAll('.points-float')).map(f => f.textContent)
    }));
    check('选「用掉一张」→ 本次不扣钱', usedWaiver.balance === 100, usedWaiver);
    check('持有物减一件（2 → 1）', usedWaiver.owned.waiver === 1, { owned: usedWaiver.owned });
    check('用掉后收起点选框、解锁规则选项（还能继续试）', usedWaiver.waiverHidden === true && usedWaiver.optionsUnlocked === true, usedWaiver);
    check('扣罚没有发生，所以没有 −60 的飘字', !usedWaiver.floats.some(t => /−60/.test(t)), { floats: usedWaiver.floats });

    // 再答错一次，这次选「照扣」
    await p.evaluate(() => document.getElementById('rules-options').children[2].click());
    await p.waitForTimeout(400);
    await p.evaluate(() => document.getElementById('rules-waiver').children[1].click());
    await p.waitForTimeout(400);
    const paidInstead = await p.evaluate(() => ({
      balance: window.MuseumPoints.balance(),
      owned: MuseumState.load(MuseumAuth.getCurrentUser().id).shopOwned,
      feedback: document.getElementById('rules-feedback').textContent
    }));
    check('选「照扣 60」→ 扣掉 60（100 → 40）', paidInstead.balance === 40, paidInstead);
    check('选「照扣」不消耗豁免（还是 1 张）', paidInstead.owned.waiver === 1, { owned: paidInstead.owned });
    check('扣罚文案带上了实际扣掉的数', /生存点 −60/.test(paidInstead.feedback), { feedback: paidInstead.feedback });
    await p.close();

    // ---------- G. 豁免用光后答错就是直接扣钱 ----------
    await seed("s.roomId='hall'; s.currentNode='hall'; s.playerX=1240; s.playerY=640; s.points=240; s.shopOwned={ waiver: 0 };");
    p = await openMap();
    await p.keyboard.press('e'); await p.waitForTimeout(600);
    await p.evaluate(() => document.getElementById('rules-options').children[2].click());
    await p.waitForTimeout(400);
    const noWaiver = await p.evaluate(() => ({
      waiverShown: !document.getElementById('rules-waiver').hidden,
      balance: window.MuseumPoints.balance()
    }));
    check('手上没有豁免时答错不弹选择，直接扣（240 − 60）', noWaiver.waiverShown === false && noWaiver.balance === 180, noWaiver);
    await p.close();

    // ---------- H. 老存档的持有物坏值 ----------
    await seed("s.shopOwned = { waiver: 'x', mag: -3, stamp: 2.7 };");
    p = await openMap();
    const sanitized = await p.evaluate(() => MuseumState.load(MuseumAuth.getCurrentUser().id).shopOwned);
    check('持有物的坏值被清掉，只留正整数件数', JSON.stringify(sanitized) === JSON.stringify({ stamp: 3 }), { sanitized: sanitized });
    await p.close();

    check('全程没有页面报错', errors.length === 0, errors.slice(0, 3));
  } finally {
    await b.close().catch(() => null);
    server.close();
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
