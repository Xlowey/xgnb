/* Visual authoring for the formal exploration maps. No player/account state is loaded. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), api = window.MuseumMapLayout;
  const rooms = window.MuseumMapData.create();
  window.MuseumMapArt(rooms); window.MuseumChapterMaps(rooms);
  const original = api.capture(rooms);
  api.applySaved(rooms);
  const canvas = $('canvas'), ctx = canvas.getContext('2d'), viewport = $('viewport');
  let roomId = 'museum', tool = 'select', selected = null, scale = 1, ox = 0, oy = 0;
  let drag = null, space = false, dirty = false, testPlayer = null, lastTime = 0;
  let history = [], future = [], savedSnapshot = JSON.stringify(api.capture(rooms).rooms);
  const keys = new Set(), colors = {colliders:'#ff6a7b',walkable:'#6bdd9c',objects:'#ffcb65',spawn:'#75d8ff'};
  const room = () => rooms[roomId];
  const snapshot = () => JSON.stringify(api.capture(rooms));
  const say = text => { $('status').textContent = text; };
  function updateDirty() {
    dirty = JSON.stringify(api.capture(rooms).rooms) !== savedSnapshot;
    $('dirty').textContent = dirty ? '有未保存修改' : '已保存';
    $('undo').disabled = !history.length; $('redo').disabled = !future.length;
  }
  function checkpoint() { history.push(snapshot()); if (history.length > 60) history.shift(); future = []; }
  function restore(data) { api.apply(rooms, JSON.parse(data)); selected=null; entryOwner=null; setTool('select'); renderUI(); }
  function undo() { if (!history.length) return; future.push(snapshot()); restore(history.pop()); }
  function redo() { if (!future.length) return; history.push(snapshot()); restore(future.pop()); }
  function change(fn) { checkpoint(); fn(); renderUI(); }
  function active() { return selected && (selected.kind === 'spawn' ? room().spawn : (room()[selected.kind] || [])[selected.index]); }
  function renderUI() { updateDirty(); renderList(); renderInspector(); draw(); }
  function loadArt() {
    const image=room().art;
    if (image.load) image.load();
    if (image.complete && !image.naturalWidth) say('地图图片加载失败，请检查素材路径。');
    image.addEventListener('load', draw, {once:true});
    image.addEventListener('error', () => say('地图图片加载失败，请检查素材路径。'), {once:true});
  }
  function fit() {
    scale=Math.min(viewport.clientWidth/room().width, viewport.clientHeight/room().height)*.94;
    ox=(viewport.clientWidth-room().width*scale)/2; oy=(viewport.clientHeight-room().height*scale)/2; draw();
  }
  function zoom(factor,x=viewport.clientWidth/2,y=viewport.clientHeight/2) {
    const next=Math.max(.1,Math.min(8,scale*factor));
    ox=x-(x-ox)*next/scale; oy=y-(y-oy)*next/scale; scale=next;draw();
  }
  function setRoom(id) { entryOwner=null; setTool('select'); roomId=id; $('room').value=id; selected=null;testPlayer=null;loadArt();fit();renderUI(); }
  function point(event) { const b=canvas.getBoundingClientRect();return {x:(event.clientX-b.left-ox)/scale,y:(event.clientY-b.top-oy)/scale}; }
  function bounded(p) { return {x:Math.round(Math.max(0,Math.min(room().width,p.x))),y:Math.round(Math.max(0,Math.min(room().height,p.y)))}; }
  function visible(kind) { return kind==='spawn' || $('show-'+kind).checked; }
  function dot(p,color,size=6) { ctx.beginPath();ctx.arc(p.x,p.y,size/scale,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=1/scale;ctx.stroke(); }
  function label(text,x,y,color) { ctx.font=`${12/scale}px Microsoft YaHei`;ctx.fillStyle='#101820dd'; const w=ctx.measureText(text).width;ctx.fillRect(x-3/scale,y-13/scale,w+6/scale,17/scale);ctx.fillStyle=color;ctx.fillText(text,x,y); }
  function draw() {
    const width=viewport.clientWidth,height=viewport.clientHeight,dpr=window.devicePixelRatio||1;
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.translate(ox,oy);ctx.scale(scale,scale);
    const r=room();ctx.fillStyle='#23303a';ctx.fillRect(0,0,r.width,r.height);
    if(r.art.complete&&r.art.naturalWidth)ctx.drawImage(r.art,0,0,r.width,r.height);
    ['walkable','colliders'].forEach(kind=>{if(!visible(kind))return;(r[kind]||[]).forEach((a,i)=>{
      ctx.fillStyle=colors[kind]+'35';ctx.fillRect(a.x,a.y,a.w,a.h);ctx.lineWidth=1.5/scale;ctx.strokeStyle=colors[kind];ctx.strokeRect(a.x,a.y,a.w,a.h);
      if(selected&&selected.kind===kind&&selected.index===i){ctx.strokeStyle='white';ctx.lineWidth=3/scale;ctx.strokeRect(a.x,a.y,a.w,a.h);ctx.fillStyle='white';ctx.fillRect(a.x+a.w-5/scale,a.y+a.h-5/scale,10/scale,10/scale);}
    });});
    if(visible('objects'))r.objects.forEach((o,i)=>{
      ctx.beginPath();ctx.arc(o.x,o.y,o.r||48,0,Math.PI*2);ctx.strokeStyle=colors.objects+'90';ctx.lineWidth=1/scale;ctx.stroke();
      dot(o,selected&&selected.kind==='objects'&&selected.index===i?'white':colors.objects);
      label(o.label||o.id,o.x+9/scale,o.y-9/scale,colors.objects);
      if(o.approach){ctx.beginPath();ctx.moveTo(o.x,o.y);ctx.lineTo(o.approach.x,o.approach.y);ctx.stroke();dot(o.approach,'#caa3ff',4);}
    });
    dot(r.spawn,colors.spawn,8);label('出生点',r.spawn.x+12/scale,r.spawn.y,colors.spawn);
    if(testPlayer){ctx.beginPath();ctx.arc(testPlayer.x,testPlayer.y,r.id==='museum'?10:22,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#182530';ctx.lineWidth=2/scale;ctx.stroke();}
    $('zoom').textContent=Math.round(scale*100)+'%';
  }
  function renderList() {
    const list=$('list');list.replaceChildren();
    function row(kind,index,text){const b=document.createElement('button');b.textContent=text;b.classList.toggle('selected',!!selected&&selected.kind===kind&&selected.index===index);b.onclick=()=>{selected={kind,index};setTool('select');renderUI();};list.append(b);}
    row('spawn',0,'出生点');room().objects.forEach((o,i)=>row('objects',i,(o.type==='travel'?'出口 · ':'交互 · ')+(o.label||o.id)));
    ['colliders','walkable'].forEach(k=>(room()[k]||[]).forEach((a,i)=>row(k,i,(k==='colliders'?'碰撞 ':'可走 ')+(i+1))));
  }
  function renderInspector() {
    const root=$('inspector');root.replaceChildren();const item=active();
    if(!item){root.textContent='点击地图上的标注，或从左侧列表选择。';return;}
    const fields=document.createElement('div');fields.className='fields';root.append(fields);
    function field(title,key,type='number',opts={}) {
      const l=document.createElement('label');l.textContent=title;if(type!=='number')l.className='wide';
      const input=document.createElement(opts.choices?'select':'input');input.setAttribute('aria-label',title);input.dataset.field=key;
      if(opts.choices){opts.choices.forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);});}
      else input.type=type;
      const value=opts.get?opts.get():item[key];input.value=value===undefined?'':value;
      if(opts.readonly)input.readOnly=true;
      if(type==='number'){input.step=1;if(opts.min!==undefined)input.min=opts.min;}
      input.onchange=()=>{
        let value=input.value;
        if(type==='number') { if(value.trim()===''||!Number.isFinite(Number(value))||(opts.min!==undefined&&Number(value)<opts.min)){say('请输入有效数值。');renderInspector();return;}value=Number(value); }
        if(opts.check&&!opts.check(value)){say('值无效或 ID 重复。');renderInspector();return;}
        change(()=>{if(opts.set)opts.set(value);else if(value===''&&type==='text')delete item[key];else item[key]=value;});
      };
      l.append(input);fields.append(l);
    }
    if(selected.kind==='objects'){
      field('ID（已有点不可改名）','id','text',{readonly:original.rooms[roomId].objects.some(o=>o.id===item.id),check:v=>!!v.trim()&&!room().objects.some(o=>o!==item&&o.id===v)});
      field('显示名称','label','text');
      const p=document.createElement('p');p.textContent='类型：'+item.type+'。已有剧情条件原样保留。';root.prepend(p);
    }
    field('X','x','number',{min:0});field('Y','y','number',{min:0});
    if(selected.kind==='colliders'||selected.kind==='walkable'){field('宽','w','number',{min:1});field('高','h','number',{min:1});}
    if(selected.kind==='objects'){
      field('交互半径','r','number',{min:1});
      if(item.type==='travel'){
        field('目标地图','target','text',{choices:Object.values(rooms).map(r=>[r.id,r.title]),set:v=>{item.target=v;item.entry={...rooms[v].spawn};}});
        const entry=()=>item.entry||window.MuseumTransition.resolveEntry({roomId},item.target,null,rooms);
        ['x','y'].forEach(k=>field('目标落点 '+k.toUpperCase(),'entry-'+k,'number',{min:0,get:()=>entry()[k],set:v=>{item.entry={...entry(),[k]:v};}}));
        field('进入后朝向','facing','text',{choices:[['down','向下'],['up','向上'],['left','向左'],['right','向右']],get:()=>entry().facing||'down',set:v=>{item.entry={...entry(),facing:v};}});
        const b=document.createElement('button');b.textContent='在目标地图上点选落点';b.onclick=()=>{const source=item;setRoom(item.target);setTool('entry');entryOwner=source;say('请点击目标房间内能够站立的位置，设置该出口的落点。');};root.append(b);
      }
      if(item.type==='scene'||item.type==='npc') {
        const ids=new Set(Object.keys(window.MuseumStory.scenes));Object.values(original.rooms).forEach(r=>r.objects.forEach(o=>{if(o.scene)ids.add(o.scene);}));if(item.scene)ids.add(item.scene);
        field('剧情节点 ID','scene','text',{choices:[['','请选择剧情节点'],...Array.from(ids).map(id=>[id,id+' · '+(window.MuseumStory.scenes[id]?.title||'剧情')])]});
      }
      field('需要的进度标记','requiredFlag','text');
      if(item.approach){['x','y'].forEach(k=>field('靠近位置 '+k,'approach-'+k,'number',{min:0,get:()=>item.approach[k],set:v=>{item.approach[k]=v;}}));}
    }
  }
  let entryOwner=null;
  function setTool(value){tool=value;keys.clear();testPlayer=null;$('tools').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===value)));canvas.style.cursor=value==='select'?'default':'crosshair';
    if(value==='test'){testPlayer={...room().spawn};say('点击可站立地面放置白色脚底圆；WASD / 方向键移动，Shift 疾跑。此模式不触发剧情、不保存玩家进度。');canvas.focus();}
    draw();
  }
  function hit(p){
    if(selected&&['colliders','walkable'].includes(selected.kind)&&visible(selected.kind)){const a=active();if(a&&Math.hypot(p.x-a.x-a.w,p.y-a.y-a.h)<12/scale)return {...selected,resize:true};}
    if(Math.hypot(p.x-room().spawn.x,p.y-room().spawn.y)<12/scale)return {kind:'spawn',index:0};
    if(visible('objects')){for(let i=room().objects.length-1;i>=0;i--){const o=room().objects[i];if(Math.hypot(p.x-o.x,p.y-o.y)<16/scale)return {kind:'objects',index:i};}}
    for(const kind of ['colliders','walkable']){if(!visible(kind))continue;const a=room()[kind]||[];for(let i=a.length-1;i>=0;i--)if(p.x>=a[i].x&&p.x<=a[i].x+a[i].w&&p.y>=a[i].y&&p.y<=a[i].y+a[i].h)return {kind,index:i};}
    return null;
  }
  canvas.onpointerdown=e=>{
    if(e.button!==0&&e.button!==1)return;e.preventDefault();canvas.focus();canvas.setPointerCapture(e.pointerId);
    const p=bounded(point(e));
    if(e.button===1||space){drag={pan:true,x:e.clientX,y:e.clientY,ox,oy};return;}
    if(tool==='test'){if(!blocked(room(),p.x,p.y)){testPlayer=p;say('试玩位置已设置。使用 WASD / 方向键移动。');}else say('此位置被墙体或边界阻挡。');draw();return;}
    if(tool==='entry'){if(blocked(room(),p.x,p.y)){say('落点被阻挡，请选择可站立地面。');return;}change(()=>{entryOwner.entry={...p,facing:entryOwner.entry?.facing||'down'};});entryOwner=null;setTool('select');say('出口落点已设置；反向出口仍需单独确认。');return;}
    if(tool==='spawn'){change(()=>{room().spawn=p;selected={kind:'spawn',index:0};});return;}
    if(tool==='travel'||tool==='scene'){
      change(()=>{let n=1;while(room().objects.some(o=>o.id===roomId+'-custom-'+n))n++;
        const o={id:roomId+'-custom-'+n,type:tool,label:tool==='travel'?'新出口':'新剧情点',...p,r:75};
        if(tool==='travel'){o.target=Object.keys(rooms).find(id=>id!==roomId);o.entry={...rooms[o.target].spawn};}else o.scene='';
        room().objects.push(o);selected={kind:'objects',index:room().objects.length-1};});setTool('select');return;
    }
    if(tool==='colliders'||tool==='walkable'){
      checkpoint();room()[tool]=room()[tool]||[];room()[tool].push({...p,w:1,h:1});selected={kind:tool,index:room()[tool].length-1};drag={create:true,start:p};draw();return;
    }
    selected=hit(p);if(selected){const a=active();drag={start:p,before:JSON.parse(JSON.stringify(a)),resize:selected.resize,moved:false};}renderUI();
  };
  canvas.onpointermove=e=>{
    const raw=point(e),p=bounded(raw);$('coords').textContent=`X ${Math.round(raw.x)} · Y ${Math.round(raw.y)}`;
    if(!drag)return;
    if(drag.pan){ox=drag.ox+e.clientX-drag.x;oy=drag.oy+e.clientY-drag.y;draw();return;}
    const a=active();if(!a)return;
    if(drag.create){a.x=Math.min(p.x,drag.start.x);a.y=Math.min(p.y,drag.start.y);a.w=Math.max(1,Math.abs(p.x-drag.start.x));a.h=Math.max(1,Math.abs(p.y-drag.start.y));}
    else {
      if(!drag.moved){if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)<1)return;checkpoint();drag.moved=true;}
      if(drag.resize){a.w=Math.max(1,p.x-a.x);a.h=Math.max(1,p.y-a.y);}
      else {const b=drag.before;a.x=Math.max(0,Math.min(room().width-(a.w||0),b.x+p.x-drag.start.x));a.y=Math.max(0,Math.min(room().height-(a.h||0),b.y+p.y-drag.start.y));if(b.approach)a.approach={...b.approach,x:b.approach.x+a.x-b.x,y:b.approach.y+a.y-b.y};}
    }draw();
  };
  function endDrag(){if(!drag)return;if(drag.create){const a=active();if(a.w<3||a.h<3){room()[selected.kind].splice(selected.index,1);selected=null;history.pop();}}drag=null;renderUI();}
  canvas.onpointerup=endDrag;canvas.onpointercancel=endDrag;
  canvas.onwheel=e=>{e.preventDefault();const b=canvas.getBoundingClientRect();zoom(e.deltaY<0?1.12:1/1.12,e.clientX-b.left,e.clientY-b.top);};
  function blocked(r,x,y){
    const rad=r.id==='museum'?10:22;
    if(x<rad||y<rad||x>r.width-rad||y>r.height-rad)return true;
    if(r.walkable?.length&&![[x-rad,y],[x+rad,y],[x,y-rad],[x,y+rad]].every(([px,py])=>r.walkable.some(a=>px>=a.x&&px<=a.x+a.w&&py>=a.y&&py<=a.y+a.h)))return true;
    return (r.colliders||[]).some(a=>x+rad>a.x&&x-rad<a.x+a.w&&y+rad>a.y&&y-rad<a.y+a.h);
  }
  function validate(){
    const errors=[];Object.values(rooms).forEach(r=>{
      const add=s=>errors.push(r.title+'：'+s);
      if(blocked(r,r.spawn.x,r.spawn.y))add('出生点被阻挡');
      ['colliders','walkable'].forEach(k=>(r[k]||[]).forEach((a,i)=>{if(a.x<0||a.y<0||a.x+a.w>r.width||a.y+a.h>r.height)add((k==='colliders'?'碰撞':'可走')+'区域 '+(i+1)+' 超出地图');}));
      r.objects.forEach(o=>{
        if(o.x<0||o.y<0||o.x>r.width||o.y>r.height)add((o.label||o.id)+' 位于地图外');
        if(o.type==='scene'&&!o.scene)add(o.id+' 没有填写剧情节点');
        if(o.type==='travel'){
          const target=rooms[o.target];if(!target){add(o.id+' 目标地图不存在');return;}
          const p=window.MuseumTransition.resolveEntry({roomId:r.id},o.target,o.entry,rooms);
          if(blocked(target,p.x,p.y))add((o.label||o.id)+' 的目标落点被阻挡');
        }
        let reachable=false;const radius=o.r||48;
        for(let dy=-radius;dy<=radius&&!reachable;dy+=6)for(let dx=-radius;dx<=radius&&!reachable;dx+=6)if(Math.hypot(dx,dy)<radius&&!blocked(r,o.x+dx,o.y+dy))reachable=true;
        if(!reachable)add((o.label||o.id)+' 的交互范围内没有可站立位置');
      });
    });
    $('issues').replaceChildren();(errors.length?errors:['未发现出生点、落点或交互范围错误。仍需试玩确认通道连通与剧情条件。']).forEach(s=>{const li=document.createElement('li');li.textContent=s;$('issues').append(li);});return errors;
  }
  function readyToSave(){endDrag();const errors=validate();if(errors.length){say('发现 '+errors.length+' 项问题，请先修正右侧检查结果；可导出 JSON 备份草稿。');return false;}return true;}
  $('save').onclick=()=>{if(!readyToSave())return;if(api.write(api.capture(rooms))){savedSnapshot=JSON.stringify(api.capture(rooms).rooms);updateDirty();say('已保存到本浏览器。请刷新同一网址下的游戏页面；玩家存档未修改。');}else say('保存失败：浏览器存储不可用或配置无效。请导出 JSON 备份。');};
  function exportStamp() { const d=new Date();const pad=n=>String(n).padStart(2,'0');return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds()); }
  $('export-room').onclick=()=>{endDrag();const data=api.capture(rooms);data.rooms={[roomId]:data.rooms[roomId]};api.download(data,room().title+'_'+roomId+'_地图标注_'+exportStamp()+'.json');say('已导出当前地图，文件名包含地图名称、ID 和时间。');};
  $('export').onclick=()=>{endDrag();api.download(api.capture(rooms),'全部地图_地图标注_'+exportStamp()+'.json');say('已导出全部地图 JSON，可备份或重新导入。');};
  $('publish').onclick=()=>{if(!readyToSave())return;const text='// Generated by the museum map editor.\nwindow.MuseumMapLayoutData = '+JSON.stringify(api.capture(rooms),null,2)+';\n';download(text,'map-layout-data.js','text/javascript');say('已导出项目配置。将文件放入项目 js 文件夹替换同名文件，刷新游戏。');};
  function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=api.normalize(JSON.parse(await file.text()));if(!data||Object.keys(data.rooms).some(id=>!rooms[id]))throw new Error('未知地图或无效格式');change(()=>api.apply(rooms,data));loadArt();validate();say('已导入草稿，尚未保存到本机。未包含的地图和字段保持原样。');}catch(err){say('导入失败：'+err.message+'。原配置未改动。');}finally{e.target.value='';}};
  $('reset').onclick=()=>{if(confirm('恢复当前地图的原始标注？可撤销，保存前不会影响游戏。'))change(()=>api.apply(rooms,{rooms:{[roomId]:{...original.rooms[roomId],walkable:original.rooms[roomId].walkable||[]}}}));};
  $('clear').onclick=()=>{if(!confirm('清除本机地图覆盖并重新载入项目配置？未保存修改将丢失，玩家存档不受影响。'))return;if(api.clear()){dirty=false;location.reload();}else say('清除失败，浏览器存储不可用。');};
  $('delete').onclick=()=>{if(!selected||selected.kind==='spawn'){say('出生点不能删除；可拖动或重新设置。');return;}change(()=>{room()[selected.kind].splice(selected.index,1);selected=null;});};
  $('undo').onclick=undo;$('redo').onclick=redo;$('fit').onclick=fit;$('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(1/1.2);$('validate').onclick=validate;
  $('tools').onclick=e=>{if(e.target.dataset.tool)setTool(e.target.dataset.tool);};
  ['colliders','walkable','objects'].forEach(k=>$('show-'+k).onchange=draw);
  Object.values(rooms).forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=r.title+' · '+r.id;$('room').append(o);});$('room').onchange=e=>setRoom(e.target.value);
  document.addEventListener('keydown',e=>{
    if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
    if(e.key==='Delete'){e.preventDefault();$('delete').click();return;}
    if(e.key==='Escape'){setTool('select');entryOwner=null;return;}
    if(e.target!==canvas)return;
    if(e.code==='Space'){space=true;e.preventDefault();}
    if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Shift'].includes(e.key)){keys.add(e.key);e.preventDefault();}
  });
  document.addEventListener('keyup',e=>{keys.delete(e.key);if(e.code==='Space')space=false;});
  window.addEventListener('blur',()=>{keys.clear();space=false;endDrag();});canvas.addEventListener('blur',()=>keys.clear());
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  function frame(time){const dt=Math.min((time-lastTime)/1000||0,.05);lastTime=time;if(tool==='test'&&testPlayer){let dx=Number(keys.has('d')||keys.has('ArrowRight'))-Number(keys.has('a')||keys.has('ArrowLeft')),dy=Number(keys.has('s')||keys.has('ArrowDown'))-Number(keys.has('w')||keys.has('ArrowUp'));const len=Math.hypot(dx,dy)||1,speed=(roomId==='museum'?100:235)*(keys.has('Shift')?1.5:1);dx=dx/len*speed*dt;dy=dy/len*speed*dt;if(!blocked(room(),testPlayer.x+dx,testPlayer.y))testPlayer.x+=dx;if(!blocked(room(),testPlayer.x,testPlayer.y+dy))testPlayer.y+=dy;if(dx||dy)draw();}requestAnimationFrame(frame);}
  new ResizeObserver(fit).observe(viewport);setRoom(roomId);validate();say('已载入地图。选择标注可拖动；画区域请在原图上按住拖动。');requestAnimationFrame(frame);
}());
