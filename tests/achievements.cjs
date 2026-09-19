/* Smoke-test the achievement registry, progress records, and save-state fields. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
let failures = 0;
function check(label, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : ' <- ' + JSON.stringify(detail))); if (!ok) failures += 1; }

(async () => {
  await new Promise(resolve => server.listen(8831, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:8831/pages/novel.html?scene=scene-01&preview=1');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    const result = await page.evaluate(() => {
      const state = MuseumState.create({ id: 'achievement-test', username: '测试' });
      const saves = [];
      MuseumAchievements.bind({ getState: () => state, save: () => saves.push(true), canOpen: () => true });
      const total = MuseumAchievementDefinitions.length;
      const names = MuseumAchievementDefinitions.map(def => def.id);
      const first = MuseumAchievements.unlock(state, 'first-step', { notify: false });
      const mid = MuseumAchievements.setProgress(state, 'clue-collector', 3, { notify: false });
      const finished = MuseumAchievements.setProgress(state, 'clue-collector', 5, { notify: false });
      const status = MuseumAchievements.status(state, 'clue-collector');
      const hidden = MuseumAchievements.status(state, 'ending-collector');
      state.endingHistory = ['ending-a', 'ending-b'];
      MuseumAchievements.setProgress(state, 'ending-collector', state.endingHistory.length, { notify: false });
      const roundTrip = JSON.parse(JSON.stringify(state));
      MuseumAchievements.normalize(roundTrip);
      return { total, names, first, mid, finished, status, hidden, saves: saves.length, achievements: state.achievements, endingProgress: MuseumAchievements.status(state, 'ending-collector'), roundTripHistory: roundTrip.endingHistory };
    });
    check('formal achievement definitions are registered', result.total >= 10 && result.names.includes('first-step') && result.names.includes('ending-collector'), result);
    check('one-shot achievements unlock once', result.first && result.achievements.includes('first-step'), result);
    check('progress achievements record and finish', result.mid && result.finished && result.status.unlocked && result.status.progress === result.status.target, result);
    check('hidden achievement keeps progress before unlock', result.hidden && !result.hidden.unlocked && result.hidden.progress === 0, result);
    check('achievement progress survives state hydration', result.endingProgress.progress === 2 && result.roundTripHistory.length === 2, result);
    await page.evaluate(() => { MuseumAchievements.bind({ getState: () => MuseumState.create({ id: 'ui-test', username: '测试' }), save: () => {}, canOpen: () => true, onOpen: () => {}, onClose: () => {} }); });
    await page.keyboard.press('j');
    check('achievement panel opens from the J shortcut', await page.locator('dialog.achievements-dialog[open]').count() === 1 && await page.locator('.achievement-card').count() >= 10);
    await page.keyboard.press('Escape');
    check('achievement test page has no runtime errors', errors.length === 0, errors);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nOK');
  process.exitCode = failures ? 1 : 0;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
