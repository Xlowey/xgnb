(function(){
  'use strict';
  function destinationObject(map, roomId){
    if(roomId==="dorm")return map.objects.find(function(o){return o.id==="overview-dorm";});
    // "宿舍外走廊" is entered through the dorm gate; a second gate at the corridor
    // position was removed so the minimap cannot highlight the wrong entrance.
    if(roomId==="corridor")return map.objects.find(function(o){return o.id==="overview-dorm";});
    if(roomId==="canteen")roomId="canteenPassage";
    return map.objects.find(function(object){return object.target===roomId;}) || null;
  }
  function drawLabel(ctx, text, x, y, active){
    if(!text)return;
    var width=ctx.measureText(text).width+8;
    ctx.fillStyle=active ? '#1b1710e8' : '#0b1013c8';
    ctx.fillRect(x-width/2,y-8,width,16);
    ctx.fillStyle=active ? '#ffe4a4' : '#eee0c6';
    ctx.fillText(text,x,y);
  }
  window.MuseumMapGuide=function(ctx,canvas,rooms,state){
    var map=rooms && rooms.museum;if(!map)return;
    var sx=canvas.width/map.width,sy=canvas.height/map.height;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#141718';ctx.fillRect(0,0,canvas.width,canvas.height);
    // 小地图的背景就是馆内总览那张图。它现在按需加载，而 drawRoom 只会为**当前房间**调
    // load()——玩家在宿舍/大厅时总览图从未被请求，导览面板就会失去底图。这里补一次。
    if(map.art && typeof map.art.load === "function")map.art.load();
    if(map.art && map.art.complete && map.art.naturalWidth)ctx.drawImage(map.art,0,0,canvas.width,canvas.height);
    ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    var objective=window.MuseumChapterProgress.objective(state);
    var objectiveTarget=map.objects.find(function(o){return o.id===objective.entrance;});
    if(!objectiveTarget && rooms[objective.room]){
      var localObjective=(rooms[objective.room].objects || []).find(function(o){return o.id===objective.entrance;});
      if(localObjective && localObjective.scene)objectiveTarget=map.objects.find(function(o){return o.scene===localObjective.scene;});
    }
    if(!objectiveTarget && objective.room!=="museum")objectiveTarget=destinationObject(map,objective.room);
    var target=state.roomId==='museum' ? objectiveTarget : destinationObject(map,state.roomId);
    // Labels are derived from the same entrance objects used for movement.
    // This keeps the minimap correct when a map coordinate or room name is
    // revised, and avoids a second hard-coded map layout drifting out of sync.
    map.objects.forEach(function(object){
      if(!object.label || object.id==='overview-exit')return;
      var locked=object.requiredFlag && !state.flags[object.requiredFlag];
      drawLabel(ctx,object.label,object.x*sx,object.y*sy,object===target);
      if(locked){ctx.fillStyle='#080b0dcc';ctx.fillRect(object.x*sx-14,object.y*sy-3,28,6);}
    });
    if(target){ctx.strokeStyle='#ffd36e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(target.x*sx,target.y*sy,9,0,Math.PI*2);ctx.stroke();}
    var p=state.roomId==='museum'?{x:state.playerX,y:state.playerY}:destinationObject(map,state.roomId);
    if(!p && state.mapReturnPoint)p=state.mapReturnPoint;
    if(!p)p=map.spawn;
    ctx.fillStyle='#fff';ctx.strokeStyle='#18232c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x*sx,p.y*sy,5,0,Math.PI*2);ctx.fill();ctx.stroke();
    var room=rooms[state.roomId],localTarget=objective.room===state.roomId && room ? (room.objects || []).find(function(o){return o.id===objective.entrance;}) : null,text=document.getElementById('mini-map-destination');
    var value='当前位置：'+(state.roomId==='museum'?'馆内总览':(room ? room.title : '未知地点'));
    if(state.roomId==='museum' && objectiveTarget)value+=' · 目标：'+objectiveTarget.label;
    else if(state.roomId!=='museum'){
      var exit=room && (room.objects || []).find(function(o){return o.type==='door' || (o.type==='travel' && (o.target==='museum' || o.target==='corridor' || o.target==='canteenPassage'));});
      if(localTarget)value+=' · 当前目标：'+localTarget.label;
      else if(objectiveTarget && objectiveTarget.target===state.roomId)value+=' · 当前目标：'+(exit ? exit.label : '完成本地点调查');
      else if(objectiveTarget)value+=' · 出口：'+(exit ? exit.label : '返回馆内总览')+' · 下一目标：'+objectiveTarget.label;
    }
    if(text && text.textContent!==value)text.textContent=value;
  };
}());
