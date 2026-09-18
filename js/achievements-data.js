/*
 * 正式成就配置。
 * 成就只描述“玩家做过什么”，解锁时机由地图/剧情代码上报，避免把进度
 * 规则散落在界面层。target 大于 1 的项目会显示累计进度，hidden 项目在
 * 解锁前只显示为“隐藏成就”。
 */
window.MuseumAchievementDefinitions = [
  { id: "first-step", name: "迈出第一步", description: "第一次在博物馆里移动。" },
  { id: "first-investigation", name: "先看看再说", description: "第一次调查地图上的物件。" },
  { id: "dorm-escape", name: "走出宿舍", description: "打开宿舍门，第一次进入走廊。" },
  { id: "corridor-meeting", name: "走廊上的新同事", description: "完成第一次与赵灵的走廊对话。" },
  { id: "area-explorer", name: "馆内漫步", description: "进入 6 个不同的馆内区域。", target: 6 },
  { id: "clue-collector", name: "把碎片拼起来", description: "收集 5 条线索。", target: 5 },
  { id: "rules-reader", name: "规则记录员", description: "完成员工守则判断。" },
  { id: "blood-note", name: "血字纸条", description: "读完宿舍里的血字纸条。" },
  { id: "director-talk", name: "馆长的试探", description: "完成第一次馆长办公室谈话。" },
  { id: "first-battle", name: "夜班交涉", description: "完成第一次战斗并活着回来。" },
  { id: "diary-reader", name: "翻开馆长的日记", description: "读完馆长日记。" },
  { id: "first-ending", name: "故事落幕", description: "第一次抵达一个结局。", hidden: true },
  { id: "ending-collector", name: "馆内全貌", description: "收集全部 5 种结局。", target: 5, hidden: true }
];
