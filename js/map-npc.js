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
 * 数据来源：assets/images/characters/walk/zhaoling-walk-cycle.webp
 * 帧顺序   [方向][帧]，方向依次为 向下(后) / 向上(前) / 向左 / 向右
 */
(function () {
  "use strict";
  var NPC_CODE = "zhaoling-npc";
  var sheet = new Image();
  var ready = new Promise(function (resolve) { sheet.onload = function () { resolve(true); }; sheet.onerror = function () { resolve(false); }; });
  sheet.src = window.MuseumAssets ? window.MuseumAssets.url("zhaoling-walk-cycle.webp", "characters") : "assets/images/characters/walk/zhaoling-walk-cycle.webp";

  // 每一帧：[源 x, 源 y, 宽, 高, 中心线相对 x]
  var FRAMES = {
    // 每帧：[源 x, 源 y, 宽, 高, 中心线相对 x]
    // 说明：图集每列是一个方向（1=正面、2=背面、3=侧身），每行是一个行走帧。
    // 正面帧在**第 1 列**，所以 "front" 这一组是给地图 NPC 用的（见 placeFor）。
    front: [[88, 20, 158, 264, 79.0], [88, 284, 158, 264, 79.0], [75, 568, 150, 278, 75.0]],
    down: [[88, 20, 158, 264, 79.0], [406, 16, 141, 268, 70.5], [726, 16, 161, 268, 80.5]],
    up: [[89, 284, 141, 284, 70.5], [409, 284, 142, 284, 71.0], [718, 284, 161, 284, 80.5]],
    left: [[75, 568, 150, 278, 75.0], [411, 568, 157, 278, 78.5], [715, 568, 162, 278, 81.0]],
    right: [[1025, 16, 168, 268, 84.0], [1041, 284, 161, 284, 80.5], [1042, 568, 163, 278, 81.5]]
  };

  // 赵灵在地图上的出现条件与站位。返回 null 表示此房间不显示她。
  //
  // 走廊那段剧情（scene-04 · 午夜巡逻）本来在走出宿舍门时自动播放；现在改成走到赵灵
  // 身边按 E 才触发——剧本里那段就是她自我介绍（"赵灵。""师……师父……"），所以应当是
  // 一次对话。map-art.js 里的 npc 交互对象用的是同一份条件，两边不会走偏。
  // 赵灵在地图上的出场表。每条各自带「必须已设」的 requires 与「必须未设」的 flag——
  // 走廊里她会出场两次：一次是第四场（午夜巡逻的自我介绍），一次是逼问馆长之后（第十二场）。
  // 只写 flag 的话，第二段会在第一段结束后立刻冒出来，把 corridor-npc 那条断言打破。
  var SEQUENCES = [
    {
      id: "corridor-zhaoling", room: "corridor",
      // 站位要落在玩家真正能站的地方（walkable x 960..1774, y 337..565）。原来放 x=1085
      // 时她的可交互半径越过了可行走区左边界，玩家站在旁边的宿舍门边时提示会被门抢走。
      x: 1060, y: 445, height: 145, facing: "front",
      scene: "scene-04", flag: "scene04Seen", label: "赵灵"
    },
    {
      // 逼问馆长之后，她换到走廊右侧再等主角一次（第十二场：师父你没事吧）。
      id: "corridor-zhaoling-12", room: "corridor",
      x: 1560, y: 445, height: 145, facing: "front",
      scene: "scene-12", flag: "scene12Seen", requires: "scene11Seen", label: "赵灵"
    }
  ];
  function sequencesFor(roomId, objectId) {
    return SEQUENCES.filter(function (s) {
      return s.room === roomId && (!objectId || s.id === objectId);
    });
  }
  function isPlaced(s, state) {
    return (!s.requires || !!state.flags[s.requires]) && !state.flags[s.flag];
  }
  function placeFor(roomId, state, objectId) {
    if (!state) return null;
    var list = sequencesFor(roomId, objectId);
    for (var i = 0; i < list.length; i += 1) {
      if (isPlaced(list[i], state)) {
        var s = list[i];
        return { x: s.x, y: s.y, facing: s.facing, height: s.height };
      }
    }
    return null;
  }
  function placesFor(roomId, state) {
    if (!state) return [];
    return sequencesFor(roomId).filter(function (s) { return isPlaced(s, state); })
      .map(function (s) { return { x: s.x, y: s.y, facing: s.facing, height: s.height }; });
  }
  function visibleFor(roomId, state, objectId) {
    return !!placeFor(roomId, state, objectId);
  }

  // 地图 NPC 的显示高度（世界像素）。主角在宿舍按 210 校准，走廊地板更窄，NPC 略小一点
  // 才不会顶到上方的墙。
  var DEFAULT_HEIGHT = 200;

  // Drawn inside the room transform (ctx is already translated+scaled by game.js), so
  // this works in WORLD pixels exactly like window.MuseumPlayerAvatar.draw does.
  function draw(ctx, roomId, state) {
    if (!readyResolved) return false;
    var places = placesFor(roomId, state);
    if (!places.length) return false;
    places.forEach(function (place) { drawOne(ctx, place); });
    return true;
  }

  function drawOne(ctx, place) {
    var frame = FRAMES[place.facing] && FRAMES[place.facing][1];
    if (!frame) return false;
    // 按目标高度等比缩放，而不是直接用素材原始像素（原始帧高达 284px，在走廊里过大）。
    var targetH = place.height || DEFAULT_HEIGHT;
    var k = targetH / frame[3];
    var drawW = frame[2] * k;
    var drawH = frame[3] * k;
    // 脚底锚点：脚站在 (x, y)，中线对准 x。
    var left = place.x - frame[4] * k;
    var top = place.y - drawH;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, frame[0], frame[1], frame[2], frame[3], left, top, drawW, drawH);
    ctx.restore();
  }

  var readyResolved = false;
  ready.then(function (ok) { readyResolved = ok; if (!ok) console.warn("赵灵行走素材加载失败，地图上不显示该 NPC。"); });

  window.MuseumNpc = { code: NPC_CODE, draw: draw, placeFor: placeFor, placesFor: placesFor, visibleFor: visibleFor, sequencesFor: sequencesFor, ready: ready, frames: FRAMES };
}());
