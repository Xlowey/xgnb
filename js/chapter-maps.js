(function(){
  "use strict";
  window.MuseumChapterMaps=function(rooms){
    function art(name){var image=new Image();image.src=window.MuseumAssets ? window.MuseumAssets.url(name,"maps") : "assets/images/maps/"+name;return image;}
    function travel(id,label,x,y,target){return {id:id,label:label,x:x,y:y,r:75,type:"travel",target:target};}
    var classroom={id:"classroom",title:"教室展厅",chapter:"第一幕",width:1647,height:955,spawn:{x:820,y:740},art:art("教室展厅背景.jpeg"),colliders:[
      {x:0,y:0,w:1647,h:280},{x:0,y:0,w:130,h:955},{x:1540,y:0,w:107,h:955},
      {x:0,y:780,w:760,h:175},{x:880,y:780,w:767,h:175},{x:0,y:900,w:1647,h:55},
      {x:1070,y:330,w:115,h:170},{x:1430,y:590,w:130,h:200}
    ],objects:[{id:"classroom-recording",type:"scene",scene:"scene-06",requiredFlag:"scene05Seen",label:"查看电视录像",x:1190,y:315,r:85},travel("classroom-exit","返回馆内",820,845,"museum")]};
    [200,400,600].forEach(function(x){classroom.colliders.push({x:x,y:320,w:145,h:425});});
    rooms.classroom=classroom;
    rooms.canteenPassage={id:"canteenPassage",title:"食堂门前走廊",chapter:"第一幕",width:1508,height:1043,spawn:{x:755,y:880},cameraZoom:1.15,art:art("食堂走廊地图.png"),colliders:[],walkable:[{x:635,y:205,w:245,h:715},{x:720,y:880,w:80,h:105}],objects:[
      {id:"canteen-door-story",type:"scene",scene:"scene-08",requiredFlag:"scene07Seen",label:"食堂铁门",x:755,y:240,r:75},travel("canteen-return","返回馆内",755,950,"museum")
    ]};
    rooms.canteen={id:"canteen",title:"食堂",chapter:"馆内探索",width:1508,height:1043,spawn:{x:750,y:825},cameraZoom:1,art:art("食堂地图.png"),
      walkable:[{x:180,y:335,w:1130,h:530},{x:660,y:825,w:145,h:150}],
      colliders:[],objects:[
        Object.assign(travel("canteen-exit","返回食堂走廊",750,935,"canteenPassage"),{entry:{x:755,y:350}}),
        {id:"canteen-meal",type:"scene",scene:"scene-14",requiredFlag:"scene13Seen",label:"调查食堂",x:750,y:395,r:75},
        {id:"canteen-ribbons",type:"scene",scene:"scene-21",requiredFlag:"scene20Seen",label:"彩带世界",x:750,y:600,r:75}
      ]};
    [390,515,640,765].forEach(function(y){[300,875].forEach(function(x){rooms.canteen.colliders.push({x:x,y:y,w:290,h:95});});});
    rooms.canteenPassage.objects.push(Object.assign(travel("canteen-enter","进入食堂",755,310,"canteen"),{requiredFlag:"scene13Seen",entry:{x:750,y:825}}));
    function change(id,props){Object.values(rooms).forEach(function(r){r.objects.forEach(function(o){if(o.id===id)Object.assign(o,props);});});}
    change("overview-class",{type:"travel",target:"classroom"});
    change("overview-canteen",{type:"travel",target:"canteenPassage"});
    change("hall-scene-06",{type:"travel",target:"classroom"});
    change("hall-scene-08",{type:"travel",target:"canteenPassage"});
    change("hall-scene-09",{type:"travel",target:"office"});
    change("corridor-canteen",{type:"travel",target:"canteenPassage"});
    change("overview-hospital",{requiredFlag:"scene04Seen"});
    change("hall-ward",{requiredFlag:"scene04Seen"});
    change("overview-office",{requiredFlag:"scene08Seen"});
    // Both museum approaches lead through the corridor, including the return trip.
    // "员工宿舍" is the only dorm entrance: routing it through the corridor keeps
    // the map-art.js rule that the player walks the corridor both ways.  There is
    // deliberately no second gate to the corridor, because two gates with the same
    // target make the minimap highlight whichever one happens to be listed first.
    change("overview-dorm",{label:"员工宿舍 · 经走廊",target:"corridor",entry:{x:1040,y:400}});
    rooms.museum.objects=rooms.museum.objects.filter(function(o){return o.id!=="overview-corridor";});
    change("corridor-dorm",{entry:{x:835,y:800}});
    change("dorm-scene-11",{x:835,y:795});
    change("dorm-scene-12",{x:835,y:795});
    change("dorm-scene-13",{x:500,y:470});
    change("dorm-scene-25",{x:1370,y:475});
    // Remove remote plot shortcuts: one event belongs to one physical location.
    rooms.dorm.objects=rooms.dorm.objects.filter(function(o){return o.scene!=="scene-14";});
    rooms.museum.objects=rooms.museum.objects.filter(function(o){return o.id!=="overview-wang-dorm";});
    var locations={
      "scene-17":["office",1130,390],"scene-18":["museum",700,625],
      "scene-21":["canteen",750,600],"scene-22":["canteen",750,600],"scene-23":["canteen",750,600],
      "scene-24":["office",1130,390],"scene-26":["corridor",1360,420],
      "scene-27":["dorm",835,795],"scene-28":["canteenPassage",755,500],
      "scene-29":["canteenPassage",755,500],"scene-30":["museum",610,620]
    };
    rooms.wax.objects=rooms.wax.objects.filter(function(o){
      var dest=locations[o.scene];if(!dest)return true;
      if(!rooms[dest[0]].objects.some(function(other){return other.scene===o.scene;}))rooms[dest[0]].objects.push(Object.assign({},o,{x:dest[1],y:dest[2],r:dest[0]==="museum"?24:72}));
      return false;
    });
    change("wax-contract",{requiredFlag:"scene14Seen"});
    // The wax room previously fell through to the old procedural placeholder.
    Object.assign(rooms.wax,{width:1649,height:954,art:art("蜡像馆地图.png"),cameraZoom:1,spawn:{x:800,y:710},
      walkable:[{x:440,y:430,w:725,h:320},{x:90,y:590,w:1480,h:160},{x:400,y:700,w:210,h:150},{x:995,y:700,w:190,h:150}],
      colliders:[{x:735,y:520,w:130,h:140}]});
    change("wax-return",{x:800,y:720,r:65});
    change("wax-contract",{x:800,y:450,r:72});
    change("wax-scene-16",{x:1140,y:570,r:72});
    rooms.wax.objects=rooms.wax.objects.filter(function(o){return o.id!=="wax-exit";});
  };
  // Shared by rendering, pointer selection and keyboard interaction.
  window.MuseumChapterMaps.visible=function(object,state){
    if(object.type!=="scene")return true;
    return (!object.requiredFlag || state.flags[object.requiredFlag]) && !window.MuseumState.sceneCompleted(state,object.scene);
  };
}());
