(function(){"use strict";
window.MuseumMapData={create:function(){
  var rooms = {
    dorm: {
      id: "dorm", title: "员工宿舍", chapter: "序章", width: 1500, height: 860, spawn: { x: 300, y: 520 },
      colliders: [{ x: 0, y: 0, w: 1500, h: 34 }, { x: 0, y: 826, w: 1500, h: 34 }, { x: 0, y: 0, w: 34, h: 860 }, { x: 1466, y: 0, w: 34, h: 860 }, { x: 130, y: 125, w: 360, h: 180 }, { x: 620, y: 104, w: 260, h: 100 }, { x: 1040, y: 120, w: 220, h: 200 }, { x: 170, y: 610, w: 310, h: 130 }, { x: 760, y: 610, w: 330, h: 110 }],
      objects: [
        { id: "dorm-note", type: "note", x: 580, y: 458, r: 72, label: "床边纸条" },
        { id: "dorm-wardrobe", type: "wardrobe", x: 1140, y: 420, r: 92, label: "衣柜" },
        { id: "dorm-terminal", type: "terminal", x: 930, y: 475, r: 75, label: "旧电视" },
        { id: "dorm-mirror", type: "mirror", x: 1250, y: 680, r: 70, label: "墙上的镜子" },
        { id: "dorm-door", type: "door", requiredFlag: "scene03Seen", x: 1375, y: 460, r: 82, label: "宿舍门" },
        { id: "dorm-scene-11", type: "scene", scene: "scene-11", requiredFlag: "scene10Seen", x: 420, y: 740, r: 82, label: "宿舍门口的客人" },
        { id: "dorm-scene-12", type: "scene", scene: "scene-12", requiredFlag: "scene11Seen", x: 620, y: 740, r: 82, label: "散落的彩带" },
        { id: "dorm-scene-13", type: "scene", scene: "scene-13", requiredFlag: "scene12Seen", x: 820, y: 740, r: 82, label: "馆长的来信" },
        { id: "dorm-scene-14", type: "scene", scene: "scene-14", requiredFlag: "scene13Seen", x: 1040, y: 740, r: 82, label: "食堂的彩带" },
        { id: "dorm-scene-25", type: "scene", scene: "scene-25", requiredFlag: "scene24Seen", x: 1240, y: 740, r: 82, label: "红色制服" }
      ]
    },
    hall: {
      id: "hall", title: "中央大厅", chapter: "第一幕", width: 1700, height: 860, spawn: { x: 160, y: 460 },
      colliders: [{ x: 0, y: 0, w: 1700, h: 34 }, { x: 0, y: 826, w: 1700, h: 34 }, { x: 0, y: 0, w: 34, h: 860 }, { x: 1666, y: 0, w: 34, h: 860 }, { x: 170, y: 110, w: 260, h: 170 }, { x: 570, y: 120, w: 280, h: 130 }, { x: 1080, y: 110, w: 320, h: 170 }, { x: 180, y: 640, w: 360, h: 80 }, { x: 1040, y: 630, w: 410, h: 90 }],
      objects: [
        { id: "hall-return", type: "returnDorm", x: 90, y: 460, r: 70, label: "回宿舍" },
        { id: "hall-guard", type: "guard", requiredFlag: "scene06Seen", x: 710, y: 455, r: 100, label: "无脸保安" },
        { id: "hall-rules", type: "rules", x: 1020, y: 360, r: 88, label: "值班告示" },
        { id: "hall-scene-05", type: "scene", scene: "scene-05", requiredFlag: "scene04Seen", x: 420, y: 400, r: 76, label: "病房展厅" },
        { id: "hall-scene-06", type: "scene", scene: "scene-06", requiredFlag: "scene05Seen", x: 430, y: 620, r: 76, label: "教室展厅" },
        { id: "hall-scene-08", type: "scene", scene: "scene-08", requiredFlag: "scene07Seen", x: 820, y: 650, r: 76, label: "食堂门前" },
        { id: "hall-scene-09", type: "scene", scene: "scene-09", requiredFlag: "scene08Seen", x: 1220, y: 430, r: 76, label: "馆长办公室" },
        { id: "hall-scene-10", type: "scene", scene: "scene-10", requiredFlag: "scene09Seen", x: 1430, y: 650, r: 76, label: "阴暗角落" },
        { id: "hall-wax-door", type: "waxDoor", x: 1530, y: 455, r: 95, label: "蜡像馆入口" }
      ]
    },
    wax: {
      id: "wax", title: "蜡像馆", chapter: "第二幕", width: 1600, height: 860, spawn: { x: 160, y: 460 },
      colliders: [{ x: 0, y: 0, w: 1600, h: 34 }, { x: 0, y: 826, w: 1600, h: 34 }, { x: 0, y: 0, w: 34, h: 860 }, { x: 1566, y: 0, w: 34, h: 860 }, { x: 170, y: 110, w: 260, h: 160 }, { x: 560, y: 105, w: 300, h: 170 }, { x: 1020, y: 110, w: 310, h: 170 }, { x: 220, y: 650, w: 300, h: 75 }, { x: 710, y: 650, w: 350, h: 75 }, { x: 1200, y: 650, w: 220, h: 75 }],
      objects: [
        { id: "wax-return", type: "returnHall", x: 90, y: 460, r: 70, label: "返回大厅" },
        { id: "wax-contract", type: "contract", x: 690, y: 445, r: 105, label: "张明诚展台" },
        { id: "wax-scene-16", type: "scene", scene: "scene-16", requiredFlag: "scene15Seen", x: 350, y: 620, r: 72, label: "王辰龙展台" },
        { id: "wax-scene-17", type: "scene", scene: "scene-17", requiredFlag: "scene16Seen", x: 560, y: 620, r: 72, label: "馆长办公室" },
        { id: "wax-scene-18", type: "scene", scene: "scene-18", requiredFlag: "scene17Seen", x: 820, y: 620, r: 72, label: "银色的恋人" },
        { id: "wax-scene-21", type: "scene", scene: "scene-21", requiredFlag: "scene20Seen", x: 1040, y: 620, r: 72, label: "食堂铁门" },
        { id: "wax-scene-22", type: "scene", scene: "scene-22", requiredFlag: "scene21Seen", x: 1240, y: 620, r: 72, label: "彩带深处" },
        { id: "wax-scene-23", type: "scene", scene: "scene-23", requiredFlag: "scene22Seen", x: 1420, y: 620, r: 72, label: "梦魇的回声" },
        { id: "wax-scene-24", type: "scene", scene: "scene-24", requiredFlag: "scene23Seen", x: 340, y: 360, r: 72, label: "第二份契约" },
        { id: "wax-scene-26", type: "scene", scene: "scene-26", requiredFlag: "scene25Seen", x: 900, y: 360, r: 72, label: "巡逻路线" },
        { id: "wax-scene-27", type: "scene", scene: "scene-27", requiredFlag: "scene26Seen", x: 1120, y: 360, r: 72, label: "宿舍门" },
        { id: "wax-scene-28", type: "scene", scene: "scene-28", requiredFlag: "scene27Seen", x: 1280, y: 360, r: 72, label: "反复穿越" },
        { id: "wax-scene-29", type: "scene", scene: "scene-29", requiredFlag: "scene28Seen", x: 1420, y: 360, r: 72, label: "食堂前方" },
        { id: "wax-scene-30", type: "scene", scene: "scene-30", requiredFlag: "scene29Seen", x: 1240, y: 740, r: 72, label: "出口前" },
        { id: "wax-exit", type: "exit", x: 1480, y: 455, r: 95, label: "出口" }
      ]
    }
  };
return rooms;
}};
}());
