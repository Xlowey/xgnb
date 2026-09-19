/*
 * 里程碑结算（012 §4.2）。一个扫描函数，两个来源：
 *
 *   1. `window.MuseumMilestoneDefinitions` —— 只发钱的节点（每日存活 / 幕结算 / 玩法通关）。
 *      达成靠旗标，幂等靠 `state.flags["milestone:<id>"]`。
 *   2. `window.MuseumAchievementDefinitions` 里带 `check(state)` 的条目 —— 条件成立就解锁成就。
 *      成就的奖励由 achievements.js 在解锁那一刻发（unlock 本身是幂等的）。
 *
 * 为什么做成"扫描"而不是"在事件点上逐个 unlock"：**老存档也能补发**。玩家今天之前就
 * 答对过守则、打赢过馆长，那些旗标已经在存档里了，扫描一跑就该把成就补上；如果只在
 * 事件点调用，老存档永远拿不到。扫描是幂等的，多跑几次没有代价。
 */
(function () {
  "use strict";

  function milestones() { return window.MuseumMilestoneDefinitions || []; }
  function achievements() { return window.MuseumAchievementDefinitions || []; }
  function claimed(state, id) { return Boolean(state && state.flags && state.flags["milestone:" + id]); }

  // 扫一遍。返回这次真正发出去的里程碑 id（成就那边的解锁由成就系统自己记录）。
  function settle(state) {
    if (!state || !window.MuseumPoints) return [];
    var fired = [];

    if (window.MuseumAchievements) {
      achievements().forEach(function (def) {
        if (!def || typeof def.check !== "function") return;
        var reached = false;
        // 单条判定出错不能卡住整轮结算：漏发一次下次扫描还会补，抛出去就全都发不了了。
        try { reached = Boolean(def.check(state)); } catch (error) { console.warn("成就判定出错，已跳过：" + def.id, error); return; }
        if (reached) window.MuseumAchievements.unlock(state, def.id);
      });
    }

    milestones().forEach(function (item) {
      if (!item || !item.id) return;

      // ---- ② 增量条目（count / per / cap）----
      // 用于「复玩按次给钱、封顶」这类要记次数的事（012 §4.2 的两个小游戏）。
      // 已发多少记在同一个旗标袋里（存数字而不是布尔），所以老存档照样能补发。
      if (typeof item.count === "function") {
        var reached = 0;
        try { reached = Math.max(0, Math.floor(Number(item.count(state)) || 0)); } catch (error) { console.warn("里程碑计数出错，已跳过：" + item.id, error); return; }
        var per = Math.max(0, Number(item.per) || 0);
        var cap = Math.max(0, Number(item.cap) || 0);
        var earned = Math.min(cap, reached * per);
        var paidKey = "milestone:" + item.id;
        var paid = Math.max(0, Number(state.flags[paidKey]) || 0);
        if (earned <= paid) return;
        // 先记已发额再发钱：万一 add 抛错，也不会变成每次扫描都重发一遍。
        state.flags[paidKey] = earned;
        window.MuseumPoints.add(earned - paid, item.source);
        fired.push(item.id);
        return;
      }

      // ---- ① 一次性条目 ----
      // 锚点有两种：`flag`（某个场次/事件旗标）或 `check(state)`（要按存档内容算条件，
      // 比如「线索够不够几条」）。二者取其一。
      if (!item.flag && typeof item.check !== "function") return;
      if (claimed(state, item.id)) return;
      var hit = false;
      if (typeof item.check === "function") {
        try { hit = Boolean(item.check(state)); } catch (error) { console.warn("里程碑判定出错，已跳过：" + item.id, error); return; }
      } else {
        hit = Boolean(state.flags[item.flag]);
      }
      if (!hit) return;
      // 先记旗标再发钱：万一 add 抛错，也不会变成每次扫描都发一遍。
      state.flags["milestone:" + item.id] = true;
      window.MuseumPoints.add(item.points, item.source);
      fired.push(item.id);
    });

    return fired;
  }

  window.MuseumMilestones = { settle: settle, claimed: claimed, milestones: milestones };
}());
