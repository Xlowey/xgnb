/*
 * 成就配置（012 §4.2：6 个 × 20 点）。
 *
 * ⚠️ 这 6 条**不是从剧本里摘的**——012 §4.2 自己写明「009 全篇 0 处『成就』」，所以这是一份
 * **设计**，不是转录。下面这版是提案，选条原则是「优先挑游戏里真的能被检测到的信号」：
 *
 *   ① 四条挂在已有的剧情/战斗旗标上（这些旗标都在 novel.js / game.js 里真的被写过）；
 *   ② 两条直接取自 012 §6.6 给券机拟的那组（【常客】【一把翻本】）。
 *
 * 字段：id（唯一）、name、description、reward（解锁时发的生存点）、
 *       check(state)（可选，给 milestones.js 扫描用）、target（默认 1）、hidden。
 *
 * 奖励统一 20，与 012 §4.2 的「成就 6 个 × 20 = 120」一致。改名字、改条件、换条目都很自由，
 * 只要保持 6 条 × 20 就等于 012 的那笔预算。
 */
window.MuseumAchievementDefinitions = [
  {
    id: "rule-keeper", name: "守则", reward: 20,
    description: "答对员工守则上的那道题。",
    check: function (state) { return Boolean(state.flags.rulesGameCompleted); }
  },
  {
    id: "director-account", name: "口供", reward: 20,
    description: "在与馆长的交涉里占上风，拿到他的口供。",
    check: function (state) { return Boolean(state.flags.battleDemoCompleted); }
  },
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
