(function(){
  "use strict";
  window.MuseumChapterMaps=function(rooms){
    // 地图按需加载：只有真正要画的房间才请求素材（见 js/lazy-image.js）。
    function art(name){
      if (window.MuseumLazyImage) return window.MuseumLazyImage.create(name, "maps", function () { if (window.MuseumGameRedraw) window.MuseumGameRedraw(); });
      var image=new Image();image.src=window.MuseumAssets ? window.MuseumAssets.url(name,"maps") : "assets/images/maps/"+name;return image;
    }
    function travel(id,label,x,y,target){return {id:id,label:label,x:x,y:y,r:75,type:"travel",target:target};}
    // 009 删掉了「教室展厅」一场，房间与地图节点一并移除（2026-09-17）。
    rooms.canteenPassage={id:"canteenPassage",title:"食堂门前走廊",chapter:"第一幕",width:1508,height:1043,spawn:{x:755,y:880},cameraZoom:1.15,art:art("食堂走廊地图.webp"),colliders:[],walkable:[{x:635,y:205,w:245,h:715},{x:720,y:880,w:80,h:105}],objects:[
      {id:"canteen-door-story",type:"travel",target:"canteen",gateFlag:"scene11Seen",scene:"scene-07",requiredFlag:"scene06Seen",label:"食堂铁门",x:755,y:240,r:75},travel("canteen-return","返回馆内",755,950,"museum")
    ]};
    rooms.canteen={id:"canteen",title:"食堂",chapter:"馆内探索",width:1508,height:1043,spawn:{x:750,y:825},cameraZoom:1,art:art("食堂地图.webp"),
      walkable:[{x:180,y:335,w:1130,h:530},{x:660,y:825,w:145,h:150}],
      colliders:[],objects:[
        Object.assign(travel("canteen-exit","返回食堂走廊",750,935,"canteenPassage"),{entry:{x:755,y:350}}),
        {id:"canteen-ribbons",type:"scene",scene:"scene-19",requiredFlag:"scene18Seen",label:"彩带世界",x:750,y:600,r:75}
      ]};
    [390,515,640,765].forEach(function(y){[300,875].forEach(function(x){rooms.canteen.colliders.push({x:x,y:y,w:290,h:95});});});
    function change(id,props){Object.values(rooms).forEach(function(r){r.objects.forEach(function(o){if(o.id===id)Object.assign(o,props);});});}
    change("overview-canteen",{type:"travel",target:"canteenPassage"});
    // 大厅里原本有通往食堂走廊 / 馆长办公室的两个门形节点，2026-09-17 作为「悬空交互点」删除；
    // 两个房间仍可从馆内总览（overview-canteen / overview-office）与宿舍外走廊进入。
    change("corridor-canteen",{type:"travel",target:"canteenPassage"});
    change("overview-hospital",{requiredFlag:"scene04Seen"});
    change("hall-ward",{requiredFlag:"scene04Seen"});
    change("overview-office",{requiredFlag:"scene07Seen"});
    // Both museum approaches lead through the corridor, including the return trip.
    // "员工宿舍" is the only dorm entrance: routing it through the corridor keeps
    // the map-art.js rule that the player walks the corridor both ways.  There is
    // deliberately no second gate to the corridor, because two gates with the same
    // target make the minimap highlight whichever one happens to be listed first.
    change("overview-dorm",{label:"员工宿舍 · 经走廊",target:"corridor",entry:{x:1600,y:420}});
    rooms.museum.objects=rooms.museum.objects.filter(function(o){return o.id!=="overview-corridor";});
    change("corridor-dorm",{entry:{x:835,y:800}});
    change("dorm-scene-11",{x:835,y:795});
    change("dorm-scene-12",{x:835,y:795});
    change("dorm-scene-13",{x:500,y:470});
    change("dorm-scene-25",{x:1370,y:475});
    // Remove remote plot shortcuts: one event belongs to one physical location.
    rooms.dorm.objects=rooms.dorm.objects.filter(function(o){return o.scene!=="scene-12";});
    rooms.museum.objects=rooms.museum.objects.filter(function(o){return o.id!=="overview-wang-dorm";});
    var locations={
      "scene-15":["office",1130,390],"scene-16":["museum",700,625],
      "scene-19":["canteen",750,600],"scene-20":["canteen",750,600],"scene-21":["canteen",750,600],
      "scene-22":["office",1130,390],"scene-24":["corridor",1360,420],
      "scene-25":["dorm",835,795],"scene-26":["canteenPassage",755,500],
      "scene-27":["canteenPassage",755,500],"scene-28":["museum",610,620]
    };
    rooms.wax.objects=rooms.wax.objects.filter(function(o){
      var dest=locations[o.scene];if(!dest)return true;
      if(!rooms[dest[0]].objects.some(function(other){return other.scene===o.scene;}))rooms[dest[0]].objects.push(Object.assign({},o,{x:dest[1],y:dest[2],r:dest[0]==="museum"?24:72}));
      return false;
    });
    change("wax-contract",{requiredFlag:"scene12Seen"});
    // The wax room previously fell through to the old procedural placeholder.
    Object.assign(rooms.wax,{width:1649,height:954,art:art("蜡像馆地图.webp"),cameraZoom:1,spawn:{x:800,y:710},
      walkable:[{x:440,y:430,w:725,h:320},{x:90,y:590,w:1480,h:160},{x:400,y:700,w:210,h:150},{x:995,y:700,w:190,h:150}],
      colliders:[{x:735,y:520,w:130,h:140}]});
    change("wax-return",{x:800,y:720,r:65});
    change("wax-contract",{x:800,y:450,r:72});
    change("wax-scene-16",{x:1140,y:570,r:72});
    rooms.wax.objects=rooms.wax.objects.filter(function(o){return o.id!=="wax-exit";});
  };
  // Shared by rendering, pointer selection and keyboard interaction.
  window.MuseumChapterMaps.visible=function(object,state){
    // NPC 的可见条件与绘制它的 js/map-npc.js 用同一份判断，避免"看得见却点不到"。
    if(object.type==="npc")return !window.MuseumNpc || window.MuseumNpc.visibleFor(state.roomId,state,object.id);
    if(object.type!=="scene")return true;
    return (!object.requiredFlag || state.flags[object.requiredFlag]) && !window.MuseumState.sceneCompleted(state,object.scene);
  };
}());
