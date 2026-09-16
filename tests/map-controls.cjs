const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
let failures = 0;
const check = (label, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : ' <- ' + JSON.stringify(detail))); if (!ok) failures += 1; };

(async () => {
  await new Promise(resolve => server.listen(8817, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  async function seed(x) {
    await page.goto('http://127.0.0.1:8817/index.html');
    await page.evaluate(playerX => {
      localStorage.clear();
      const u = MuseumAuth.register('地图操作', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore'; s.roomId = 'corridor'; s.playerX = playerX; s.playerY = 450;
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    }, x);
  }
  async function open() {
    await page.goto('http://127.0.0.1:8817/index.html?fromSave=1');
    await page.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await page.waitForTimeout(500);
  }
  async function run(speedKey) {
    await page.keyboard.down('ArrowRight');
    if (speedKey) await page.keyboard.down(speedKey);
    await page.waitForTimeout(500);
    if (speedKey) await page.keyboard.up(speedKey);
    await page.keyboard.up('ArrowRight');
    // game.js writes its throttled auto-save every six seconds.
    await page.waitForTimeout(6400);
    return await page.evaluate(() => {
      const u = MuseumAuth.getCurrentUser();
      return MuseumState.load(u.id).playerX;
    });
  }
  try {
    await seed(1100);
    await open();
    let hud = await page.evaluate(() => ({ hidden: document.body.classList.contains('hide-map-guide'), display: getComputedStyle(document.querySelector('.map-guide')).display }));
    check('小地图默认隐藏', hud.hidden && hud.display === 'none', hud);
    await page.keyboard.press('Tab');
    hud = await page.evaluate(() => ({ hidden: document.body.classList.contains('hide-map-guide'), display: getComputedStyle(document.querySelector('.map-guide')).display }));
    check('Tab 显示小地图', !hud.hidden && hud.display !== 'none', hud);
    await page.keyboard.press('Tab');
    hud = await page.evaluate(() => ({ hidden: document.body.classList.contains('hide-map-guide'), display: getComputedStyle(document.querySelector('.map-guide')).display }));
    check('再次按 Tab 隐藏小地图', hud.hidden && hud.display === 'none', hud);

    await seed(1100); await open();
    const normalX = await run(null);
    await seed(1100); await open();
    const sprintX = await run('Shift');
    const normalDistance = normalX - 1100, sprintDistance = sprintX - 1100;
    check('Shift 疾跑速度约为普通移动的 1.5 倍', sprintDistance > normalDistance * 1.3 && sprintDistance < normalDistance * 1.7, { normalDistance, sprintDistance, normalX, sprintX });
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }
  console.log(failures ? '\n' + failures + ' FAILED' : '\nOK');
  process.exitCode = failures ? 1 : 0;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
