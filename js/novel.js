(function () {
  "use strict";

  var user = MuseumAuth.getCurrentUser();
  if (!user) {
    window.location.href = "login.html?next=novel";
    return;
  }

  var state = MuseumState.load(user.id) || MuseumState.create(user);
  var story = window.MuseumStory;
  var params = new URLSearchParams(window.location.search);
  var currentSceneId = params.get("scene") || state.narrativeNode || story.fallback;
  var currentScene = getScene(currentSceneId);
  var lineIndex = Number(state.narrativeIndex) || 0;
  var endingChoice = state.narrativeChoice || state.ending || null;
  var finalChoiceTimer = null;
  var finalChoiceSeconds = 15;

  var els = {
    location: document.getElementById("novel-location"),
    title: document.getElementById("novel-title"),
    subtitle: document.getElementById("novel-subtitle"),
    choices: document.getElementById("novel-choices"),
    dialogue: document.getElementById("novel-dialogue"),
    speaker: document.getElementById("novel-speaker"),
    text: document.getElementById("novel-text"),
    next: document.getElementById("novel-next"),
    progress: document.getElementById("novel-progress"),
    toast: document.getElementById("novel-toast"),
    end: document.getElementById("novel-end"),
    endTitle: document.getElementById("novel-end-title"),
    endDescription: document.getElementById("novel-end-description"),
    review: document.getElementById("novel-review"),
    reviewList: document.getElementById("novel-review-list")
  };

  function getScene(sceneId) {
    return story.scenes[sceneId] || story.scenes[story.fallback];
  }

  function currentLine() {
    return currentScene.lines[lineIndex] || { speaker: "旁白", text: "" };
  }

  function displayText(value) {
    var name = state.characterName || state.playerName || "玩家";
    return String(value || "").replace(/\{\{playerName\}\}/g, name);
  }

  function displaySpeaker(value) {
    var name = state.characterName || state.playerName || "主角";
    return String(value || "旁白").replace(/^主角/, name);
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () { els.toast.hidden = true; }, 2200);
  }

  function markSceneRead() {
    if (currentScene.flag) state.flags[currentScene.flag] = true;
  }

  function saveNovelState() {
    if (state.mode !== "ending") state.mode = "novel";
    markSceneRead();
    state.narrativeNode = currentSceneId;
    state.narrativeIndex = lineIndex;
    state.narrativeChoice = endingChoice;
    MuseumState.save(state, user.id);
  }

  function saveEnding() {
    state.mode = "ending";
    markSceneRead();
    state.narrativeNode = currentSceneId;
    state.narrativeIndex = lineIndex;
    state.narrativeChoice = endingChoice;
    state.ending = currentScene.endingId || endingChoice || state.ending;
    state.endingComplete = true;
    MuseumState.save(state, user.id);
  }

  function addLog(line) {
    var key = currentSceneId + ":" + lineIndex;
    var keys = state.narrativeLogKeys || [];
    if (keys.indexOf(key) !== -1) return;
    keys.push(key);
    state.narrativeLogKeys = keys;
    state.dialogueLog = state.dialogueLog || [];
    state.dialogueLog.push({
      location: currentScene.location || currentScene.title,
      speaker: displaySpeaker(line.speaker),
      text: displayText(line.text),
      readAt: new Date().toISOString()
    });
    if (state.dialogueLog.length > 300) state.dialogueLog.splice(0, state.dialogueLog.length - 300);
  }

  function clearChoices() {
    if (finalChoiceTimer) {
      window.clearInterval(finalChoiceTimer);
      finalChoiceTimer = null;
    }
    els.choices.textContent = "";
    els.choices.hidden = true;
  }

  function armFinalChoiceTimer() {
    if (currentSceneId !== "scene-31" || finalChoiceTimer) return;
    var remaining = finalChoiceSeconds;
    els.next.textContent = "请选择行动 · " + remaining + " 秒";
    finalChoiceTimer = window.setInterval(function () {
      remaining -= 1;
      els.next.textContent = "请选择行动 · " + Math.max(remaining, 0) + " 秒";
      if (remaining <= 0) {
        window.clearInterval(finalChoiceTimer);
        finalChoiceTimer = null;
        var timeoutChoice = currentScene.choices && currentScene.choices.filter(function (choice) { return choice.id === "ending-d"; })[0];
        if (timeoutChoice) choose(timeoutChoice);
      }
    }, 1000);
  }

  function renderNamePrompt() {
    els.choices.textContent = "";
    els.choices.hidden = false;

    var label = document.createElement("label");
    label.className = "novel-name-label";
    label.textContent = currentScene.namePromptLabel || "请输入本次故事使用的名字";
    label.setAttribute("for", "novel-character-name");

    var input = document.createElement("input");
    input.id = "novel-character-name";
    input.className = "novel-name-input";
    input.type = "text";
    input.maxLength = 12;
    input.placeholder = "输入 1—12 个字";
    input.value = state.characterName || "";

    var submit = document.createElement("button");
    submit.type = "button";
    submit.className = "novel-choice";
    submit.textContent = "确认名字";
    submit.addEventListener("click", function () {
      var value = input.value.trim();
      if (!value) {
        input.focus();
        showToast("请先输入一个名字。");
        return;
      }
      state.characterName = value;
      state.flags.playerNamed = true;
      clearChoices();
      saveNovelState();
      advance();
    });

    els.choices.appendChild(label);
    els.choices.appendChild(input);
    els.choices.appendChild(submit);
    input.focus();
  }

  function renderChoices() {
    clearChoices();
    var lastLine = lineIndex >= currentScene.lines.length - 1;
    if (!lastLine) return;
    if (currentScene.namePrompt && !state.characterName) {
      renderNamePrompt();
      return;
    }
    if (!Array.isArray(currentScene.choices) || !currentScene.choices.length) return;

    els.choices.hidden = false;
    currentScene.choices.forEach(function (choice) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "novel-choice";
      button.textContent = choice.label;
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        choose(choice);
      });
      els.choices.appendChild(button);
    });
    armFinalChoiceTimer();
  }

  function render() {
    var line = currentLine();
    els.location.textContent = currentScene.location || currentScene.title;
    els.title.textContent = currentScene.title;
    els.subtitle.textContent = currentScene.subtitle || "";
    els.speaker.textContent = displaySpeaker(line.speaker);
    els.text.textContent = displayText(line.text);
    els.progress.textContent = (lineIndex + 1) + " / " + currentScene.lines.length;
    els.next.textContent = lineIndex < currentScene.lines.length - 1 ? "点击继续　◆" : (currentScene.choices ? "请选择行动" : "剧情结束");
    addLog(line);
    saveNovelState();
    renderChoices();
  }

  function applyChoice(choice) {
    endingChoice = choice.id;
    if (choice.effect === "read-note") {
      state.flags.readNote = true;
      state.systemTrust += 3;
      if (state.clues.indexOf("blood-note") === -1) state.clues.push("blood-note");
      state.task = "调查衣柜，寻找能打开宿舍门的东西。";
    }
    if (choice.effect === "take-key") {
      state.flags.cabinetKeyTaken = true;
      state.flags.hasKey = true;
      if (state.inventory.indexOf("dorm-key") === -1) state.inventory.push("dorm-key");
      if (state.clues.indexOf("wardrobe-key") === -1) state.clues.push("wardrobe-key");
      state.task = "带着钥匙离开宿舍，去中央大厅。";
    }
    if (choice.effect === "find-contract-clue") {
      state.flags.foundContract = true;
      if (state.clues.indexOf("contract") === -1) state.clues.push("contract");
    }
    if (choice.id === "remove-mask" || choice.id === "reveal-name") state.flags.removedMask = true;
    if (choice.id === "keep-mask" || choice.id === "keep-name-secret") state.flags.remainedMasked = true;
    if (["ending-a", "ending-b", "ending-c", "ending-d"].indexOf(choice.id) !== -1) state.ending = choice.id;
  }

  function loadScene(sceneId) {
    currentSceneId = sceneId;
    currentScene = getScene(sceneId);
    lineIndex = 0;
    endingChoice = currentScene.endingId || endingChoice;
    els.end.hidden = true;
    window.history.replaceState({}, "", "?scene=" + encodeURIComponent(sceneId));
    render();
  }

  function startBattle(choice) {
    state.returnRoom = state.returnRoom || state.roomId;
    state.returnX = state.returnX || state.playerX;
    state.returnY = state.returnY || state.playerY;
    state.returnScene = choice.afterBattle || "guard-after-battle";
    state.mode = "battle";
    state.narrativeNode = state.returnScene;
    MuseumState.save(state, user.id);
    window.location.href = "../demos/battle/index.html?from=novel&user=" + encodeURIComponent(user.id);
  }

  function choose(choice) {
    applyChoice(choice);
    if (choice.action === "battle") {
      startBattle(choice);
      return;
    }
    if (choice.nextScene) {
      loadScene(choice.nextScene);
      return;
    }
    finishToMap();
  }

  function finishToMap() {
    state.mode = "explore";
    state.narrativeNode = null;
    state.narrativeIndex = 0;
    state.narrativeChoice = null;
    state.returnScene = null;
    if (state.returnRoom) state.roomId = state.returnRoom;
    if (state.returnX !== null) state.playerX = Number(state.returnX) || state.playerX;
    if (state.returnY !== null) state.playerY = Number(state.returnY) || state.playerY;
    if (state.returnFacing) state.facing = state.returnFacing;
    state.returnRoom = null;
    state.returnX = null;
    state.returnY = null;
    state.returnFacing = "down";
    MuseumState.save(state, user.id);
    window.location.href = "../index.html?fromStory=1";
  }

  function showEndingScreen() {
    var descriptions = {
      "ending-a": "你选择回头。这个结局已记录到当前档案。",
      "ending-b": "你执行了系统建议。这个结局已记录到当前档案。",
      "ending-c": "你拒绝了最优解。这个结局已记录到当前档案。",
      "ending-d": "选择超时，生命体征归零。这个结局已记录到当前档案。",
      "ending-e": "你回到了最近的存档点。这个结局已记录到当前档案。"
    };
    els.endTitle.textContent = currentScene.title;
    els.endDescription.textContent = descriptions[currentScene.endingId] || "这个结局已记录到当前档案。";
    els.end.hidden = false;
  }

  function completeEnding() {
    saveEnding();
    showEndingScreen();
  }

  function advance() {
    if (!els.choices.hidden) return;
    if (lineIndex < currentScene.lines.length - 1) {
      lineIndex += 1;
      render();
      return;
    }
    if (currentScene.namePrompt && !state.characterName) {
      renderNamePrompt();
      return;
    }
    if (currentScene.nextScene) {
      loadScene(currentScene.nextScene);
      return;
    }
    if (currentScene.ending) completeEnding();
    else finishToMap();
  }

  function showReview() {
    els.reviewList.textContent = "";
    var log = state.dialogueLog || [];
    if (!log.length) {
      els.reviewList.textContent = "还没有读过文本。";
    } else {
      log.forEach(function (entry) {
        var item = document.createElement("article");
        item.className = "novel-review-item";
        var speaker = document.createElement("strong");
        speaker.textContent = entry.speaker || "旁白";
        var location = document.createElement("small");
        location.textContent = entry.location || "未知地点";
        var text = document.createElement("p");
        text.textContent = entry.text || "";
        item.appendChild(speaker);
        item.appendChild(location);
        item.appendChild(text);
        els.reviewList.appendChild(item);
      });
    }
    els.review.hidden = false;
  }

  function loadSaved() {
    var loaded = MuseumState.load(user.id);
    if (!loaded) {
      showToast("当前没有可读取的自动存档。");
      return;
    }
    state = loaded;
    if (state.mode === "novel" || state.mode === "ending") {
      currentSceneId = state.narrativeNode || story.fallback;
      currentScene = getScene(currentSceneId);
      lineIndex = Math.min(Math.max(Number(state.narrativeIndex) || 0, 0), Math.max(0, currentScene.lines.length - 1));
      endingChoice = state.narrativeChoice || state.ending || null;
      render();
      if (state.mode === "ending" && currentScene.ending) showEndingScreen();
      showToast("已读取剧情存档。");
    } else {
      window.location.href = "../index.html?fromSave=1";
    }
  }

  function toMenu() {
    if (state.mode === "ending") saveEnding();
    else saveNovelState();
    window.location.href = "../index.html?fromMenu=1";
  }

  els.dialogue.addEventListener("click", advance);
  els.dialogue.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      advance();
    }
  });
  document.getElementById("novel-review-button").addEventListener("click", showReview);
  document.getElementById("novel-review-close").addEventListener("click", function () { els.review.hidden = true; });
  els.review.addEventListener("click", function (event) { if (event.target === els.review) els.review.hidden = true; });
  document.getElementById("novel-save-button").addEventListener("click", function () { saveNovelState(); showToast("剧情已保存。"); });
  document.getElementById("novel-load-button").addEventListener("click", loadSaved);
  document.getElementById("novel-menu-button").addEventListener("click", toMenu);
  document.getElementById("novel-end-save").addEventListener("click", function () { saveEnding(); showToast("结局已保存。"); });
  document.getElementById("novel-end-menu").addEventListener("click", function () { saveEnding(); window.location.href = "../index.html?fromEnding=1"; });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (!els.review.hidden) els.review.hidden = true;
    else toMenu();
  });

  if (state.narrativeNode === currentSceneId && (state.mode === "novel" || state.mode === "ending")) {
    lineIndex = Math.min(Math.max(lineIndex, 0), Math.max(0, currentScene.lines.length - 1));
  } else {
    lineIndex = 0;
  }
  render();
}());
