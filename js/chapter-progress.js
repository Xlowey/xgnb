(function () {
  "use strict";
  // The first missing flag is not always the next map entrance.  Scene 04
  // starts at the dorm door; the first patrol then uses the actual entrances
  // in the hall map. Keep this route table as the single source of truth for
  // objective text and minimap targets so a save cannot point at a dead route.
  var route = [
    ["scene03Seen", "调查宿舍里的纸条，确认下一步该怎么走。", "dorm", "dorm-note"],
    ["scene04Seen", "回到员工宿舍，打开宿舍门进入走廊，开始午夜巡逻。", "museum", "overview-dorm"],
    ["scene05Seen", "在大厅调查病房展厅的病床和电视。", "hall", "hall-scene-05"],
    ["scene06Seen", "前往教室展厅，查看录像。", "hall", "hall-scene-06"],
    ["scene07Seen", "对讲机通知集合：返回大厅，观察无脸保安。", "hall", "hall-guard"],
    ["scene08Seen", "与赵灵前往食堂门前。", "hall", "hall-scene-08"],
    ["scene09Seen", "前往馆长办公室谈话。", "hall", "hall-scene-09"]
  ];
  function objective(state) {
    var row = route.find(function (r) { return !state.flags[r[0]]; });
    return row ? {text:row[1],room:row[2],entrance:row[3]} : {text:"馆长谈话已结束，可以保存进度，继续探索。"};
  }
  function complete(state, id) {
    // The parent office scene ends at a question, not at the end of the conversation.
    if (id === "scene-09") return;
    if (/^scene-09-[abc]$/.test(id)) state.flags.scene09Seen = true;
    state.task = objective(state).text;
  }
  window.MuseumChapterProgress={objective:objective,complete:complete};
}());
