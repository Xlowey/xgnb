/*
 * 账号流程：退出登录 → 回到标题页 → 能重新登录/注册新账号。
 *
 * 背景：MuseumAuth.logout() 一直存在，但此前**没有任何 DOM 元素能触发它**（全仓只有定义），
 * 所以玩家永远换不了账号、也回不到注册页。index.html 现在加了"退出登录（切换账号）"按钮。
 */
const http = require('http'), fs = require('fs'), path = require('path');
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
  await new Promise(r => server.listen(8844, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  try {
    await p.goto('http://127.0.0.1:8844/index.html');
    await p.waitForTimeout(600);
    // Register player one, then get into the game so the pause menu exists.
    await p.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('甲', 'x').user;
      const s = MuseumState.create(u);
      s.mode = 'explore'; s.roomId = 'dorm';
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    });
    await p.reload(); await p.waitForTimeout(600);
    if (await p.isVisible('#cover-screen')) await p.click('#continue-button');
    await p.waitForSelector('#game-screen:not([hidden])', { timeout: 8000 });
    await p.waitForTimeout(500);

    // The button must actually exist in the DOM (the old code queried an id nothing declared).
    const exists = await p.evaluate(() => !!document.getElementById('logout-button'));
    check('暂停菜单里有退出登录按钮', exists === true, { exists });

    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    const pauseVisible = await p.evaluate(() => { const el = document.getElementById('pause-overlay'); return el && !el.hidden; });
    check('Esc 打开暂停菜单', pauseVisible === true, { pauseVisible });

    await p.click('#logout-button');
    await p.waitForTimeout(700);
    const after = await p.evaluate(() => ({
      cover: !document.getElementById('cover-screen').hidden,
      game: document.getElementById('game-screen').hidden,
      pause: document.getElementById('pause-overlay').hidden,
      session: localStorage.getItem('museum_session_v1'),
      users: JSON.parse(localStorage.getItem('museum_users_v1') || '[]').length,
      saveStillThere: (() => { const keys = Object.keys(localStorage).filter(k => /museum_save_v5_auto_/.test(k)); return keys.length; })(),
      who: document.getElementById('current-user') ? document.getElementById('current-user').textContent : null
    }));
    check('退出后回到标题页', after.cover === true && after.game === true, after);
    check('退出后暂停菜单关闭', after.pause === true, { pause: after.pause });
    check('会话已清除', after.session === null, { session: after.session });
    check('账号仍然保留（只是登出，不是删号）', after.users === 1, { users: after.users });
    check('退出前把进度存了下来', after.saveStillThere >= 1, { saveKeys: after.saveStillThere });
    check('标题页不再显示用户名', !/甲/.test(String(after.who || '')), { who: after.who });

    // A new account can be registered and started.
    await p.evaluate(() => {
      const u = MuseumAuth.register('乙', 'y').user;
      MuseumAuth.login('乙', 'y');
    });
    await p.reload(); await p.waitForTimeout(700);
    const second = await p.evaluate(() => ({ who: MuseumAuth.getCurrentUser() && MuseumAuth.getCurrentUser().username }));
    check('可以登录另一个账号', second.who === '乙', second);

    check('整个过程没有页面报错', errors.length === 0, errors.slice(0, 3));
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
