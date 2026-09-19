const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, fs.existsSync(path.resolve(__dirname, '../game.js')) ? '..' : '../outputs/forest-speed-run');
const adapter = fs.readFileSync(path.join(root,'integration/museum-runner.js'),'utf8');
const bridgeSource = fs.readFileSync(path.join(root,'museum-bridge.js'),'utf8');
const key = 'museum_pending_runner_v1';
const clone = obj => JSON.parse(JSON.stringify(obj));
const originalLines=[{speaker:'主角',text:'原对白'}];
const entryEnv={window:{MuseumStory:{scenes:{'scene-28':{flag:'scene28Seen',lines:clone(originalLines)},'scene-11':{choices:[{action:'battle'}]}}}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'integration/museum-runner-entry.js'),'utf8'),entryEnv);
assert.deepEqual(entryEnv.window.MuseumStory.scenes['scene-28'].lines,originalLines);
assert.equal(entryEnv.window.MuseumStory.scenes['scene-28'].flag,null);
assert.equal(entryEnv.window.MuseumStory.scenes['scene-28'].choices[0].action,'runner');
assert.equal(entryEnv.window.MuseumStory.scenes['scene-11'].choices[0].action,'battle');
function storage() {
  const entries = new Map();
  return {getItem(k){return entries.get(k) ?? null;}, setItem(k,v){entries.set(k,v);}, removeItem(k){entries.delete(k);}, entries};
}
function host(preview = false) {
  const local = storage(), session = storage();
  const user = {id:preview?'class-preview':'user-one',username:'测试'};
  let state = {hp:17,roomId:'wax',playerX:0,playerY:42,narrativeNode:'scene-28',narrativeIndex:7,flags:{},clues:[],unlockedRooms:['dorm','wax']};
  if(preview) session.setItem('museum_class_preview',JSON.stringify(state));
  const location = {search:preview?'?scene=scene-28&preview=1&resume=1':'?scene=scene-28',href:'initial'};
  const env = {URL,URLSearchParams,console,localStorage:local,sessionStorage:session,
    document:{currentScript:{src:'http://museum.test/xgnb/js/museum-runner.js'}},
    window:{location,MuseumAuth:{getCurrentUser(){return user;}},MuseumState:{
      load(){return clone(state);},create(){return clone(state);},
      save(value){if(env.failSave) return false;state=clone(value);return true;},
      completeScene(value,id){value.flags['completed:'+id]=true;}
    }}};
  vm.runInNewContext(adapter,env);
  return {env,local,session,location,api:env.window.MuseumRunner,
    state(){return preview ? JSON.parse(session.getItem('museum_class_preview')) : clone(state);},
    setState(value){state=clone(value);if(preview)session.setItem('museum_class_preview',JSON.stringify(value));},
    write(status,extra={}){const s=this.state();(preview?session:local).setItem(key,JSON.stringify(Object.assign({kind:'museum-runner',version:1,status,userId:user.id,runId:s.runnerContext.runId,elapsed:180,score:2000,coins:10},extra)));}
  };
}
for (const preview of [false,true]) {
  for (const status of ['win','lose','cancel']) {
    const h=host(preview);
    h.local.setItem('museum_pending_battle_v1','UNRELATED');
    assert.equal(h.api.launch(),true);
    const launchUrl=new URL(h.location.href);
    assert.equal(launchUrl.pathname,'/xgnb/demos/forest-speed-run/index.html');
    assert.equal(launchUrl.searchParams.get('returnScene'),'scene-29');
    assert.equal(launchUrl.searchParams.get('preview'),preview?'1':null);
    assert.equal(h.state().flags.scene28Seen,undefined,'Opening runner must not award scene completion');
    h.write(status); assert.equal(h.api.consume(),true);
    const state=h.state();
    assert.equal(state.roomId,'wax');assert.equal(state.playerX,0);assert.equal(state.playerY,42);
    assert.equal(state.flags.battleDemoCompleted,undefined);
    assert.equal(state.flags.waxDoorUnlocked,undefined);
    assert.deepEqual(state.clues,[]);
    assert.equal(h.local.getItem('museum_pending_battle_v1'),'UNRELATED');
    assert.equal(state.runnerContext,undefined);
    assert.equal((preview?h.session:h.local).getItem(key),null);
    assert.equal(h.api.consume(),false,'The same result cannot be applied twice');
    if(status==='win') {
      assert.equal(state.hp,17);assert.equal(state.flags.scene28Seen,true);
      assert.equal(state.flags['completed:scene-28'],true);assert.equal(state.runnerRecord.score,2000);
      assert.equal(new URL(h.location.href).searchParams.get('scene'),'scene-29');
    } else if(status==='lose') {
      assert.equal(state.hp,0);assert.equal(state.flags.scene28Seen,undefined);
      assert.equal(new URL(h.location.href).searchParams.get('scene'),'ending-d');
    } else {
      assert.equal(state.hp,17);assert.equal(state.narrativeIndex,7);assert.equal(state.flags.scene28Seen,undefined);
      assert.equal(new URL(h.location.href).searchParams.get('scene'),'scene-28');
    }
    if(preview) assert.equal(h.local.getItem(key),null,'Preview must never write a formal result');
  }
}
for(const invalid of [{userId:'someone-else'},{runId:'old-run'},{elapsed:179.9},{elapsed:'bad'},{version:2},{kind:'battle'},{status:'unknown'}]) {
  const h=host();h.api.launch();h.write('win',invalid);
  const before=h.state();assert.equal(h.api.consume(),false);assert.deepEqual(h.state(),before);assert.ok(h.local.getItem(key));
}
const failedSave=host();failedSave.api.launch();failedSave.write('win');failedSave.env.failSave=true;
assert.equal(failedSave.api.consume(),false);assert.ok(failedSave.local.getItem(key),'A save failure must retain the result');
const failedLaunch=host();failedLaunch.env.failSave=true;
assert.equal(failedLaunch.api.launch(),false);assert.equal(failedLaunch.location.href,'initial');
const dead=host();dead.setState({...dead.state(),hp:0});assert.equal(dead.api.launch(),false);

function runner(query='') {
  const local=storage(),session=storage(),message={textContent:''},buttons=[];
  const env={URLSearchParams,localStorage:local,sessionStorage:session,
    document:{querySelectorAll(){return [{classList:{toggle(...args){buttons.push(args);}}}];},getElementById(){return message;}},
    window:{location:{search:query,href:'initial'}}};
  vm.runInNewContext(bridgeSource,env);
  return {env,local,session,message,buttons,api:env.window.MuseumRunnerBridge};
}
const standalone=runner();standalone.api.complete('win',{survivalTime:180});
assert.equal(standalone.api.enabled,false);assert.equal(standalone.api.returnToStory(),false);assert.equal(standalone.local.entries.size,0);
for(const preview of [false,true]) {
  const r=runner('?from=novel&runId=test-run&returnScene=scene-29&cancelScene=scene-28&user=user-one'+(preview?'&preview=1':''));
  const game={survivalTime:180,score:4000,distance:1400,coinCount:25,player:{wallHits:1}};
  assert.equal(r.api.enabled,true);r.api.complete('win',game);
  assert.equal(r.local.entries.size,0);assert.equal(r.session.entries.size,0,'Retry should not submit a result before leaving');
  assert.equal(r.api.returnToStory(),true);
  const result=JSON.parse((preview?r.session:r.local).getItem(key));
  assert.equal(result.status,'win');assert.equal(result.runId,'test-run');assert.equal(result.elapsed,180);
  r.api.reset();r.api.returnToStory();assert.equal(JSON.parse((preview?r.session:r.local).getItem(key)).status,'cancel');
  if(preview)assert.equal(r.local.entries.size,0);
}
const fullStorage=runner('?from=novel&runId=x&returnScene=scene-29&user=user-one');
fullStorage.local.setItem=()=>{throw new Error('full');};
assert.equal(fullStorage.api.returnToStory(),false);assert.equal(fullStorage.env.window.location.href,'initial');assert.ok(fullStorage.message.textContent);

// Original repository art is packaged locally, and every stylesheet/image path exists.
for(const name of ['menu-panel.webp','button-primary.webp','button-dark.webp','system-frame.webp','corridor.webp']) {
  const data=fs.readFileSync(path.join(root,'assets/museum',name));
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');
}
const css=fs.readFileSync(path.join(root,'museum.css'),'utf8');
for(const match of css.matchAll(/url\("([^\"]+)"\)/g))assert.ok(fs.existsSync(path.join(root,match[1])));
const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
const sandbox={window:{addEventListener(){}}};
vm.runInNewContext(source+'\n;globalThis.Renderer=Renderer;',sandbox);
const calls=[];
const ctx=new Proxy({}, {get(target,key){
  if(key==='createLinearGradient')return()=>({addColorStop(){}});
  return target[key] ?? ((...args)=>{calls.push([key,...args]);});
},set(target,key,value){calls.push(['set',key,value]);target[key]=value;return true;}});
const renderer=Object.create(sandbox.Renderer.prototype);
Object.assign(renderer,{ctx,width:1280,height:720,museumBackground:{complete:true,naturalWidth:1508,naturalHeight:1043}});
renderer.drawBackground({worldTravel:0,ambientTime:0},{});const a=JSON.stringify(calls);calls.length=0;
renderer.drawBackground({worldTravel:999,ambientTime:999},{});assert.equal(JSON.stringify(calls),a,'Distant art must not scroll or flash');
renderer.museumBackground.complete=false;renderer.drawBackground({},{});
console.log('PASS: museum art packaged, static distant background and fallback; runner win/lose/cancel, account/run isolation, preview isolation, no guard rewards, exact-once result consumption, save-failure recovery.');
