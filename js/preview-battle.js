/* Preview settlement runs after the gameplay services are bound to this state.
   The caller owns persistence, pending-result removal and navigation. */
(function () {
  "use strict";

  function knob(name, fallback) {
    var value = Number((window.MuseumHumanityTuning || {})[name]);
    return Number.isFinite(value) ? value : fallback;
  }
  function addUnique(list, value) { if (list.indexOf(value) === -1) list.push(value); }
  function position(state, finalBoss) {
    function coordinate(value, fallback) {
      return value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : fallback;
    }
    state.roomId = finalBoss ? "museum" : state.returnRoom || state.roomId || "hall";
    state.currentNode = state.roomId;
    state.playerX = finalBoss ? 610 : coordinate(state.returnX, coordinate(state.playerX, 160));
    state.playerY = finalBoss ? 620 : coordinate(state.returnY, coordinate(state.playerY, 460));
    state.returnRoom = state.roomId;
    state.returnX = state.playerX;
    state.returnY = state.playerY;
    state.returnFacing = finalBoss ? "up" : (state.returnFacing || "down");
  }
  function alive(state) {
    var value = window.MuseumHumanity ? window.MuseumHumanity.value() : Number(state.hp);
    return Number.isFinite(value) && value > 0;
  }

  function settle(state, result) {
    if (!state || typeof state !== "object") throw new TypeError("预览战斗缺少当前存档。");
    state.flags = state.flags || {};
    var attempt = state.battleAttempt;
    var finalBoss = state.battleContext === "final-boss";
    var source = finalBoss ? "pixel-dungeon" : "battle";
    var retryScene = attempt && attempt.retryScene || (finalBoss || state.narrativeNode === "scene-28" ? "scene-27-boss" : "scene-11");
    var retryIndex = attempt && Number(attempt.retryIndex);
    if (!Number.isFinite(retryIndex) || retryIndex < 0) retryIndex = 0;
    var destination = retryScene;
    var index = retryIndex;
    var active = state.mode === "battle" && state.returnScene && state.narrativeNode === state.returnScene;
    var valid = active && result && typeof result === "object" && result.userId === (state.userId || "class-preview") &&
      (result.status === "win" || result.status === "lose") && (!result.source || result.source === source);
    if (attempt && attempt.id) valid = valid && result.battleAttempt === attempt.id && (!attempt.source || attempt.source === source);
    else valid = valid && !result.battleAttempt;
    var receipt = attempt && attempt.id || "legacy:" + state.savedAt + ":" + state.returnScene;
    valid = valid && state.lastBattleResultId !== receipt;

    if (valid && result.status === "win") {
      var hits = Number(result.hitsTaken);
      if (!Number.isFinite(hits) || hits < 0) hits = 0;
      if (window.MuseumHumanity) window.MuseumHumanity.damage(knob("battleBaseDrain", 14) + hits * knob("battleHitDrain", 6), finalBoss ? "首领战损耗" : "馆长战损耗");
      // Winning the minigame does not award a victory if its humanity drain is fatal.
      if (alive(state)) {
        window.MuseumPoints.add(finalBoss ? 70 : 50, finalBoss ? "首领战胜利" : "馆长战胜利");
        if (finalBoss) {
          state.flags.boss_defeated = true;
          state.flags.nightmareMinigameChoice = "enter";
          state.flags.nightmareMinigameWon = true;
        } else {
          state.flags.battleDemoCompleted = true;
          state.flags.waxDoorUnlocked = true;
          state.clues = state.clues || [];
          state.unlockedRooms = state.unlockedRooms || [];
          addUnique(state.clues, "director-account");
          addUnique(state.unlockedRooms, "wax");
          if (window.MuseumAchievements) {
            window.MuseumAchievements.setProgress(state, "clue-collector", state.clues.length, { save: function () {} });
            window.MuseumAchievements.setProgress(state, "area-explorer", state.unlockedRooms.length, { save: function () {} });
            window.MuseumAchievements.unlock(state, "first-battle", { save: function () {} });
          }
        }
        state.minigamePlays = state.minigamePlays || { forest: 0, dungeon: 0 };
        state.minigamePlays.dungeon = Math.max(0, Number(state.minigamePlays.dungeon) || 0) + 1;
        if (window.MuseumMilestones) window.MuseumMilestones.settle(state);
        if (window.MuseumHumanity) window.MuseumHumanity.settle(state);
        destination = finalBoss ? "scene-28" : state.returnScene || "guard-after-battle";
        index = 0;
      }
    } else {
      if (finalBoss) state.flags.nightmareMinigameWon = false;
      if (valid && result.status === "lose") window.MuseumPoints.penalize(knob("battleFailPenalty", 300), "战斗失败");
      if (window.MuseumHumanity) window.MuseumHumanity.settleZero(state);
    }

    if (!alive(state)) {
      destination = "ending-d";
      index = 0;
      state.flags.endingCause = "humanity";
      if (finalBoss) state.flags.nightmareMinigameWon = false;
    }
    position(state, finalBoss);
    state.mode = "novel";
    state.narrativeNode = destination;
    state.narrativeIndex = index;
    state.narrativeChoice = destination === "ending-d" ? "ending-d" : null;
    state.ending = null;
    state.endingComplete = false;
    state.returnScene = null;
    state.battleContext = null;
    state.battleAttempt = null;
    if (valid) state.lastBattleResultId = receipt;
    return destination;
  }

  window.MuseumPreviewBattle = { settle: settle };
}());
