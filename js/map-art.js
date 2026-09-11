(function () {
  "use strict";
  window.MuseumMapArt = function (rooms) {
    // The artwork is only the room skin.  Keep the authored interaction
    // objects in the same room data so replacing a background cannot silently
    // remove the key, note, rules, guard, or chapter triggers.
    var authored = {};
    ["dorm", "hall"].forEach(function (id) {
      authored[id] = (rooms[id] && rooms[id].objects ? rooms[id].objects : []).reduce(function (all, object) {
        all[object.id] = object;
        return all;
      }, {});
    });
    function room(id,title,image,spawn,colliders,objects,chapter, cameraZoom) {
      var img=new Image();img.src=window.MuseumAssets ? window.MuseumAssets.url(image,"maps") : "assets/images/maps/"+image;
      rooms[id]={id:id,title:title,chapter:chapter || "第一幕",width:1670,height:942,spawn:spawn,colliders:colliders,objects:objects,art:img,cameraZoom:cameraZoom || 1};
    }
    function overviewRoom(id,title,image,spawn,colliders,objects) {
      var img=new Image();img.src=window.MuseumAssets ? window.MuseumAssets.url(image,"maps") : "assets/images/maps/"+image;
      rooms[id]={id:id,title:title,chapter:"馆内总览",width:1280,height:853,spawn:spawn,colliders:colliders,objects:objects,art:img,cameraZoom:1.22};
    }
    function gate(id,label,x,y,target,requiredFlag){return{id:id,type:"travel",label:label,x:x,y:y,r:90,target:target,requiredFlag:requiredFlag};}
    function scene(id,label,x,y,target,flag){return{id:id,type:"scene",label:label,x:x,y:y,r:100,scene:target,requiredFlag:flag};}
    /*
     * The overview is a real room, rather than a menu over a picture.  The
     * painted rooms are collision areas and the open floor between them is
     * the walkable route.  Entrances are deliberately placed in the door
     * openings so the player can read the labels on the artwork while moving.
     */
    overviewRoom("museum","博物馆","museum-overview-map.png",{x:615,y:610},[
      {x:565,y:340,w:80,h:100},
      {x:425,y:400,w:40,h:65},
      {x:700,y:555,w:36,h:46}
    ],[
      gate("overview-dorm","员工宿舍",320,330,"dorm"),
      gate("overview-corridor","宿舍外走廊",465,570,"corridor"),
      scene("overview-hospital","病房展厅",335,240,"scene-05"),
      scene("overview-class","教室展厅",650,250,"scene-06","scene05Seen"),
      gate("overview-wax","蜡像馆",835,250,"wax","scene07Seen"),
      gate("overview-hall","大厅",615,465,"hall"),
      scene("overview-canteen","食堂展厅",805,430,"scene-08","scene07Seen"),
      gate("overview-office","馆长办公室",350,480,"office"),
      scene("overview-wang-dorm","王钢蛋宿舍",285,440,"scene-11","scene10Seen"),
      scene("overview-silver","银色恋人展厅",700,625,"scene-18","scene17Seen"),
      scene("overview-exit","离开博物馆",610,642,"ending-choice","scene30Seen")
    ]);
    // Only these connected floor strips are walkable. Unmarked pixels,
    // including the south door facade and the exterior, are solid.
    rooms.museum.walkable = [
      {x:425,y:390,w:375,h:190},
      {x:500,y:570,w:215,h:85},
      {x:470,y:220,w:65,h:185},
      {x:175,y:228,w:670,h:30},
      {x:310,y:240,w:65,h:250},
      {x:245,y:390,w:90,h:100},
      {x:765,y:245,w:55,h:340},
      {x:530,y:240,w:315,h:24}
    ];
    rooms.museum.objects.forEach(function (object) {
      object.r = 24;
      object.approach = {x:object.x,y:object.y};
    });
    if (rooms.wax) {
      var exit = rooms.wax.objects.find(function (object) { return object.id === "wax-return"; });
      if (exit) { exit.type = "travel"; exit.target = "museum"; exit.label = "返回馆内"; }
    }
    room("dorm","员工宿舍","dorm-map.png",{x:830,y:750},[
      {x:0,y:0,w:1670,h:280},{x:0,y:0,w:40,h:942},{x:1630,y:0,w:40,h:942},{x:0,y:850,w:740,h:92},{x:930,y:850,w:740,h:92},
      {x:45,y:300,w:165,h:550},{x:160,y:270,w:330,h:160},{x:575,y:260,w:220,h:100},{x:1190,y:275,w:280,h:170},{x:1440,y:540,w:200,h:315}
    ],[
      Object.assign({}, authored.dorm["dorm-wardrobe"], { id:"dorm-wardrobe", type:"wardrobe", x:1370, y:475, r:92, label:"衣柜" }),
      Object.assign({}, authored.dorm["dorm-note"], { id:"dorm-note", type:"note", x:285, y:805, r:72, label:"床边纸条" }),
      Object.assign({}, authored.dorm["dorm-terminal"], { id:"dorm-terminal", type:"terminal", x:690, y:400, r:75, label:"旧电视" }),
      Object.assign({}, authored.dorm["dorm-mirror"], { id:"dorm-mirror", type:"mirror", x:1510, y:450, r:70, label:"墙上的镜子" }),
      // Leave the dorm through the exterior corridor first.  The corridor is
      // a real room and the player must walk through it before reaching the
      // museum overview; this prevents the old dorm -> hall teleport.
      Object.assign({}, authored.dorm["dorm-door"], { id:"dorm-door", type:"travel", target:"corridor", requiredFlag:"scene03Seen", x:835, y:860, r:82, label:"宿舍门 · 前往走廊", entry:{x:1040,y:400} }),
      authored.dorm["dorm-scene-11"], authored.dorm["dorm-scene-12"], authored.dorm["dorm-scene-13"],
      authored.dorm["dorm-scene-14"], authored.dorm["dorm-scene-25"]
    ].filter(Boolean),"序章",1);
    room("hall","博物馆大厅","hall-map.png",{x:835,y:700},[
      {x:0,y:0,w:1670,h:525},{x:0,y:0,w:110,h:942},{x:1555,y:0,w:115,h:942},{x:0,y:875,w:735,h:67},{x:945,y:875,w:725,h:67}
    ],[
      gate("hall-corridor","返回馆内总览",835,860,"museum"),
      Object.assign({}, authored.hall["hall-guard"], { id:"hall-guard", type:"guard", requiredFlag:"scene06Seen", x:835, y:610, r:100, label:"无脸保安" }),
      Object.assign({}, authored.hall["hall-rules"], { id:"hall-rules", type:"rules", x:1240, y:610, r:88, label:"值班告示" }),
      Object.assign({}, authored.hall["hall-scene-05"], { id:"hall-scene-05", type:"scene", scene:"scene-05", requiredFlag:"scene04Seen", x:310, y:620, r:76, label:"病房展厅" }),
      Object.assign({}, authored.hall["hall-scene-06"], { id:"hall-scene-06", type:"scene", scene:"scene-06", requiredFlag:"scene05Seen", x:1370, y:620, r:76, label:"教室展厅" }),
      Object.assign({}, authored.hall["hall-scene-08"], { id:"hall-scene-08", type:"scene", scene:"scene-08", requiredFlag:"scene07Seen", x:620, y:740, r:76, label:"食堂门前" }),
      Object.assign({}, authored.hall["hall-scene-09"], { id:"hall-scene-09", type:"scene", scene:"scene-09", requiredFlag:"scene08Seen", x:1080, y:740, r:76, label:"馆长办公室" }),
      Object.assign({}, authored.hall["hall-scene-10"], { id:"hall-scene-10", type:"scene", scene:"scene-10", requiredFlag:"scene09Seen", x:1430, y:740, r:76, label:"阴暗角落" }),
      Object.assign({}, authored.hall["hall-wax-door"], { id:"hall-wax-door", type:"waxDoor", x:1490, y:610, r:95, label:"蜡像馆入口" })
    ].filter(Boolean),"第一幕",1);
    room("corridor","宿舍外走廊","走廊示意图1.png",{x:1360,y:450},[],[
      gate("corridor-dorm","返回员工宿舍",1000,400,"dorm"),
      gate("corridor-hall","前往馆内总览",1690,420,"museum")
    ],"第一幕",1);
    // New artwork has a horizontal corridor; the dorm facade has no doorway.
    // Do not retain old vertical-map door locations or allow walking through it.
    rooms.corridor.width=1774;rooms.corridor.height=887;
    rooms.corridor.walkable=[{x:995,y:280,w:745,h:225},{x:1190,y:495,w:210,h:65}];
    room("office","馆长办公室","office-map.png",{x:830,y:780},[
      {x:0,y:0,w:1670,h:315},{x:0,y:0,w:180,h:942},{x:1455,y:0,w:215,h:942},{x:550,y:300,w:520,h:180},{x:440,y:495,w:780,h:125},{x:0,y:885,w:730,h:57},{x:935,y:885,w:735,h:57}
    ],[scene("office-director","馆长",1130,390,"scene-09","scene08Seen"),gate("office-exit","返回馆内总览",835,865,"museum")],"第一幕",1);
    // Keep the chapter events that live in these rooms, while placing them on
    // the open floor of the replacement artwork.
    ["dorm", "hall"].forEach(function (id) {
      (rooms[id].objects || []).forEach(function (object) {
        if (object.scene === "scene-10") { object.x = 1320; object.y = 780; }
      });
    });
  };
}());
