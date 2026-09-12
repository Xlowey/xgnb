/*
 * 最终抉择的 15 秒倒计时。
 *
 * 这是"至少两个结局"里通往 ending-d（死亡）的唯一路径，靠计时器触发，最容易在改动中坏掉，
 * 而且坏了不会报错——玩家会一直等下去。这里在真实页面里跑一次完整倒计时：
 *   1. 打开最终抉择时应出现倒计时提示
 *   2. 倒计时数字会往下走
 *   3. 时间到之后自动走到 ending-d
 *   4. 倒计时期间点选项会取消计时器（不会过一会儿又被踢去 ending-d）
 */
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': body.length });
  res.end(body);
});
let fails = 0;
const check = (l, ok, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + l + (ok || d === undefined ? '' : '  <- ' + JSON.stringify(d))); if (!ok) fails += 1; };

(async () => {
  await new Promise(r => server.listen(8845, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const seed = async () => {
    const sh = await ctx.newPage();
    await sh.goto('http://127.0.0.1:8845/pages/saves.html');
    await sh.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('终局', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'novel'; s.narrativeNode = 'ending-choice';
      s.flags = Object.assign({}, s.flags, { scene30Seen: true, scene01Seen: true, hasKey: true });
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    });
    await sh.close();
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('        [pageerror]', e.message));
    await p.goto('http://127.0.0.1:8845/pages/novel.html?scene=ending-choice');
    await p.waitForTimeout(1200);
    return p;
  };

  try {
    // 1 + 2. the timer exists and counts down.
    let p = await seed();
    const t0 = await p.evaluate(() => {
      const el = document.getElementById('novel-next');
      const bodyText = document.body.innerText;
      const m = bodyText.match(/(\d{1,2})\s*秒/);
      return { hasTimerEl: !!el, timerText: el ? el.textContent.trim() : null, secondsInText: m ? Number(m[1]) : null };
    });
    check('最终抉择显示倒计时', t0.hasTimerEl || t0.secondsInText !== null, t0);
    const firstReading = t0.timerText || String(t0.secondsInText);
    await p.waitForTimeout(3000);
    const t1 = await p.evaluate(() => {
      const el = document.getElementById('novel-next');
      const m = document.body.innerText.match(/(\d{1,2})\s*秒/);
      return { timerText: el ? el.textContent.trim() : null, secondsInText: m ? Number(m[1]) : null };
    });
    const secondReading = t1.timerText || String(t1.secondsInText);
    check('倒计时在往下走', firstReading !== secondReading, { first: firstReading, after3s: secondReading });

    // 3. wait it out -> ending-d
    await p.waitForTimeout(16000);
    const done = await p.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 200) }));
    check('时间到自动走到 ending-d（死亡）', /ending-d/.test(done.url) || /生命体征归零|死亡/.test(done.text), { url: done.url, text: done.text.slice(0, 80) });
    await p.close();

    // 4. choosing before the timeout cancels it.
    p = await seed();
    const clicked = await p.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter(x => !/回顾|存档|返回|菜单|关闭/.test(x.textContent));
      if (!btns.length) return null;
      const label = btns[0].textContent.trim();
      btns[0].click();
      return label;
    });
    check('最终抉择能点选选项', Boolean(clicked), { clicked });
    await p.waitForTimeout(17000);
    const after = await p.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 260) }));
    check('选过之后不会被超时再踢去 ending-d', !/ending-d/.test(after.url), { url: after.url });
    check('选过之后确实进了一个结局', /ending-/.test(after.url) || /结局/.test(after.text), { url: after.url });
    await p.close();
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
