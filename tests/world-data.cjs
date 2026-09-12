process.chdir(require('path').resolve(__dirname,'..'));
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const c={window:{MuseumItems:{}},Image:function(){},console};vm.createContext(c);for(const n of ['state','map-data','map-art','chapter-maps','novel-data','novel-overrides','novel-presentation','novel-prologue','chapter-story','chapter-progress'])vm.runInContext(fs.readFileSync('js/'+n+'.js','utf8'),c);const w=c.window,r=w.MuseumMapData.create();w.MuseumMapArt(r);w.MuseumChapterMaps(r);
const flags={};for(let i=0;i<30;i++){const o=w.MuseumChapterProgress.objective({flags});if(!o.room)break;const obj=r[o.room].objects.find(x=>x.id===o.entrance);assert(obj,JSON.stringify(o));console.log('route',o.room,o.entrance);const m=/scene-(\d+)/.exec(obj.scene||'');if(i===0)flags.scene03Seen=true;else if(i===1)flags.scene04Seen=true;else if(obj.type==='guard')flags.scene07Seen=true;else if(obj.type==='contract')flags.scene15Seen=true;else if(m){flags['scene'+m[1]+'Seen']=true;if(m[1]==='18')flags.scene20Seen=true;}else throw Error('unhandled '+JSON.stringify(o));}
function blocked(room,x,y,rad){return x<rad||y<rad||x>room.width-rad||y>room.height-rad||(room.walkable&&![[x-rad,y],[x+rad,y],[x,y-rad],[x,y+rad]].every(([a,b])=>room.walkable.some(t=>a>=t.x&&a<=t.x+t.w&&b>=t.y&&b<=t.y+t.h)))||room.colliders.some(t=>x+rad>t.x&&x-rad<t.x+t.w&&y+rad>t.y&&y-rad<t.y+t.h)}
for(const room of Object.values(r)){const rad=room.id==='museum'?10:22;assert(!blocked(room,room.spawn.x,room.spawn.y,rad),'spawn '+room.id);for(const o of room.objects){if(o.type==='travel'){assert(r[o.target],o.id);const p=o.entry||r[o.target].spawn;assert(!blocked(r[o.target],p.x,p.y,o.target==='museum'?10:22),'entry '+o.id)}if(o.scene)assert(w.MuseumStory.scenes[o.scene],o.id);let reachable=false;for(let x=-o.r+1;x<o.r;x+=5)for(let y=-o.r+1;y<o.r;y+=5)if(Math.hypot(x,y)<o.r&&!blocked(room,o.x+x,o.y+y,rad))reachable=true;assert(reachable,'unreachable '+o.id);}}
assert.equal(w.MuseumStory.scenes['scene-03'].nextScene,null);assert.equal(w.MuseumStory.scenes['note-repeat'].events[0].type,'document');assert.equal(r.museum.objects.find(o=>o.id==='overview-dorm').target,'corridor');assert.equal(r.dorm.objects.filter(o=>o.scene==='scene-14').length,0);assert(!w.MuseumChapterMaps.visible(r.dorm.objects.find(o=>o.scene==='scene-11'),{flags:{}}));assert(!w.MuseumChapterMaps.visible(r.dorm.objects.find(o=>o.scene==='scene-11'),{flags:{scene10Seen:true,scene11Seen:true}}));console.log('PASS routes, spawn/entry collision, approaches, scene references, hidden future/completed events');

// Regression guards for the interrupted "one event, one location" pass.  These are
// the exact defects that were left half-applied; each one silently breaks a route.
assert(!r.museum.objects.some(o=>o.id==='overview-corridor'),'the museum must have a single dorm/corridor gate');
assert(!r.museum.objects.some(o=>o.id==='overview-wang-dorm'),'the dorm plot marker was moved off the overview');
assert(!r.dorm.objects.some(o=>o.id==='dorm-scene-14'),'scene-14 has one entrance: the canteen');
assert(!r.wax.objects.some(o=>o.id==='wax-exit'),'the wax exit is the return gate, not a second storyline');
assert.equal(r.wax.objects.find(o=>o.id==='wax-return').target,'museum');
for(const room of Object.values(r))for(const o of room.objects)if(o.target)assert(r[o.target],'broken travel target '+room.id+'.'+o.id+' -> '+o.target);
const gatesTo=target=>{const found=[];for(const room of Object.values(r))for(const o of room.objects)if(o.target===target)found.push(room.id+'.'+o.id);return found;};
// The overview used to hold two gates into the same corridor, and the dorm held a
// direct jump to the overview.  Both let the player skip the walk the artwork and
// the route table assume, so the dorm <-> corridor pair must stay the only gates.
assert.deepEqual(gatesTo('corridor').sort(),['dorm.dorm-door','museum.overview-dorm'],'dorm and the overview are the only corridor entrances');
assert.deepEqual(gatesTo('dorm'),['corridor.corridor-dorm'],'the corridor is the only way back into the dorm');
assert.equal(r.dorm.objects.find(o=>o.id==='dorm-door').target,'corridor','leaving the dorm must go through the corridor');
assert.equal(r.museum.objects.find(o=>o.id==='overview-dorm').entry.x,1040,'the overview dorm gate must enter beside the corridor dorm gate');
for(const id of ['wardrobe-repeat','note-repeat','mirror']){
  const s=w.MuseumStory.scenes[id];
  assert(s&&s.events&&s.events.length,'missing recorded inspection scene '+id);
  assert(s.events.every(e=>e.type!=='item'&&e.type!=='television'),id+' must not replay the prologue');
}
assert.equal(w.MuseumStory.scenes['wardrobe-repeat'].events[0].item,'rules','re-opening the wardrobe shows the staff rules');
assert.equal(w.MuseumStory.scenes['note-repeat'].events[0].item,'note','re-reading the note shows the note');
const uniformEvents=w.MuseumStory.scenes['scene-25'].events;const uniformTrigger=uniformEvents.findIndex(e=>e.type==='dialogue'&&/看纸片上的意思/.test(e.text||''));const uniformItem=uniformEvents.findIndex(e=>e.item==='银色的发卡.webp');assert(uniformTrigger>=0&&uniformItem>uniformTrigger,'scene-25 discoveries must follow the line that finds them');
console.log('PASS route uniqueness, travel targets, recorded inspections, discovery order');
