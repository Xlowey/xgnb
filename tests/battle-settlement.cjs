/* Real map return: attempt validation, retry accounting, death, and one commit. */
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', ({ '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.png':'image/png', '.webp':'image/webp' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
let fails = 0;
function check(label, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : ' <- ' + JSON.stringify(detail))); if (!ok) fails++; }
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [];
  let ctx;
  try {
    async function setup(options = {}) {
      if (ctx) await ctx.close();
      ctx = await browser.newContext();
      const page = await ctx.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/index.html');
      const seeded = await page.evaluate(options => {
        const user = MuseumAuth.register('战斗结算', 'x').user;
        const state = MuseumState.create(user);
        state.hp = options.hp === undefined ? 100 : options.hp;
        state.points = 500;
        state.roomId = 'museum'; state.currentNode = 'museum'; state.playerX = 610; state.playerY = 620;
        state.mode = 'novel'; state.narrativeNode = 'scene-27-boss'; state.narrativeIndex = 0;
        Object.keys(state.tutorial).forEach(key => { state.tutorial[key] = true; });
        if (options.rollback) state.shopOwned = { rollback: 1 };
        if (options.checkpoint !== false) {
          const checkpoint = JSON.parse(JSON.stringify(state));
          checkpoint.points = 900;
          MuseumState.saveCheckpoint(checkpoint, user.id, { sceneId: 'scene-27-boss', narrativeIndex: 0 });
        }
        state.flags.nightmareMinigameChoice = 'enter';
        state.returnRoom = 'dorm'; state.returnX = 100; state.returnY = 200;
        state.returnScene = 'scene-28'; state.narrativeNode = 'scene-28'; state.battleContext = 'final-boss';
        state.mode = options.mode || 'battle';
        state.battleAttempt = { id: 'attempt-1', source: 'pixel-dungeon', retryScene: 'scene-27-boss', retryIndex: 0, returnScene: 'scene-28' };
        MuseumState.save(state, user.id);
        const result = { status: options.status || 'win', hitsTaken: 0, userId: user.id, source: 'pixel-dungeon', battleAttempt: options.token || 'attempt-1' };
        if (options.pending !== false) localStorage.setItem('museum_pending_battle_v1', JSON.stringify(result));
        return { state, result };
      }, options);
      return { page, seeded };
    }
    const read = page => page.evaluate(() => ({ state: MuseumState.load(MuseumAuth.getCurrentUser().id), pending: localStorage.getItem('museum_pending_battle_v1'), url: location.href }));
    async function returned(page, query = 'fromBattle=1') {
      await page.goto(base + '/index.html?' + query);
      await page.waitForURL(/\/pages\/novel\.html\?scene=/);
      await page.waitForFunction(() => window.MuseumState && window.MuseumStory);
      return read(page);
    }

    let { page, seeded } = await setup({ mode: 'explore' });
    await page.goto(base + '/index.html?fromSave=1');
    let after = await read(page);
    check('loading a map save does not consume an old victory', !/novel\.html/.test(after.url) && after.state.hp === 100 && after.state.points === 500 && !after.state.flags.nightmareMinigameWon, after);

    ({ page } = await setup({ token: 'old-attempt' }));
    after = await returned(page);
    check('old attempt cannot win the current battle', /scene-27-boss/.test(after.url) && after.state.hp === 100 && after.state.points === 500 && !after.state.flags.nightmareMinigameWon, after);

    ({ page, seeded } = await setup());
    after = await returned(page);
    check('valid boss victory returns to scene-28 at the museum exit', /scene-28/.test(after.url) && after.state.roomId === 'museum' && after.state.playerX === 610 && after.state.playerY === 620 && after.state.returnX === 610 && after.state.returnY === 620, after);
    check('victory records both the choice and completed minigame', after.state.flags.nightmareMinigameChoice === 'enter' && after.state.flags.nightmareMinigameWon === true && after.state.flags.boss_defeated === true, after.state.flags);
    check('victory charges humanity and grants its reward once', after.state.hp === 86 && after.state.minigamePlays.dungeon === 1 && after.state.pointsLog.filter(entry => entry.source === '首领战胜利').length === 1, { hp: after.state.hp, plays: after.state.minigamePlays, log: after.state.pointsLog });
    check('committed victory clears result and battle context', after.pending === null && after.state.battleAttempt === null && after.state.battleContext === null && after.state.returnScene === null, after);
    // Simulate loading an older in-battle save and receiving the same demo result again.
    await page.goto(base + '/pages/saves.html');
    await page.evaluate(seeded => { MuseumState.save(seeded.state, seeded.state.userId); localStorage.setItem('museum_pending_battle_v1', JSON.stringify(seeded.result)); }, seeded);
    after = await returned(page);
    check('replayed result after loading an old battle save returns to retry without reward', /scene-27-boss/.test(after.url) && after.state.hp === 100 && after.state.points === 500 && after.state.minigamePlays.dungeon === 0 && after.pending === null, after);

    ({ page } = await setup({ status: 'lose' }));
    after = await returned(page);
    check('loss retries the boss without restoring the checkpoint wallet', /scene-27-boss/.test(after.url) && after.state.points === 200 && after.state.hp === 100 && after.state.flags.nightmareMinigameChoice === 'enter', after);
    await page.goto(base + '/pages/saves.html');
    await page.evaluate(() => {
      const user = MuseumAuth.getCurrentUser();
      const state = MuseumState.load(user.id);
      state.mode = 'battle'; state.narrativeNode = 'scene-28'; state.returnScene = 'scene-28'; state.battleContext = 'final-boss';
      state.battleAttempt = { id: 'attempt-2', source: 'pixel-dungeon', retryScene: 'scene-27-boss', retryIndex: 0, returnScene: 'scene-28' };
      MuseumState.save(state, user.id);
      localStorage.setItem('museum_pending_battle_v1', JSON.stringify({ status: 'lose', hitsTaken: 0, userId: user.id, source: 'pixel-dungeon', battleAttempt: 'attempt-2' }));
    });
    after = await returned(page);
    check('a second loss charges the remaining wallet instead of refunding the first', after.state.points === 0 && after.state.hp === 100 && after.state.pointsLog.filter(entry => entry.source === '战斗失败').map(entry => entry.delta).join(',') === '-300,-200', after.state);

    ({ page } = await setup({ status: 'lose', checkpoint: false }));
    after = await returned(page);
    check('loss without a checkpoint still returns to a playable retry', /scene-27-boss/.test(after.url) && after.state.points === 200 && after.state.battleAttempt === null && !after.state.flags.nightmareMinigameWon, after);

    ({ page } = await setup({ hp: 10 }));
    after = await returned(page);
    check('zero humanity without rollback reaches D without a win reward', /ending-d/.test(after.url) && after.state.hp === 0 && after.state.points === 500 && after.state.minigamePlays.dungeon === 0 && !after.state.flags.nightmareMinigameWon && after.pending === null, after);

    ({ page } = await setup({ hp: 10, rollback: true }));
    after = await returned(page);
    check('rollback is consumed and saved before normal victory continues', /scene-28/.test(after.url) && after.state.hp === 100 && !after.state.shopOwned.rollback && after.state.flags.nightmareMinigameWon === true, after);

    ({ page } = await setup({ pending: false }));
    after = await returned(page, 'fromSave=1');
    check('loading an unfinished battle returns to its choice, never the victory scene', /scene-27-boss/.test(after.url) && after.state.points === 500 && !after.state.flags.nightmareMinigameWon, after);

    ({ page } = await setup());
    await page.evaluate(() => sessionStorage.setItem('block-battle-save', '1'));
    await page.addInitScript(() => {
      if (!location.search.includes('fromBattle=1') || sessionStorage.getItem('block-battle-save') !== '1') return;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (String(key).startsWith('museum_save_v5_auto_')) throw new DOMException('test write failure', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await page.goto(base + '/index.html?fromBattle=1');
    after = await read(page);
    check('failed commit preserves the battle and pending result without partial damage or rewards', !/novel\.html/.test(after.url) && after.state.mode === 'battle' && after.state.hp === 100 && after.state.points === 500 && !!after.pending, after);
    await page.evaluate(() => sessionStorage.removeItem('block-battle-save'));
    after = await returned(page);
    check('retry after a write failure settles exactly once', after.state.hp === 86 && after.state.minigamePlays.dungeon === 1 && after.state.pointsLog.filter(entry => entry.source === '首领战胜利').length === 1 && after.pending === null, after);
    check('battle settlement has no page errors', errors.length === 0, errors);
  } finally {
    if (ctx) await ctx.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
