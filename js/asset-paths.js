(function () {
  "use strict";
  // 运行素材按用途归档；文件名到相对路径集中维护，避免业务代码各写一套路径。
  var root = new URL("../assets/images/", document.currentScript.src).href;
  var dirs = { maps: "maps/", storyBackgrounds: "story-backgrounds/", cg: "cg/", items: "items/", ui: "ui/", characters: "characters/" };
  var maps = {
    "museum-overview-map.webp": true, "dorm-map.webp": true, "hall-map.webp": true,
    "office-map.webp": true, "食堂走廊地图.webp": true, "蜡像馆地图.webp": true,
    "教室展厅背景.webp": true, "走廊示意图1.webp": true
  };
  var storyBackgrounds = {
    "病房展厅（电视机打开）.webp": true, "病房展厅(电视机关闭）.webp": true,
    "食堂走廊背景.webp": true, "食堂门口背景.webp": true, "食堂正常背景.webp": true,
    "食堂背景（含彩带版）.webp": true, "蜡像馆背景（正常版）.webp": true,
    "蜡像馆背景（有人涌入版）.webp": true, "银色的恋人展厅.webp": true
  };
  function categoryFor(name, fallback) {
    if (maps[name]) return "maps";
    if (storyBackgrounds[name]) return "storyBackgrounds";
    return fallback || "root";
  }
  var paths = {
    "museum-overview-map.webp":"maps/world/museum-overview-map.webp", "dorm-map.webp":"maps/rooms/dorm-map.webp", "hall-map.webp":"maps/rooms/hall-map.webp", "office-map.webp":"maps/rooms/office-map.webp", "食堂走廊地图.webp":"maps/rooms/食堂走廊地图.webp", "蜡像馆地图.webp":"maps/rooms/蜡像馆地图.webp", "教室展厅背景.webp":"maps/rooms/教室展厅背景.webp", "走廊示意图1.webp":"maps/rooms/走廊示意图1.webp",
    "病房展厅（电视机打开）.webp":"story-backgrounds/locations/hospital/病房展厅（电视机打开）.webp", "病房展厅(电视机关闭）.webp":"story-backgrounds/locations/hospital/病房展厅(电视机关闭）.webp", "食堂走廊背景.webp":"story-backgrounds/locations/canteen/食堂走廊背景.webp", "食堂门口背景.webp":"story-backgrounds/locations/canteen/食堂门口背景.webp", "食堂正常背景.webp":"story-backgrounds/locations/canteen/食堂正常背景.webp", "食堂背景（含彩带版）.webp":"story-backgrounds/locations/canteen/食堂背景（含彩带版）.webp", "蜡像馆背景（正常版）.webp":"story-backgrounds/locations/wax/蜡像馆背景（正常版）.webp", "蜡像馆背景（有人涌入版）.webp":"story-backgrounds/locations/wax/蜡像馆背景（有人涌入版）.webp", "银色的恋人展厅.webp":"story-backgrounds/locations/silver/银色的恋人展厅.webp",
    "peach-dream.webp":"cg/peach-dream.webp", "rabbits-recording.webp":"cg/rabbits-recording.webp", "note-front.webp":"items/documents/note-front.webp", "note-back.webp":"items/documents/note-back.webp", "wardrobe-detail.webp":"items/closeups/wardrobe-detail.webp",
    "hero-portrait.webp":"characters/portraits/hero-portrait.webp", "zhaoling-portrait.webp":"characters/portraits/zhaoling-portrait.webp", "director-portrait.webp":"characters/portraits/director-portrait.webp", "hero-walk-cycle.webp":"characters/walk/hero-walk-cycle.webp",
  "paper-man-portrait.webp":"characters/portraits/paper-man-portrait.webp", "masked-girl-portrait.webp":"characters/portraits/masked-girl-portrait.webp", "masked-guard-portrait.webp":"characters/portraits/masked-guard-portrait.webp", "nightmare-portrait.webp":"characters/portraits/nightmare-portrait.webp", "zhaoling-walk-cycle.webp":"characters/walk/zhaoling-walk-cycle.webp",
    "dialogue-frame.webp":"ui/frames/dialogue-frame.webp", "system-frame.webp":"ui/frames/system-frame.webp", "menu-panel.webp":"ui/menus/menu-panel.webp",
    "button-primary.webp":"ui/buttons/button-primary.webp", "button-normal.webp":"ui/buttons/button-normal.webp", "button-dark.webp":"ui/buttons/button-dark.webp"
  };

  Object.assign(paths, {
  "食堂地图.webp": "maps/rooms/食堂地图.webp",
  "宿舍背景图.webp": "story-backgrounds/locations/dorm/宿舍背景图.webp",
  "宿舍门正常版.webp": "story-backgrounds/locations/dorm/宿舍门正常版.webp",
  "宿舍门带血迹.webp": "story-backgrounds/locations/dorm/宿舍门带血迹.webp",
  "大厅背景.webp": "story-backgrounds/locations/hall/大厅背景.webp",
  "馆长办公室背景.webp": "story-backgrounds/locations/office/馆长办公室背景.webp",
  "普通走廊.webp": "story-backgrounds/locations/corridor/普通走廊.webp",
  "走廊带血版.webp": "story-backgrounds/locations/corridor/走廊带血版.webp",
  "阴暗的角落.webp": "story-backgrounds/locations/corridor/阴暗的角落.webp",
  "病房场景黑夜版.webp": "story-backgrounds/locations/hospital/病房场景黑夜版.webp",
  "病房场景黑夜版（电视机关闭）.webp": "story-backgrounds/locations/hospital/病房场景黑夜版（电视机关闭）.webp",
  "出口图片.webp": "story-backgrounds/locations/exit/出口图片.webp",
  "张明诚展台.webp": "items/closeups/张明诚展台.webp",
  "赵灵展厅.webp": "items/closeups/赵灵展厅.webp",
  "赵灵展厅（含人物）.webp": "items/closeups/赵灵展厅（含人物）.webp",
  "床头柜.webp": "items/closeups/床头柜.webp",
  "床头柜（透明底）.webp": "items/closeups/床头柜（透明底）.webp",
  "银色的发卡.webp": "items/closeups/银色的发卡.webp",
  "入职申请表.webp": "items/documents/入职申请表.webp",
  "张明诚契约.webp": "items/documents/张明诚契约.webp",
  "赵灵契约.webp": "items/documents/赵灵契约.webp",
  "赵灵红色制服里的纸片.webp": "items/documents/赵灵红色制服里的纸片.webp",
  "赵灵红色制服里的纸片2.webp": "items/documents/赵灵红色制服里的纸片2.webp",
  "病房电视机.webp": "cg/病房电视机.webp",
  "病房场景含人物.webp": "cg/病房场景含人物.webp"
});
  maps["食堂地图.webp"]=true;
  storyBackgrounds["宿舍背景图.webp"]=true;
  storyBackgrounds["宿舍门正常版.webp"]=true;
  storyBackgrounds["宿舍门带血迹.webp"]=true;
  storyBackgrounds["大厅背景.webp"]=true;
  storyBackgrounds["馆长办公室背景.webp"]=true;
  storyBackgrounds["普通走廊.webp"]=true;
  storyBackgrounds["走廊带血版.webp"]=true;
  storyBackgrounds["阴暗的角落.webp"]=true;
  storyBackgrounds["病房场景黑夜版.webp"]=true;
  storyBackgrounds["病房场景黑夜版（电视机关闭）.webp"]=true;
  storyBackgrounds["出口图片.webp"]=true;
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
