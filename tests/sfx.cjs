const fs = require('fs'), path = require('path'), assert = require('assert');
const {pathToFileURL} = require('url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--autoplay-policy=no-user-gesture-required']});
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve('pages/novel.html')).href+'?scene=scene-01&preview=1');
    for (const name of ['cabinet.mp3','system.mp4','victory.mp3','advance.mp3','collect.mp3','transition.mp3']) {
      const result = await page.evaluate(async bytes=>{
        const ctx = new AudioContext();
        try { const data = await ctx.decodeAudioData(Uint8Array.from(bytes).buffer); return {duration:data.duration,channels:data.numberOfChannels}; }
        finally { await ctx.close(); }
      },Array.from(fs.readFileSync(path.join('assets/audio/sfx',name))));
      assert(result.duration>0 && result.channels>0,name); console.log('PASS audio decodes',name,result.duration.toFixed(2)+'s');
    }
    await page.evaluate(()=>{
      window.__sfxCalls=[];
      const original=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){window.__sfxCalls.push(this.src);return original.call(this);};
      MuseumSfx.play('collect'); MuseumSfx.play('collect');
    });
    const calls=await page.evaluate(()=>window.__sfxCalls);
    assert.equal(calls.filter(x=>x.includes('/sfx/collect.mp3')).length,1);
    assert(!calls.some(x=>x.includes('/music/')));
    console.log('PASS duplicate sound throttled; no BGM restart');
    await page.evaluate(()=>{MuseumSfx.toggle();MuseumSfx.play('victory');});
    assert.equal((await page.evaluate(()=>window.__sfxCalls)).length,calls.length);
    assert.equal(await page.locator('[data-sfx-toggle]').first().textContent(),'音效 · 关');
    console.log('PASS independent sound mute');
    await page.reload();assert.equal(await page.evaluate(()=>MuseumSfx.isEnabled()),false);
    console.log('PASS sound setting survives reload');
    const director=await page.locator('.portrait-director').evaluate(img=>({loaded:img.complete&&img.naturalWidth===1254,url:img.src}));
    assert(director.loaded);assert(director.url.endsWith('?v=51'));
    console.log('PASS updated director portrait loaded');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
