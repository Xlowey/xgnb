/*
 * Deployment proof: a fresh clone of what is committed must run.
 *
 * Exports the STAGED tree (what a clone would receive) into a temp directory, then
 * loads index.html and pages/novel.html from there in a real browser and fails on
 * any 404 or missing asset. This is the check that catches "works on my machine"
 * when an image was never staged.
 */
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const out = path.join(os.tmpdir(), 'museum-clone-' + Date.now());
fs.mkdirSync(out, { recursive: true });
// `git checkout-index` writes exactly the staged content, without the working tree.
execSync('git checkout-index -a -f --prefix="' + out.replace(/\\/g, '/') + '/"', { cwd: ROOT });
console.log('exported staged tree ->', out);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(out, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
let fails = 0;
const check = (l, ok, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + l + (ok || d === undefined ? '' : '  <- ' + JSON.stringify(d))); if (!ok) fails += 1; };

(async () => {
  await new Promise(r => server.listen(8807, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const missing = [], errors = [];
  page.on('response', r => { if (r.status() >= 400) missing.push(r.status() + ' ' + r.url()); });
  page.on('pageerror', e => errors.push(String(e.message)));
  try {
    await page.goto('http://127.0.0.1:8807/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('克隆', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore'; s.flags.scene03Seen = true; s.flags.hasKey = true;
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    });
    await page.goto('http://127.0.0.1:8807/index.html?fromSave=1');
    if (await page.isVisible('#cover-screen')) await page.click('#continue-button');
    await page.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await page.waitForTimeout(1500);
    check('the clone boots into the map', await page.isVisible('#game-screen'));

    // Every room map the player can reach must exist in the clone.
    const roomArt = await page.evaluate(() => {
      const rooms = MuseumMapData.create(); MuseumMapArt(rooms); MuseumChapterMaps(rooms);
      return Object.values(rooms).filter(r => r.art).map(r => ({ id: r.id, src: r.art.src }));
    });
    const fetched = roomArt.map(r => r.src.replace('http://127.0.0.1:8807/', ''));
    const gone = fetched.filter(p => !fs.existsSync(path.join(out, decodeURIComponent(p))));
    check('every room map file exists in the clone', gone.length === 0, gone);

    // Walk the story screen for its assets too.
    await page.goto('http://127.0.0.1:8807/pages/novel.html?scene=scene-01');
    await page.waitForTimeout(1200);
    for (let i = 0; i < 6; i += 1) {
      const ui = await page.evaluate(() => ({ event: !document.getElementById('event-next').hidden }));
      if (ui.event) await page.click('#event-next'); else await page.keyboard.press('e');
      await page.waitForTimeout(400);
    }
    const still = await page.evaluate(() => ({ url: location.href, ok: !!document.getElementById('novel-progress') }));
    check('the story screen runs from the clone', still.ok, still);

    // The decisive assertion: nothing the pages asked for was missing.
    const uniqueMissing = [...new Set(missing)].filter(m => !/favicon/.test(m));
    check('no missing asset in the clone', uniqueMissing.length === 0, uniqueMissing.slice(0, 10));
    check('no uncaught error in the clone', errors.length === 0, errors.slice(0, 4));
  } finally {
    await b.close(); server.close();
    fs.rmSync(out, { recursive: true, force: true });
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nCLONE IS PLAYABLE');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
