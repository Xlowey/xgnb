/* Presentation preparation runs AFTER branch slicing: directions are never dialogue. */
(function () {
  "use strict";
  var story = window.MuseumStory;
  var scenes = story.scenes;
  story.textRevision = 3;
  story.productionNotes = {};
  Object.keys(scenes).forEach(function (id) {
    var scene = scenes[id];
    var notes = [];
    scene.lines = scene.lines.filter(function (line, index) {
      if (/^\s*[△▲▼▽]/.test(line.text)) {
        notes.push({ sourceIndex: index, kind: /文字特写/.test(line.text) ? "item" : "cg", text: line.text });
        return false;
      }
      return true;
    });
    story.productionNotes[id] = notes;
  });
  function line(speaker, text) { return { speaker: speaker, text: text }; }
  function set(ids, values) { ids.forEach(function (id) { Object.assign(scenes[id], values); }); }
  set(["scene-01", "opening"], {
    title: "梦醒", location: "员工宿舍 · 第一天", theme: "dorm",
    briefing: ["身份：博物馆保安", "存活三天", "找出异变源头", "找出唯一活人"]
  });
  set(["scene-02", "wardrobe-clue", "wardrobe-repeat"], {
    title: "更衣柜", location: "员工宿舍 · 更衣柜", theme: "wardrobe",
    inspection: "更衣柜", lines: []
  });
  set(["scene-04"], { title: "午夜巡逻", location: "博物馆走廊 · 午夜", theme: "patrol" });
  set(["scene-14"], { theme: "canteen" });
  // Three exclusive replies, selected from the script's short version. The later
  // alternate draft is not appended to all branches.
  scenes["scene-09"].lines = [line("馆长", "小张啊，快坐。最近……还在做那个梦吗？"), line("MOSS", "建议先不暴露更多信息。")];
  scenes["scene-09-a"].lines = [line("主角", "什么梦？我没做梦啊。"), line("馆长", "你……吃那些桃子了吗！？"), line("主角", "没吃。那桃子看着瘆人，谁会去碰啊。"), line("馆长", "奥，你很不诚实。"), line("主角", "馆长，你怎么连我「梦里」有没有碰东西都知道？你在我们睡觉的时候，看得到我们做梦？"), line("馆长", "我不用看。这座馆里，就没有我不知道的事。你以为你偷偷进蜡像馆，能瞒得过我？")];
  scenes["scene-09-b"].lines = [line("主角", "我最近常做一个怪梦，梦里有一棵桃树，长满了人头大小的桃子。"), line("馆长", "你……吃那些桃子了吗！？"), line("主角", "吃了……我控制不住。醒来之后，房间里就会多出一个被啃咬过的人头。"), line("馆长", "小张，别紧张，馆长不会害你"), line("主角", "吃了那桃子会怎样？"), line("馆长", "算了，算了，没什么大事。你嘛……下次注意。")];
  scenes["scene-09-c"].lines = [line("主角", "馆长这么紧张我吃没吃桃……该不会，你自己也做过那个梦吧？"), line("馆长", "……"), line("主角", "你梦里那棵树，是不是也长满了人头？"), line("馆长", "早忘了。我连那梦是什么样都想不起来。不是想不起来……是我不想想起来。这地方，记得越多，越难受。我干干净净地当我的馆长，挺好。"), line("MOSS", "馆长在遗忘")];
  ["scene-09", "scene-09-a", "scene-09-b", "scene-09-c"].forEach(function (id) {
    Object.assign(scenes[id], { title: "馆长的试探", location: "馆长办公室 · 夜", theme: "office" });
    if (id !== "scene-09") scenes[id].lines.push(line("MOSS", "馆长对「桃树」存在异常关注。建议将其标记为高价值线索。"));
  });
  set(["scene-29"], { title: "出口之前", location: "食堂门前 · 最后一夜", theme: "nightmare", nextScene: "scene-30" });
  set(["scene-30"], { title: "正在消失的出口", location: "食堂门前 · 最后一夜", theme: "nightmare" });
  Object.keys(scenes).forEach(function (id) {
    scenes[id].lines = scenes[id].lines.filter(function (entry) {
      var annotation = /^(（(?:如果|设计分支|玩家可选|配一个|战斗|界面弹出)|主角（独白）（似乎|结局 [A-E]\s)/.test(entry.text);
      if (annotation) story.productionNotes[id].push({kind: "direction", text: entry.text});
      return !annotation;
    });
  });
  // Stage directions and authoring annotations from old saves must not reappear
  // as spoken text. Empty scenes are handled by the inspection UI.
}());
