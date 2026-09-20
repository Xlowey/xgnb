const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'), types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.webp':'image/webp'};
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8848,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 const context=await browser.newContext({viewport:{width:1500,height:960}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8848/pages/map-editor.html');await page.waitForTimeout(400);
 assert.equal(await page.locator('#room option').count(),10);console.log('PASS eight exploration maps and both story investigations load');
 console.log('Initial validation:',await page.locator('#issues').innerText());
 await page.selectOption('#room','dorm');await page.waitForTimeout(150);
 await page.locator('#list button').first().click();
 const old=await page.locator('[data-field=x]').inputValue();await page.locator('[data-field=x]').fill(String(Number(old)+5));await page.locator('[data-field=x]').press('Tab');
 await page.click('#undo');await page.locator('#list button').first().click();assert.equal(await page.locator('[data-field=x]').inputValue(),old);console.log('PASS property edit and undo');
 await page.click('#redo');await page.click('#save');console.log('Save status:',await page.locator('#status').innerText());
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem(MuseumMapLayout.KEY)));assert(stored);assert.equal(stored.rooms.dorm.spawn.x,Number(old)+5);
 await page.reload();await page.selectOption('#room','dorm');await page.locator('#list button').first().click();assert.equal(await page.locator('[data-field=x]').inputValue(),String(Number(old)+5));console.log('PASS local save persists across reload');
 // Actual pointer drawing, undo and redo, including missing walkable restoration.
 await page.click('[data-tool=walkable]');const b=await page.locator('#canvas').boundingBox();
 await page.mouse.move(b.x+b.width*.35,b.y+b.height*.45);await page.mouse.down();await page.mouse.move(b.x+b.width*.6,b.y+b.height*.7);await page.mouse.up();
 assert(await page.locator('#list button').filter({hasText:'可走 1'}).count());await page.click('#undo');assert.equal(await page.locator('#list button').filter({hasText:'可走 1'}).count(),0);console.log('PASS drawing a floor region and undo removes the constraint');
 const before=await page.evaluate(()=>localStorage.getItem(MuseumMapLayout.KEY));
 await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"rooms":{"dorm":{"colliders":[null]}}}')});await page.waitForTimeout(80);assert((await page.locator('#status').innerText()).includes('导入失败'));assert.equal(await page.evaluate(()=>localStorage.getItem(MuseumMapLayout.KEY)),before);console.log('PASS malformed import preserves saved data');
 const download=page.waitForEvent('download');await page.click('#publish');const file=await download;assert.equal(file.suggestedFilename(),'map-layout-data.js');const text=fs.readFileSync(await file.path(),'utf8');assert(text.includes('window.MuseumMapLayoutData'));console.log('PASS portable project config export');
 await page.click('[data-tool=test]');await page.locator('#canvas').focus();await page.keyboard.down('d');await page.waitForTimeout(200);await page.keyboard.up('d');
 fs.mkdirSync(path.join(root,'work/map-editor'),{recursive:true});await page.screenshot({path:path.join(root,'work/map-editor/editor.png')});
 // Verify same game map assembly consumes both project and local configurations without touching accounts.
 const values=await page.evaluate(()=>{const r=MuseumMapData.create();MuseumMapArt(r);MuseumChapterMaps(r);MuseumMapLayout.applySaved(r);return {x:r.dorm.spawn.x,blockedFloor:!!r.dorm.walkable};});assert.equal(values.x,Number(old)+5);assert.equal(values.blockedFloor,false);

 await page.selectOption('#room','dorm-intro');
 await page.locator('#list button').filter({hasText:'电视'}).click();
 await page.locator('[data-field=x]').fill('710');await page.locator('[data-field=x]').press('Tab');
 assert(await page.locator('#delete').isDisabled());
 await page.click('#save');assert((await page.locator('#status').innerText()).includes('已保存'));
 await page.selectOption('#room','investigation-hospital');
 await page.locator('#list button').filter({hasText:'病床'}).click();
 await page.locator('[data-field=x]').fill('494.4');await page.locator('[data-field=x]').press('Tab');await page.click('#save');
 await page.screenshot({path:path.join(root,'work/map-editor/unified.png')});
 const novel=await page.context().newPage();novel.on('pageerror',e=>errors.push(e.message));
 await novel.goto('http://127.0.0.1:8848/pages/novel.html?scene=scene-02&preview=1');
 const observed=await novel.evaluate(()=>{
   const host=document.createElement('div');host.style.cssText='position:fixed;width:1000px;height:700px';document.body.append(host);
   const state={flags:{}};const hooks={state,canExplore:()=>true,save:()=>{},setAdvance:()=>{},advance:()=>{}};
   const cleanup=MuseumDormExploration.mount(host,hooks,()=>{});
   const tv=host.querySelector('[aria-label="走近电视"]');const left=parseFloat(tv.style.left);cleanup();host.replaceChildren();
   const e=MuseumStory.scenes['scene-05'].events.find(e=>e.type==='investigate');MuseumInvestigation.mount(host,e,hooks);
   const hospitalLeft=parseFloat(host.querySelector('[data-hotspot=bed]').style.left);host.remove();
   return {left,hospitalLeft};
 });
 assert(Math.abs(observed.left-710/1670*100)<.001);assert.equal(observed.hospitalLeft,30);
 console.log('PASS edited intro marker and hospital hotspot reach actual story renderers; required points protected');
 await novel.close();
 assert.deepEqual(errors,[]);console.log('PASS runtime configuration and no browser errors');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
