/*
 * 双击打开（file://）的守卫。
 *
 * 作业的交付要求是「老师解压后双击 index.html 即可进入游戏」——但其余测试全都起了一个
 * HTTP 服务器，**真正的交付路径反而没人守**。服务器下能跑不代表 file:// 下能跑：
 * file:// 是个不透明来源，localStorage、相对跳转、`new URL()` 的行为都可能不同。
 *
 * 这个脚本不起服务器，直接用 `file://` 打开本地目录跑一遍关键路径：
 *   进地图 → M 开面板 → 商城 → 跳券机 → 券机余额接上主游戏 points。
 *
 * 跑法：node tests/offline-file.cjs
 */
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let fails = 0;
const errors = [];
const check = (label, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : '  <- ' + JSON.stringify(detail))); if (!ok) fails += 1; };

(async () => {
  // 先确认路径里有中文和括号也能正确转成 file:// —— 仓库正好在「程序设计（小学期）」下面，
  // 手写 file:// 字符串很容易在这里翻车，交给 pathToFileURL。
  const base = pathToFileURL(ROOT).href;
  check('仓库路径能转成 file:// URL（含中文与全角括号）', base.startsWith('file:///') && fs.existsSync(path.join(ROOT, 'index.html')), { base: base.slice(-40) });

  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });

  try {
    // 种子：在 pages/saves.html 上写一份存档（这个页面不加载 game.js，不会把旧 state 写回去）。
    const sh = await ctx.newPage();
    sh.on('pageerror', e => errors.push('seed: ' + e.message));
    await sh.goto(base + '/pages/saves.html');
    await sh.waitForTimeout(600);
    const seeded = await sh.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('双击', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore';
      s.flags = Object.assign({}, s.flags, { scene01Seen: true });
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
      return { userId: u.id, points: s.points };
    });
    check('file:// 下 localStorage 可写（存档落得下去）', Boolean(seeded.userId), seeded);
    await sh.close();

    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('game: ' + e.message));
    await p.goto(base + '/index.html?fromSave=1');
    await p.waitForTimeout(800);
    if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
    await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await p.waitForTimeout(700);
    check('file:// 下能进地图', await p.locator('#game-screen').isVisible(), {});

    await p.keyboard.press('m');
    await p.waitForTimeout(400);
    check('file:// 下 M 能开系统面板', await p.evaluate(() => window.MuseumPanel.isOpen()), {});

    await p.click('[data-shop-open]');
    await p.waitForTimeout(400);
    const shop = await p.evaluate(() => ({ items: document.querySelectorAll('.shop-item').length, total: window.MuseumShopData.total() }));
    check('file:// 下商城能打开，商品表仍在', shop.items > 0 && shop.total === 4280, shop);

    // 商城是面板里的另一个视图，先退回概览才点得到券机入口。
    await p.click('.panel-back');
    await p.waitForTimeout(300);
    await p.click('[data-machine-open]');
    await p.waitForTimeout(2500);
    check('file:// 下能跳到 demos/scratch/', /\/demos\/scratch\/index\.html$/.test(new URL(p.url()).pathname), { url: p.url().slice(-56) });

    const scratch = await p.evaluate(() => ({ bridged: window.MuseumScratchGame.isBridged(), balance: window.MuseumScratchGame.getBalance() }));
    check('file:// 下券机余额接的是主游戏 points（不是演示的 200）', scratch.bridged === true && scratch.balance === seeded.points, { scratch: scratch, points: seeded.points });

    check('file:// 全程没有页面报错', errors.length === 0, errors.slice(0, 3));
  } finally {
    await b.close().catch(() => null);
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
