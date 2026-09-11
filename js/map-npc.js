/*
 * 赵灵（NPC）在地图上的静态贴图。
 *
 * 美术组给的是一张四向行走图（列 = 方向，行 = 帧），但本轮只把它当作地图上的一个
 * NPC 贴图使用，不要求她会走动。下面这张表是从 PNG 的 alpha 包围盒实测出来的，不是
 * 按 4×3 均分推算的——1280×853 不能被 4 和 3 整除，直接推算会切歪：
 *
 *   网格    1280/4 = 320，只有 3 列例外（第三列宽 324）
 *   行高    853/3 = 284.33，所以第三行被上移
 *
 * 数据来源：assets/images/characters/walk/zhaoling-walk-cycle.png
 * 帧顺序   [方向][帧]，方向依次为 向下(后) / 向上(前) / 向左 / 向右
 */
(function () {
  "use strict";
  var NPC_CODE = "zhaoling-npc";
  var sheet = new Image();
  var ready = new Promise(function (resolve) { sheet.onload = function () { resolve(true); }; sheet.onerror = function () { resolve(false); }; });
  sheet.src = window.MuseumAssets ? window.MuseumAssets.url("zhaoling-walk-cycle.png", "characters") : "assets/images/characters/walk/zhaoling-walk-cycle.png";

  // 每一帧：[源 x, 源 y, 宽, 高, 中心线相对 x]
  var FRAMES = {
    down: [[88, 20, 158, 264, 79.0], [406, 16, 141, 268, 70.5], [726, 16, 161, 268, 80.5]],
    up: [[89, 284, 141, 284, 70.5], [409, 284, 142, 284, 71.0], [718, 284, 161, 284, 80.5]],
    left: [[75, 568, 150, 278, 75.0], [411, 568, 157, 278, 78.5], [715, 568, 162, 278, 81.0]],
    right: [[1025, 16, 168, 268, 84.0], [1041, 284, 161, 284, 80.5], [1042, 568, 163, 278, 81.5]]
  };

  // 赵灵在地图上的站位与朝向按剧情推进；空数组表示此房间不显示她。
  // 新剧本第二十五场：赵灵在宿舍外的走廊等主角；第五场（病房）之前她还在。
  function placeFor(roomId, state) {
    if (!state) return null;
    if (roomId === "corridor" && !state.flags.scene05Seen) return { x: 1360, y: 520, facing: "down" };
    return null;
  }

  // Drawn inside the room transform (ctx is already translated+scaled by game.js), so
  // this works in WORLD pixels exactly like window.MuseumPlayerAvatar.draw does.
  function draw(ctx, roomId, state) {
    if (!readyResolved) return false;
    var place = placeFor(roomId, state);
    if (!place) return false;
    var frame = FRAMES[place.facing] && FRAMES[place.facing][1];
    if (!frame) return false;
    // 脚底锚点与主角一致：脚站在 (x, y)，中线对准 x。
    var left = place.x - frame[4];
    var top = place.y - frame[3];
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, frame[0], frame[1], frame[2], frame[3], left, top, frame[2], frame[3]);
    ctx.restore();
    return true;
  }

  var readyResolved = false;
  ready.then(function (ok) { readyResolved = ok; if (!ok) console.warn("赵灵行走素材加载失败，地图上不显示该 NPC。"); });

  window.MuseumNpc = { code: NPC_CODE, draw: draw, placeFor: placeFor, ready: ready, frames: FRAMES };
}());
