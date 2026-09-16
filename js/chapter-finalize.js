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

  // ---------------------------------------------------------------------------
  // 2a. 将最新剧本里的互斥支线落成真正的场景节点。
  // ---------------------------------------------------------------------------
  function visibleLines(lines) {
    return (lines || []).filter(function (line) {
      var text = String(line && line.text || "");
      // △ 是给制作组看的舞台说明；它们不进入对白播放器。
      if (/^\s*△/.test(text)) return false;
      // 这些是剧本里的分支标记，选择按钮已经承担了它们的作用。
      if (/^\s*(?:A|B|C|D)[．.]/.test(text)) return false;
      if (/玩家可选支线|玩家可以选择|分支选择/.test(text)) return false;
      return text.trim().length > 0;
    });
  }

  function lineEvents(lines, background) {
    return visibleLines(lines).map(function (line) {
      return { type: "dialogue", speaker: line.speaker, text: line.text, background: background };
    });
  }

  // 第十六场：A/B/C 三选一。C 是“系统回顾”路线，直接进入 B 结局；
  // A/B 才会进入第十七场，并且两条支线都从馆长办公室门口开始。
  var scene16 = scenes["scene-16"];
  if (scene16) {
    var scene16All = scene16.lines.slice();
    var scene16ChoiceAt = scene16All.findIndex(function (line) { return /我现在应该/.test(line.text); });
    if (scene16ChoiceAt < 0) scene16ChoiceAt = scene16All.length;
    var scene16Intro = scene16All.slice(0, scene16ChoiceAt);
    scene16.lines = visibleLines(scene16Intro);
    scene16.events = [
      { type: "cg", background: "赵灵展厅.webp", action: "继续" },
      { type: "cg", background: "赵灵展厅（含人物）.webp", action: "继续" }
    ].concat(lineEvents(scene16Intro, scene16.background));
    scene16.choices = [
      { id: "scene16-office", label: "A　进入馆长办公室，确认员工人数", nextScene: "scene-17" },
      { id: "scene16-diary", label: "B　调查馆长日记，了解馆长为何放弃过去", nextScene: "scene-17-diary" },
      { id: "scene16-system", label: "C　使用系统帮助，回顾之前的会议人数", nextScene: "ending-b", effect: "scene16-system" }
    ];
  }

  // 第十七场原稿把 A、B、C 三段连续写在同一个 lines 数组里。拆开后，
  // 每次只播玩家选中的一条路线，所有入口的第一句都是“办公室门口”。
  var scene17 = scenes["scene-17"];
  if (scene17) {
    var scene17All = scene17.lines.slice();
    var scene17BAt = scene17All.findIndex(function (line) { return /^\s*△?\s*B[（(．.]/.test(line.text); });
    var scene17CAt = scene17All.findIndex(function (line) { return /^\s*△?\s*C[（(．.]/.test(line.text); });
    // novel-presentation 已经移除了 △ 标记，故用正文首句作稳定回退。
    if (scene17BAt < 0) scene17BAt = scene17All.findIndex(function (line) { return line.text === "馆长的日记本"; });
    if (scene17CAt < 0) scene17CAt = scene17All.findIndex(function (line) { return /^经多次确认，蜡像馆展台数/.test(line.text); });
    if (scene17BAt < 0) scene17BAt = scene17All.length;
    if (scene17CAt < 0) scene17CAt = scene17All.length;
    var officeDoor = [{ speaker: "旁白", text: "你来到馆长办公室门口。" }];
    var aLines = officeDoor.concat(visibleLines(scene17All.slice(0, scene17BAt)));
    var bLines = officeDoor.concat(visibleLines(scene17All.slice(scene17BAt + 1, scene17CAt)));
    var branchScene = function (id, title, lines) {
      return Object.assign({}, scene17, {
        id: id,
        title: title,
        location: "馆长办公室门口 · 夜",
        background: "馆长办公室背景.webp",
        lines: lines,
        events: null,
        choices: null,
        returnToMap: true,
        flag: "scene17Seen"
      });
    };
    scenes["scene-17"] = branchScene("scene-17", "第十七场　馆长办公室门口", aLines);
    scenes["scene-17-diary"] = branchScene("scene-17-diary", "第十七场　馆长办公室 · 日记", bLines);
    // 日记路线使用实际的文档素材。正文仍保留在剧情文本中，翻开后可在背包里重看。
    var diaryScene = scenes["scene-17-diary"];
    diaryScene.events = [];
    diaryScene.lines.forEach(function (line) {
      diaryScene.events.push({ type: "dialogue", speaker: line.speaker, text: line.text, background: diaryScene.background });
      if (String(line.text || "") === "馆长的日记本") {
        diaryScene.events.push({ type: "document", item: "director-diary", side: "front", action: "翻看日记" });
      }
    });
  }

  // 面具分支的后续对白必须真正分开。不摘面具时，删除“以前见过 / 渣男”回忆，
  // 同时让第二十四场的办公室事件使用同一条规则。
  if (scenes["scene-18-no-mask"]) {
    scenes["scene-18-no-mask"].lines = scenes["scene-18-no-mask"].lines.filter(function (line) {
      return !/渣男|以前是不是见过|看到你的样子之后/.test(String(line.text || ""));
    });
    scenes["scene-18-no-mask"].events = null;
    scenes["scene-18-no-mask"].background = "银色的恋人展厅.webp";
  }
  if (scenes["scene-09-d"]) scenes["scene-09-d"].background = "馆长办公室背景.webp";

  // 文字修订：统一最新场次名称、时间、身份表述和重复问句。
  function rewriteSceneText(scene, rewrite) {
    if (!scene) return;
    (scene.lines || []).forEach(function (line) { line.text = rewrite(String(line.text || ""), line); });
    (scene.events || []).forEach(function (event) {
      if (typeof event.text === "string") event.text = rewrite(event.text, event);
    });
  }
  Object.keys(scenes).forEach(function (id) {
    var scene = scenes[id];
    rewriteSceneText(scene, function (text) {
      return text.replace(/去图书馆/g, "去蜡像馆");
    });
  });
  ["scene-25"].forEach(function (id) {
    if (scenes[id]) {
      scenes[id].title = scenes[id].title.replace(/　夜$/, "　下午");
      scenes[id].location = scenes[id].location.replace(/　夜$/, "　下午");
    }
  });
  if (scenes["scene-26"]) {
    var duplicateSeen = false;
    scenes["scene-26"].lines = scenes["scene-26"].lines.filter(function (line) {
      if (line.text === "对了，这个是你的吧？") {
        if (duplicateSeen) return true;
        duplicateSeen = true;
        return false;
      }
      return true;
    });
    scenes["scene-26"].events = null;
  }
  Object.keys(scenes).forEach(function (id) {
    rewriteSceneText(scenes[id], function (text) {
      return text
        .replace(/^胜利后[：:]\s*/, "")
        .replace(/我已经死了/g, "张明诚已经死了");
    });
    if (scenes[id].lines) {
      scenes[id].lines = scenes[id].lines.filter(function (line) {
        return !/^胜利后[：:]?\s*$/.test(String(line.text || ""));
      });
    }
  });

  // 第二十四场沿用面具分支状态；不摘面具路线不应在办公室再次提起“渣男”。
  if (scenes["scene-24"]) {
    scenes["scene-24"].events = (scenes["scene-24"].events || []).filter(function (event) {
      return !/渣男|以前是不是见过|看到你的样子之后/.test(String(event.text || ""));
    });
  }

  // 最新剧本将“未了解信息直接去 B”的限制放到第十六场 C；最终选择不再读取旧 submitted 旗标。
  if (scenes["scene-31"] && scenes["scene-31"].choices) {
    ["scene-31", "ending-choice"].forEach(function (id) {
      if (!scenes[id] || !scenes[id].choices) return;
      scenes[id].choices = scenes[id].choices.map(function (choice) {
        var copy = Object.assign({}, choice);
        delete copy.availableIf;
        return copy;
      });
    });
  }
  if (scenes["scene-30"]) {
    scenes["scene-30"].lines = scenes["scene-30"].lines.filter(function (line) {
      return !/如果之前没有从馆长了解信息/.test(String(line.text || ""));
    });
    scenes["scene-30"].events = null;
  }

  // C 结局的新对白：回到原世界，契约揭示不再重复解释梦魇为何阻止出口。
  if (scenes["ending-c"]) {
    rewriteSceneText(scenes["ending-c"], function (text) {
      return text
        .replace("你打开病房的门，就可以进入下一个试炼了。", "你打开病房的门，就可以回到原来的世界。")
        .replace("你想知道为什么我笃定那个出口是错的吗？", "还有一件事，你应该知道。")
        .replace("梦魇不希望我进入到那个所谓的出口，原因就是因为这个！这个不是你的，是张明诚的。他也和梦魇签订了一份契约，梦魇之所以不想让我进入那里，应该就是不想让我见到这个东西。”", "这不是你的，是张明诚的——他也和梦魇签了一份契约。")
        .replace("为什么？", "什么事？");
    });
  }

  // △ 说明永远不进入对白页，避免“地图/演出说明”再次混到播放器里。
  Object.keys(scenes).forEach(function (id) {
    var scene = scenes[id];
    if (!scene || !scene.events) return;
    scene.events = scene.events.filter(function (event) {
      return !(typeof event.text === "string" && /^\s*△/.test(event.text));
    });
  });

  // The mirror hotspot must not open the blood note. novel-prologue.js aliases
  // `mirror` to `note-inspect`, which made 墙上的镜子 show 血字纸条 - a real
  // "wrong scene" bug. It gets its own small recorded frame instead.
  if (scenes["note-inspect"]) {
    scenes["mirror-inspect"] = {
      id: "mirror-inspect",
      title: "墙上的镜子",
      location: "员工宿舍",
      theme: "dorm",
      background: "宿舍背景图.webp",
      lines: [],
      returnToMap: true,
      events: [{ type: "system", text: "镜面上蒙着一层水汽。你抬手擦掉一块，里面的人比你慢了半拍才抬起头。", action: "后退一步" }]
    };
    scenes["mirror"] = Object.assign({}, scenes["mirror-inspect"], { id: "mirror" });
  }

  // ---------------------------------------------------------------------------
  // 2b. 最终 boss 战（在第三十场之前）
  //
  // 剧本第二十九场「出口之前」里梦魇自己下了战书：
  //   "那个出口就在我身后的食堂里，但时间已经来不及了！想要离开，就看你能不能在那个
  //    出口关闭之前打败我了！"
  // 但原文只有台词、没有战斗入口，玩家读完就直接进第三十场——这场戏等于被跳过了。
  // 这里补上真正的战斗，接像素地牢（demos/pixel-dungeon-html）：
  //   打赢 -> scene-30（正在消失的出口）-> 最终抉择
  //   打输 -> game.js 走 ending-d（死亡）
  // 放在 chapter-finalize 里是因为它必须在所有故事文件之后生效，而且要让
  // tests/story-reachability.cjs 能从选项图里走到它。
  // ---------------------------------------------------------------------------
  scenes["scene-29-boss"] = {
    id: "scene-29-boss",
    title: "梦魇 · 出口之前",
    location: "食堂内部 · 最后一夜",
    theme: "nightmare",
    background: "食堂背景（含彩带版）.webp",
    lines: [
      { speaker: "MOSS（系统 · 画外音）", text: "目标已进入交战范围。这是本副本的最后一个节点。" },
      { speaker: "梦魇", text: "来吧，张天师。让我看看你这一趟，到底学会了什么。" }
    ],
    returnToMap: false,
    choices: [
      { id: "boss-fight", label: "迎战梦魇", action: "battle", demo: "pixel-dungeon", battleContext: "final-boss", afterBattle: "scene-30" }
    ]
  };
  if (scenes["scene-29"]) scenes["scene-29"].nextScene = "scene-29-boss";

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
