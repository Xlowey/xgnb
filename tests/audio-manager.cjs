const fs=require('fs'),vm=require('vm'),assert=require('assert');
function boot(saved,ready=1){
 const events={},listeners={},store={museum_audio_settings_v1:JSON.stringify(saved||{enabled:true,position:12,volumeRev:2,volume:.042})};
 class Audio {constructor(src){this.src=src;this.currentTime=0;this.duration=120;this.readyState=ready;this.paused=true;this.calls=0;}play(){this.calls++;this.paused=false;return Promise.resolve();}pause(){this.paused=true;}addEventListener(n,fn){(events[n]??=[]).push(fn);}}
 const document={currentScript:{src:'http://localhost/js/audio-manager.js'},baseURI:'http://localhost/',body:{dataset:{}},readyState:'complete',querySelectorAll:()=>[],addEventListener:(n,fn)=>{listeners[n]=fn;}};
 const c={window:{addEventListener(){}},document,Audio,URL,Date,console,localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v}};vm.createContext(c);vm.runInContext(fs.readFileSync('js/audio-manager.js','utf8'),c);
 return {api:c.window.MuseumAudio,store,events,listeners};
}
const t=boot(),a=t.api.audio;assert.equal(a.currentTime,12);t.events.timeupdate.forEach(fn=>fn());a.currentTime=30;
for(let i=0;i<30;i++)t.listeners.keydown({target:{tagName:'BODY'}});assert.equal(a.calls,1);
t.api.play('dungeonWaves');assert.equal(JSON.parse(t.store.museum_audio_settings_v1).position,30);
t.api.toggle();assert.equal(JSON.parse(t.store.museum_audio_settings_v1).enabled,false);assert(a.paused);
t.api.toggle();assert.equal(JSON.parse(t.store.museum_audio_settings_v1).enabled,true);
t.api.play('main');assert.equal(a.currentTime,30);
const u=boot(undefined,0);u.api.play('dungeonBoss');u.api.audio.currentTime=0;u.api.audio.readyState=1;for(const fn of u.events.loadedmetadata||[])fn();assert.equal(u.api.audio.currentTime,0);
const v=boot({enabled:false,position:45,volumeRev:2,volume:.042},0);v.api.toggle();assert.equal(JSON.parse(v.store.museum_audio_settings_v1).enabled,true);
console.log('PASS key repeat does not replay; non-main mute persists; main position preserved across tracks; stale metadata cannot seek new track; early toggle persists');
