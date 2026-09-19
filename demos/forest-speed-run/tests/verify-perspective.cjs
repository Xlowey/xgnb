const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,fs.existsSync(path.resolve(__dirname,'../game.js'))?'..':'../outputs/forest-speed-run');
const sandbox={console,Math,window:{addEventListener(){}},localStorage:{getItem(){return null;}}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'game.js'),'utf8')+'\nthis.api={CONFIG,Renderer,Player,Obstacle,Coin,PowerUp};',sandbox);
const {CONFIG,Renderer,Player,Obstacle,Coin,PowerUp}=sandbox.api;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const renderer=Object.create(Renderer.prototype);
const gradient={addColorStop(){}};
let calls=[];
const ctx=new Proxy({}, {get(o,k){
  if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>gradient;
  return o[k]??((...args)=>calls.push([k,...args]));
},set(o,k,v){o[k]=v;return true;}});
Object.assign(renderer,{width:1280,height:720,dpr:1,ctx,powerUpImages:{},museumBackground:{complete:false}});
for(const [width,height] of [[1280,720],[693,390],[1920,1080]]) {
  renderer.width=width;renderer.height=height;
  let previous=renderer.project(1,-12);
  for(const z of [-11,0,20,42,100,220,290,600]) {
    const p=renderer.project(1,z), elevated=renderer.project(1,z,30);
    assert.ok(p.scale>0&&p.scale<previous.scale);
    assert.ok(p.y<previous.y&&p.x<previous.x);
    close(p.y-elevated.y,30*p.scale);
    previous=p;
    if(z===220)break;
  }
  const ratio=renderer.project(0,20).scale/renderer.project(0,220).scale;
  assert.ok(ratio>3&&ratio<3.4,'Restore the original moderate near/far ratio');
  // Nominal framing and sizes must exactly match the museum version before the aggressive redesign.
  for(const z of [0,20,42,100,220]) {
    const raw=70/(z+70),far=70/290,p=(raw-far)/(1-far);
    const expectedHalf=width*(.035+(.38-.035)*p),point=renderer.project(1,z);
    close(point.x,width*.5+expectedHalf*.62);
    close(point.y,height*.43+height*(.96-.43)*p);
    close(point.scale,raw*1.05);
    close(point.roadHalf,expectedHalf);
  }
}
renderer.width=1280;renderer.height=720;
const faces=[];
const face=renderer.face;
renderer.face=(points,color)=>faces.push({points,color});
for(const lane of [-1,0,1]) {
  faces.length=0;
  renderer.box(lane,42,.4,1.5,0,62,{top:'top',side:'side',front:'front'});
  const top=faces.find(f=>f.color==='top').points;
  const thickness=Math.abs(top[0].y-top[3].y);
  assert.ok(thickness>.5&&thickness<10,'Keep only a thin, restrained projected top face');
  assert.ok(top[1].x-top[0].x>top[2].x-top[3].x,'Near roof edge must be wider than far edge');
  assert.equal(faces.filter(f=>f.color==='side').length,lane===0?0:1);
}
renderer.face=face;
const drawOrder=[];
const drawPlayer=renderer.drawPlayer,drawObstacle=renderer.drawObstacle,drawCoin=renderer.drawCoin,drawPowerUp=renderer.drawPowerUp;
renderer.drawPlayer=()=>drawOrder.push('player');
renderer.drawObstacle=item=>drawOrder.push('obstacle:'+item.z);
renderer.drawCoin=item=>drawOrder.push('coin:'+item.z);
renderer.drawPowerUp=item=>drawOrder.push('power:'+item.z);
const dead=new Obstacle(0,60,'animal');dead.dead=true;
renderer.drawWorldObjects({obstacles:[new Obstacle(0,80,'rock'),new Obstacle(0,10,'fence'),dead],coins:[new Coin(0,35)],powerUps:[new PowerUp(0,5,'shield')],ambientTime:0});
assert.deepEqual(drawOrder,['obstacle:80','coin:35','player','obstacle:10','power:5']);
Object.assign(renderer,{drawPlayer,drawObstacle,drawCoin,drawPowerUp});

// Check every obstacle, including objects near either side of the camera, at multiple view sizes.
for(const [width,height] of [[1280,720],[693,390]]) {
  renderer.width=width;renderer.height=height;
  for(const lane of [-1,0,1])for(const z of [-10,20,70,220])for(const type of ['river','rock','animal','bulldozer','fence']) {
    calls=[];renderer.drawObstacle(new Obstacle(lane,z,type,{variant:'high',direction:-1}));
    for(const call of calls)for(const n of call.slice(1))if(typeof n==='number')assert.ok(Number.isFinite(n));
  }
}
renderer.width=1280;renderer.height=720;
const scene={player:new Player(),worldTravel:0,distance:0,ambientTime:0,shake:0,particles:[],coins:[],powerUps:[],obstacles:[]};
function characterPosition(height) {
  scene.player.height=height;scene.player.jumpActive=height>0;calls=[];renderer.drawPlayer(scene);
  return calls.filter(c=>c[0]==='translate');
}
const grounded=characterPosition(0),airborne=characterPosition(CONFIG.JUMP_HEIGHT);
close(grounded[0][2],airborne[0][2]);
const lift=grounded.at(-1)[2]-airborne.at(-1)[2];
assert.ok(lift>75&&lift<85,'Restore the original jump amplitude instead of the exaggerated >110px lift');
scene.player.reset();scene.player.slideTimer=CONFIG.SLIDE_DURATION;renderer.drawPlayer(scene);
renderer.render(scene);
// Nearest roadside objects must continue smoothly past z=0 until fully outside the view.
calls=[];
scene.worldTravel=32;renderer.drawRoadside(scene,renderer.palette(0));
const retiring=renderer.project(-1.88,-6);
assert.ok(calls.some(c=>c[0]==='translate'&&Math.abs(c[1]-retiring.x)<1e-7&&Math.abs(c[2]-retiring.y)<1e-7),'Exhibits must continue past z=0');
for(const travel of [35.999,36.001]) {
  calls=[];scene.worldTravel=travel;renderer.drawRoadside(scene,renderer.palette(0));
  const p=renderer.project(-1.88,26-travel);
  assert.ok(calls.some(c=>c[0]==='translate'&&Math.abs(c[1]-p.x)<1e-7&&Math.abs(c[2]-p.y)<1e-7),'The same exhibit must survive the segment wrap without disappearing');
}
console.log('PASS: exact original museum framing and sizes, moderate near/far ratio, thin obstacle top faces, correct player depth ordering, original jump amplitude with fixed foot shadow, responsive finite geometry, continuous roadside exit.');
