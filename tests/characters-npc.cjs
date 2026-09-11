const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const s=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(ROOT,u==='/'?'index.html':u.replace(/^\/+/,''));
if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('nf');return}
r.writeHead(200,{'Content-Type':T[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
let fails=0;const ck=(l,o,d)=>{console.log((o?'PASS ':'FAIL ')+l+(o||d===undefined?'':'  <- '+JSON.stringify(d)));if(!o)fails++};
(async()=>{await new Promise(r=>s.listen(8810,'127.0.0.1',r));
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const ctx=await b.newContext({viewport:{width:1366,height:768}});const p=await ctx.newPage();
const errs=[];const miss=[];p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400)miss.push(r.status()+' '+r.url())});
try{
 await p.goto('http://127.0.0.1:8810/index.html');
 await p.evaluate(()=>{localStorage.clear();const u=MuseumAuth.register('npc','x').user;const st=MuseumState.create(u);
 st.roomId='corridor';st.playerX=1200;st.playerY=520;st.mode='explore';
 st.flags=Object.assign({},st.flags,{scene03Seen:true,scene04Seen:true,hasKey:true});
 Object.keys(st.tutorial).forEach(k=>st.tutorial[k]=true);MuseumState.save(st,u.id)});
 await p.goto('http://127.0.0.1:8810/index.html?fromSave=1');
 if(await p.isVisible('#cover-screen'))await p.click('#continue-button');
 await p.waitForSelector('#game-screen:not([hidden])');await p.waitForTimeout(1500);
 const placed=await p.evaluate(()=>({room:MuseumState.load(MuseumAuth.getCurrentUser().id).roomId,place:!!window.MuseumNpc.placeFor('corridor',MuseumState.load(MuseumAuth.getCurrentUser().id)),frames:Object.keys(window.MuseumNpc.frames)}));
 ck('the NPC is placed in the corridor before scene-05',placed.place===true&&placed.room==='corridor',placed);
 const drew=await p.evaluate(()=>{const c=document.getElementById('explore-canvas');const x=c.getContext('2d');
  const d=x.getImageData(0,0,c.width,c.height).data;let nonbg=0;
  for(let i=0;i<d.length;i+=4*97){if(d[i]>60||d[i+1]>60||d[i+2]>60)nonbg++}
  return nonbg});
 ck('the map canvas has painted content (NPC does not break rendering)',drew>100,{sampled:drew});
 await p.screenshot({path:'tmp/audit-npc-corridor.png'});
 ck('no page error with the NPC mounted',errs.length===0,errs.slice(0,3));
 ck('no 404 for the NPC sheet',miss.filter(m=>/zhaoling-walk/.test(m)).length===0,miss.filter(m=>/zhaoling/.test(m)));
}finally{await b.close();s.close()}
console.log(fails?'\n'+fails+' FAILED':'\nOK');process.exitCode=fails?1:0})().catch(e=>{console.error(e);s.close();process.exitCode=1});