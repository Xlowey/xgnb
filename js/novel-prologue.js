/* 前三场以 详细剧情线第一部分（待更新）.docx 为准。
   △ 内容是画面/物品/系统事件，不是角色对白。 */
(function () {
  "use strict";
  var story = window.MuseumStory, scenes = story.scenes;
  story.items = window.MuseumItems;
  function dialogue(text, visual) { return { type: "dialogue", speaker: "主角（独白）", text: text, visual: visual }; }
  var roomMap = "dorm-map.png";
  scenes["scene-01"].events = [
    { type: "cg", id: "peach-dream", background: "peach-dream.png", effect: "dream", action: "继续" },
    { type: "cg", id: "wake", effect: "wake", action: "睁开眼睛" },
    { type: "system", text: "欢迎来到规则怪谈世界。异变袭击全球，每个国家随机挑选一名天选者进入副本，天选者的存亡与国运直接相关。" },
    dialogue("这是哪儿……我这是穿越到哪本网文小说了？"),
    { type: "system", text: "欢迎来到“怪谈博物馆”副本，请扮演好博物馆的保安的角色，并完成以下任务：① 存活三天 ② 找出异变源头 ③ 找出唯一活人。" },
    dialogue("还真是。副本、任务···为什么是我，来到这个世界？")
  ];
  scenes["scene-02"].events = [
    { type: "explore", background: roomMap },
    { type: "item", image: "wardrobe-detail.png", crop: [423,92,776,735], title: "双开门更衣柜", description: "柜内挂着一套黑色保安制服、一套红色保安制服，以及面具。", action: "查看门板内侧" },
    { type: "document", item: "rules", side: "front", action: "查看黑色制服口袋" }
  ];
  scenes["scene-03"].events = [
    { type: "item", collect: "note", image: "note-front.png", crop: [442,85,820,787], title: "黑色制服的口袋", description: "抽出一张揉皱的纸条。纸条上满是干涸的血字，纸背还写着几行小字，末尾几行被血污糊住，看不清。", action: "展开纸条" },
    { type: "document", item: "note", side: "front", action: "继续" },
    dialogue("我的前身，到底经历了什么？", "note-front.png"),
    { type: "document", item: "note", side: "back", action: "收好纸条" },
    dialogue("两张纸条除了不让去蜡像馆这一条，几乎全部矛盾"),
    { type: "television", action: "打开电视" }
  ];
  ["scene-01", "scene-02", "scene-03"].forEach(function (id, index) {
    Object.assign(scenes[id], { choices: null, namePrompt: false, briefing: null, inspection: null, theme: "dorm", nextScene: index < 2 ? "scene-0" + (index + 2) : null });
  });
  scenes["scene-02"].title = "调查宿舍";
  scenes["scene-03"].title = "血字纸条";
  scenes["scene-03"].location = "员工宿舍 · 夜";
  // Order matters: the alias block below copies the full prologue scene for the
  // named map entries, so the dedicated short re-inspection scenes have to be
  // defined afterwards.  Defining them first silently replaced them with the long
  // prologue, which is what made "re-open the wardrobe" replay half of scene 03.
  var aliases = {opening:"scene-01", "wardrobe-clue":"scene-02", "note-intro":"scene-03"};
  Object.keys(aliases).forEach(function (id) { scenes[id] = Object.assign({}, scenes[aliases[id]], { id:id }); });
  scenes["rules-inspect"] = {id:"rules-inspect",title:"员工守则",location:"员工宿舍",theme:"dorm",events:[{type:"document",item:"rules",side:"front",action:"返回房间"}],lines:[],returnToMap:true};
  scenes["note-inspect"] = {id:"note-inspect",title:"血字纸条",location:"员工宿舍",theme:"dorm",events:[{type:"document",item:"note",side:"front",action:"翻到背面"},{type:"document",item:"note",side:"back",action:"返回房间"}],lines:[],returnToMap:true};
  scenes["tv-inspect"] = {id:"tv-inspect",title:"电视",location:"员工宿舍",theme:"dorm",events:[{type:"television"}],lines:[],returnToMap:true};
  // Repeat visits are recorded inspections, not replays: cloning scene-02/scene-03
  // here would re-run the whole prologue from the wardrobe or the note.  The map
  // entries dorm-wardrobe / dorm-note / dorm-terminal / dorm-mirror open these.
  var inspections = {"wardrobe-repeat":"rules-inspect", "note-repeat":"note-inspect", "mirror":"note-inspect"};
  Object.keys(inspections).forEach(function (id) { scenes[id] = Object.assign({}, scenes[inspections[id]], { id:id }); });
  story.textRevision = 4;
}());
