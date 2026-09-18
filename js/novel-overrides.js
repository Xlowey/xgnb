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

  scenes["scene-06"].choices = [
    { id: "follow-zhaoling", label: "跟赵灵去食堂门前", nextScene: "scene-07" }
  ];

  scenes["scene-13"].choices = [
    { id: "inspect-wax", label: "继续清点蜡像，调查赵灵的展台", nextScene: "scene-14", effect: "find-contract-clue" }
  ];

  // 第九场的四个回答是同一轮的互斥选项。旧实现把 A/B/C 串成了三段，
  // 还留下一个“提交调查记录”伪选项，导致坦白路线继续播放隐瞒路线的完整坦白。
  // 以“吃没吃桃子？”为切点，四条路线各自从头播放到自己的收束处。
  var office = scenes["scene-08"];
  var officeAllLines = office.lines.slice();
  var officeChoiceAt = findLineIndex("scene-08", function (line) { return line.text.indexOf("① 什么梦") === 0; });
  var officeAAt = findLineIndex("scene-08", function (line) { return line.text.indexOf("你……吃那些桃子了吗") === 0; });
  var officeBAt = findLineIndex("scene-08", function (line) { return line.text.indexOf("吃了……") === 0; });
  var officeCAt = findLineIndex("scene-08", function (line) { return line.text.indexOf("馆长这么紧张") === 0; });
  // 「主角（若隐瞒）」的括号已按 009 口径剔除，改用 D 分支首句定位（选项行前面带 ①，不会误命中）
  var officeDAt = findLineIndex("scene-08", function (line) { return line.text.indexOf("什么梦？") === 0; });
  var officeEnd = officeAllLines.length;
  office.lines = officeAllLines.slice(0, officeChoiceAt);
  office.choices = [
    { id: "office-hide", label: "A　没吃，继续隐瞒", nextScene: "scene-08-a" },
    { id: "office-tell", label: "B　吃了，直接坦白", nextScene: "scene-08-b" },
    { id: "office-ask", label: "C　反问馆长是否也梦见过桃树", nextScene: "scene-08-c" },
    { id: "office-secret", label: "D　不回答，保留自己的秘密", nextScene: "scene-08-d" }
  ];
  var officeBranch = function (id, title, lines, flag) {
    return Object.assign({}, office, {
      id: id,
      title: title,
      lines: lines,
      events: null,
      choices: null,
      flag: flag
    });
  };
  scenes["scene-08-a"] = officeBranch("scene-08-a", "馆长办公室 · 没吃", officeAllLines.slice(officeAAt, officeBAt), "officeHideSeen");
  scenes["scene-08-b"] = officeBranch("scene-08-b", "馆长办公室 · 坦白", officeAllLines.slice(officeBAt, officeCAt), "officeTellSeen");
  scenes["scene-08-c"] = officeBranch("scene-08-c", "馆长办公室 · 追问", officeAllLines.slice(officeCAt, officeDAt), "officeAskSeen");
  scenes["scene-08-d"] = officeBranch("scene-08-d", "馆长办公室 · 保留秘密", officeAllLines.slice(officeDAt, officeEnd), "officeSecretSeen");

  // 009 删掉了王钢蛋的宿舍卡牌战，战斗挪到第十一场：馆长被擒、客人走后主角动手。
  // 以「进入战斗（可选择使用系统提供的帮助）」为切点，战斗结算后回到 scene-11-after。
  var dormIntrusion = scenes["scene-11"];
  var dormAllLines = dormIntrusion.lines.slice();
  var fightHintAt = findLineIndex("scene-11", function (line) { return line.text.indexOf("进入战斗") !== -1; });
  dormIntrusion.lines = dormAllLines.slice(0, fightHintAt);
  dormIntrusion.choices = [
    { id: "dorm-fight", label: "战斗，逼馆长说出通关的方法", action: "battle", afterBattle: "scene-11-after" }
  ];
  cloneScene("scene-11-after", "scene-11", {
    title: "员工宿舍 · 交涉之后",
    location: "员工宿舍",
    lines: dormAllLines.slice(fightHintAt + 1),
    // 必须仍是 scene11Seen：战斗选项不会完成 scene-11（见 novel.js choose()），
    // 真正记录「逼问完成」的是这个战后场。改名会让进度链永远卡在「追上逃跑的馆长」。
    flag: "scene11Seen",
    choices: null
  });

  // The mask decision in the Silver Lovers scene is represented as a real choice.
  // The two lines that only labelled the branches in the script ("A摘下" / "B没摘…") are
  // authoring notes, not dialogue, so they are replaced with the action each branch is.
  var silver = scenes["scene-16"];
  var maskChoiceAt = findLineIndex("scene-16", function (line) { return line.text.indexOf("分支选择") !== -1; });
  var maskBranchLines = silver.lines.slice(maskChoiceAt + 1, maskChoiceAt + 4).map(function (line) {
    var text = String(line.text || "");
    if (/^【A】\s*摘下/.test(text) || text.indexOf("A摘下") === 0) return Object.assign({}, line, { speaker: "旁白", text: "你伸手摘下了面具。" });
    if (/^【B】\s*没摘/.test(text) || text.indexOf("B没摘") === 0) return Object.assign({}, line, { speaker: "旁白", text: "你没有动，继续戴着面具观察。" });
    return line;
  });
  var silverA = maskBranchLines.slice(0, 2).concat(silver.lines.slice(maskChoiceAt + 4));
  var silverB = maskBranchLines.slice(2, 3).concat(silver.lines.slice(maskChoiceAt + 4));
  silver.lines = silver.lines.slice(0, maskChoiceAt);
  silver.choices = [
    { id: "remove-mask", label: "摘下自己的面具", nextScene: "scene-16-mask" },
    { id: "keep-mask", label: "不摘面具，继续观察", nextScene: "scene-16-no-mask" }
  ];
  cloneScene("scene-16-mask", "scene-16", { title: "银色的恋人 · 面具之后", lines: silverA.concat(scenes["scene-17"].lines, scenes["scene-18"].lines), flag: "scene18Seen", choices: null });
  cloneScene("scene-16-no-mask", "scene-16", { title: "银色的恋人 · 面具之后", lines: silverB.concat(scenes["scene-17"].lines, scenes["scene-18"].lines), flag: "scene18Seen", choices: null });

  // Scene 26 keeps both written variants available, while the engine records the choice.
  var patrol = scenes["scene-24"];
  var revealAt = findLineIndex("scene-24", function (line) { return line.text.indexOf("主角缓缓摘下面具") !== -1; });
  patrol.choices = [
    { id: "reveal-name", label: "摘下面具，告诉赵灵自己的名字", nextScene: "scene-24-reveal" },
    { id: "keep-name-secret", label: "不摘面具，继续观察", nextScene: "scene-24-hide" }
  ];
  // Keep the direct script text after the decision in both routes; the difference is stored as a flag.
  cloneScene("scene-24-reveal", "scene-24", { title: "巡逻路线 · 真名", lines: patrol.lines.slice(0, revealAt + 3), flag: "scene24Seen", choices: null });
  cloneScene("scene-24-hide", "scene-24", { title: "巡逻路线 · 面具", lines: patrol.lines.slice(0, revealAt), flag: "scene24Seen", choices: null });
  patrol.lines = patrol.lines.slice(0, revealAt);

  // Scene 31 must stop before the ending text and expose the final choice.
  var finale = scenes["scene-29"];
  var endingTextAt = findLineIndex("scene-29", function (line) { return line.text.indexOf("结局 A") === 0; });
  finale.lines = finale.lines.slice(0, endingTextAt);
  finale.returnToMap = false;
  // 新剧本第三十场：白光在身后明灭，屏上浮出选项；① 进入出口 ② 回头救赵灵 ③ 超时未选择。
  // 超时由 novel.js 的 15 秒计时器结算为 ending-d，所以不再需要一个「等待到超时」按钮。
  // 三个最终选项保持并列；A/C 的最终差异由后续 BOSS 阶段系统决定，
  // 不再读取旧的 submitted 旗标。
  finale.choices = [
    { id: "ending-a", label: "回头救赵灵（拒绝系统建议）", nextScene: "ending-a" },
    { id: "ending-b", label: "进入出口（执行系统建议）", nextScene: "ending-b" },
    { id: "ending-c", label: "拒绝系统，追问真相", nextScene: "ending-c" }
  ];

  // NOTE: the alias clones and the authored opening pages live in
  // js/chapter-finalize.js, which loads LAST. Doing them here was the root cause of
  // two bugs: clones made before chapter-story.js never inherited the events and
  // backgrounds it adds, and a page authored here was deleted afterwards by
  // novel-presentation.js's △ filter.
}());
