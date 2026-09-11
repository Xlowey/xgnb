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
    "dialogue-frame.png":"ui/frames/dialogue-frame.png", "system-frame.png":"ui/frames/system-frame.png", "menu-panel.png":"ui/menus/menu-panel.png",
    "button-primary.png":"ui/buttons/button-primary.png", "button-normal.png":"ui/buttons/button-normal.png", "button-dark.png":"ui/buttons/button-dark.png"
  };
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
