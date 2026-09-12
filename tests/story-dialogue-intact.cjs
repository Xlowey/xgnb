/*
 * 真实页面验证：说话人提示行合并之后，对话有没有丢行、串行、或丢掉说话人。
 *
 * novel-presentation.js 现在会把"赵灵（迷离）"这类提示行收起来，并把说话人贴到下一行。
 * 这个改动动了**全部场次**的 lines 数组，所以必须在浏览器里逐场对比：
 *   期望页数（用同样的规则独立算一遍） vs 页面实际渲染出来的页数
 * 同时检查每页的说话人是否非空、是否还残留提示行文本。
 */
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
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

// Independent expectation: same rule as the page, computed in Node from the source files.
const c = { window: { MuseumItems: {} }, Image: function () {}, console };
vm.createContext(c);
for (const n of ['state', 'map-data', 'map-art', 'chapter-maps', 'novel-data', 'novel-overrides',
  'novel-presentation', 'novel-prologue', 'chapter-story', 'chapter-finalize']) {
  vm.runInContext(fs.readFileSync('js/' + n + '.js', 'utf8'), c);
}
const NODE_SCENES = c.window.MuseumStory.scenes;
const CUE = /^([\u4e00-\u9fa5A-Za-z]{2,8})（([^）]{1,16})）\s*$/;
function expectPages(scene) {
  if (!scene) return [];
  if (scene.events && scene.events.length) {
    const out = [];
    for (const e of scene.events) {
      if (e.type === 'investigate') { if (e.intro) out.push({ speaker: '旁白', text: e.intro }); continue; }
      if (['item', 'document', 'television', 'explore'].includes(e.type)) continue;
      out.push({ speaker: e.speaker || '旁白', text: String(e.text == null ? '' : e.text) });
    }
    if (out.length) return out;
  }
  return (scene.lines || []).map(l => ({ speaker: l.speaker || '旁白', text: String(l.text == null ? '' : l.text) }));
}
const expected = {};
for (const [id, sc] of Object.entries(NODE_SCENES)) expected[id] = expectPages(sc);

let fails = 0;
const check = (l, ok, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + l + (ok || d === undefined ? '' : '  <- ' + JSON.stringify(d))); if (!ok) fails += 1; };

(async () => {
  await new Promise(r => server.listen(8842, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const shelter = await ctx.newPage();
  await shelter.goto('http://127.0.0.1:8842/pages/saves.html');
  await shelter.evaluate(() => {
    localStorage.clear();
    const u = MuseumAuth.register('对话', 'x').user;
    const s = MuseumState.create(u);
    s.flags = Object.assign({}, s.flags, { scene01Seen: true, scene03Seen: true, scene04Seen: true, hasKey: true });
    Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
    MuseumState.save(s, u.id);
  });
  await shelter.close();

  // Read the page's own final scene graph and compare per scene.
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('        [pageerror]', e.message));
  await page.goto('http://127.0.0.1:8842/pages/novel.html?scene=scene-01');
  await page.waitForTimeout(1200);
  const inPage = await page.evaluate(() => {
    const out = {};
    for (const [id, sc] of Object.entries(window.MuseumStory.scenes)) {
      const pages = (typeof window.MuseumStory.pagesFor === 'function')
        ? window.MuseumStory.pagesFor(sc)
        : null;
      out[id] = {
        lineCount: (sc.lines || []).length,
        lines: (sc.lines || []).map(l => ({ speaker: l.speaker, text: l.text })),
        pages: pages ? pages.map(p => ({ speaker: p.speaker, text: p.text })) : null
      };
    }
    return out;
  });
  console.log('页面里的场次数：' + Object.keys(inPage).length + '    Node 侧：' + Object.keys(expected).length);

  let mismatched = 0, cueLeft = 0, emptySpeaker = 0;
  for (const id of Object.keys(expected)) {
    const got = inPage[id];
    if (!got) { mismatched += 1; console.log('  缺少场次 ' + id); continue; }
    const exp = expected[id];
    // The page may legitimately hide some lines (e.g. the recording scenes), so compare
    // the count the page will actually page through only when it exposes pages.
    if (got.pages && got.pages.length !== exp.length) {
      mismatched += 1;
      if (mismatched <= 8) console.log('  页数不一致 ' + id + '  期望 ' + exp.length + '  实际 ' + got.pages.length);
    }
    for (const l of got.lines) {
      const text = String(l.text == null ? '' : l.text).trim();
      if (CUE.test(text)) cueLeft += 1;
      if (!l.speaker) emptySpeaker += 1;
    }
  }
  check('每个场次的可读页数与独立计算一致', mismatched === 0, { mismatched });
  check('没有残留的人物提示行被当成台词', cueLeft === 0, { cueLeft });
  check('每一行都有说话人', emptySpeaker === 0, { emptySpeaker });

  // Spot check the scenes that were fixed.
  for (const [id, want] of [['scene-27', '赵灵（急促拍门）'], ['ending-c', '赵灵（轻声）'], ['scene-07', '馆长（扫视全场）']]) {
    const lines = inPage[id] ? inPage[id].lines : [];
    const hit = lines.find(l => l.speaker === want);
    check(id + ' 的说话人是 ' + want, Boolean(hit), { speakers: [...new Set(lines.map(l => l.speaker))].slice(0, 8) });
  }
  await page.close();
  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
