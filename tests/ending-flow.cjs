/* Completed endings survive navigation; loading another ending keeps its own completion state. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/__seed.html') {
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    return res.end('<!doctype html><script src="/js/auth.js"></script><script src="/js/state.js"></script>');
  }
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
  res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
let fails = 0;
function check(label, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : ' ' + JSON.stringify(detail))); if (!ok) fails++; }
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const ctx = await browser.newContext({viewport:{width:1366,height:768}});
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const state = () => page.evaluate(() => MuseumState.load(MuseumAuth.getCurrentUser().id));
  const completed = () => page.locator('#novel-end').isVisible();
  try {
    await page.goto(origin + '/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('完结回归','x').user;
      const s = MuseumState.create(u);
      s.mode = 'novel'; s.narrativeNode = 'ending-b'; s.narrativeIndex = 0;
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s,u.id);
      const pending = JSON.parse(JSON.stringify(s));
      pending.narrativeNode = 'ending-c';
      pending.flags.nightmareMinigameChoice = 'enter';
      pending.flags.nightmareMinigameWon = true;
      MuseumState.saveSlot(pending,u.id,0);
    });
    await page.goto(origin + '/pages/novel.html?scene=ending-b');
    for (let i=0; i<30 && !await completed(); i++) await page.keyboard.press('e');
    const done = await state();
    check('读完 B 后显示完结页并记录 B', await completed() && done.endingComplete === true && done.ending === 'ending-b', done.ending);
    check('只记录一次 B 结局', done.endingHistory.filter(x => x === 'ending-b').length === 1, done.endingHistory);
    const logLength = done.dialogueLog.length;

    await page.reload();
    const refreshed = await state();
    check('刷新已完成结局直接恢复完结页', await completed());
    check('刷新不重记剧情和结局', refreshed.dialogueLog.length === logLength && refreshed.endingHistory.filter(x => x === 'ending-b').length === 1, {logs:refreshed.dialogueLog.length,history:refreshed.endingHistory});

    if (await completed()) await page.locator('#novel-end-menu').click();
    else await page.goto(origin + '/index.html?fromEnding=1');
    await page.waitForSelector('#continue-button');
    await page.locator('#continue-button').click();
    await page.waitForURL('**/pages/novel.html?scene=ending-b');
    check('标题页继续游戏也直接恢复完结页', await completed());

    await page.keyboard.press('Escape');
    await page.locator('#novel-pause-load').click();
    const slot = page.locator('.story-save-dialog article').filter({hasText:'存档位 1 ·'}).first();
    await slot.getByRole('button',{name:'读取',exact:true}).click();
    const loaded = await state();
    check('从 B 完结页读取 C 未完档进入 C 正文', new URL(page.url()).searchParams.get('scene') === 'ending-c' && !await completed(), page.url());
    check('C 没有继承旧结局的完成状态', loaded.mode === 'novel' && loaded.endingComplete !== true && loaded.endingHistory.includes('ending-b') && !loaded.endingHistory.includes('ending-c'), {mode:loaded.mode,complete:loaded.endingComplete,history:loaded.endingHistory});
    await page.reload();
    const reloaded = await state();
    check('未完成 C 刷新仍为正文且不提前收集 C', !await completed() && reloaded.endingComplete !== true && !reloaded.endingHistory.includes('ending-c'), {mode:reloaded.mode,complete:reloaded.endingComplete,history:reloaded.endingHistory});
    // Legacy saves did not store a win marker. Completion of the post-battle scene is
    // evidence only when there is no pending attempt; boss-stage flags are not evidence.
    const cases = [
      ['旧档已经完成战后场景可保留 C', {mode:'novel',flags:{nightmareMinigameChoice:'enter',scene28Seen:true}}, 'ending-c'],
      ['显式未通关不能被旧档规则改判 C', {mode:'novel',flags:{nightmareMinigameChoice:'enter',nightmareMinigameWon:false,scene28Seen:true}}, 'scene-27-boss'],
      ['待结算战斗不能按旧档完成处理', {mode:'novel',returnScene:'scene-28',flags:{nightmareMinigameChoice:'enter',scene28Seen:true}}, 'scene-27-boss'],
      ['进行中的战斗记录不能按旧档完成处理', {mode:'novel',battleAttempt:{id:'pending'},flags:{nightmareMinigameChoice:'enter',scene28Seen:true}}, 'scene-27-boss'],
      ['Boss 阶段标志不能替代小游戏通关', {mode:'novel',flags:{nightmareMinigameChoice:'enter',boss_defeated:true,finalPhaseCompleted:true}}, 'scene-27-boss'],
      ['主动跳过仍为 A，不受旧 Boss 标志影响', {mode:'novel',flags:{nightmareMinigameChoice:'skip',boss_defeated:true,nightmareMinigameWon:true}}, 'ending-a']
    ];
    for (const [label, fixture, expected] of cases) {
      const resolved = await page.evaluate(fixture => MuseumEndingFlow.resolveChoice(fixture,{id:'ending-c',nextScene:'ending-c',endingFromNightmareChoice:true}).nextScene, fixture);
      check(label, resolved === expected, resolved);
    }
    // A zero-humanity D save is already terminal. Opening the title must not run
    // the gameplay damage settlement again and erase its completed-ending state.
    await page.goto(origin + '/__seed.html');
    await page.evaluate(() => {
      const u = MuseumAuth.getCurrentUser();
      const s = MuseumState.create(u);
      s.hp = 0;
      s.mode = 'novel'; s.narrativeNode = 'ending-d'; s.narrativeIndex = 0;
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s,u.id);
    });
    await page.goto(origin + '/pages/novel.html?scene=ending-d');
    for (let i=0; i<8 && !await completed(); i++) await page.keyboard.press('e');
    const death = await state();
    check('人性值为零仍能读完 D 并保存完结状态', await completed() && death.hp === 0 && death.endingComplete === true && death.ending === 'ending-d', {hp:death.hp,ending:death.ending,complete:death.endingComplete});
    await page.locator('#novel-end-menu').click();
    await page.waitForTimeout(800);
    const titleUrl = new URL(page.url());
    const stayedOnTitle = titleUrl.pathname === '/index.html' && await page.locator('#cover-screen').isVisible();
    const atTitle = await state();
    check('零人性值 D 返回标题后不会被再次踢回死亡剧情', stayedOnTitle && atTitle.endingComplete === true && atTitle.mode === 'ending', {url:page.url(),mode:atTitle.mode,complete:atTitle.endingComplete});
    if (stayedOnTitle) {
      await page.locator('#continue-button').click();
      await page.waitForURL('**/pages/novel.html?scene=ending-d');
      const continued = await state();
      check('标题继续 D 恢复完结卡，既不重播也不重复收集', await completed() && continued.hp === 0 && continued.endingHistory.filter(x=>x === 'ending-d').length === 1, continued.endingHistory);
    } else check('标题继续 D 恢复完结卡，既不重播也不重复收集', false, '未能停留标题，无法继续');
    check('整个结局恢复流程无页面异常', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  process.exitCode = fails ? 1 : 0;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
