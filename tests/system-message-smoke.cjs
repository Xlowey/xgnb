const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const check = (label, ok, detail) => console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : ' <- ' + JSON.stringify(detail)));
let failures = 0;
const expect = (label, ok, detail) => { check(label, ok, detail); if (!ok) failures += 1; };

(async () => {
  await new Promise(resolve => server.listen(8812, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function open(scene) {
    await page.goto('http://127.0.0.1:8812/pages/novel.html?scene=' + scene + '&preview=1');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    await page.waitForTimeout(350);
  }
  async function advanceUntilSystem(maxSteps) {
    for (let i = 0; i < maxSteps; i += 1) {
      const state = await page.evaluate(() => ({
        speaker: (document.getElementById('novel-speaker') || {}).textContent || '',
        event: document.body.dataset.event,
        panel: !!document.querySelector('.system-message:not([hidden])'),
        progress: (document.getElementById('novel-progress') || {}).textContent || ''
      }));
      if (/MOSS|系统/.test(state.speaker) || state.event === 'system') return Object.assign(state, { speaker: state.speaker.trim() });
      if (await page.locator('#novel-choices:not([hidden])').count()) break;
      await page.keyboard.press('e');
      await page.waitForTimeout(65);
    }
    return await page.evaluate(() => ({ speaker: ((document.getElementById('novel-speaker') || {}).textContent || '').trim(), event: document.body.dataset.event, panel: !!document.querySelector('.system-message:not([hidden])'), progress: ((document.getElementById('novel-progress') || {}).textContent || '') }));
  }
  try {
    await open('scene-01');
    const first = await advanceUntilSystem(8);
    first.label = await page.evaluate(() => { const label = document.querySelector('.system-message small'); return label ? label.textContent.trim() : null; });
    first.bottomText = await page.evaluate(() => (document.getElementById('novel-text') || {}).textContent || '');
    expect('event-based system line uses the top panel', first.event === 'system' && first.panel && first.label === '系统', first);
    expect('event-based system line clears the bottom dialogue text', first.bottomText === '', first);

    await open('scene-20');
    const later = await advanceUntilSystem(100);
    expect('line-based system line reaches the top panel', later.event === 'system' && later.panel, later);
    const lower = await page.evaluate(() => ({ speakerHidden: !!document.getElementById('novel-speaker').hidden, panelLabel: document.querySelector('.system-message small') && document.querySelector('.system-message small').textContent.trim() }));
    expect('line-based system line is not left as ordinary MOSS dialogue', later.event === 'system' && lower.speakerHidden && lower.panelLabel === '系统', Object.assign(later, lower));
    expect('no page errors', errors.length === 0, errors);
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }
  console.log(failures ? '\n' + failures + ' FAILED' : '\nOK');
  process.exitCode = failures ? 1 : 0;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
