/*
 * 成就配置（012 §4.2：6 个 × 20 点）。
 *
 * ⚠️ 这份表是 2026-09-19 合并 origin/main 时两边取**并集**的结果：
 *
 *   远端（a3fa877「完成了成就系统」）带来 13 条，全部**只追踪、不发钱**——
 *   没有 reward 字段，从不调用 MuseumPoints.add。它们是"玩家做过什么"的
 *   叙事型成就，unlock 时机由 game.js / novel.js 在事件点直接调用。
 *
 *   我们这边带来 6 条，每条 reward: 20，由 milestones.js 扫描 check(state)
 *   条件触发，对应 012 §4.2 那笔「成就 6 × 20 = 120」的收入预算。
 *
 *   两边重合的只有 2 条（下面的 rules-reader / first-battle）：保留远端的
 *   id 和文案（因为远端的代码就是按这些 id 调的），挂上我们的 reward 和
 *   check。所以我们独有的 4 条（面具 2 条 + 券机 2 条）原样保留。
 *
 *   结果：17 条成就，其中 6 条发钱 = 6 × 20 = 120，与 012 §4.2 的预算分毫
 *   不差，§7.1 / §7.2 / §7.4 的合计都不用改。
 *
 * ⚠️ 改这份表时注意：unlock() 对查不到的定义是**静默失败**（achievements.js
 *   里 `var def = find(id); if (!def) return false;`），所以删条目会让远端
 *   那边对应的 unlockAchievement() 调用无声无息地失效。
 *
 * 字段：id（唯一）、name、description、reward（解锁时发的生存点，缺省即 0）、
 *       check(state)（可选，给 milestones.js 扫描用；不写就只走事件点解锁）、
 *       target（默认 1）、hidden。
 */
window.MuseumAchievementDefinitions = [
  // ---- 以下 11 条来自远端，reward 缺省为 0（纯追踪，不动经济）----
  { id: "first-step", name: "迈出第一步", description: "第一次在博物馆里移动。" },
  { id: "first-investigation", name: "先看看再说", description: "第一次调查地图上的物件。" },
  { id: "dorm-escape", name: "走出宿舍", description: "打开宿舍门，第一次进入走廊。" },
  { id: "corridor-meeting", name: "走廊上的新同事", description: "完成第一次与赵灵的走廊对话。" },
  { id: "area-explorer", name: "馆内漫步", description: "进入 6 个不同的馆内区域。", target: 6 },
  { id: "clue-collector", name: "把碎片拼起来", description: "收集 5 条线索。", target: 5 },
  { id: "blood-note", name: "血字纸条", description: "读完宿舍里的血字纸条。" },
  { id: "director-talk", name: "馆长的试探", description: "完成第一次馆长办公室谈话。" },
  { id: "diary-reader", name: "翻开馆长的日记", description: "读完馆长日记。" },
  { id: "first-ending", name: "故事落幕", description: "第一次抵达一个结局。", hidden: true },
  { id: "ending-collector", name: "馆内全貌", description: "收集全部 5 种结局。", target: 5, hidden: true },

  // ---- 以下 2 条是重合项：远端的 id + 文案，我们的 reward + check ----
  {
    // 远端叫「规则记录员」，对应我们原来的 rule-keeper
    id: "rules-reader", name: "规则记录员", reward: 20,
    description: "完成员工守则判断。",
    check: function (state) { return Boolean(state.flags.rulesGameCompleted); }
  },
  {
    // 远端叫「夜班交涉」，对应我们原来的 director-account。
    // battleDemoCompleted 只在非最终战（馆长战）胜利时置位，语义与远端的
    // 「第一次战斗并活着回来」一致。
    id: "first-battle", name: "夜班交涉", reward: 20,
    description: "完成第一次战斗并活着回来。",
    check: function (state) { return Boolean(state.flags.battleDemoCompleted); }
  },

  // ---- 以下 4 条是我们这边独有的，都带 reward: 20 ----
  {
    id: "mask-off", name: "摘下面具", reward: 20,
    description: "在别人面前摘下面具。",
    check: function (state) { return Boolean(state.flags.removedMask); }
  },
  {
    id: "mask-on", name: "戴着面具", reward: 20,
    description: "始终没有摘下面具。",
    check: function (state) { return Boolean(state.flags.remainedMasked); }
  },
  {
    // 012 §6.6：累计购券满 30 张 → 【常客】
    id: "regular", name: "常客", reward: 20, target: 30,
    description: "在员工福利券机累计购券 30 张。",
    check: function (state) { return (state.machine && state.machine.tickets || 0) >= 30; }
  },
  {
    // 012 §6.6：单张券净收益 ≥ 200 点 → 【一把翻本】（machine.bestNet）
    id: "lucky-one", name: "一把翻本", reward: 20, target: 200,
    description: "单张券的净收益达到 200 点。",
    check: function (state) { return (state.machine && state.machine.bestNet || 0) >= 200; }
  }
];
