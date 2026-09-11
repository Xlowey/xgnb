(function () {
  "use strict";
  // The first missing flag is not always the next map entrance.  Scene 04
  // starts at the dorm door; the first patrol then uses the actual entrances
  // in the hall map. Keep this route table as the single source of truth for
  // objective text and minimap targets so a save cannot point at a dead route.
  var route = [
    ["scene03Seen", "调查宿舍里的纸条，确认下一步该怎么走。", "dorm", "dorm-note"],
    ["scene04Seen", "从宿舍门进入走廊，开始午夜巡逻。", "dorm", "dorm-door"],
    ["scene05Seen", "前往病房展厅，调查病床和电视。", "museum", "overview-hospital"],
    ["scene06Seen", "前往教室展厅，查看录像。", "classroom", "classroom-recording"],
    ["scene07Seen", "对讲机通知集合：返回大厅，观察无脸保安。", "hall", "hall-guard"],
    ["scene08Seen", "与赵灵前往食堂门前。", "canteenPassage", "canteen-door-story"],
    ["scene09Seen", "前往馆长办公室谈话。", "office", "office-director"],
    ["scene10Seen", "回大厅调查阴暗角落。", "hall", "hall-scene-10"],
    ["scene11Seen", "经走廊回宿舍，查看门口的客人。", "dorm", "dorm-scene-11"],
    ["scene12Seen", "调查宿舍门边散落的彩带。", "dorm", "dorm-scene-12"],
    ["scene13Seen", "查看宿舍桌边的来信。", "dorm", "dorm-scene-13"],
    ["scene14Seen", "经食堂走廊进入食堂。", "canteen", "canteen-meal"],
    ["scene15Seen", "前往蜡像馆调查张明诚展台。", "wax", "wax-contract"],
    ["scene16Seen", "继续调查蜡像馆展台。", "wax", "wax-scene-16"],
    ["scene17Seen", "前往馆长办公室。", "office", "wax-scene-17"],
    ["scene20Seen", "前往银色恋人展厅，完成调查。", "museum", "overview-silver"],
    ["scene21Seen", "进入食堂，调查彩带。", "canteen", "canteen-ribbons"],
    ["scene22Seen", "调查食堂彩带深处。", "canteen", "wax-scene-22"],
    ["scene23Seen", "继续调查食堂中的回声。", "canteen", "wax-scene-23"],
    ["scene24Seen", "回馆长办公室调查。", "office", "wax-scene-24"],
    ["scene25Seen", "回宿舍翻找红色制服。", "dorm", "dorm-scene-25"],
    ["scene26Seen", "回到宿舍外走廊巡逻。", "corridor", "wax-scene-26"],
    ["scene27Seen", "回到宿舍门边。", "dorm", "wax-scene-27"],
    ["scene28Seen", "前往食堂走廊，调查逃离路线。", "canteenPassage", "wax-scene-28"],
    ["scene29Seen", "调查食堂门前的变化。", "canteenPassage", "wax-scene-29"],
    ["scene30Seen", "前往博物馆出口。", "museum", "wax-scene-30"]
  ];
  function objective(state) {
    var row = route.find(function (r) { return !state.flags[r[0]]; });
    return row ? {text:row[1],room:row[2],entrance:row[3]} : {text:"前往博物馆出口，做出最后的选择。"};
  }
  function complete(state, id) {
    // The parent office scene ends at a question, not at the end of the conversation.
    if (id === "scene-09") return;
    if (/^scene-09-[abc]$/.test(id)) state.flags.scene09Seen = true;
    state.task = objective(state).text;
  }
  window.MuseumChapterProgress={objective:objective,complete:complete};
}());
