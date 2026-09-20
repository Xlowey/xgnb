/* Ending art: authored timing, per-page costume changes, and real ending overlays. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
let fails = 0;
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : ' <- ' + JSON.stringify(detail)));
  if (!ok) fails++;
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    const newArt = /ending-[ab]-card|ending-c-card|hospital-farewell/;
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => { if (newArt.test(request.url())) errors.push('request failed: ' + request.url()); });
    page.on('response', response => { if (response.status() >= 400 && newArt.test(response.url())) errors.push(response.status() + ': ' + response.url()); });
    await page.goto(base + '/pages/novel.html?scene=ending-c&preview=1');
    await page.waitForFunction(() => window.MuseumStory && window.MuseumPortraits);

    async function openScene(scene) {
      await page.evaluate(scene => {
        const state = MuseumState.create({ id: 'class-preview', username: '体验者' });
        Object.keys(state.tutorial).forEach(key => { state.tutorial[key] = true; });
        state.mode = 'novel';
        state.narrativeNode = scene;
        state.narrativeIndex = 0;
        state.flags.narrativeTextRevision = MuseumStory.textRevision;
        sessionStorage.setItem('museum_class_preview', JSON.stringify(state));
      }, scene);
      await page.goto(base + '/pages/novel.html?scene=' + scene + '&preview=1&resume=1');
      await page.waitForFunction(() => window.MuseumStory && window.MuseumPortraits);
    }
    async function frame() {
      return page.evaluate(() => {
        const state = JSON.parse(sessionStorage.getItem('museum_class_preview') || '{}');
        const log = state.dialogueLog || [];
        return {
        progress: document.getElementById('novel-progress').textContent,
        end: !document.getElementById('novel-end').hidden,
        type: document.body.dataset.event,
        // The read log contains this page's complete text while its typewriter runs.
        text: document.body.dataset.event === 'dialogue' && log.length ? log[log.length - 1].text : '',
        background: document.querySelector('.novel-background').style.getPropertyValue('--scene-background'),
        backgroundSize: getComputedStyle(document.querySelector('.novel-background')).backgroundSize,
        portraitsHidden: document.querySelector('.novel-portraits').hidden,
        hero: document.querySelector('.portrait-hero').src,
        zhaoling: document.querySelector('.portrait-zhaoling').src,
        // 结局 C 的完整对白页：上下滑动是它的核心行为，所以把滚动尺寸一起取出来。
        letterScroll: (() => { const sheet = document.querySelector('.ending-letter'); return sheet ? { scrollHeight: sheet.scrollHeight, clientHeight: sheet.clientHeight } : null; })()
        };
      });
    }
    async function advancePage() {
      const before = await frame();
      for (let attempt = 0; attempt < 3; attempt++) {
        // 结局 CG 是原生 <video>，按 E 推不动（它要等 ended）。素材是 168 MB，
        // 真放完整段会拖死这个测试，所以走它自己的「跳过动画」按钮。
        const skip = page.locator('.video-cg-skip');
        if (before.type === 'video' && await skip.count()) { await skip.click(); await page.waitForTimeout(150); }
        await page.keyboard.press('e');
        const after = await frame();
        if (after.end || after.progress !== before.progress) return after;
      }
      throw new Error('Cannot advance ending page: ' + JSON.stringify(before));
    }
    // 2026-09-20：结局 C 改成「结局 CG → 一页可上下滑动的完整对白 → 通关界面」。
    // 原来逐行推进的 31 页（带现实病房逐行换装）不再存在，所以这里改为断言新结构：
    // 事件顺序、完整对白页逐条覆盖本场每一行、以及两个画面在长页里的位置。
    const authored = await page.evaluate(() => {
      const scene = MuseumStory.scenes['ending-c'];
      const events = scene.events || [];
      const letter = events.find(event => event.type === 'letter');
      const entries = (letter && letter.entries) || [];
      const lineEntries = entries.filter(entry => !entry.image);
      const at = predicate => entries.findIndex(predicate);
      return {
        kinds: events.map(event => event.type),
        hasLetter: !!letter,
        lineCount: lineEntries.length,
        // 完整对白页必须逐条包含本场的每一行：顺序、正文、说话人三者都要对上，
        // 否则「变成一封完整的对白」就是漏了内容。
        linesMatch: lineEntries.length === scene.lines.length && scene.lines.every((line, index) => lineEntries[index].text === line.text && (lineEntries[index].speaker || '') === (line.speaker || '')),
        missingSample: scene.lines.find((line, index) => !lineEntries[index] || lineEntries[index].text !== line.text) || null,
        images: entries.filter(entry => entry.image).map(entry => entry.image),
        farewell: at(entry => /^有缘再见，/.test(entry.text || '')),
        cg: at(entry => entry.image === 'hospital-farewell.png'),
        reveal: at(entry => /^这不是你的，是张明诚的/.test(entry.text || '')),
        contract: at(entry => entry.image === '张明诚契约.webp'),
        cards: ['ending-a', 'ending-b', 'ending-c'].map(id => ({ id, art: MuseumStory.scenes[id].endArt }))
      };
    });
    check('三个结局各自对上自己的通关海报，没有借用别家的', authored.cards[0].art === 'ending-a-card.png' && authored.cards[1].art === 'ending-b-card.png' && authored.cards[2].art === 'ending-c-card.png', authored.cards);
    check('C 先播结局 CG、再接完整对白页', authored.kinds.length === 2 && authored.kinds[0] === 'video' && authored.kinds[1] === 'letter', authored.kinds);
    check('完整对白页逐条包含本场每一行（顺序与说话人一致）', authored.hasLetter && authored.linesMatch, { lineCount: authored.lineCount, missingSample: authored.missingSample });
    check('告别 CG 只出现一次，紧接在告别台词之前', authored.cg >= 0 && authored.cg === authored.farewell - 1, { cg: authored.cg, farewell: authored.farewell });
    check('张明诚契约只出现一次，紧接在揭示台词之后', authored.contract >= 0 && authored.contract === authored.reveal + 1, { contract: authored.contract, reveal: authored.reveal });

    // 逐行换装（hero-casual / zhaoling-patient）随逐页对白一起取消了：一页读完没有"行"，
    // 也就没有逐行的立绘状态。这里改为守住"长页隐藏立绘层、普通台词仍恢复立绘"。
    const portraits = await page.evaluate(() => {
      const snapshot = () => ({ hero: document.querySelector('.portrait-hero').src, zhaoling: document.querySelector('.portrait-zhaoling').src, hidden: document.querySelector('.novel-portraits').hidden });
      const cScene = MuseumStory.scenes['ending-c'];
      MuseumPortraits.render(cScene, cScene.events.find(event => event.type === 'letter'));
      const onLetter = snapshot();
      const other = MuseumStory.scenes['ending-a'];
      MuseumPortraits.render(other, (other.events || other.lines).find(event => event.speaker === '主角'));
      const onDialogue = snapshot();
      return { onLetter, onDialogue };
    });
    const defaults = state => /hero-portrait\.webp(?:\?|$)/.test(state.hero) && /zhaoling-portrait\.webp(?:\?|$)/.test(state.zhaoling);
    check('完整对白页隐藏立绘层', portraits.onLetter.hidden, portraits.onLetter);
    check('另一个结局的普通台词仍恢复立绘与可见性', defaults(portraits.onDialogue) && !portraits.onDialogue.hidden, portraits.onDialogue);

    // Play C once: 结局 CG → 完整对白页（可上下滑动）→ 通关界面。
    await openScene('ending-c');
    const observed = [];
    for (let count = 0; count < 30; count++) {
      const current = await frame();
      if (current.end) break;
      observed.push(current);
      await advancePage();
    }
    check('C completes through the normal ending flow', (await frame()).end);
    const letterPage = observed.find(item => item.type === 'letter');
    check('C 的演出顺序是结局 CG → 完整对白页', observed.length >= 1 && observed[0].type === 'video' && !!letterPage, observed.map(item => item.type));
    // 「可以上下滑动」是这次改动的核心行为：内容高度必须超过容器高度，否则滑不动。
    check('完整对白页内容高于容器，确实可以上下滑动', !!letterPage && !!letterPage.letterScroll && letterPage.letterScroll.scrollHeight > letterPage.letterScroll.clientHeight, letterPage && letterPage.letterScroll);
    check('完整对白页不显示立绘层', !!letterPage && letterPage.portraitsHidden, letterPage && { portraitsHidden: letterPage.portraitsHidden });

    // 2026-09-20：C 的通关海报到位，三张卡一起走同一套校验（能加载、不裁切、两档视口不溢出）。
    for (const suffix of ['a', 'b', 'c']) {
      await openScene('ending-' + suffix);
      for (let count = 0; count < 100 && !(await frame()).end; count++) await advancePage();
      check('ending-' + suffix + ' reaches its overlay', (await frame()).end);
      const art = page.locator('#novel-end img.ending-art');
      check('ending-' + suffix + ' has one ending card', await art.count() === 1);
      if (await art.count() !== 1) continue;
      await art.evaluate(async img => { try { await img.decode(); } catch (error) {} });
      const resource = await art.evaluate(img => ({ src: img.currentSrc || img.src, width: img.naturalWidth, height: img.naturalHeight, fit: getComputedStyle(img).objectFit }));
      check('ending-' + suffix + ' loads its matching uncropped card', new RegExp('ending-' + suffix + '-card\\.png(?:\\?|$)').test(resource.src) && resource.width > 0 && resource.height > 0 && resource.fit === 'contain', resource);
      for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        const bounds = await art.evaluate(img => { const box = img.getBoundingClientRect(); return { x: box.x, right: box.right, width: box.width, scrollWidth: document.documentElement.scrollWidth }; });
        check('ending-' + suffix + ' card fits viewport width ' + viewport.width, bounds.width > 0 && bounds.x >= -1 && bounds.right <= viewport.width + 1 && bounds.scrollWidth <= viewport.width + 1, bounds);
      }
      await page.setViewportSize({ width: 1366, height: 768 });
    }
    check('ending art has no runtime errors or failed resource requests', errors.length === 0, errors);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exitCode = fails ? 1 : 0;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
