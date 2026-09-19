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
    const newArt = /ending-[ab]-card|hero-casual|zhaoling-patient|hospital-farewell/;
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
        zhaoling: document.querySelector('.portrait-zhaoling').src
        };
      });
    }
    async function advancePage() {
      const before = await frame();
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.keyboard.press('e');
        const after = await frame();
        if (after.end || after.progress !== before.progress) return after;
      }
      throw new Error('Cannot advance ending page: ' + JSON.stringify(before));
    }
    const authored = await page.evaluate(() => {
      const scene = MuseumStory.scenes['ending-c'];
      const events = scene.events || [];
      const start = events.findIndex(event => event.text === '赵灵？');
      const resurrection = events.findIndex(event => /^复活张明诚。/.test(event.text || ''));
      const farewell = events.findIndex(event => /^有缘再见，/.test(event.text || ''));
      const cgs = events.map((event, index) => ({ event, index })).filter(({ event }) => event.type === 'cg' && event.background === 'hospital-farewell.png');
      return {
        start, resurrection, farewell, cgs,
        first: events[0], final: events[farewell],
        hospital: events.slice(start, farewell).filter(event => event.type === 'dialogue'),
        farewellCount: events.filter(event => /^有缘再见，/.test(event.text || '')).length,
        cards: ['ending-a', 'ending-b', 'ending-c'].map(id => ({ id, art: MuseumStory.scenes[id].endArt }))
      };
    });
    check('A and B cards match their actual endings', authored.cards[0].art === 'ending-a-card.png' && authored.cards[1].art === 'ending-b-card.png' && !/ending-[ab]-card/.test(authored.cards[2].art || ''), authored.cards);
    check('C starts in the dream before the real hospital', authored.start > 0 && /她在等着你/.test(authored.first.text) && !authored.first.portraitVariants, authored.first);
    check('real hospital dialogue has both costume variants', authored.hospital.length > 1 && authored.hospital.every(event => event.portraitVariants && event.portraitVariants.hero === 'portraits/hero-casual.png' && event.portraitVariants.zhaoling === 'portraits/zhaoling-patient.png'), authored.hospital.map(event => ({ text: event.text, variants: event.portraitVariants })));
    check('one farewell CG appears after resurrection and before goodbye', authored.resurrection > authored.start && authored.cgs.length === 1 && authored.cgs[0].index > authored.resurrection && authored.cgs[0].index < authored.farewell && authored.cgs[0].event.backgroundFit === 'contain', { resurrection: authored.resurrection, farewell: authored.farewell, cgs: authored.cgs });
    check('goodbye keeps the CG and suppresses duplicate portraits', authored.farewellCount === 1 && authored.final && authored.final.background === 'hospital-farewell.png' && authored.final.backgroundFit === 'contain' && authored.final.hidePortraits === true, authored.final);

    const costumes = await page.evaluate(async () => {
      const scene = MuseumStory.scenes['ending-c'];
      const first = scene.events[0];
      const hospital = scene.events.find(event => event.text === '赵灵？');
      const farewell = scene.events.find(event => /^有缘再见，/.test(event.text || ''));
      function snapshot() {
        return { hero: document.querySelector('.portrait-hero').src, zhaoling: document.querySelector('.portrait-zhaoling').src, hidden: document.querySelector('.novel-portraits').hidden };
      }
      MuseumPortraits.render(scene, first);
      const initial = snapshot();
      MuseumPortraits.render(scene, hospital);
      const changed = snapshot();
      const loaded = await Promise.all(['hero', 'zhaoling'].map(async id => {
        const img = document.querySelector('.portrait-' + id);
        try { await img.decode(); return img.naturalWidth > 0; } catch (error) { return false; }
      }));
      MuseumPortraits.render(scene, first);
      const restored = snapshot();
      MuseumPortraits.render(scene, farewell);
      const goodbye = snapshot();
      const other = MuseumStory.scenes['ending-a'];
      MuseumPortraits.render(other, (other.events || other.lines).find(event => event.speaker === '主角'));
      return { initial, changed, loaded, restored, goodbye, other: snapshot() };
    });
    const defaults = state => /hero-portrait\.webp(?:\?|$)/.test(state.hero) && /zhaoling-portrait\.webp(?:\?|$)/.test(state.zhaoling);
    check('dream uses normal costumes', defaults(costumes.initial) && !costumes.initial.hidden, costumes.initial);
    check('hospital swaps to loaded casual and patient portraits', /hero-casual\.png(?:\?|$)/.test(costumes.changed.hero) && /zhaoling-patient\.png(?:\?|$)/.test(costumes.changed.zhaoling) && costumes.loaded.every(Boolean) && !costumes.changed.hidden, costumes);
    check('revisiting the dream restores normal costumes', defaults(costumes.restored), costumes.restored);
    check('farewell hides the portrait layer', costumes.goodbye.hidden, costumes.goodbye);
    check('another ending restores normal costumes and portrait visibility', defaults(costumes.other) && !costumes.other.hidden, costumes.other);

    // Play the actual C pages once, exercising page splitting and metadata propagation.
    await openScene('ending-c');
    const observed = [];
    for (let count = 0; count < 160; count++) {
      const current = await frame();
      if (current.end) break;
      observed.push(current);
      await advancePage();
    }
    check('C completes through the normal ending flow', (await frame()).end);
    const hospitalPage = observed.find(item => item.text === '赵灵？');
    check('real C hospital page preserves costume metadata through playback', !!hospitalPage && /hero-casual\.png/.test(hospitalPage.hero) && /zhaoling-patient\.png/.test(hospitalPage.zhaoling), hospitalPage);
    const cgPages = observed.filter(item => item.type === 'cg' && /hospital-farewell\.png/.test(item.background));
    const goodbyePages = observed.filter(item => /^有缘再见，/.test(item.text));
    check('real C playback shows exactly one unobstructed farewell CG', cgPages.length === 1 && cgPages[0].portraitsHidden && /contain/.test(cgPages[0].backgroundSize), cgPages);
    check('real final line retains the farewell art without portraits', goodbyePages.length === 1 && /hospital-farewell\.png/.test(goodbyePages[0].background) && goodbyePages[0].portraitsHidden && /contain/.test(goodbyePages[0].backgroundSize), goodbyePages);

    for (const suffix of ['a', 'b']) {
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
