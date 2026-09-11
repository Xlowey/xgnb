/*
 * Long-dialogue overflow: a 519-char page is real content (4 such pages exist).
 * The dialogue box is position:fixed with overflow:hidden, so if it exceeds the
 * viewport it is cut off above the top edge and can never be scrolled.
 */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
let fails = 0;
const check = (l, ok, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + l + (ok || d === undefined ? '' : '  <- ' + JSON.stringify(d))); if (!ok) fails += 1; };

(async () => {
  await new Promise(r => server.listen(8805, '127.0.0.1', r));
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  try {
    await page.goto('http://127.0.0.1:8805/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      const u = MuseumAuth.register('长文本', 'x').user;
      const s = MuseumState.create(u);
      s.flags.scene04Seen = true; s.mode = 'novel'; s.narrativeNode = 'scene-01';
      Object.keys(s.tutorial).forEach(k => s.tutorial[k] = true);
      MuseumState.save(s, u.id);
    });
    // The story data only exists on the story page, so enumerate there.
    await page.goto('http://127.0.0.1:8805/pages/novel.html?scene=scene-01');
    await page.waitForSelector('#novel-progress', { state: 'attached' });
    const target = await page.evaluate(() => {
      const out = [];
      for (const [id, sc] of Object.entries(MuseumStory.scenes)) {
        if (!sc.events) continue;
        let idx = 0;
        for (const ev of sc.events) {
          if (ev.type === 'dialogue') {
            let text = String(ev.text || '').replace(/^\s*△\s*/, '').trim();
            while (text.length > 64) { out.push({ id, idx, len: 64 }); idx += 1; text = text.slice(64); }
            if (text) { out.push({ id, idx, len: text.length }); idx += 1; }
          } else { out.push({ id, idx, len: 0, type: ev.type }); idx += 1; }
        }
      }
      out.sort((a, b) => b.len - a.len);
      return out.slice(0, 3);
    });
    console.log('longest pages:', JSON.stringify(target));

    for (const [w, h] of [[1366, 768], [844, 390], [390, 844]]) {
      await page.setViewportSize({ width: w, height: h });
      // scene-08 page 4 is a real 64-char dialogue page.
      await page.goto('http://127.0.0.1:8805/pages/novel.html?scene=scene-08');
      await page.waitForSelector('#novel-progress', { state: 'attached' });
      await page.waitForTimeout(400);
      // Advance to the first plain dialogue page so #novel-text is actually shown.
      let fit = null;
      for (let i = 0; i < 14; i += 1) {
        fit = await page.evaluate(() => {
          const d = document.getElementById('novel-dialogue');
          const t = document.getElementById('novel-text');
          const r = d.getBoundingClientRect(), tr = t.getBoundingClientRect();
          return {
            shown: !document.getElementById('novel-text').hidden && tr.height > 0,
            box: { top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(0) },
            text: { top: +tr.top.toFixed(1), bottom: +tr.bottom.toFixed(1), h: +tr.height.toFixed(0) },
            chars: (t.textContent || '').length,
            viewportH: innerHeight,
            spillingAbove: r.top < 0,
            textClipped: tr.top < r.top - 1 || tr.bottom > r.bottom + 1
          };
        });
        if (fit.shown && fit.chars > 40) break;
        const ui = await page.evaluate(() => ({ event: !document.getElementById('event-next').hidden, dialogue: !document.getElementById('novel-dialogue').hidden }));
        if (ui.event) await page.click('#event-next'); else await page.keyboard.press('e');
        await page.waitForTimeout(250);
      }
      check(`${w}x${h}: dialogue box fits in the viewport (top >= 0)`, fit && !fit.spillingAbove, fit);
      check(`${w}x${h}: dialogue text is fully inside its box`, fit && fit.shown && !fit.textClipped, fit);
      if (w === 390 || w === 844) await page.screenshot({ path: `tmp/audit-textfit-${w}x${h}.png` });
    }

    // Horizontal drag on the story page (dream-push scale animation).
    for (const [w, h] of [[1366, 768], [390, 844]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('http://127.0.0.1:8805/pages/novel.html?scene=scene-01');
      await page.waitForTimeout(3000);
      const over = await page.evaluate(() => {
        const d = document.documentElement;
        const before = scrollX;
        window.scrollTo(500, 0);
        const after = scrollX;
        return { hOverflow: d.scrollWidth - d.clientWidth, vOverflow: d.scrollHeight - d.clientHeight, scrolledTo: after, was: before };
      });
      check(`${w}x${h}: story page has no horizontal overflow`, over.hOverflow <= 1, over);
    }
  } finally { await b.close(); server.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
