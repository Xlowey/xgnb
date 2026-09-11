(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var preview = params.get("preview") === "1";
  var previewResume = preview && params.get("resume") === "1";
  var user = preview ? { id: "class-preview", username: "体验者" } : MuseumAuth.getCurrentUser();
  if (!user) {
    window.location.href = "login.html?next=novel";
    return;
  }

  function readPreviewState() {
    if (!previewResume) return null;
    try {
      var raw = sessionStorage.getItem("museum_class_preview");
      return raw ? JSON.parse(raw) : null;
    } catch (error) { return null; }
  }
  var state = preview ? (readPreviewState() || MuseumState.create(user)) : (MuseumState.load(user.id) || MuseumState.create(user));
  if (previewResume) {
    // The preview battle does not pass through game.js, so finish the small
    // amount of result handling here before showing the continuation scene.
    var previewBattleResult = null;
    try {
      var previewBattleRaw = sessionStorage.getItem("museum_pending_battle_v1");
      previewBattleResult = previewBattleRaw ? JSON.parse(previewBattleRaw) : null;
    } catch (error) { previewBattleResult = null; }
    sessionStorage.removeItem("museum_pending_battle_v1");
    state.mode = "novel";
    state.returnScene = null;
    if (previewBattleResult && previewBattleResult.status === "win") {
      state.flags.battleDemoCompleted = true;
      state.flags.waxDoorUnlocked = true;
      if (state.clues.indexOf("faceless-mask") === -1) state.clues.push("faceless-mask");
      if (state.unlockedRooms.indexOf("wax") === -1) state.unlockedRooms.push("wax");
    }
    if (previewBattleResult && Number.isFinite(Number(previewBattleResult.remainingHp))) state.hp = Math.max(0, Number(previewBattleResult.remainingHp));
    persist();
  }
  function persist() {
    try {
      if (preview) { sessionStorage.setItem("museum_class_preview", JSON.stringify(state)); return true; }
      return MuseumState.save(state, user.id) !== false;
    } catch (error) {
      console.warn("剧情存档写入失败。", error);
      return false;
    }
  }
  var story = window.MuseumStory;
  var currentSceneId = params.get("scene") || state.narrativeNode || story.fallback;
  var currentScene = getScene(currentSceneId);
  var currentPages = buildPages(currentScene);
  var lineIndex = Number(state.narrativeIndex) || 0;
  var endingChoice = state.narrativeChoice || state.ending || null;
  var finalChoiceTimer = null;
  var finalChoiceRemaining = null;
  var finalChoiceSeconds = 15;
  var automatic = false, autoTimer = null, revealTimer = null, revealTextValue = "", revealIndex = 0, revealComplete = true, eventAdvance = true, seenBeforeRender = false;
  var stage = window.MuseumStage;
  var eventNext = document.getElementById("event-next");
  function pausePlayback() {
    window.clearTimeout(autoTimer); autoTimer = null;
    window.clearInterval(revealTimer); revealTimer = null;
    if (finalChoiceTimer) { window.clearInterval(finalChoiceTimer); finalChoiceTimer = null; }
  }
  function finishTextReveal() {
    window.clearInterval(revealTimer); revealTimer = null;
    revealIndex = revealTextValue.length; revealComplete = true;
    if (els && els.text) els.text.textContent = revealTextValue;
    if (automatic && els && els.review && els.review.hidden) schedulePlayback();
  }
  function startTextReveal(value) {
    revealTextValue = String(value || ""); revealIndex = 0; revealComplete = !revealTextValue;
    if (!els || !els.text || revealComplete) { if (els && els.text) els.text.textContent = revealTextValue; return; }
    els.text.textContent = "";
    var cps = 34;
    revealTimer = window.setInterval(function () {
      revealIndex = Math.min(revealTextValue.length, revealIndex + 1);
      els.text.textContent = revealTextValue.slice(0, revealIndex);
      if (revealIndex >= revealTextValue.length) finishTextReveal();
    }, Math.max(16, Math.round(1000 / cps)));
  }
  function resumeTextReveal() {
    if (revealComplete || revealTimer) return;
    els.text.textContent = revealTextValue.slice(0, revealIndex);
    var cps = 34;
    revealTimer = window.setInterval(function () {
      revealIndex = Math.min(revealTextValue.length, revealIndex + 1);
      els.text.textContent = revealTextValue.slice(0, revealIndex);
      if (revealIndex >= revealTextValue.length) finishTextReveal();
    }, Math.max(16, Math.round(1000 / cps)));
  }
  function schedulePlayback() {
    pausePlayback();
    if (!revealComplete) { resumeTextReveal(); return; }
    if (!els.choices.hidden) { startFinalChoiceTimer(); return; }
    if (!automatic || !els.review.hidden || !els.end.hidden || stage.isOpen()) return;
    var line = currentLine();
    if (line.type && line.type !== "dialogue" && line.type !== "system") return;
    autoTimer = window.setTimeout(advance, Math.max(2600, (line.text || "").length * 100));
  }

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
    reviewList: document.getElementById("novel-review-list"),
    pause: document.getElementById("novel-pause"),
    pauseResume: document.getElementById("novel-resume-button"),
    pauseSave: document.getElementById("novel-pause-save"),
    pauseLoad: document.getElementById("novel-pause-load"),
    pauseMenu: document.getElementById("novel-pause-menu")
  };
  window.MuseumTutorial.bind({getState:function(){return state;},save:persist});
  window.MuseumInventory.bind({getState:function(){return state;},save:persist,canOpen:function(){return els.review.hidden && els.end.hidden && els.pause.hidden && !stage.isOpen();},onOpen:function(){pausePlayback();window.MuseumTutorial.complete("inventory");},onClose:function(){schedulePlayback();}});
  window.MuseumAchievements.bind({getState:function(){return state;},save:persist,canOpen:function(){return els.review.hidden && els.end.hidden && els.pause.hidden && !stage.isOpen();},onOpen:pausePlayback,onClose:function(){schedulePlayback();}});

  // 浮层焦点管理：剧情暂停与文本回顾原先打开后焦点留在工具栏，Tab 会跑到浮层背后。
  if (window.MuseumFocus) {
    window.MuseumFocus.mark(els.pause, { initial: "#novel-resume-button" });
    window.MuseumFocus.mark(els.review, { initial: "#novel-review-close" });
  }

  function getScene(sceneId) {
    return story.scenes[sceneId] || story.scenes[story.fallback];
  }

  function cleanNarrativeText(value) {
    return String(value || "")
      .replace(/^\s*△\s*/, "")
      .replace(/^（(?:文字特写|画面|CG|设计分支|如果[^）]*)）\s*/, "")
      .trim();
  }

  function splitNarrativeText(value) {
    var text = cleanNarrativeText(value);
    // Keep each page short enough for both desktop and narrow windows.
    var maxChars = 64;
    var pages = [];
    while (text.length > maxChars) {
      var cut = -1;
      var start = Math.max(28, maxChars - 22);
      for (var i = maxChars - 1; i >= start; i -= 1) {
        if (/[。！？!?；;，,、]/.test(text.charAt(i))) {
          cut = i + 1;
          break;
        }
      }
      if (cut < 1) cut = maxChars;
      pages.push(text.slice(0, cut).trim());
      text = text.slice(cut).trim();
    }
    if (text) pages.push(text);
    return pages.length ? pages : ["..."];
  }

  function buildPages(scene) {
    var pages = [];
    if (scene.events) {
      scene.events.forEach(function (event, index) {
        if (event.type === "dialogue") splitNarrativeText(event.text).forEach(function (text) { pages.push(Object.assign({},event,{text:text,sourceIndex:index})); });
        else pages.push(Object.assign({},event,{sourceIndex:index}));
      });
      return pages;
    }
    (scene.lines || []).forEach(function (line, sourceIndex) {
      if (/^\s*[△▲▼▽]/.test(line.text)) return;
      splitNarrativeText(line.text).forEach(function (text) {
        pages.push({ speaker: line.speaker, text: text, sourceIndex: sourceIndex });
      });
    });
    return pages;
  }

  function currentLine() {
    return currentPages[lineIndex] || { speaker: "旁白", text: "" };
  }

  function displayText(value) {
    var name = state.characterName || state.playerName || "玩家";
    return String(value || "").replace(/\{\{playerName\}\}/g, name);
  }

  function displaySpeaker(value) {
    var name = state.characterName || state.playerName || "主角";
    var speaker = String(value || "旁白").replace(/^主角/, name);
    return /^(画面|舞台说明|场景)/.test(speaker) ? "旁白" : speaker;
  }

  function displayLocation(value) {
    return String(value || currentScene.title || "剧情").replace(/第二周剧本\s*[·・]?\s*/g, "").trim();
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
    state.narrativeNode = currentSceneId;
    state.narrativeIndex = lineIndex;
    state.narrativeChoice = endingChoice;
    state.flags.narrativeTextRevision = story.textRevision;
    return persist();
  }

  function openPauseMenu() {
    if (!els.pause || !els.pause.hidden) return;
    pausePlayback();
    els.pause.hidden = false;
    if (els.pauseResume) els.pauseResume.focus();
  }

  function closePauseMenu() {
    if (!els.pause) return;
    els.pause.hidden = true;
    schedulePlayback();
  }

  // Replayable entries (repeat/inspect aliases, the mirror) show recorded text
  // again.  They must not write a "scene seen" flag, otherwise re-reading a
  // note or re-opening the wardrobe would be recorded as progress through the
  // main script.  scene-09 is excluded for the same reason it always was: its
  // completion is decided by the branch scene, not by the parent dialogue.
  function isReplayScene(id) {
    return id === "scene-09" || /(?:-repeat|-inspect)$/.test(id) || id === "mirror";
  }

  function completeCurrentScene() {
    if (!isReplayScene(currentSceneId)) MuseumState.completeScene(state, currentSceneId);
    if (!isReplayScene(currentSceneId) && currentScene.flag) state.flags[currentScene.flag] = true;
    // The wardrobe scene is the player's first usable progression item. The
    // data file contains the inspection text but no separate choice node, so
    // completing that scene must award the key explicitly; otherwise the
    // newly connected dorm door can never be opened.  Keyed on the real scene
    // id, so re-opening the wardrobe cannot hand out a second key.
    if (currentSceneId === "scene-02" && !state.flags.hasKey) {
      state.flags.cabinetKeyTaken = true;
      state.flags.hasKey = true;
      if (state.inventory.indexOf("dorm-key") === -1) state.inventory.push("dorm-key");
      if (state.clues.indexOf("wardrobe-key") === -1) state.clues.push("wardrobe-key");
      state.task = "调查宿舍里的纸条，确认下一步该怎么走。";
    }
    window.MuseumChapterProgress.complete(state,currentSceneId);
    if (currentSceneId === "scene-03") {
      // Scene 03 is the blood note inside the dorm.  Finishing it must put the
      // player back in the dorm where the story started, so the set objective
      // ("leave through the dorm door") is something the player actually walks.
      // Setting the return point to the museum overview here teleported the
      // player out of the dorm and past the corridor, which is the shortcut
      // map-art.js and chapter-maps.js explicitly removed.  The museum and hall
      // are unlocked by the dorm door, not by reading the note.
      state.flags.prologueComplete = true;
      state.flags.readNote = true;
      state.task = window.MuseumChapterProgress.objective(state).text;
      state.returnRoom = state.returnRoom || "dorm";
    }
  }

  function saveEnding() {
    state.mode = "ending";
    markSceneRead();
    state.narrativeNode = currentSceneId;
    state.narrativeIndex = lineIndex;
    state.narrativeChoice = endingChoice;
    state.ending = currentScene.endingId || endingChoice || state.ending;
    state.endingComplete = true;
    return persist();
  }

  function saveChoiceCheckpoint() {
    if (state.checkpoint && state.checkpoint.sceneId === currentSceneId && Number(state.checkpoint.narrativeIndex) === lineIndex) return true;
    var meta = {
      label: currentScene.title || "重要选择前",
      sceneId: currentSceneId,
      narrativeIndex: lineIndex,
      summary: displayText(currentLine().text || "")
    };
    var result;
    if (preview) {
      try {
        var data = JSON.parse(JSON.stringify(state));
        var savedAt = new Date().toISOString();
        data.savedAt = savedAt;
        data.checkpoint = Object.assign({}, meta, { savedAt: savedAt });
        sessionStorage.setItem("museum_preview_checkpoint", JSON.stringify(data));
        result = data;
      } catch (error) { result = null; }
    } else if (window.MuseumState && typeof window.MuseumState.saveCheckpoint === "function") {
      result = window.MuseumState.saveCheckpoint(state, user.id, meta);
    }
    if (result) {
      state.checkpoint = result.checkpoint;
      return true;
    }
    return false;
  }

  function addLog(line) {
    var key = story.textRevision + ":" + currentSceneId + ":" + lineIndex;
    var keys = state.narrativeLogKeys || [];
    if (keys.indexOf(key) !== -1) return;
    keys.push(key);
    if (!preview && window.MuseumState && window.MuseumState.markRead) window.MuseumState.markRead(user.id, key);
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
    finalChoiceRemaining = null;
  }

  function startFinalChoiceTimer() {
    // The map enters the final decision through the stable alias `ending-choice`.
    // Keep the source id supported for direct testing and old saves as well.
    if ((currentSceneId !== "scene-31" && currentSceneId !== "ending-choice") || finalChoiceTimer || els.choices.hidden) return;
    if (finalChoiceRemaining === null) finalChoiceRemaining = finalChoiceSeconds;
    els.next.textContent = "请选择行动 · " + finalChoiceRemaining + " 秒";
    finalChoiceTimer = window.setInterval(function () {
      finalChoiceRemaining -= 1;
      els.next.textContent = "请选择行动 · " + Math.max(finalChoiceRemaining, 0) + " 秒";
      if (finalChoiceRemaining <= 0) {
        window.clearInterval(finalChoiceTimer);
        finalChoiceTimer = null;
        // 新剧本第三十场：③ 超时未选择 → ending-d。Prefer the authored choice and fall
        // back to it by id, so the timeout still resolves if that option is not offered.
        var offered = currentScene.choices || [];
        var timeoutChoice = offered.filter(function (choice) { return choice.id === "ending-d"; })[0]
          || (currentSceneId === "scene-31" || currentSceneId === "ending-choice" ? { id: "ending-d", nextScene: "ending-d" } : null);
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
    var lastLine = lineIndex >= currentPages.length - 1;
    if (!lastLine) return;
    if (currentScene.namePrompt && !state.characterName) {
      renderNamePrompt();
      return;
    }
    if (!Array.isArray(currentScene.choices) || !currentScene.choices.length) return;

    // A choice can be gated on progress. `availableIf: "notSubmitted"` is the script's
    // rule that submitting the investigation record closes the perfect ending for the
    // rest of the run, so the option must not merely be disabled - it must be gone.
    var offered = currentScene.choices.filter(function (choice) {
      if (choice.availableIf === "notSubmitted" && state.flags.submitted) return false;
      return true;
    });
    if (!offered.length) return;

    els.choices.hidden = false;
    saveChoiceCheckpoint();
    if (!state.flags.tutorialChoiceSaved) {
      state.flags.tutorialChoiceSaved = true;
      saveNovelState();
      showToast("选择前已自动保存。你可以按自己的判断行动。");
    }
    if (!window.MuseumTutorial.isDone("branch")) window.MuseumTutorial.show("branch", { kind: "branch", title: "这里的选择会留下记录", body: "没有选项说明是正确答案。按照你掌握的线索行动，之后仍然可以读取选择前的存档。" });
    offered.forEach(function (choice) {
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
    startFinalChoiceTimer();
  }

  function render() {
    pausePlayback();
    window.MuseumInventory.refresh();
    window.MuseumAchievements.refresh();
    var line = currentLine();
    els.location.textContent = displayLocation(currentScene.location || currentScene.title);
    els.title.textContent = currentScene.title;
    els.subtitle.textContent = currentScene.subtitle || "";
    els.speaker.textContent = displaySpeaker(line.speaker);
    els.dialogue.classList.toggle("is-system", /MOSS|系统/.test(line.speaker));
    startTextReveal(displayText(line.text));
    document.body.dataset.theme = currentScene.theme || "dorm";
    var briefing = document.getElementById("novel-briefing");
    briefing.hidden = !currentScene.briefing;
    briefing.textContent = currentScene.briefing ? currentScene.briefing.join("\n") : "";
    var inspection = document.getElementById("novel-inspection");
    inspection.hidden = !currentScene.inspection;
    if (currentScene.inspection) {
      inspection.querySelector("img").src = window.MuseumAssets ? window.MuseumAssets.url("wardrobe-detail.png","items") : "../assets/images/items/closeups/wardrobe-detail.png";
      inspection.querySelector("img").alt = state.flags.cabinetOpen ? "打开的更衣柜" : "关闭的更衣柜";
      inspection.querySelector("figcaption").textContent = state.flags.hasKey ? "已取得宿舍钥匙" : "更衣柜";
    }
    els.dialogue.hidden = false;
    els.progress.hidden = currentPages.length === 0;
    els.progress.textContent = (lineIndex + 1) + " / " + currentPages.length;
    els.next.textContent = lineIndex < currentPages.length - 1 ? "点击画面 / E 继续　◆" : (currentScene.choices ? "请选择行动" : "剧情结束");
    var pageKey = story.textRevision + ":" + currentSceneId + ":" + lineIndex;
    seenBeforeRender = (state.narrativeLogKeys || []).indexOf(pageKey) !== -1 || (!preview && window.MuseumState.hasRead && window.MuseumState.hasRead(user.id, pageKey));
    if (currentPages.length && (!line.type || line.type === "dialogue")) addLog(line);
    saveNovelState();
    renderChoices();
    if (currentScene.inspection && !state.flags.cabinetOpen) {
      els.choices.textContent = ""; els.choices.hidden = false;
      var open = document.createElement("button");
      open.type = "button"; open.className = "novel-choice"; open.textContent = "打开更衣柜";
      open.addEventListener("click", function () { state.flags.cabinetOpen = true; render(); });
      els.choices.appendChild(open);
    } else if (currentScene.inspection && state.flags.hasKey) {
      els.choices.textContent = ""; els.choices.hidden = true;
    }
    if (!currentPages.length && els.choices.hidden) {
      els.choices.hidden = false;
      var leave = document.createElement("button");
      leave.type = "button"; leave.className = "novel-choice"; leave.textContent = "继续探索";
      leave.addEventListener("click", function () { completeCurrentScene(); finishToMap(); });
      els.choices.appendChild(leave);
    }
    eventAdvance = true;
    var isEvent = line.type && line.type !== "dialogue";
    eventNext.hidden = !isEvent;
    eventNext.disabled = false;eventNext.textContent = line.action || "继续";
    els.speaker.hidden = !!isEvent; els.text.hidden = !!isEvent; els.next.hidden = !!isEvent;
    stage.render(currentScene.events ? line : null, {
      scene:currentScene, state:state, save:persist, advance:advance, pause:pausePlayback, resume:function(){els.dialogue.focus();schedulePlayback();},
      canExplore:function(){return els.review.hidden && els.end.hidden && !stage.isOpen() && els.choices.hidden;},
      setAdvance:function(enabled,label){eventAdvance=enabled;eventNext.hidden=!enabled;if(label)eventNext.textContent=label;}
    });
    window.MuseumPortraits.render(currentScene,line);
    if(line.type === "system") { finishTextReveal(); els.text.textContent = ""; }
    document.getElementById("novel-back-button").disabled = lineIndex === 0;
    schedulePlayback();
    if ((!line.type || line.type === "dialogue") && !window.MuseumTutorial.isDone("dialogue")) window.MuseumTutorial.show("dialogue", { kind: "dialogue", title: "对白可以这样推进", body: "点击屏幕任意空白处，或按 E 继续。第一次推进后，这条提示会消失。" });
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
      state.task = "带着钥匙离开宿舍，穿过走廊前往馆内总览。";
    }
    if (/^office-/.test(choice.id)) {
      state.flags[choice.id] = true;
      if (state.clues.indexOf("peach-dream") === -1) state.clues.push("peach-dream");
    }
    if (choice.effect === "find-contract-clue") {
      state.flags.foundContract = true;
      if (state.clues.indexOf("contract") === -1) state.clues.push("contract");
    }
    // 新剧本第八场：提交调查记录。此后 C 完美结局永久关闭，最终抉择只剩 A / B。
    if (choice.effect === "submit-record") {
      state.flags.submitted = true;
      state.flags.refusedSubmit = false;
      if (state.clues.indexOf("submitted-record") === -1) state.clues.push("submitted-record");
      state.systemTrust += 6;
      state.task = "按系统的安排继续行动。";
    }
    if (choice.id === "remove-mask" || choice.id === "reveal-name") state.flags.removedMask = true;
    if (choice.id === "keep-mask" || choice.id === "keep-name-secret") state.flags.remainedMasked = true;
    if (["ending-a", "ending-b", "ending-c", "ending-d"].indexOf(choice.id) !== -1) state.ending = choice.id;
  }

  function loadScene(sceneId) {
    pausePlayback();clearChoices();
    currentSceneId = sceneId;
    currentScene = getScene(sceneId);
    currentPages = buildPages(currentScene);
    lineIndex = 0;
    endingChoice = currentScene.endingId || endingChoice;
    els.end.hidden = true;
    window.history.replaceState({}, "", "?scene=" + encodeURIComponent(sceneId) + (preview ? "&preview=1" : ""));
    render();
  }

  function startBattle(choice) {
    var beforeBattle=JSON.parse(JSON.stringify(state));
    state.returnRoom = state.returnRoom || state.roomId;
    state.returnX = state.returnX == null ? state.playerX : state.returnX;
    state.returnY = state.returnY == null ? state.playerY : state.returnY;
    state.returnScene = choice.afterBattle || "guard-after-battle";
    state.mode = "battle";
    state.narrativeNode = state.returnScene;
    if (!persist()) { state=beforeBattle; render(); showToast("保存失败，暂未进入战斗，请重试。"); return; }
    var battleUrl = "../demos/battle/index.html?from=novel&user=" + encodeURIComponent(user.id) + "&returnScene=" + encodeURIComponent(state.returnScene);
    if (preview) battleUrl += "&preview=1&resume=1";
    window.location.href = battleUrl;
  }

  function choose(choice) {
    if (!window.MuseumTutorial.isDone("branch")) window.MuseumTutorial.complete("branch");
    // A battle choice must NOT complete the scene yet: doing so awarded scene11Seen and
    // completed:scene-11 the moment 战斗 was clicked, so losing the fight still unlocked
    // scene-12. The outcome is decided by the battle itself, and the after-battle scene
    // (scene-11-after / guard-after-battle) is what records the completion.
    if (choice.action !== "battle") completeCurrentScene();
    applyChoice(choice);
    clearChoices();
    if (choice.effect === "take-key") { persist(); render(); showToast("获得物品：宿舍钥匙"); return; }
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
    if (preview) { window.location.href = "showcase.html"; return; }
    var before=JSON.parse(JSON.stringify(state));
    window.MuseumTransition.leaveStory(state);
    if(!persist()){state=before;showToast("保存失败，请重试后再返回地图。");return;}
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
    if (!els.review.hidden || !els.end.hidden || stage.isOpen() || !eventAdvance) return;
    if (!revealComplete) { finishTextReveal(); schedulePlayback(); return; }
    if (!els.choices.hidden) return;
    if ((!currentLine().type || currentLine().type === "dialogue") && !window.MuseumTutorial.isDone("dialogue")) window.MuseumTutorial.complete("dialogue");
    if (lineIndex < currentPages.length - 1) {
      lineIndex += 1;
      render();
      return;
    }
    if (currentScene.namePrompt && !state.characterName) {
      renderNamePrompt();
      return;
    }
    completeCurrentScene();
    if (currentScene.nextScene) {
      loadScene(currentScene.nextScene);
      return;
    }
    if (currentScene.ending) completeEnding();
    else finishToMap();
  }

  function showReview() {
    pausePlayback();
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

  function openSaves(mode) {
    window.MuseumSaveDialog.open({user:user,preview:preview,state:function(){return state;},save:saveNovelState,pause:pausePlayback,resume:schedulePlayback,load:loadSaved},mode);
  }
  function loadSaved(loaded) {
    pausePlayback();clearChoices();els.end.hidden=true;els.review.hidden=true;
    if (!loaded) {
      showToast("当前没有可读取的剧情存档。");
      return;
    }
    state = loaded;persist();
    if (state.mode === "novel" || state.mode === "ending") {
      currentSceneId = state.narrativeNode || story.fallback;
      currentScene = getScene(currentSceneId);
      currentPages = buildPages(currentScene);
      lineIndex = Math.min(Math.max(Number(state.narrativeIndex) || 0, 0), Math.max(0, currentPages.length - 1));
      endingChoice = state.narrativeChoice || state.ending || null;
      window.history.replaceState({}, "", "?scene=" + encodeURIComponent(currentSceneId) + (preview ? "&preview=1" : ""));
      render();
      if (state.mode === "ending" && currentScene.ending) showEndingScreen();
      showToast("已读取剧情存档。");
    } else {
      window.location.href = "../index.html?fromSave=1";
    }
  }

  function toMenu() {
    if (preview) { window.location.href = "showcase.html"; return; }
    var saved = state.mode === "ending" ? saveEnding() : saveNovelState();
    if (!saved) { showToast("保存失败，请检查浏览器存储空间后重试。"); return; }
    window.location.href = "../index.html?fromMenu=1";
  }

  // Capture eligibility before an investigation or modal click changes the current event.
  document.addEventListener("click", function(event) {
    if (event.button !== 0 || event.defaultPrevented) return;
    if (!els.pause.hidden) return;
    if (event.target.closest('button,a,input,textarea,select,label,[contenteditable="true"],[role="button"],#novel-choices,#novel-review,#novel-end,#item-modal,dialog,.tutorial-cue')) return;
    var inEventLayer = event.target.closest("#scene-events");
    if (inEventLayer && currentLine().type && currentLine().type !== "dialogue" && currentLine().type !== "system") return;
    if (currentLine().type === "explore" || String(window.getSelection()).trim()) return;
    advance();
  }, true);
  els.dialogue.addEventListener("keydown", function (event) {
    if (event.target !== els.dialogue) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      advance();
    }
  });
  document.getElementById("novel-review-button").addEventListener("click", showReview);
  document.querySelector('.novel-toolbar-actions').addEventListener("click",function(e){e.stopPropagation();});
  eventNext.addEventListener("click",function(e){e.stopPropagation();advance();});
  document.getElementById("novel-back-button").addEventListener("click",function(){
    pausePlayback();
    if (lineIndex <= 0) return;
    // Rewind the CURSOR only. This used to restore a whole-state snapshot taken per
    // page, which also rolled back everything the page changed: at scene-05, stepping
    // back after investigating both hotspots reset investigation:hospital:bed and :tv
    // to false, rewound progress to 1/13 and rewrote the auto save with them wiped, so
    // the player had to redo the investigation. Progress belongs to the save, not to
    // the reading position.
    lineIndex -= 1;
    render();
  });
  document.getElementById("novel-auto-button").addEventListener("click",function(){automatic=!automatic;this.setAttribute("aria-pressed",String(automatic));this.textContent=automatic?"自动中":"自动";schedulePlayback();});
  document.getElementById("novel-skip-button").addEventListener("click",function(){
    pausePlayback();var moved=false;
    while (lineIndex<currentPages.length-1 && seenBeforeRender && (!currentLine().type || currentLine().type==="dialogue")) {
      var next=currentPages[lineIndex+1];
      if(next.type && next.type!=="dialogue")break;
      var nextKey=story.textRevision+":"+currentSceneId+":"+(lineIndex+1);
      var knownNext=(state.narrativeLogKeys||[]).indexOf(nextKey)>=0 || (!preview && window.MuseumState.hasRead && window.MuseumState.hasRead(user.id,nextKey));
      if(!knownNext)break;
      lineIndex+=1;moved=true;
    }
    if(moved)render();else showToast("没有可快进的已读对白。");
  });
  document.getElementById("novel-bag-button").addEventListener("click",function(){stage.bag();});
  document.getElementById("novel-achievements-button").addEventListener("click",function(){window.MuseumAchievements.open();});
  document.getElementById("novel-review-close").addEventListener("click", function () { els.review.hidden = true; schedulePlayback(); });
  els.review.addEventListener("click", function (event) { if (event.target === els.review) els.review.hidden = true; });
  document.getElementById("novel-save-button").addEventListener("click",function(){openSaves("save");});
  document.getElementById("novel-load-button").addEventListener("click",function(){openSaves("load");});
  document.getElementById("novel-menu-button").addEventListener("click", toMenu);
  els.pauseResume.addEventListener("click", closePauseMenu);
  els.pauseSave.addEventListener("click", function () { els.pause.hidden = true; openSaves("save"); });
  els.pauseLoad.addEventListener("click", function () { els.pause.hidden = true; openSaves("load"); });
  els.pauseMenu.addEventListener("click", function () { els.pause.hidden = true; toMenu(); });
  els.pause.addEventListener("click", function (event) { if (event.target === els.pause) closePauseMenu(); });
  document.getElementById("novel-end-save").addEventListener("click", function () { if (saveEnding()) showToast("结局已保存。"); else showToast("保存失败，请检查浏览器存储空间后重试。"); });
  document.getElementById("novel-end-menu").addEventListener("click", function () { if (!saveEnding()) { showToast("保存失败，请检查浏览器存储空间后重试。"); return; } window.location.href = "../index.html?fromEnding=1"; });
  document.addEventListener("keydown", function (event) {
    if (event.key.toLowerCase() === "e") {
      if (event.repeat || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
      if (!els.pause.hidden) return;
      if (event.target.closest('input,textarea,select,[contenteditable="true"]') || currentLine().type === "explore") return;
      event.preventDefault();advance();return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    if(stage.isOpen()){stage.close();return;}
    if (!els.review.hidden) {els.review.hidden = true;schedulePlayback();return;}
    if (!els.pause.hidden) {closePauseMenu();return;}
    automatic=false;document.getElementById("novel-auto-button").textContent="自动";document.getElementById("novel-auto-button").setAttribute("aria-pressed","false");
    openPauseMenu();
  });
  document.addEventListener("visibilitychange",function(){if(document.hidden)pausePlayback();else schedulePlayback();});

  if (state.narrativeNode === currentSceneId && (state.mode === "novel" || state.mode === "ending")) {
    lineIndex = Math.min(Math.max(lineIndex, 0), Math.max(0, currentPages.length - 1));
  } else {
    lineIndex = 0;
  }
  if (state.flags.narrativeTextRevision !== story.textRevision) {
    lineIndex = 0;
    var removedPages = [];
    Object.keys(story.productionNotes).forEach(function (id) {
      story.productionNotes[id].forEach(function (note) {
        removedPages = removedPages.concat(splitNarrativeText(note.text));
      });
    });
    state.dialogueLog = (state.dialogueLog || []).filter(function (entry) {
      return !/^\s*[△▲▼▽]/.test(entry.text) && removedPages.indexOf(entry.text) === -1;
    });
    state.narrativeLogKeys = [];
  }
  render();
}());
