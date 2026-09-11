/*
 * Focus management for the overlays that declare aria-modal="true".
 * The audit measured Tab escaping the dialog (5/14, 3/16, 11/12, 9/10, 7/10, 9/10 stops).
 * This asserts focus moves in on open, Tab cycles inside, and focus returns on close.
 */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
let fails = 0;
const check = (l, ok, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + l + (ok || d === undefined ? '' : '  <- ' + JSON.stringify(d))); if (!ok) fails += 1; };

(async () => {
  await new Promise(r => server.listen(8811, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();

  const tabStops = async (sel, n) => tabStopsOn(page, sel, n);
  const tabStopsOn = async (target, sel, n) => {
    let outside = 0; const seen = [];
    for (let i = 0; i < n; i += 1) {
      await target.keyboard.press('Tab');
      await target.waitForTimeout(55);
      const info = await target.evaluate(s => {
        const ov = document.querySelector(s);
        const a = document.activeElement;
        return { inside: !!ov && ov.contains(a), tag: a ? (a.id ? '#' + a.id : a.tagName) : 'none' };
      }, sel);
      if (!info.inside) outside += 1;
      seen.push(info.tag);
    }
    return { outside, seen };
  };
  const openMap = async () => {
    await page.goto('http://127.0.0.1:8811/index.html?fromSave=1');
    await page.waitForTimeout(400);
    if (await page.isVisible('#cover-screen')) await page.click('#continue-button');
    await page.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await page.waitForTimeout(400);
  };
  const overlayTest = async (label, openFn, sel, stops, initialRe) => {
    await openMap();
    await openFn();
    await page.waitForTimeout(500);
    const opened = await page.evaluate(s => !document.querySelector(s).hidden, sel);
    check(label + ': opens', opened);
    if (!opened) return;
    const focused = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
    check(label + ': focus moves in on open', initialRe.test(focused), focused);
    const t = await tabStops(sel, stops);
    check(label + ': Tab never escapes (' + stops + ' stops)', t.outside === 0, { outside: t.outside, seen: t.seen.slice(0, 6) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
    check(label + ': focus returns on close', back !== 'BODY' && back !== 'none', back);
  };

  try {
    await page.goto('http://127.0.0.1:8811/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('焦点', 'x').user;
      const s = MuseumState.create(u);
      s.roomId = 'dorm'; s.mode = 'explore';
      s.flags = Object.assign({}, s.flags, { scene03Seen: true, hasKey: true });
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    });

    await overlayTest('地图暂停', async () => { await page.keyboard.press('Escape'); }, '#pause-overlay', 14, /resume-button/);
    await overlayTest('存档面板', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.click('#save-button'); }, '#save-panel', 16, /save-mode-button/);
    await overlayTest('文本回顾', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.click('#log-button'); }, '#log-panel', 12, /close-log-panel/);

    // 告示规则小游戏：大厅的值班告示在 (1240,610)。
    // 注意：不能在已打开的地图页里改存档再刷新——那一页会在卸载时把它的旧内存状态
    // 写回去（多标签页保护正是这样工作的）。所以用新开一页的方式进入大厅。
    await page.evaluate(() => { const u = MuseumAuth.getCurrentUser().id; const s = MuseumState.load(u); s.roomId = 'hall'; s.playerX = 1240; s.playerY = 690; s.mode = 'explore'; MuseumState.save(s, u); });
    {
      const fresh = await ctx.newPage();
      fresh.on('pageerror', e => console.log('        [rules pageerror]', e.message));
      await fresh.goto('http://127.0.0.1:8811/index.html?fromSave=1');
      await fresh.waitForTimeout(500);
      if (await fresh.isVisible('#cover-screen')) await fresh.click('#continue-button');
      await fresh.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
      await fresh.waitForTimeout(600);
      const probe = await fresh.evaluate(() => { const s = MuseumState.load(MuseumAuth.getCurrentUser().id); return { room: s.roomId, x: s.playerX, prompt: document.getElementById('interaction-prompt').textContent }; });
      check('规则小游戏: the player is in the hall', probe.room === 'hall', probe);
      await fresh.keyboard.press('e');
      await fresh.waitForTimeout(500);
      const opened = await fresh.evaluate(() => !document.getElementById('rules-overlay').hidden);
      check('规则小游戏: opens', opened, probe);
      if (opened) {
        const t = await tabStopsOn(fresh, '#rules-overlay', 10);
        check('规则小游戏: Tab never escapes (10 stops)', t.outside === 0, { outside: t.outside, seen: t.seen.slice(0, 6) });
      }
      await fresh.close();
      await openMap();
    }

    // 剧情页的两个浮层。
    await page.goto('http://127.0.0.1:8811/pages/novel.html?scene=scene-05');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    await page.waitForTimeout(700);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const nOpen = await page.evaluate(() => !document.getElementById('novel-pause').hidden);
    check('剧情暂停: opens', nOpen);
    if (nOpen) {
      const f = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
      check('剧情暂停: focus moves in on open', /novel-resume-button/.test(f), f);
      const t = await tabStops('#novel-pause', 10);
      check('剧情暂停: Tab never escapes (10 stops)', t.outside === 0, { outside: t.outside, seen: t.seen.slice(0, 6) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
    await page.click('#novel-review-button');
    await page.waitForTimeout(500);
    const rOpen = await page.evaluate(() => !document.getElementById('novel-review').hidden);
    check('剧情回顾: opens', rOpen);
    if (rOpen) {
      const t = await tabStops('#novel-review', 12);
      check('剧情回顾: Tab never escapes (12 stops)', t.outside === 0, { outside: t.outside, seen: t.seen.slice(0, 6) });
    }
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
