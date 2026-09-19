/* Ending decisions and lifecycle. No DOM, storage or navigation side effects. */
(function () {
  "use strict";
  function isEnding(id) { return /^ending-[a-e]$/.test(id || ""); }
  function isComplete(state, sceneId) {
    return isEnding(sceneId) && state.mode === "ending" && state.endingComplete === true &&
      state.ending === sceneId && state.narrativeNode === sceneId;
  }
  function resolveChoice(state, choice) {
    if (!choice.endingFromNightmareChoice) return choice;
    var flags = state.flags || {}, destination = "ending-a";
    if (flags.nightmareMinigameChoice === "enter") {
      // Old successful saves predate the explicit win marker. Only accept a
      // completed post-battle scene with no pending battle as legacy evidence.
      var legacyWin = flags.nightmareMinigameWon == null && flags.scene28Seen &&
        state.mode !== "battle" && !state.battleAttempt && !state.returnScene;
      destination = flags.nightmareMinigameWon === true || legacyWin ? "ending-c" : "scene-27-boss";
    }
    return Object.assign({}, choice, { id: destination, nextScene: destination });
  }
  function enter(state, sceneId) {
    state.mode = "novel";
    state.narrativeNode = sceneId;
    state.narrativeIndex = 0;
    state.ending = isEnding(sceneId) ? sceneId : null;
    state.endingComplete = false;
  }
  function complete(state, sceneId) {
    if (!isEnding(sceneId)) return false;
    state.mode = "ending";
    state.narrativeNode = sceneId;
    state.ending = sceneId;
    state.endingComplete = true;
    state.endingHistory = state.endingHistory || [];
    if (state.endingHistory.indexOf(sceneId) === -1) state.endingHistory.push(sceneId);
    return true;
  }
  window.MuseumEndingFlow = { isEnding: isEnding, isComplete: isComplete, resolveChoice: resolveChoice, enter: enter, complete: complete };
}());
