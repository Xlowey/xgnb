/* Smoke-test the achievement registry, progress records, and save-state fields. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
let failures = 0;
function check(label, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : ' <- ' + JSON.stringify(detail))); if (!ok) failures += 1; }


(async()=>{
 await new Promise(r=>server.listen(8831,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1366,height:768}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto('http://127.0.0.1:8831/index.html');
 await page.evaluate(()=>{localStorage.clear();const u=MuseumAuth.register('读档测试','x').user;const s=MuseumState.create(u);s.mode='novel';s.narrativeNode='scene-01';s.narrativeIndex=2;MuseumState.save(s,u.id);MuseumState.saveSlot(s,u.id,0);MuseumState.saveCheckpoint(s,u.id,{label:'测试检查点'});});
 let baseline;
 for(const route of ['index.html','pages/novel.html?scene=scene-01','pages/saves.html']){
 await page.goto('http://127.0.0.1:8831/'+route);
 if(route==='index.html')await page.locator('#cover-load-button').click();
 else if(route.startsWith('pages/novel'))await page.evaluate(()=>document.querySelector('#novel-load-button').click());
 await page.waitForSelector('dialog.story-save-dialog[open]');
 const text=await page.locator('.story-save-grid article').evaluateAll(rows=>rows.slice(1).map(r=>r.innerText).join('\n'));
 if(!baseline)baseline=text;check(route+' shares identical slots and summaries',text===baseline);
 check(route+' includes delete and checkpoint',text.includes('删除')&&text.includes('选择前检查点'));
 await page.keyboard.press('Escape');check(route+' Escape closes saves',await page.locator('dialog[open]').count()===0);
 }
 await page.goto('http://127.0.0.1:8831/index.html');
 await page.locator('#cover-load-button').click();
 await page.locator('.story-save-grid article').filter({hasText:'存档位 1 ·'}).getByRole('button',{name:'读取',exact:true}).click();
 await page.waitForURL('**/pages/novel.html?scene=scene-01');
 check('title loads a story save into the story player',page.url().includes('scene-01'));
 await page.evaluate(()=>document.getElementById('novel-load-button').click());
 await page.locator('.story-save-checkpoint').getByRole('button',{name:'读取',exact:true}).click();
 check('checkpoint restores story rather than changing its ending',page.url().includes('scene-01'));
 await page.goto('http://127.0.0.1:8831/index.html');
 await page.evaluate(()=>{const u=MuseumAuth.getCurrentUser();const s=MuseumState.load(u.id);s.mode='explore';s.narrativeNode=null;MuseumState.save(s,u.id);});
 await page.goto('http://127.0.0.1:8831/index.html?fromSave=1');
 await page.keyboard.press('Escape');await page.locator('#load-button').click();
 check('map pause uses the same save component',await page.locator('dialog.story-save-dialog[open]').count()===1);
 await page.screenshot({path:require('os').tmpdir()+'/museum-save-dialog.png'});
 await page.keyboard.press('Escape');check('closing saves returns to map pause',await page.locator('#load-button').isVisible());
 check('no runtime errors',errors.length===0,errors);
 }finally{await browser.close();server.close();}process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

