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
      rooms[id]={id:id,title:title,chapter:chapter || "第一幕",width:1670,height:942,spawn:spawn,colliders:colliders,objects:objects,art:art(image),cameraZoom:cameraZoom || 1};
    }
    function overviewRoom(id,title,image,spawn,colliders,objects) {
      rooms[id]={id:id,title:title,chapter:"馆内总览",width:1280,height:853,spawn:spawn,colliders:colliders,objects:objects,art:art(image),cameraZoom:1.22};
    }
    // 地图按房间按需加载：开局不再把 9 张地图（实测 14.5 MB）全部拉下来，只有真正要画的
    // 那一张会请求。加载完成后重绘一次，避免背景空白等到下一帧。
    function art(image) {
      return window.MuseumLazyImage ? window.MuseumLazyImage.create(image, "maps", function () { if (window.MuseumGameRedraw) window.MuseumGameRedraw(); })
        : (function () { var img = new Image(); img.src = window.MuseumAssets ? window.MuseumAssets.url(image, "maps") : "assets/images/maps/" + image; return img; }());
    }
    function gate(id,label,x,y,target,requiredFlag){return{id:id,type:"travel",label:label,x:x,y:y,r:90,target:target,requiredFlag:requiredFlag};}
    function scene(id,label,x,y,target,flag){return{id:id,type:"scene",label:label,x:x,y:y,r:100,scene:target,requiredFlag:flag};}
    /*
     * The overview is a real room, rather than a menu over a picture.  The
     * painted rooms are collision areas and the open floor between them is
     * the walkable route.  Entrances are deliberately placed in the door
     * openings so the player can read the labels on the artwork while moving.
     */
    // ---------------------------------------------------------------------------
    // 馆内总览的碰撞与可走区域（第三版，全部按画面像素实测重标）
    //
    // 判定方式：玩家是"脚底一个半径 10 的圆"，四个探点都必须落在某个可走矩形内。
    // 因此两条规则：
    //   1) 可走矩形要铺满画面上能走的石地，而且相邻矩形必须**重叠至少 20px**——
    //      只首尾相接的话圆过不去，接缝处就成了看不见的墙；
    //   2) 碰撞体负责挡住房间内部的石地（否则玩家会走进展厅里）。
    //      碰撞体宁可比房间略小：大不了玩家贴着墙走进去一点，也比门口整片地板变成
    //      空气墙好。上一版碰撞体估得比房间大，正是空气墙的主因。
    //
    // 实测依据：tmp/measure-museum-floor2.cjs（每行石地范围）、
    //           tmp/find-air-walls.cjs（空气墙格数，用来验收）、
    //           tmp/measure-museum-runs.cjs（走廊横竖扫描）。
    // ---------------------------------------------------------------------------
    overviewRoom("museum","博物馆","museum-overview-map.png",{x:615,y:610},[
      // 八个展厅的内芯（比画面上的房间略小，门前的石地留给玩家）
      {x:200,y:172,w:150,h:76},    // 病房展厅
      {x:476,y:184,w:176,h:66},    // 教室展厅
      {x:836,y:190,w:156,h:66},    // 蜡像馆
      {x:200,y:310,w:120,h:88},    // 宿舍
      {x:200,y:450,w:120,h:88},    // 王钢蛋宿舍
      {x:200,y:588,w:120,h:80},    // 馆长办公室
      {x:1000,y:310,w:150,h:140},  // 食堂展厅
      {x:1000,y:620,w:150,h:96},   // 银色恋人展厅
      // 地面障碍
      {x:565,y:340,w:80,h:100},
      {x:425,y:400,w:40,h:65},
      {x:700,y:555,w:36,h:46}
    ],[
      // 标记放在各自房间**门外的走廊石地上**，而且位置由脚本在附近搜索"能站住、通道够宽"
      // 的点得到（tmp/fix-museum-markers.cjs），不是估的。原来它们落在房间内部
      // （例如病房展厅在 335,240），而那里是墙，于是碰撞体把标记整个盖住、玩家永远走不到。
      gate("overview-dorm","员工宿舍",345,330,"dorm"),
      gate("overview-corridor","宿舍外走廊",465,570,"corridor"),
      scene("overview-hospital","病房展厅",345,300,"scene-05"),
      scene("overview-class","教室展厅",650,298,"scene-06","scene05Seen"),
      gate("overview-wax","蜡像馆",799,300,"wax","scene07Seen"),
      gate("overview-hall","大厅",615,465,"hall"),
      scene("overview-canteen","食堂展厅",769,430,"scene-08","scene07Seen"),
      gate("overview-office","馆长办公室",345,480,"office"),
      scene("overview-wang-dorm","王钢蛋宿舍",345,440,"scene-11","scene10Seen"),
      scene("overview-silver","银色恋人展厅",700,625,"scene-18","scene17Seen"),
      scene("overview-exit","离开博物馆",610,642,"ending-choice","scene30Seen")
    ]);
    // 可走区域 = 画面上的石地走廊，按实测范围铺满，并且相邻两条**重叠 20px 以上**。
    // 上一版每条带子只有 60-100px 宽、彼此只是首尾相接，于是带子之外的地板全是空气墙
    // （tmp/find-air-walls.cjs 量到 369 格可见地板走不进去）。这一版把走廊按实测铺满：
    // 左纵带 x 300-380、中央大厅 x 440-880、右纵带 x 880-1230、上下横带贯穿全宽。
    rooms.museum.walkable = [
      {x:270,y:190,w:200,h:340},   // 左纵带：覆盖右上角平台与 x 300-420 的纵向走廊
      {x:270,y:380,w:200,h:230},   // 左纵带下半（与上一条重叠 150px）
      {x:430,y:230,w:460,h:150},   // 上横带：病房/教室展厅门前（实测 y 240-330）
      {x:430,y:360,w:460,h:130},   // 大厅上层（与上横带、大厅各重叠 30px）
      {x:430,y:460,w:460,h:170},   // 大厅下层
      {x:470,y:600,w:260,h:180},   // 南侧出口通道（实测 y 600-780，含门厅平台）
      {x:860,y:230,w:390,h:230},   // 右纵带：食堂展厅门前（实测 x 880-1230 / y 240-460）
      {x:860,y:420,w:390,h:230},   // 右纵带下半（重叠 40px）
      {x:860,y:610,w:390,h:170}    // 银色恋人展厅门前（实测 y 640-750，重叠 40px）
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
      gate("corridor-hall","前往馆内总览",1690,420,"museum"),
      // 赵灵在走廊左侧等主角。走廊那段剧情（scene-04 · 午夜巡逻）应当是"和她对话"，
      // 而不是走出宿舍门就自动播放——剧本里那段正是她自我介绍（"赵灵。""师……师父……"）。
      // 出现条件与 js/map-npc.js 的 sequenceFor() 一致：还没谈过才显示。
      {id:"corridor-zhaoling",type:"npc",x:1060,y:445,r:95,label:"赵灵",scene:"scene-04",npc:"zhaoling"}
    ],"第一幕",1);
    // New artwork has a horizontal corridor; the dorm facade has no doorway.
    // Do not retain old vertical-map door locations or allow walking through it.
    rooms.corridor.width=1774;rooms.corridor.height=887;
    // 可走区域按画面像素实测而来（不是估的）：走廊地板 x 960..1774、y 337..565，
    // 下墙的门口凹口在 x 1256..1478 直到 y 608。
    // 旧的 {x:995,y:280,w:745,h:225} 上边缘比地板高出约 60px，所以人物头部会插进上方的墙
    // （看起来像"穿模"）；下边缘又停在 505，够不到门口（看起来像"下方会卡"）。
    // 人物质心（脚底）允许走的范围比地板略高一点，因为脚底站在地板下沿时身体本来就会
    // 盖住上方的墙面，这是俯视视角的正常表现。
    rooms.corridor.walkable=[
      {x:950,y:222,w:820,h:388},
      {x:1256,y:560,w:222,h:72}
    ];
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
