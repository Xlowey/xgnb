/* 跑酷只提交自己的记录，不复用保安战斗的奖励和结算。 */
(function () {
  "use strict";
  const query = new URLSearchParams(window.location.search);
  /*
   * 两种进入方式，金币的换算完全一样（js/demo-shell.js 的 earnCoins：局内实时到账、
   * 全程累计封顶），区别只在"打完往哪走"：
   *
   *   from=novel —— 剧情里的追逐段（第二十六场）。打完把结果回传，主游戏结算并接下一场。
   *   from=panel —— 从**系统面板**直接开一局（通关一次后解锁的复玩入口），只为赚金币：
   *                 不回传结果、不动剧情，退出时回原来那个页面。
   */
  const storyMode = query.get("from") === "novel" && !!query.get("runId") && /^[\w-]+$/.test(query.get("returnScene") || "");
  const panelMode = query.get("from") === "panel" && !!query.get("user");
  const enabled = storyMode || panelMode;
  let outcome = null;
  const bridge = {
    enabled,
    reset() { outcome = null; },
    complete(status, game) {
      // 面板复玩不回传结果：它不接任何剧情，也没有 runnerAttempt 给它结算。
      if (!storyMode) return;
      outcome = {
        status, elapsed: Math.min(180, Math.max(0, game.survivalTime)),
        score: game.score, distance: game.distance, coins: game.coinCount,
        wallHits: game.player.wallHits,
        // 金币已经在局内**实时**换成生存点了（见 js/demo-shell.js 的 earnCoins）。
        // 带上这个标记，主游戏结算时才不会又换一次（双重发钱）。
        // 独立游玩 / shell 没接上时它是假的 —— 那会儿主游戏会照旧按结算换算，不会漏发。
        liveCoins: Boolean(window.__liveCoinsGranted),
      };
    },
    returnToStory() {
      if (!enabled) return false;
      // 面板复玩：直接回原页面，不写任何结果（写了一份也没有 runnerAttempt 认它，
      // 反而会卡在"结果合法性校验"那一步被删掉）。
      if (panelMode) {
        const back = query.get("returnTo");
        window.location.href = back ? decodeURIComponent(back) : "../../index.html";
        return true;
      }
      const result = Object.assign({status:"cancel",elapsed:0,score:0,distance:0,coins:0,wallHits:0}, outcome || {}, {
        userId: query.get("user"), runId: query.get("runId"), kind:"museum-runner", version:1,
      });
      try {
        const storage = query.get("preview") === "1" ? sessionStorage : localStorage;
        storage.setItem("museum_pending_runner_v1", JSON.stringify(result));
      } catch {
        document.getElementById("bridgeStatus").textContent = "记录未能保存，请检查浏览器存储空间后重试。";
        return false;
      }
      const preview = query.get("preview") === "1";
      const destination = preview
        ? "../../pages/novel.html?preview=1&resume=1&fromRunner=1&scene=" + encodeURIComponent(result.status === "lose" ? "ending-d" : query.get(result.status === "cancel" ? "cancelScene" : "returnScene") || "scene-28")
        : "../../index.html?fromRunner=1";
      window.location.href = destination;
      return true;
    },
  };
  document.querySelectorAll(".story-exit").forEach(button => {
    button.classList.toggle("hidden", !enabled);
    // 面板复玩不是"回剧情"，标签得跟着改，否则玩家会以为退出去要演下一场。
    if (panelMode) button.textContent = "返回游戏";
  });
  window.MuseumRunnerBridge = bridge;
}());
