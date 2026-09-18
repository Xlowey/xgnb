/* Smoke-checks for the 9.16 asset drop: CG video events, new portraits, and the diary item. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.webp':'image/webp', '.png':'image/png', '.mp4':'video/mp4' };
const server = http.createServer((req,res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, {'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'}); fs.createReadStream(file).pipe(res);
});
let fails = 0;
function check(label, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : ' <- ' + JSON.stringify(detail))); if (!ok) fails++; }
(async () => {
  await new Promise(r => server.listen(8822, '127.0.0.1', r));
  const browser = await chromium.launch({ headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport:{width:1366,height:768} });
  try {
    await page.goto('http://127.0.0.1:8822/pages/novel.html?scene=scene-01&preview=1');
    await page.waitForSelector('.video-cg-player');
    const video = await page.$eval('.video-cg-player', v => ({src:v.currentSrc, controls:v.controls, muted:v.muted}));
    check('scene-01 loads the new CG video', /CG1.*\.mp4/.test(decodeURIComponent(video.src)) && video.controls && video.muted, video);
    await page.getByRole('button', {name:'跳过动画'}).click();
    check('CG skip exposes the normal continue action', await page.locator('#event-next').isVisible());

    await page.goto('http://127.0.0.1:8822/pages/novel.html?scene=scene-09&preview=1');
    await page.waitForSelector('.video-cg-player');
    await page.getByRole('button', {name:'跳过动画'}).click();
    await page.locator('#event-next').click();
    check('scene-09 uses the new dark-corner story art', await page.locator('.novel-background').evaluate(el => /dark-corner\.webp/.test(el.style.getPropertyValue('--scene-background'))));

    const mapping = await page.evaluate(() => ({ doctor: MuseumPortraits.character('医生（录像）'), oldman: MuseumPortraits.character('老人（录像）'), son: MuseumPortraits.character('儿子（录像）') }));
    check('new hospital cast maps to portraits', mapping.doctor === 'doctor' && mapping.oldman === 'oldman' && mapping.son === 'son', mapping);

    await page.goto('http://127.0.0.1:8822/pages/novel.html?scene=scene-15-diary&preview=1');
    await page.waitForSelector('.novel-stage');
    const diary = await page.evaluate(() => ({ src: MuseumAssets.url('director-diary-cover.webp'), item: MuseumItems['director-diary'] }));
    check('diary item is registered with cover and pages', /director-diary-cover\.webp$/.test(diary.src) && diary.item && diary.item.reverseImage === 'director-diary-pages.webp', diary);
  } finally { await browser.close(); server.close(); }
  console.log(fails ? `${fails} FAILED` : 'OK'); process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
