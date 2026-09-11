(function () {
  "use strict";

  var story = window.MuseumStory;
  var scenes = story.scenes;

  function cloneScene(id, sourceId, changes) {
    var source = scenes[sourceId];
    if (!source) return;
    scenes[id] = Object.assign({}, source, changes || {}, { id: id });
    scenes[id].lines = (changes && changes.lines) || source.lines.slice();
  }

  function findLineIndex(sceneId, predicate, fallback) {
    var lines = scenes[sceneId] ? scenes[sceneId].lines : [];
    var index = lines.findIndex(predicate);
    return index === -1 ? (fallback === undefined ? lines.length : fallback) : index;
  }

  // ---------------------------------------------------------------------------
  // Stage directions.
  //
  // novel-presentation.js deletes every line starting with △, because the prologue
  // turns those into real cg/item/television events. Later scenes have no such
  // conversion, and a story file cannot repair that itself: at this point the △
  // lines still exist, so "is this scene empty?" is not yet answerable here. The
  // repair lives in js/chapter-finalize.js, which runs after every mutator.
  // ---------------------------------------------------------------------------

  // The television is an optional investigation after the blood note, not part of the note itself.
  var scene03 = scenes["scene-03"];
  var televisionAt = findLineIndex("scene-03", function (line) { return line.text.indexOf("打开电视") !== -1; });
  if (televisionAt < scene03.lines.length) {
    scene03.lines = scene03.lines.slice(0, televisionAt);
    cloneScene("scene-03-tv", "scene-03", {
      title: "员工宿舍 · 旧电视",
      subtitle: "第一幕 · 录像",
      location: "员工宿舍 · 旧电视",
      lines: scenes["scene-03-tv"] ? scenes["scene-03-tv"].lines : [],
      flag: "scene03TvSeen"
    });
  }

  scenes["scene-03"].choices = [
    { id: "remember", label: "记住纸条上的规则", effect: "read-note" },
    { id: "leave-note", label: "先把纸条收好", nextScene: null }
  ];

  scenes["scene-02"].choices = [
    { id: "take-key", label: "取下黑色制服里的钥匙", effect: "take-key" },
    { id: "leave-wardrobe", label: "暂时不动，继续调查宿舍", nextScene: null }
  ];

  scenes["scene-07"].choices = [
    { id: "follow-zhaoling", label: "跟赵灵去食堂门前", nextScene: "scene-08" }
  ];

  scenes["scene-15"].choices = [
    { id: "inspect-wax", label: "继续清点蜡像，调查赵灵的展台", nextScene: "scene-16", effect: "find-contract-clue" }
  ];

  // The office scene is split at the three choices written in the script.
  var office = scenes["scene-09"];
  var officeAllLines = office.lines.slice();
  var officeChoiceAt = findLineIndex("scene-09", function (line) { return line.text.indexOf("① 什么梦") === 0; });
  var officeAAt = findLineIndex("scene-09", function (line) { return line.text.indexOf("你……吃那些桃子了吗") === 0; });
  var officeBAt = findLineIndex("scene-09", function (line) { return line.text.indexOf("吃了……") === 0; });
  var officeCAt = findLineIndex("scene-09", function (line) { return line.text.indexOf("馆长这么紧张") === 0; });
  var officeEnd = officeAllLines.length;
  office.lines = officeAllLines.slice(0, officeChoiceAt);
  office.choices = [
    { id: "office-hide", label: "隐瞒：什么梦？我没做梦啊。", nextScene: "scene-09-a" },
    { id: "office-tell", label: "坦白桃树的梦", nextScene: "scene-09-b" },
    { id: "office-ask", label: "反问馆长是否也梦见过桃树", nextScene: "scene-09-c" },
    // 新剧本第八场：提交后 flag.submitted = true，C 完美结局永久关闭，最终抉择只剩 A / B。
    { id: "office-submit", label: "提交调查记录（站到系统这边）", effect: "submit-record" }
  ];
  scenes["scene-09-a"] = Object.assign({}, office, { id: "scene-09-a", title: "馆长办公室 · 隐瞒", lines: [officeAllLines[officeChoiceAt]].concat(officeAllLines.slice(officeAAt, officeBAt)), choices: null, flag: "officeHideSeen" });
  scenes["scene-09-b"] = Object.assign({}, office, { id: "scene-09-b", title: "馆长办公室 · 坦白", lines: [officeAllLines[officeChoiceAt + 1]].concat(officeAllLines.slice(officeBAt, officeCAt)), choices: null, flag: "officeTellSeen" });
  scenes["scene-09-c"] = Object.assign({}, office, { id: "scene-09-c", title: "馆长办公室 · 追问", lines: officeAllLines.slice(officeCAt, officeEnd), choices: null, flag: "officeAskSeen" });

  // The first red-uniform confrontation pauses before the two fights.
  var dormIntrusion = scenes["scene-11"];
  var dormAllLines = dormIntrusion.lines.slice();
  var fightHintAt = findLineIndex("scene-11", function (line) { return line.text.indexOf("玩家可选择") !== -1; });
  dormIntrusion.lines = dormAllLines.slice(0, fightHintAt);
  dormIntrusion.choices = [
    { id: "dorm-yield", label: "妥协，先观察他们的行动", nextScene: "scene-11-after" },
    { id: "dorm-fight", label: "战斗，夺回进入宿舍的权利", action: "battle", afterBattle: "scene-11-after" }
  ];
  cloneScene("scene-11-after", "scene-11", {
    title: "员工宿舍 · 交涉之后",
    subtitle: "第三幕 · 禁忌与梦境",
    location: "员工宿舍",
    lines: dormAllLines.slice(fightHintAt),
    flag: "scene11Seen",
    choices: null
  });

  // The mask decision in the Silver Lovers scene is represented as a real choice.
  var silver = scenes["scene-18"];
  var maskChoiceAt = findLineIndex("scene-18", function (line) { return line.text.indexOf("分支选择") !== -1; });
  var silverA = silver.lines.slice(maskChoiceAt + 1, maskChoiceAt + 3).concat(silver.lines.slice(maskChoiceAt + 4));
  var silverB = silver.lines.slice(maskChoiceAt + 3, maskChoiceAt + 4).concat(silver.lines.slice(maskChoiceAt + 4));
  silver.lines = silver.lines.slice(0, maskChoiceAt);
  silver.choices = [
    { id: "remove-mask", label: "摘下自己的面具", nextScene: "scene-18-mask" },
    { id: "keep-mask", label: "不摘面具，继续观察", nextScene: "scene-18-no-mask" }
  ];
  cloneScene("scene-18-mask", "scene-18", { title: "银色的恋人 · 面具之后", lines: silverA.concat(scenes["scene-19"].lines, scenes["scene-20"].lines), flag: "scene20Seen", choices: null });
  cloneScene("scene-18-no-mask", "scene-18", { title: "银色的恋人 · 面具之后", lines: silverB.concat(scenes["scene-19"].lines, scenes["scene-20"].lines), flag: "scene20Seen", choices: null });

  // Scene 26 keeps both written variants available, while the engine records the choice.
  var patrol = scenes["scene-26"];
  var revealAt = findLineIndex("scene-26", function (line) { return line.text.indexOf("主角缓缓摘下面具") !== -1; });
  patrol.choices = [
    { id: "reveal-name", label: "摘下面具，告诉赵灵自己的名字", nextScene: "scene-26-reveal" },
    { id: "keep-name-secret", label: "不摘面具，继续观察", nextScene: "scene-26-hide" }
  ];
  // Keep the direct script text after the decision in both routes; the difference is stored as a flag.
  cloneScene("scene-26-reveal", "scene-26", { title: "巡逻路线 · 真名", lines: patrol.lines.slice(0, revealAt + 3), flag: "scene26Seen", choices: null });
  cloneScene("scene-26-hide", "scene-26", { title: "巡逻路线 · 面具", lines: patrol.lines.slice(0, revealAt), flag: "scene26Seen", choices: null });
  patrol.lines = patrol.lines.slice(0, revealAt);

  // Scene 31 must stop before the ending text and expose the final choice.
  var finale = scenes["scene-31"];
  var endingTextAt = findLineIndex("scene-31", function (line) { return line.text.indexOf("结局 A") === 0; });
  finale.lines = finale.lines.slice(0, endingTextAt);
  finale.returnToMap = false;
  // 新剧本第三十场：白光在身后明灭，屏上浮出选项；① 进入出口 ② 回头救赵灵 ③ 超时未选择。
  // 超时由 novel.js 的 15 秒计时器结算为 ending-d，所以不再需要一个「等待到超时」按钮。
  // ending-c（完美结局）只在没有提交调查记录时出现。
  finale.choices = [
    { id: "ending-a", label: "回头救赵灵（拒绝系统建议）", nextScene: "ending-a" },
    { id: "ending-b", label: "进入出口（执行系统建议）", nextScene: "ending-b" },
    { id: "ending-c", label: "拒绝系统，追问真相", nextScene: "ending-c", availableIf: "notSubmitted" }
  ];

  // NOTE: the alias clones and the authored opening pages live in
  // js/chapter-finalize.js, which loads LAST. Doing them here was the root cause of
  // two bugs: clones made before chapter-story.js never inherited the events and
  // backgrounds it adds, and a page authored here was deleted afterwards by
  // novel-presentation.js's △ filter.
}());
