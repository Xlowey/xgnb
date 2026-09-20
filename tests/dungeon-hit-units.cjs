/*
 * 地牢回传的「挨打次数」到底是哪一把尺子，以及打完首领能不能走到 C。
 *
 * 2026-09-20 实测的 bug：打完首领、领了宝箱，结算完却进了**结局 D**。
 * 三处病灶都在这一条链上：
 *
 *   1. **单位**（js/game.js 的 settleBattleWin 按 `14 + 挨打次数 ×6` 扣人性值）：
 *      这个系数是 013 §8.1 按回合制那场战斗定的（「被击中 3—4 次算死亡临界点」），
 *      一次挨打是一个大事件；而弹幕地牢里蹭到一颗子弹就算一次，护甲还会边挨边回。
 *      整局几十次 → 损耗 100+ → 扣到 0 → 结局 D。打赢了反而进死亡结局。
 *      ⇒ 地牢只回传**真的掉血**的那些次数（demos/pixel-dungeon-html/game.js 的 hurtPlayer）。
 *      地牢只有 7 点血、**没有任何回血手段**，所以活着走出去的局这个数天然 ≤ 6，
 *      损耗封顶 14 + 6×6 = 50。
 *   2. **跨局残留**：hitsTaken / coins / route 这三个量挂在 window 上传给接入段，
 *      而「重新开始」走的是页面内的 reset()，**不刷新页面**——上一局的数会原样留在
 *      window 上。最坏的情况是「零命中通关」按上一局的命中数回去扣人性值。
 *      ⇒ 每局开始（initialState）三个镜像一起清零。
 *   3. **最终战的死活**：2026-09-20 拍板「打完首领一定 C」——这一笔损耗再也不能把
 *      destination 改成 ending-d。有【回滚】照常消耗（回满 100），没有就夹到「至少留 1 点」。
 *      013 §5.2「硬拼 → 归零」改由馆长战承担（tests/battle-settlement.cjs 里守着）。
 *
 * 跑法：node tests/dungeon-hit-units.cjs
 */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
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
    /* ---------- 一、地牢那一侧的计数单位与跨局清零 ---------- */
    ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/demos/pixel-dungeon-html/index.html');
    await page.waitForFunction(() => typeof window.__dungeonHurt === 'function');
    // 冻住循环：不然房间里的小怪会在我观察期间补刀，计数就不可复现了。
    await page.evaluate(() => window.__dungeonPause());

    // ⚠️ 判据只取 `window.__dungeonHits`，**不读 HUD 上的血量**：`#hp-value` 是帧循环
    // 刷的，而上面刚把循环冻住，读到的会是上一次渲染的旧值（第一版就是这么写错的）。
    // 探针整体在一个 evaluate 里同步跑完，帧回调插不进来，所以这 6 下之间没有第三方伤害。
    const probe = await page.evaluate(() => {
      const hitsNow = () => Number(window.__dungeonHits) || 0;
      const log = [hitsNow()];
      // 连打 6 下、每下 1 点：新档 7 血 5 甲，前 5 下该被护甲整块吃掉，第 6 下才动血。
      for (let i = 0; i < 6; i += 1) { window.__dungeonHurt(1); log.push(hitsNow()); }
      return log;
    });
    check('被打时脚本能拿到计数（接不上就是没跑起来）', probe[0] === 0, probe);
    check('被护甲整块吸掉的 5 下**一次都不计**', probe.slice(1, 6).every(count => count === 0), probe);
    check('掉血的那一下计 1 次（改之前这里会是 6——擦碰全算，正是那条 bug）', probe[6] === 1, probe);
    check('6 下只掉 1 点血，所以计数只能是 1', probe.filter(count => count > 0).length === 1, probe);

    const afterRestart = await page.evaluate(() => {
      window.__dungeonHits = 25;               // 假装上一局挨了 25 下
      window.__dungeonCoins = 40;
      document.getElementById('pause-restart').click();   // 走 reset()——**不刷新页面**
      return { hits: Number(window.__dungeonHits) || 0, coins: Number(window.__dungeonCoins) || 0 };
    });
    check('重开一局把上一局的挨打数清零（零命中通关不该继承旧账）', afterRestart.hits === 0, afterRestart);
    check('重开一局把上一局的金币一起清零', afterRestart.coins === 0, afterRestart);

    /* ---------- 二、主游戏那一侧：打完首领一定走到 C ---------- */
    // 每个战绩单开一个 context：存档都在 localStorage 里，共用会互相串味。
    async function bossRun(label, options) {
      const runCtx = await browser.newContext();
      const runPage = await runCtx.newPage();
      runPage.on('pageerror', error => errors.push(error.message));
      try {
        await runPage.goto(base + '/index.html');
        await runPage.evaluate(options => {
          const user = MuseumAuth.register(options.user, 'x').user;
          const state = MuseumState.create(user);
          // 人性值 100 起、三夜 −10、线索回血若干 —— 打最终战时现实区间是 50—90。
          state.hp = options.hp;
          state.points = 500;
          if (options.rollback) state.shopOwned = { rollback: 1 };
          state.roomId = 'museum'; state.currentNode = 'museum'; state.playerX = 610; state.playerY = 620;
          Object.keys(state.tutorial).forEach(key => { state.tutorial[key] = true; });
          state.flags.nightmareMinigameChoice = 'enter';
          state.mode = 'battle';
          state.returnScene = 'scene-28'; state.narrativeNode = 'scene-28'; state.battleContext = 'final-boss';
          state.battleAttempt = { id: 'attempt-' + options.user, source: 'pixel-dungeon', retryScene: 'scene-27-boss', retryIndex: 0, returnScene: 'scene-28' };
          MuseumState.save(state, user.id);
          localStorage.setItem('museum_pending_battle_v1', JSON.stringify({
            status: 'win', hitsTaken: options.hits, route: options.route || 'boss', coins: 0, liveCoins: true,
            userId: user.id, source: 'pixel-dungeon', battleAttempt: 'attempt-' + options.user
          }));
        }, options);
        await runPage.goto(base + '/index.html?fromBattle=1');
        await runPage.waitForURL(/\/pages\/novel\.html\?scene=/);
        await runPage.waitForFunction(() => window.MuseumState && window.MuseumStory);
        const observed = await runPage.evaluate(() => {
          const state = MuseumState.load(MuseumAuth.getCurrentUser().id);
          const choice = (MuseumStory.scenes['scene-29'] || { choices: [] }).choices.filter(item => item.id === 'ending-c')[0];
          return {
            url: location.href,
            hp: state.hp,
            route: state.flags.nightmareRoute,
            won: state.flags.nightmareMinigameWon,
            boss: state.flags.boss_defeated,
            rollback: state.shopOwned && state.shopOwned.rollback,
            resolved: choice && window.MuseumEndingFlow ? window.MuseumEndingFlow.resolveChoice(state, choice).nextScene : null
          };
        });
        return observed;
      } finally {
        await runCtx.close();
      }
    }

    // ① 现实里最惨的一份战绩：带着 70 点人性值进最终战，掉了 6 次血（7 血活着出来的上限）。
    const worst = await bossRun('worst', { user: '挨打计数①', hp: 70, hits: 6 });
    check('① 最惨战绩（6 次掉血）扣完还剩 20 点人性值', worst.hp === 20, worst);
    check('① 落点 scene-28，不是被改道去 ending-d', /scene-28/.test(worst.url), worst);
    check('① 打完首领记的是 boss 路线与 boss_defeated', worst.route === 'boss' && worst.won === true && worst.boss === true, worst);
    check('① 最终抉择按这条路走 C 完美结局', worst.resolved === 'ending-c', worst);

    // ② 战前就已经快怪谈化了（10 点），而且身上没有【回滚】——照样不许被扣死。
    const brink = await bossRun('brink', { user: '挨打计数②', hp: 10, hits: 0 });
    check('② 会扣到 0 时夹到「至少留 1 点」', brink.hp === 1, brink);
    check('② 没有回滚也落在 scene-28，不是 ending-d', /scene-28/.test(brink.url), brink);
    check('② 仍然走到 C（打完首领一定 C）', brink.resolved === 'ending-c' && brink.won === true, brink);

    // ③ 身上有【回滚】时，这笔损耗照常让它消耗——那件东西在最终战里仍值 300 点。
    const saved = await bossRun('rollback', { user: '挨打计数③', hp: 10, hits: 6, rollback: true });
    check('③ 带回滚时照常消耗并回满 100', saved.hp === 100 && !saved.rollback, saved);
    check('③ 落点仍是 scene-28 并走到 C', /scene-28/.test(saved.url) && saved.resolved === 'ending-c', saved);

    // ④ 撤离试炼那条路（放弃打梦魇）同样是「赢」，也不许被扣死，落点是 A。
    const evac = await bossRun('evacuate', { user: '挨打计数④', hp: 10, hits: 6, route: 'evacuate' });
    check('④ 撤离试炼也不许被扣死（人性值停在 1）', evac.hp === 1, evac);
    check('④ 撤离那条不记 boss_defeated、不置 nightmareMinigameWon', evac.route === 'evacuate' && evac.boss === undefined && evac.won === false, evac);

    check('全程没有页面报错', errors.length === 0, errors);
  } finally {
    if (ctx) await ctx.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
