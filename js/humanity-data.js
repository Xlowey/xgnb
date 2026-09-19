/*
 * 人性值的旗标表（013 §3.1 的时间流逝 + §3.3 的回血）。
 *
 * 一条 = 「某个旗标成立 → 变一笔人性值，且只变一次」，delta 带符号。
 * 幂等靠 `state.flags["humanity:<id>"]`，复用现成的旗标袋，**不加新变量、不改存档结构**。
 * 扫描逻辑在 js/humanity.js 的 settle()，与 js/milestones.js 同构。
 *
 * ⚠️ 这一版**没有**把 §3.3 的四类回血做全。只做了两类有现成钩子的：
 *      ✅ 【锚点】道具（走商城，见 js/shop-data.js + 商城的「使用」入口）
 *      ✅ 找回线索（本表下面的 clue-* 八条）
 *      ⏸ NPC 信任互动 —— `state.npcTrust` 全仓只写初值、**从来没有任何地方改写它**，
 *         要接得先给 009 第十二场「角色信任松动」造一个钩子；
 *      ⏸ 休息一个场次 —— 这个时机在代码里根本不存在（`rest` 零命中）。
 */
(function () {
  "use strict";

  // 013 §8.1 的调参旋钮。**提出来放这儿**，是为了让两场战斗（第十一场馆长、第二十九场 BOSS）
  // 共用同一套数字——它们打在不同的 demo 里（js/battle.js 与 demos/pixel-dungeon-html），
  // 各写一份迟早会分叉，而 013 §8.1 那张表要求这三个数能一起调。
  //
  // 013 §8.1 的难度目标：「让每场被击中 3—4 次成为死亡临界点。低于 2 次太宽松，高于 6 次太劝退。」
  window.MuseumHumanityTuning = {
    battleBaseDrain: 14,    // 每场战斗的基础损耗（完胜也要付）
    battleHitDrain: 6,      // 战斗中每被击中一次
    battleFailPenalty: 300, // 战斗失败扣的**生存点**（不是人性值），定 300 = 与【回滚】同价
    lowWarn: 30             // 013 §8.2 的预警线：低于它，面板该变形、画面该起蜡像化滤镜
  };

  window.MuseumHumanityDefinitions = [
    // ---------- 时间流逝（013 §3.1：每过一天 −10，共 3 次）----------
    // 013 的设计意图：「让玩家感觉到时间在走、自己在变——那是蜡像化的钟表。」
    // 三个节点与每日存活里程碑**共用同一组场次旗标**（见 js/milestones-data.js），
    // 所以玩家拿到 +20 生存点的同一刻，会掉 10 点人性值。一进一出，是刻意的。
    { id: "drain-day-1", flag: "scene12Seen", delta: -10, source: "时间在走 · 第一夜" },
    { id: "drain-day-2", flag: "scene23Seen", delta: -10, source: "时间在走 · 第二夜" },
    { id: "drain-day-3", flag: "scene25Seen", delta: -10, source: "时间在走 · 第三夜" },

    // ---------- 找回线索（013 §3.3：核心线索 +2，上限 8 条）----------
    // ⚠️ **口径出入**：012 的「核心线索 8 条」是按 CL 编号数的（CL-07/09/10/12/13/14/16/17），
    // 但**代码里根本不枚举 CL 编号**——`state.clues` 装的是 `rule-red` / `peach-dream` /
    // `blood-note` 这类剧情事件 id（见 js/game.js 的 addClue 与 js/novel.js 的几处 push）。
    // 硬套 CL 会引出新的错，所以这里按**条数**实现：每多一条线索 +2，封顶 8 条 = +16。
    // 与 013 §3.3 的总量一致，只是不区分「核心 / 普通」。等 008 的 SC ↔ 009 场次对照表
    // 做出来之后，这里可以再收窄成只认核心那几条。
    //
    // 拆成 8 条而不是一条动态表，是为了让幂等继续靠单个旗标——扫描是「多跑几次没有代价」的，
    // 动态 delta 会需要一个计数器，那就要改存档结构了。
    { id: "clue-1", check: function (state) { return state.clues.length >= 1; }, delta: 2, source: "找回了真相的碎片" },
    { id: "clue-2", check: function (state) { return state.clues.length >= 2; }, delta: 2, source: "找回了真相的碎片" },
    { id: "clue-3", check: function (state) { return state.clues.length >= 3; }, delta: 2, source: "找回了真相的碎片" },
    { id: "clue-4", check: function (state) { return state.clues.length >= 4; }, delta: 2, source: "找回了真相的碎片" },
    { id: "clue-5", check: function (state) { return state.clues.length >= 5; }, delta: 2, source: "找回了真相的碎片" },
    { id: "clue-6", check: function (state) { return state.clues.length >= 6; }, delta: 2, source: "找回了真相的碎片" },
    { id: "clue-7", check: function (state) { return state.clues.length >= 7; }, delta: 2, source: "找回了真相的碎片" },
    { id: "clue-8", check: function (state) { return state.clues.length >= 8; }, delta: 2, source: "找回了真相的碎片" }
  ];
}());
