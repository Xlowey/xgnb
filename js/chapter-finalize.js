/*
 * 剧情数据的最后一道工序（必须最后加载）。
 *
 * 加载顺序：novel-data → novel-overrides → novel-presentation → novel-prologue
 *           → chapter-story → chapter-finalize
 *
 * 这个文件存在的两个理由，都是"前面的文件互相覆盖"造成的真实 bug：
 *
 * 1. 别名副本。novel-overrides.js 原先在 chapter-story.js 之前做 cloneScene，
 *    所以玩家真正点击的地图入口（guard-intro / contract / ending-choice …）拿不到
 *    chapter-story.js 后来挂到正式场次上的 events 与 background。实测：纸人那一幕
 *    从不播放、张明诚展台的两张 CG 从不播放、出口背景图从不显示。放在最后克隆，
 *    副本才等于正式场次。
 *
 * 2. 空白页。novel-presentation.js 会删掉所有以 △ 开头的舞台说明。如果某场戏被
 *    novel-overrides.js 切分后只剩 △ 行，它就变成 0 页——玩家看到的是几个选项按钮
 *    悬在空屏上（scene-11 / scene-31 / ending-choice 都曾如此，而 ending-choice 是
 *    最终抉择的唯一入口）。在最后补齐开场页，前面的删除就不会再影响它。
 */
(function () {
  "use strict";
  var story = window.MuseumStory;
  var scenes = story.scenes;

  function cloneScene(id, sourceId, changes) {
    var source = scenes[sourceId];
    if (!source) { console.warn("chapter-finalize: 缺少来源场次 " + sourceId + "（用于 " + id + "）"); return; }
    scenes[id] = Object.assign({}, source, changes || {}, { id: id });
    scenes[id].lines = (changes && changes.lines) || source.lines.slice();
    if (source.events) scenes[id].events = source.events.slice();
  }

  // A stage direction renders through the stage as a system page, so it survives the
  // △ filter that removed it from `lines`.
  function narration(text) { return { type: "system", text: text, action: "继续" }; }

  // Only fill a scene that would otherwise reach the player as an empty box.
  function ensureOpeningPage(id, text) {
    var scene = scenes[id];
    if (!scene) return;
    var hasEvents = scene.events && scene.events.length;
    var hasLines = scene.lines && scene.lines.length;
    if (hasEvents || hasLines) return;
    scene.events = [narration(text)];
  }

  // ---------------------------------------------------------------------------
  // 1. 别名副本（放在最后，才会带上 events 与 background）
  // ---------------------------------------------------------------------------
  cloneScene("opening", "scene-01", { id: "opening" });
  cloneScene("note-intro", "scene-03", { id: "note-intro" });
  cloneScene("note-repeat", "scene-03", { id: "note-repeat", title: "员工宿舍 · 已读纸条", choices: null });
  cloneScene("wardrobe-clue", "scene-02", { id: "wardrobe-clue" });
  cloneScene("wardrobe-repeat", "scene-02", { id: "wardrobe-repeat", title: "员工宿舍 · 已查衣柜", choices: null });
  cloneScene("terminal", "scene-03-tv", { id: "terminal" });
  cloneScene("guard-intro", "scene-07", { id: "guard-intro" });
  cloneScene("guard-repeat", "scene-07", { id: "guard-repeat", title: "中央大厅 · 已读记录", choices: null });
  cloneScene("guard-after-battle", "scene-11-after", { id: "guard-after-battle" });
  cloneScene("contract", "scene-15", { id: "contract" });
  cloneScene("contract-repeat", "scene-15", { id: "contract-repeat", title: "蜡像馆 · 已读展台", choices: null });
  // ending-choice 是最终抉择的唯一入口（博物馆出口那个物件就打开它）。必须在
  // ensureOpeningPage 之前克隆，才能带上 scene-31 的三选一与开场页。
  cloneScene("ending-choice", "scene-31", { id: "ending-choice" });
  // 曾经还有 ending-escape / ending-turn-back / ending-understand 三个副本，分别是
  // ending-a/b/c 的克隆，但**没有任何代码会打开它们**（全仓 grep 0 处引用）。它们是
  // 永远播不到的死内容，还让"一共有几个结局"数不清。已删除。
  // 现在的结局入口：a/b/c 来自最终抉择，d 来自超时或战斗失败，e 来自读取"选择前检查点"。

  // ---------------------------------------------------------------------------
  // 2. 开场页：被 △ 过滤清空的场次
  //
  // 这两个 id 是同一场戏的两条入口，都要补。scene-11 不需要补页：它的 choices 在第 0 页
  // 就能点，补一句"玩家可选择"反而把剧本的写作标记念给玩家听。
  // ---------------------------------------------------------------------------
  ensureOpeningPage("scene-31", "白光在身后明灭。屏上浮出三个选项，静静等待。");
  ensureOpeningPage("ending-choice", "白光在身后明灭。屏上浮出三个选项，静静等待。");

  // The mirror hotspot must not open the blood note. novel-prologue.js aliases
  // `mirror` to `note-inspect`, which made 墙上的镜子 show 血字纸条 - a real
  // "wrong scene" bug. It gets its own small recorded frame instead.
  if (scenes["note-inspect"]) {
    scenes["mirror-inspect"] = {
      id: "mirror-inspect",
      title: "墙上的镜子",
      location: "员工宿舍",
      theme: "dorm",
      background: "宿舍背景图.png",
      lines: [],
      returnToMap: true,
      events: [{ type: "system", text: "镜面上蒙着一层水汽。你抬手擦掉一块，里面的人比你慢了半拍才抬起头。", action: "后退一步" }]
    };
    scenes["mirror"] = Object.assign({}, scenes["mirror-inspect"], { id: "mirror" });
  }

  // ---------------------------------------------------------------------------
  // 3. 重看入口（最后一步，必须盖过上面的别名克隆）
  //
  // novel-prologue.js 里的通用别名块会把 "重看" 入口指回完整场次，于是"再打开一次
  // 衣柜"会重播整个序章。这三个入口应当是已录制内容的短回看，所以放在最后改写。
  // ---------------------------------------------------------------------------
  function asInspection(id, sourceId, title) {
    var source = scenes[sourceId];
    if (!source) { console.warn("chapter-finalize: 缺少回看来源 " + sourceId); return; }
    scenes[id] = Object.assign({}, source, { id: id, title: title });
    scenes[id].lines = [];
    if (source.events) scenes[id].events = source.events.slice();
    scenes[id].choices = null;
  }
  asInspection("wardrobe-repeat", "rules-inspect", "员工宿舍 · 已查衣柜");
  asInspection("note-repeat", "note-inspect", "员工宿舍 · 已读纸条");
  // ---------------------------------------------------------------------------
  // 4. 最后一道保险：任何残留在可读文本里的写作标记都清掉。
  //    剧本里有少量作者注（例如"（配一个CG？）"），它们不是给玩家看的。
  // ---------------------------------------------------------------------------
  var RESIDUE = /（配一个CG[^）]*）|（设计分支[^）]*）|（若不[^）]*）|（摘面具[^）]*）|^A摘下$|^B没摘[^）]*）?$/;
  var cleaned = 0;
  function scrub(text) {
    var value = String(text == null ? "" : text);
    if (!RESIDUE.test(value)) return value;
    cleaned += 1;
    return value.replace(RESIDUE, "").trim();
  }
  Object.keys(scenes).forEach(function (id) {
    var scene = scenes[id];
    if (!scene) return;
    (scene.lines || []).forEach(function (line) { line.text = scrub(line.text); });
    (scene.events || []).forEach(function (event) { if (typeof event.text === "string") event.text = scrub(event.text); });
  });
  if (cleaned) console.info("chapter-finalize: 清理了 " + cleaned + " 处写作标记。");
}());
