/* Integration: the real novel binds gameplay services before settling preview results. */
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/__seed.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end('<script src="/js/auth.js"></script><script src="/js/state.js"></script>'); }
  const file = path.join(ROOT, url.replace(/^\/+/, '') || 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', ({ '.js':'text/javascript; charset=utf-8', '.css':'text/css', '.html':'text/html; charset=utf-8', '.png':'image/png', '.webp':'image/webp' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
let fails = 0;
function check(label, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : ' <- ' + JSON.stringify(detail))); if (!ok) fails++; }
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  let ctx;
  const errors = [];
  try {
    async function seed(options = {}) {
      if (ctx) await ctx.close();
      ctx = await browser.newContext();
      const page = await ctx.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/__seed.html');
      await page.evaluate(options => {
        const other = MuseumAuth.register('正式档案', 'x').user;
        const accountState = MuseumState.create(other);
        accountState.hp = 80; accountState.points = 880;
        MuseumState.save(accountState, other.id);
        const state = MuseumState.create({ id: 'class-preview', username: '体验者' });
        const boss = options.finalBoss !== false;
        state.hp = options.hp === undefined ? 100 : options.hp;
        state.points = 500;
        Object.keys(state.tutorial).forEach(key => { state.tutorial[key] = true; });
        state.mode = 'battle'; state.battleContext = boss ? 'final-boss' : null;
        state.narrativeNode = state.returnScene = boss ? 'scene-28' : 'guard-after-battle';
        state.narrativeIndex = 0;
        state.flags.nightmareMinigameChoice = 'enter';
        state.flags.nightmareMinigameWon = false;
        state.returnRoom = 'hall'; state.returnX = 400; state.returnY = 510;
        state.battleAttempt = { id: 'preview-1', source: boss ? 'pixel-dungeon' : 'battle', retryScene: boss ? 'scene-27-boss' : 'scene-11', retryIndex: 0, returnScene: state.returnScene };
        if (options.rollback) state.shopOwned = { rollback: 1 };
        sessionStorage.setItem('museum_class_preview', JSON.stringify(state));
        if (options.pending !== false) sessionStorage.setItem('museum_pending_battle_v1', JSON.stringify({
          status: options.status || 'win', hitsTaken: 2,
          userId: options.wrongUser ? other.id : 'class-preview',
          source: options.source || state.battleAttempt.source,
          battleAttempt: options.token || state.battleAttempt.id
        }));
      }, options);
      return page;
    }
    async function snapshot(page) {
      return page.evaluate(() => ({
        state: JSON.parse(sessionStorage.getItem('museum_class_preview')),
        pending: sessionStorage.getItem('museum_pending_battle_v1'),
        boundHp: MuseumHumanity.value(), boundPoints: MuseumPoints.balance(), rollback: MuseumShop.count('rollback'),
        account: MuseumState.load(MuseumAuth.getCurrentUser().id),
        url: location.href, title: document.getElementById('novel-title').textContent
      }));
    }
    async function enter(page, finalBoss = true) {
      await page.goto(base + '/pages/novel.html?scene=' + (finalBoss ? 'scene-28' : 'guard-after-battle') + '&preview=1&resume=1');
      await page.waitForFunction(() => window.MuseumPreviewBattle && window.MuseumHumanity && window.MuseumPoints);
      return snapshot(page);
    }
    const victoryCount = (state, source) => state.pointsLog.filter(entry => entry.source === source && entry.delta > 0).length;
    function identity(label, after) {
      check(label + ' gameplay services are bound to the preview state', after.state.userId === 'class-preview' && after.boundHp === after.state.hp && after.boundPoints === after.state.points, after);
      check(label + ' does not modify the signed-in account save', after.account.hp === 80 && after.account.points === 880 && after.account.minigamePlays.dungeon === 0, after.account);
    }

    let page = await seed();
    let after = await enter(page);
    check('preview victory reaches scene-28 with one reward and completion', /scene=scene-28&preview=1&resume=1/.test(after.url) && after.state.hp === 74 && after.state.flags.nightmareMinigameWon && after.state.flags.boss_defeated && after.state.minigamePlays.dungeon === 1 && victoryCount(after.state, '首领战胜利') === 1, after);
    check('preview victory saves the museum exit and clears pending context', after.state.roomId === 'museum' && after.state.playerX === 610 && after.state.playerY === 620 && after.state.returnRoom === 'museum' && after.state.returnX === 610 && after.state.returnY === 620 && after.state.battleAttempt === null && after.pending === null, after);
    identity('boss victory', after);
    const won = after.state;
    await page.reload();
    after = await snapshot(page);
    check('refreshing preview victory cannot charge or reward again', after.state.hp === won.hp && after.state.points === won.points && after.state.pointsLog.length === won.pointsLog.length && after.state.minigamePlays.dungeon === 1 && /scene=scene-28/.test(after.url), after);

    page = await seed({ finalBoss: false });
    after = await enter(page, false);
    check('director preview binds rewards and achievement to its own state', /scene=guard-after-battle/.test(after.url) && after.state.hp === 76 && after.state.flags.battleDemoCompleted && after.state.clues.includes('director-account') && after.state.achievements.includes('first-battle') && victoryCount(after.state, '馆长战胜利') === 1, after);
    identity('director victory', after);

    page = await seed({ status: 'lose' });
    after = await enter(page);
    check('preview loss charges 300 and returns to a playable boss retry', /scene=scene-27-boss&preview=1&resume=1/.test(after.url) && after.state.points === 200 && after.state.hp === 100 && !after.state.flags.nightmareMinigameWon && after.state.minigamePlays.dungeon === 0 && after.pending === null, after);
    await page.reload();
    after = await snapshot(page);
    check('refreshing a loss does not charge the penalty again', after.state.points === 200 && after.state.pointsLog.filter(entry => entry.source === '战斗失败').length === 1, after.state);

    for (const hp of [0, 10]) {
      page = await seed({ hp });
      after = await enter(page);
      check('preview humanity ' + hp + ' reaches D without a victory reward', /scene=ending-d&preview=1&resume=1/.test(after.url) && after.state.hp === 0 && after.state.points === 500 && after.state.flags.endingCause === 'humanity' && !after.state.flags.nightmareMinigameWon && after.state.minigamePlays.dungeon === 0 && after.pending === null, after);
      identity('humanity ' + hp, after);
    }

    page = await seed({ hp: 10, rollback: true });
    after = await enter(page);
    check('bound rollback is consumed and victory continues with 100 humanity', /scene=scene-28/.test(after.url) && after.state.hp === 100 && after.rollback === 0 && !after.state.shopOwned.rollback && after.state.flags.nightmareMinigameWon && victoryCount(after.state, '首领战胜利') === 1, after);
    await page.reload();
    after = await snapshot(page);
    check('rollback restoration and reward survive refresh without repeating', after.state.hp === 100 && after.rollback === 0 && after.state.minigamePlays.dungeon === 1 && victoryCount(after.state, '首领战胜利') === 1, after);

    for (const [label, options] of [ ['old token', { token: 'old-preview' }], ['foreign source', { source: 'battle' }], ['account result', { wrongUser: true }], ['missing result', { pending: false }] ]) {
      page = await seed(options);
      after = await enter(page);
      check(label + ' cannot complete the preview boss', /scene=scene-27-boss/.test(after.url) && after.state.hp === 100 && after.state.points === 500 && !after.state.flags.nightmareMinigameWon && after.state.minigamePlays.dungeon === 0, after);
      identity(label, after);
    }

    page = await seed();
    await page.evaluate(() => sessionStorage.setItem('block-preview-save', '1'));
    await page.addInitScript(() => {
      if (!location.search.includes('resume=1') || sessionStorage.getItem('block-preview-save') !== '1') return;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (this === sessionStorage && key === 'museum_class_preview') throw new DOMException('test write failure', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    after = await enter(page);
    check('preview save failure leaves original session and pending result intact', after.state.mode === 'battle' && after.state.hp === 100 && after.state.points === 500 && after.state.minigamePlays.dungeon === 0 && !!after.pending && after.boundHp === 100 && after.boundPoints === 500, after);
    await page.evaluate(() => sessionStorage.removeItem('block-preview-save'));
    await page.reload();
    after = await snapshot(page);
    check('retrying preview save settles the retained result once', after.state.hp === 74 && after.state.minigamePlays.dungeon === 1 && victoryCount(after.state, '首领战胜利') === 1 && after.pending === null, after);
    check('preview battle integration has no page errors', errors.length === 0, errors);
  } finally {
    if (ctx) await ctx.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
