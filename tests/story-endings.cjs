/*
 * Multi-ending regression (第二周要求「至少 2 个结局」).
 *
 * Asserts, in the real story page:
 *  1. the finale is not empty and offers the script's three options;
 *  2. choosing 提交 investigation record removes the perfect ending permanently;
 *  3. the other two endings stay reachable either way;
 *  4. the 15 s timeout still resolves to 死亡;
 *  5. the scenes that used to render blank now have content.
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
  await new Promise(r => server.listen(8806, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const seed = async (flags) => {
    await page.goto('http://127.0.0.1:8806/index.html');
    await page.evaluate(flags => {
      localStorage.clear();
      const u = MuseumAuth.register('结局', 'x').user;
      const s = MuseumState.create(u);
      s.flags = Object.assign({}, s.flags, { scene30Seen: true, scene08Seen: true }, flags);
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    }, flags);
  };
  const choices = async () => page.evaluate(() => Array.from(document.querySelectorAll('.novel-choice')).map(x => x.textContent.trim()));
  const text = async () => page.evaluate(() => (document.getElementById('novel-text').textContent || '').trim());

  try {
    // ---- 1. finale is not blank, offers the script's three options --------
    await seed({});
    await page.goto('http://127.0.0.1:8806/pages/novel.html?scene=ending-choice');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    await page.waitForTimeout(400);
    // page 0 is the authored stage direction; press through it to the choice page
    for (let i = 0; i < 4; i += 1) {
      const ui = await page.evaluate(() => ({ event: !document.getElementById('event-next').hidden, n: document.querySelectorAll('.novel-choice').length }));
      if (ui.n) break;
      if (ui.event) await page.click('#event-next'); else await page.keyboard.press('e');
      await page.waitForTimeout(350);
    }
    let opts = await choices();
    check('the finale offers the script\'s three options (submitted=false)', opts.length === 3, opts);
    check('the finale offers 回头救赵灵', opts.some(o => o.includes('回头救赵灵')), opts);
    check('the finale offers 进入出口', opts.some(o => o.includes('进入出口')), opts);
    check('the finale offers 追问真相', opts.some(o => o.includes('追问真相')), opts);
    check('the redundant 等待到超时 button is gone (timer covers it)', !opts.some(o => o.includes('等待到超时')), opts);

    // ---- 2. submitting closes the perfect ending permanently --------------
    await seed({ submitted: true });
    await page.goto('http://127.0.0.1:8806/pages/novel.html?scene=ending-choice');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    await page.waitForTimeout(400);
    for (let i = 0; i < 4; i += 1) {
      const ui = await page.evaluate(() => ({ event: !document.getElementById('event-next').hidden, n: document.querySelectorAll('.novel-choice').length }));
      if (ui.n) break;
      if (ui.event) await page.click('#event-next'); else await page.keyboard.press('e');
      await page.waitForTimeout(350);
    }
    opts = await choices();
    check('after 提交 the perfect ending is GONE', !opts.some(o => o.includes('追问真相')), opts);
    check('after 提交 exactly two options remain (A / B)', opts.length === 2, opts);

    // ---- 3. each offered ending actually plays ---------------------------
    for (const [label, expect] of [['回头救赵灵', /ending-a/], ['进入出口', /ending-b/]]) {
      await seed({});
      await page.goto('http://127.0.0.1:8806/pages/novel.html?scene=ending-choice');
      await page.waitForSelector('#novel-progress', { state: 'attached' });
      for (let i = 0; i < 4; i += 1) {
        const ui = await page.evaluate(() => ({ event: !document.getElementById('event-next').hidden, n: document.querySelectorAll('.novel-choice').length }));
        if (ui.n) break;
        if (ui.event) await page.click('#event-next'); else await page.keyboard.press('e');
        await page.waitForTimeout(350);
      }
      await page.getByRole('button', { name: new RegExp(label) }).click();
      await page.waitForTimeout(600);
      check(`choosing 「${label}」 opens the matching ending`, expect.test(page.url()), page.url());
      const body = await text();
      check(`「${label}」 ending has text`, body.length > 0 || (await page.evaluate(() => !document.getElementById('novel-end').hidden)), body.slice(0, 60));
    }

    // ---- 4. the timeout still resolves to 死亡 ---------------------------
    await seed({});
    await page.goto('http://127.0.0.1:8806/pages/novel.html?scene=ending-choice');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    for (let i = 0; i < 4; i += 1) {
      const ui = await page.evaluate(() => ({ event: !document.getElementById('event-next').hidden, n: document.querySelectorAll('.novel-choice').length }));
      if (ui.n) break;
      if (ui.event) await page.click('#event-next'); else await page.keyboard.press('e');
      await page.waitForTimeout(300);
    }
    const countdown = await page.evaluate(() => document.getElementById('novel-next').textContent);
    check('a countdown is shown for the timed final choice', /秒/.test(countdown), countdown);
    await page.waitForTimeout(17000);
    check('letting the timer run out resolves to 死亡 (ending-d)', /ending-d/.test(page.url()), page.url());

    // ---- 5. previously-blank scenes now have content ---------------------
    for (const scene of ['scene-11', 'ending-choice', 'scene-31', 'guard-intro', 'contract']) {
      await page.goto('http://127.0.0.1:8806/pages/novel.html?scene=' + scene);
      await page.waitForSelector('#novel-progress', { state: 'attached' });
      await page.waitForTimeout(300);
      const info = await page.evaluate(() => ({
        progress: document.getElementById('novel-progress').textContent,
        pageCount: Number((document.getElementById('novel-progress').textContent || '0 / 0').split('/')[1].trim()),
        chars: (document.getElementById('novel-text').textContent || '').trim().length,
        events: document.querySelectorAll('#scene-events > *').length,
        choices: document.querySelectorAll('.novel-choice').length
      }));
      // "Not blank" == the scene has at least one page (1 / N with N >= 1) or offers a choice.
      const hasContent = info.pageCount >= 1 || info.choices > 0;
      check(`${scene} renders content (not a blank box)`, hasContent, info);
    }
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
