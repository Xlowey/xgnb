(function () {
  "use strict";
  var W = 1670, H = 942, STEP = 26, RADIUS = 15;
  // Coordinates refer to the original artwork. Only the character's feet collide.
  var walls = [[0,0,1670,290],[0,0,42,942],[1625,0,45,942],
    [0,850,742,92],[925,850,745,92],[742,913,183,29],
    [45,330,165,520],[165,290,325,145],[580,285,210,76],
    [1200,290,265,225],[1190,485,90,80],[1290,475,140,122],[1440,545,185,310]];
  var objects = [
    {id:"tv",name:"电视",text:"盖着红布的电视。",x:685,y:395,mark:[680,275],crop:[570,175,240,220]},
    {id:"dvd",name:"影碟机",text:"一台影碟机。",x:1395,y:625,mark:[1540,600],crop:[1430,530,205,175]},
    {id:"desk",name:"木桌",text:"木桌上有被啃食的痕迹。",x:380,y:472,mark:[320,320],crop:[165,175,330,275]},
    {id:"bed",name:"床底",text:"床底好像有异响。",x:1155,y:465,mark:[1220,460],crop:[1180,360,300,220]},
    {id:"wardrobe",name:"更衣柜",x:252,y:625,mark:[155,605]}
  ];
  function blocked(x,y) {
    return x<RADIUS || y<RADIUS || x>W-RADIUS || y>H-RADIUS || walls.some(function(b){
      return x+RADIUS>b[0] && x-RADIUS<b[0]+b[2] && y+RADIUS>b[1] && y-RADIUS<b[1]+b[3];
    });
  }
  function mount(root, hooks, inspect) {
    var map=document.createElement("div"); map.className="investigation-map";
    map.tabIndex=0; map.setAttribute("role","group"); map.setAttribute("aria-label","员工宿舍。方向键或 WASD 移动，走近物品后按 E 调查，也可点击地面移动。");
    var img=document.createElement("img"); img.src="../assets/images/dorm-map.png"; img.alt="员工宿舍"; img.draggable=false; map.appendChild(img);
    var canvas=document.createElement("canvas"); canvas.width=W;canvas.height=H;canvas.className="exploration-character";canvas.setAttribute("aria-hidden","true");map.appendChild(canvas);
    var ctx=canvas.getContext("2d"), keys={}, route=[], closest=null, destroyed=false, frame, last=0, moving=false, facing="down", travelled=0;
    var saved=hooks.state.flags.dormExplorationPosition;
    if(saved && ["up","down","left","right"].includes(saved.facing))facing=saved.facing;
    var player=saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && !blocked(saved.x,saved.y)?{x:saved.x,y:saved.y}:{x:835,y:745};
    var hint=document.createElement("p");hint.className="investigation-hint";hint.id="investigation-hint";hint.setAttribute("aria-live","polite");
    var action=document.createElement("button");action.type="button";action.className="nearby-investigation";action.hidden=true;
    var pins=[];
    function ready(){return objects.slice(0,4).every(function(o){return hooks.state.flags["examined-"+o.id];});}
    function enabled(o){return o.id!=="wardrobe" || ready();}
    function suspended(){return document.hidden || !hooks.canExplore();}
    function remember(){hooks.state.flags.dormExplorationPosition={x:player.x,y:player.y,facing:facing};}
    function stop(){keys={};route=[];if(moving){moving=false;remember();hooks.save();}}
    function saveBeforeLeave(){stop();remember();hooks.save();}
    function distance(o){return Math.hypot(player.x-o.x,player.y-o.y);}
    function update(){
      closest=objects.filter(function(o){return enabled(o)&&distance(o)<115;}).sort(function(a,b){return distance(a)-distance(b);})[0] || null;
      pins.forEach(function(pin,i){var o=objects[i];pin.hidden=!enabled(o);pin.classList.toggle("is-near",o===closest);pin.classList.toggle("is-examined",!!hooks.state.flags["examined-"+o.id]);});
      action.hidden=!closest;
      if(closest){action.textContent="E · "+(closest.id==="wardrobe"?"打开":"调查")+closest.name;action.style.left=(player.x/W*100)+"%";action.style.top=((player.y+25)/H*100)+"%";}
      var text=ready()?"打开更衣柜":"调查电视、影碟机、木桌和床底";
      if(hint.textContent!==text)hint.textContent=text;
      map.dataset.playerX=player.x.toFixed(1);map.dataset.playerY=player.y.toFixed(1);
    }
    function interact(){
      if(suspended() || !closest)return;
      var target=closest;stop();remember();hooks.save();
      if(target.id==="wardrobe"){hooks.state.flags.cabinetOpen=true;hooks.setAdvance(true);hooks.advance();}
      else inspect(target);
    }
    // A small floor grid gives pointer/touch movement the same collisions as the keyboard.
    function walkTo(x,y){
      if(suspended())return;
      var cols=Math.ceil(W/STEP),rows=Math.ceil(H/STEP), cells=[];
      for(var gy=0;gy<rows;gy++)for(var gx=0;gx<cols;gx++){
        var px=gx*STEP+STEP/2,py=gy*STEP+STEP/2;
        if(!blocked(px,py))cells.push({id:gy*cols+gx,x:px,y:py});
      }
      function nearest(px,py){return cells.reduce(function(a,b){return Math.hypot(b.x-px,b.y-py)<Math.hypot(a.x-px,a.y-py)?b:a;});}
      var start=nearest(player.x,player.y),end=nearest(x,y), allowed=new Map(cells.map(function(c){return [c.id,c];})),prev=new Map([[start.id,null]]),queue=[start.id],found=false;
      for(var qi=0;qi<queue.length;qi++){
        var id=queue[qi];if(id===end.id){found=true;break;}
        [id-1,id+1,id-cols,id+cols].forEach(function(n){
          if(!allowed.has(n)||prev.has(n))return;
          var a=allowed.get(id),b=allowed.get(n);if(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)>STEP+1)return;
          prev.set(n,id);queue.push(n);
        });
      }
      if(!found)return;
      route=[];for(var cursor=end.id;cursor!==null;cursor=prev.get(cursor))route.unshift(allowed.get(cursor));
      map.focus({preventScroll:true});
    }
    objects.forEach(function(o){
      var pin=document.createElement("button");pin.type="button";pin.className="investigation-pin";pin.setAttribute("aria-label","走近"+o.name);pin.title=o.name;
      pin.style.left=(o.mark[0]/W*100)+"%";pin.style.top=(o.mark[1]/H*100)+"%";
      pin.addEventListener("click",function(e){e.stopPropagation();if(!suspended())walkTo(o.x,o.y);});map.appendChild(pin);pins.push(pin);
    });
    action.addEventListener("click",function(e){e.stopPropagation();interact();});map.appendChild(action);
    map.addEventListener("click",function(e){if(e.target!==map && e.target!==img && e.target!==canvas)return;var b=map.getBoundingClientRect();walkTo((e.clientX-b.left)/b.width*W,(e.clientY-b.top)/b.height*H);});
    root.appendChild(map);root.appendChild(hint);
    function fit(){var b=root.getBoundingClientRect(),scale=Math.min(b.width/W,Math.max(0,b.height-38)/H);map.style.width=(W*scale)+"px";map.style.height=(H*scale)+"px";}
    var observer=new ResizeObserver(fit);observer.observe(root);fit();
    function keydown(e){
      if(suspended() || e.ctrlKey || e.metaKey || e.altKey)return;
      if(e.target.closest("input,textarea,select,[contenteditable=true]"))return;
      var key=e.key.toLowerCase();
      if(["w","a","s","d","arrowup","arrowleft","arrowdown","arrowright"].includes(key)){e.preventDefault();keys[key]=true;route=[];}
      if(key==="e" && !e.repeat){e.preventDefault();interact();}
    }
    function keyup(e){delete keys[e.key.toLowerCase()];}
    function draw(){
      ctx.clearRect(0,0,W,H);
      window.MuseumPlayerAvatar.draw(ctx,player.x,player.y,facing,moving,travelled,"dorm");
    }
    function tick(now){
      if(destroyed)return;var dt=Math.min((now-last)/1000||0,.04);last=now;
      if(suspended()){stop();draw();frame=requestAnimationFrame(tick);return;}
      var dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
      if(!dx&&!dy&&route.length){var p=route[0],dist=Math.hypot(p.x-player.x,p.y-player.y);if(dist<6)route.shift();else{dx=(p.x-player.x)/dist;dy=(p.y-player.y)/dist;}}
      var len=Math.hypot(dx,dy), wasMoving=moving;moving=false;
      if(len){
        dx=dx/len*230*dt;dy=dy/len*230*dt;var steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/7));
        for(var i=0;i<steps;i++){if(!blocked(player.x+dx/steps,player.y)){player.x+=dx/steps;moving=true;}if(!blocked(player.x,player.y+dy/steps)){player.y+=dy/steps;moving=true;}}
        facing=Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up");travelled+=Math.hypot(dx,dy);remember();
      }
      if(wasMoving&&!moving)hooks.save();update();draw();frame=requestAnimationFrame(tick);
    }
    document.addEventListener("keydown",keydown);document.addEventListener("keyup",keyup);window.addEventListener("blur",stop);document.addEventListener("visibilitychange",stop);window.addEventListener("pagehide",saveBeforeLeave);window.addEventListener("beforeunload",saveBeforeLeave);
    update();draw();map.focus({preventScroll:true});frame=requestAnimationFrame(tick);
    return function(){destroyed=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener("keydown",keydown);document.removeEventListener("keyup",keyup);window.removeEventListener("blur",stop);document.removeEventListener("visibilitychange",stop);window.removeEventListener("pagehide",saveBeforeLeave);window.removeEventListener("beforeunload",saveBeforeLeave);};
  }
  window.MuseumDormExploration={mount:mount};
}());
