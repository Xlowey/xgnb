(function () {
  "use strict";
  // 运行素材按用途归档；文件名到相对路径集中维护，避免业务代码各写一套路径。
  var root = new URL("../assets/images/", document.currentScript.src).href;
  var dirs = { maps: "maps/", storyBackgrounds: "story-backgrounds/", cg: "cg/", items: "items/", ui: "ui/", characters: "characters/" };
  var maps = {
    "museum-overview-map.png": true, "dorm-map.png": true, "hall-map.png": true,
    "office-map.png": true, "食堂走廊地图.png": true, "蜡像馆地图.png": true,
    "教室展厅背景.jpeg": true, "走廊示意图1.png": true
  };
  var storyBackgrounds = {
    "病房展厅（电视机打开）.jpeg": true, "病房展厅(电视机关闭）.jpeg": true,
    "食堂走廊背景.png": true, "食堂门口背景.png": true, "食堂正常背景.jpeg": true,
    "食堂背景（含彩带版）.jpeg": true, "蜡像馆背景（正常版）.jpeg": true,
    "蜡像馆背景（有人涌入版）.jpeg": true, "银色的恋人展厅.jpeg": true
  };
  function categoryFor(name, fallback) {
    if (maps[name]) return "maps";
    if (storyBackgrounds[name]) return "storyBackgrounds";
    return fallback || "root";
  }
  var paths = {
    "museum-overview-map.png":"maps/world/museum-overview-map.png", "dorm-map.png":"maps/rooms/dorm-map.png", "hall-map.png":"maps/rooms/hall-map.png", "office-map.png":"maps/rooms/office-map.png", "食堂走廊地图.png":"maps/rooms/食堂走廊地图.png", "蜡像馆地图.png":"maps/rooms/蜡像馆地图.png", "教室展厅背景.jpeg":"maps/rooms/教室展厅背景.jpeg", "走廊示意图1.png":"maps/rooms/走廊示意图1.png",
    "病房展厅（电视机打开）.jpeg":"story-backgrounds/locations/hospital/病房展厅（电视机打开）.jpeg", "病房展厅(电视机关闭）.jpeg":"story-backgrounds/locations/hospital/病房展厅(电视机关闭）.jpeg", "食堂走廊背景.png":"story-backgrounds/locations/canteen/食堂走廊背景.png", "食堂门口背景.png":"story-backgrounds/locations/canteen/食堂门口背景.png", "食堂正常背景.jpeg":"story-backgrounds/locations/canteen/食堂正常背景.jpeg", "食堂背景（含彩带版）.jpeg":"story-backgrounds/locations/canteen/食堂背景（含彩带版）.jpeg", "蜡像馆背景（正常版）.jpeg":"story-backgrounds/locations/wax/蜡像馆背景（正常版）.jpeg", "蜡像馆背景（有人涌入版）.jpeg":"story-backgrounds/locations/wax/蜡像馆背景（有人涌入版）.jpeg", "银色的恋人展厅.jpeg":"story-backgrounds/locations/silver/银色的恋人展厅.jpeg",
    "peach-dream.png":"cg/peach-dream.png", "rabbits-recording.png":"cg/rabbits-recording.png", "note-front.png":"items/documents/note-front.png", "note-back.png":"items/documents/note-back.png", "wardrobe-detail.png":"items/closeups/wardrobe-detail.png",
    "hero-portrait.png":"characters/portraits/hero-portrait.png", "zhaoling-portrait.png":"characters/portraits/zhaoling-portrait.png", "director-portrait.png":"characters/portraits/director-portrait.png", "hero-walk-cycle.png":"characters/walk/hero-walk-cycle.png",
  "paper-man-portrait.png":"characters/portraits/paper-man-portrait.png", "masked-girl-portrait.png":"characters/portraits/masked-girl-portrait.png", "masked-guard-portrait.png":"characters/portraits/masked-guard-portrait.png", "nightmare-portrait.png":"characters/portraits/nightmare-portrait.png", "zhaoling-walk-cycle.png":"characters/walk/zhaoling-walk-cycle.png",
    "dialogue-frame.png":"ui/frames/dialogue-frame.png", "system-frame.png":"ui/frames/system-frame.png", "menu-panel.png":"ui/menus/menu-panel.png",
    "button-primary.png":"ui/buttons/button-primary.png", "button-normal.png":"ui/buttons/button-normal.png", "button-dark.png":"ui/buttons/button-dark.png"
  };

  Object.assign(paths, {
  "食堂地图.png": "maps/rooms/食堂地图.png",
  "宿舍背景图.png": "story-backgrounds/locations/dorm/宿舍背景图.png",
  "宿舍门正常版.png": "story-backgrounds/locations/dorm/宿舍门正常版.png",
  "宿舍门带血迹.png": "story-backgrounds/locations/dorm/宿舍门带血迹.png",
  "大厅背景.png": "story-backgrounds/locations/hall/大厅背景.png",
  "馆长办公室背景.png": "story-backgrounds/locations/office/馆长办公室背景.png",
  "普通走廊.png": "story-backgrounds/locations/corridor/普通走廊.png",
  "走廊带血版.png": "story-backgrounds/locations/corridor/走廊带血版.png",
  "阴暗的角落.png": "story-backgrounds/locations/corridor/阴暗的角落.png",
  "病房场景黑夜版.png": "story-backgrounds/locations/hospital/病房场景黑夜版.png",
  "病房场景黑夜版（电视机关闭）.png": "story-backgrounds/locations/hospital/病房场景黑夜版（电视机关闭）.png",
  "出口图片.png": "story-backgrounds/locations/exit/出口图片.png",
  "张明诚展台.png": "items/closeups/张明诚展台.png",
  "赵灵展厅.png": "items/closeups/赵灵展厅.png",
  "赵灵展厅（含人物）.png": "items/closeups/赵灵展厅（含人物）.png",
  "床头柜.png": "items/closeups/床头柜.png",
  "床头柜（透明底）.png": "items/closeups/床头柜（透明底）.png",
  "银色的发卡.png": "items/closeups/银色的发卡.png",
  "入职申请表.png": "items/documents/入职申请表.png",
  "张明诚契约.png": "items/documents/张明诚契约.png",
  "赵灵契约.png": "items/documents/赵灵契约.png",
  "赵灵红色制服里的纸片.png": "items/documents/赵灵红色制服里的纸片.png",
  "赵灵红色制服里的纸片2.png": "items/documents/赵灵红色制服里的纸片2.png",
  "病房电视机.png": "cg/病房电视机.png",
  "病房场景含人物.png": "cg/病房场景含人物.png"
});
  maps["食堂地图.png"]=true;
  storyBackgrounds["宿舍背景图.png"]=true;
  storyBackgrounds["宿舍门正常版.png"]=true;
  storyBackgrounds["宿舍门带血迹.png"]=true;
  storyBackgrounds["大厅背景.png"]=true;
  storyBackgrounds["馆长办公室背景.png"]=true;
  storyBackgrounds["普通走廊.png"]=true;
  storyBackgrounds["走廊带血版.png"]=true;
  storyBackgrounds["阴暗的角落.png"]=true;
  storyBackgrounds["病房场景黑夜版.png"]=true;
  storyBackgrounds["病房场景黑夜版（电视机关闭）.png"]=true;
  storyBackgrounds["出口图片.png"]=true;
  function url(name, category) {
    var path = paths[name];
    if (!path) {
      var group = category && dirs[category] !== undefined ? category : categoryFor(name);
      path = (dirs[group] || "") + name;
    }
    return new URL(path, root).href;
  }
  window.MuseumAssets = { root: root, dirs: dirs, maps: maps, storyBackgrounds: storyBackgrounds, paths: paths, categoryFor: categoryFor, url: url };
}());
