/* Final-choice regression: real choice buttons, visible countdown, exact destinations. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
  res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
let fails = 0;
function check(label, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : ' ' + JSON.stringify(detail))); if (!ok) fails++; }
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const ctx = await browser.newContext({viewport:{width:1366,height:768}});
  const errors = [];
  async function finale() {
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('终局', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'novel'; s.narrativeNode = 'ending-choice';
      Object.assign(s.flags, {scene28Seen:true, scene01Seen:true, hasKey:true, nightmareMinigameChoice:'skip'});
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s,u.id);
    });
    await page.clock.install();
    await page.goto(origin + '/pages/novel.html?scene=ending-choice');
    await page.waitForSelector('#novel-choices .novel-choice');
    return page;
  }
  const scene = page => new URL(page.url()).searchParams.get('scene');
  const seconds = async page => {
    const text = await page.locator('#novel-next').textContent();
    const match = /(\d+)\s*秒/.exec(text);
    return match ? Number(match[1]) : null;
  };
  try {
    let page = await finale();
    const first = await seconds(page);
    check('最终抉择的倒计时实际可见', await page.locator('#novel-next').isVisible() && first > 0, first);
    await page.clock.runFor(3000);
    const later = await seconds(page);
    check('倒计时明确减少三秒', later === first - 3, {first,later});
    await page.clock.runFor(16000);
    check('超时必须进入 ending-d，不能仍停留 ending-choice', scene(page) === 'ending-d', page.url());
    await page.close();

    page = await finale();
    const exitChoice = page.locator('#novel-choices .novel-choice').filter({hasText:'进入出口'});
    check('找到真实的进入出口选项', await exitChoice.count() === 1);
    await exitChoice.click();
    check('点击后立刻进入指定 B 结局', scene(page) === 'ending-b', page.url());
    await page.clock.runFor(17000);
    check('选过之后计时器不再把玩家踢到 D', scene(page) === 'ending-b', page.url());
    await page.close();
    check('计时与切场无页面异常', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  process.exitCode = fails ? 1 : 0;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
