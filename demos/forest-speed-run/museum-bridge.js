/* 跑酷只提交自己的记录，不复用保安战斗的奖励和结算。 */
(function () {
  "use strict";
  const query = new URLSearchParams(window.location.search);
  const enabled = query.get("from") === "novel" && !!query.get("runId") && /^[\w-]+$/.test(query.get("returnScene") || "");
  let outcome = null;
  const bridge = {
    enabled,
    reset() { outcome = null; },
    complete(status, game) {
      if (!enabled) return;
      outcome = {
        status, elapsed: Math.min(180, Math.max(0, game.survivalTime)),
        score: game.score, distance: game.distance, coins: game.coinCount,
        wallHits: game.player.wallHits,
      };
    },
    returnToStory() {
      if (!enabled) return false;
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
  document.querySelectorAll(".story-exit").forEach(button => button.classList.toggle("hidden", !enabled));
  window.MuseumRunnerBridge = bridge;
}());
