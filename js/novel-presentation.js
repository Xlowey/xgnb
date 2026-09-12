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
  // ---------------------------------------------------------------------------
  // 说话人提示行（"赵灵（迷离）"、"馆长（扫视全场）"）不是给玩家读的台词。
  //
  // 剧本的写法是：先一行人物加括号提示，下一行才是他说的话。抽取时两行都留成了
  // 旁白，于是玩家看到的是——旁白念出"赵灵（迷离）"，然后旁白再念出赵灵说的话，
  // 赵灵本人始终没有名字。实测影响 13 处，包括 ending-c（完美结局）里的
  // "赵灵（轻声）"、scene-07 的"馆长（扫视全场）"、scene-27 的"赵灵（急促拍门）"。
  //
  // 这里把提示行收进 productionNotes（不再出现在对话里），并把它认出的说话人
  // 贴到下一行上。这样"赵灵说的话"就真的是赵灵说的。
  // ---------------------------------------------------------------------------
  var SPEAKER_CUE = /^([\u4e00-\u9fa5A-Za-z]{2,8})（([^）]{1,16})）\s*$/;
  function unifySpeaker(name, note) {
    var rename = { "画面": "旁白", "镜头": "旁白", "字幕": "旁白" };
    if (rename[name]) return rename[name];
    // 主角（独白）与 主角（呢喃）是同一个人的不同语气，统一成剧本里的称呼。
    if (/^主角/.test(name)) return "主角";
    return note ? name + "（" + note + "）" : name;
  }
  Object.keys(scenes).forEach(function (id) {
    var lines = scenes[id].lines || [];
    var out = [];
    lines.forEach(function (entry) {
      var text = String(entry.text == null ? "" : entry.text).trim();
      var cue = SPEAKER_CUE.exec(text);
      // "进入战斗（可选择使用系统提供的帮助）" 是流程提示，不是人物提示。
      if (cue && /战斗|界面|选项|玩家|系统提示/.test(cue[2])) {
        story.productionNotes[id].push({ kind: "direction", text: text });
        return;
      }
      if (cue) {
        story.productionNotes[id].push({ kind: "speaker-cue", text: text });
        out.push({ __cue: unifySpeaker(cue[1], cue[2]) });
        return;
      }
      var previous = out[out.length - 1];
      if (previous && previous.__cue && (entry.speaker === "旁白" || !entry.speaker)) {
        out.push({ speaker: previous.__cue, text: entry.text });
        out[out.length - 2] = null;   // drop the cue placeholder
        return;
      }
      out.push(entry);
    });
    // 未被消费的提示行占位（下一行本来就有说话人）与空的空行都要丢掉，
    // 否则它们会变成没有文字也没有说话人的空页。
    scenes[id].lines = out.filter(function (entry) {
      if (!entry) return false;
      return String(entry.text == null ? "" : entry.text).trim().length > 0;
    });
    // 相邻重复的舞台指示（抽取时同一段 △ 被写了两遍）
    scenes[id].lines = scenes[id].lines.filter(function (entry, index, all) {
      var prev = all[index - 1];
      return !(prev && prev.text === entry.text && /^\s*[△▲▼▽]/.test(String(entry.text)));
    });
  });
  // Stage directions and authoring annotations from old saves must not reappear
  // as spoken text. Empty scenes are handled by the inspection UI.
}());
