(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var preview = params.get("preview") === "1";
  var previewResume = preview && params.get("resume") === "1";

  /*
   * 【剧情测试开关】用 URL 参数打开，跳过战斗 / 追逐直接看后面的戏。
   *
   *   pages/novel.html?scene=scene-27-boss&autoWin=boss       最终战按「打倒首领」结算 → C 结局
   *   pages/novel.html?scene=scene-27-boss&autoWin=evacuate   最终战按「撤离试炼」结算 → A 结局
   *   pages/novel.html?scene=scene-11&autoWin=1               普通战斗也直接判胜
   *   pages/novel.html?scene=scene-26&autoWin=1               森林极速跑也直接判胜
   *
   * 做法与 `xgnb-无BOSS战` 那个测试副本一致：**不打开任何小游戏**，直接写一份「打赢」的
   * 结果再跳回主页面，走 game.js 原有的 applyBattleResult / applyRunnerResult ——
   * 所以旗标、生存点、接哪一场都和真打赢一模一样，不会出现「测试档和真档不一样」。
   *
   * **刻意用 URL 参数、不改源码常量**：常量迟早有人把它留在 true 上提交进去
   * （那个测试副本就是这么来的）。参数不会有这个问题。
   */
  var autoWin = String(params.get("autoWin") || "");

  // 控制台开关：已经玩到一半才想跳过时，改 URL 要重新加载，不方便。
  // 在剧情页的 DevTools 里敲一句 `MuseumDebug.autoWin()`，然后**照常点「迎战梦魇」**即可
  // ——和 URL 参数走的是同一条路（见下面 autoWinMode 的用法）。
  // 传 'evacuate' 就是按撤离试炼结算（→ A 结局）。
  var devAutoWin = "";
  function autoWinMode() { return devAutoWin || autoWin; }
  window.MuseumDebug = {
    autoWin: function (route) {
      devAutoWin = String(route || "boss");
      console.log("[dev] 下一场战斗 / 追逐将直接判胜：" + (devAutoWin === "evacuate" ? "最终战按「撤离试炼」→ A 结局" : "按「打倒首领」→ C 结局"));
      return devAutoWin;
    },
    off: function () { devAutoWin = ""; console.log("[dev] 已关闭直接判胜"); },
  };

  /*
   * 【开发快捷键】Shift + A / B / C / D → 直接跳到对应结局，方便逐段看结局文本。
   *
   * 和 MuseumDebug.autoWin 的分工：
   *   autoWin      跳过战斗，但**保持剧情流程**（旗标、生存点都按真打赢算）
   *   这个快捷键    直接跳结局场景，**不写存档**，纯看文本
   *
   * 为什么不用 Ctrl+Shift：Ctrl+Shift+B（书签栏）、+C（检查元素）、+D（把所有标签页
   * 加书签）都是 Chrome 的**浏览器级**快捷键，页面拦不住，按下去浏览器先响应。
   * Shift + 字母没有这个冲突。代价是"正在输入框里打字"时会误触，所以下面挡掉了输入框。
   *
   * E 没放进来：009 里 E 是预留的、没有成稿路线，跳过去只会看到空场景。
   */
  document.addEventListener("keydown", function (event) {
    if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    var target = event.target;
    if (target && (/INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable)) return;
    // 探索场里 Shift 是"1.5 倍疾跑"的修饰键（Shift + WASD）。这个监听在捕获阶段，
    // 一旦吃掉 Shift+A / Shift+D，探索那边（冒泡阶段）就收不到、疾跑时没法左右走。
    // 所以探索进行中直接让路。
    if (document.body.dataset.event === "explore") return;
    // 有弹窗挡着时也不跳，否则会在背包 / 系统面板 / 成就 / 存档框中途换页。
    if (window.MuseumStage && window.MuseumStage.isOpen()) return;
    var key = String(event.key || "").toLowerCase();
    if (key.length !== 1 || "abcd".indexOf(key) < 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    console.log("[dev] 跳到 ending-" + key);
    window.location.href = "novel.html?scene=ending-" + key;
  }, true);
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
  var endingFlow = window.MuseumEndingFlow;
  var pendingDeath = false;
  var settlingPreview = false;
  function unlockAchievement(id, persistNow) {
    if (!state || !window.MuseumAchievements) return false;
    return window.MuseumAchievements.unlock(state, id, { save: persistNow ? persist : function () {} });
  }
  function syncAchievementProgress() {
    if (!state || !window.MuseumAchievements) return;
    window.MuseumAchievements.setProgress(state, "clue-collector", state.clues.length, { save: function () {} });
    window.MuseumAchievements.setProgress(state, "area-explorer", state.unlockedRooms.length, { save: function () {} });
  }
  function persist() {
    try {
      if (settlingPreview) return true;
      syncAchievementProgress();
      if (preview) { sessionStorage.setItem("museum_class_preview", JSON.stringify(state)); return true; }
      var saved = MuseumState.saveGuarded(state, user.id);
      return saved !== false && saved !== "stale";
    } catch (error) {
      console.warn("剧情存档写入失败。", error);
      return false;
    }
  }
  // 人性值归零、且身上没有【回滚】时的去处（013 §二：归零 = 完全怪谈化 → 结局 D）。
  // 由 js/humanity.js 的 settleZero() 通过 bind 的 onZero 回调触发。
  //
  // A terminal outcome must stop the current scene before its normal nextScene
  // can run. The local transition below also preserves preview state.
  function goEndingD() {
    if (!state || pendingDeath || (currentScene && currentScene.ending)) return;
    pendingDeath = true;
    state.flags.endingCause = "humanity";
    if (settlingPreview) return;
    pausePlayback();
    // Finish settlement first; callers must not advance past a terminal outcome.
    window.setTimeout(function () { pendingDeath = false; loadScene("ending-d"); }, 0);
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
    if (document.hidden || pendingDeath || !els.pause.hidden || !els.review.hidden || !els.end.hidden || stage.isOpen()) return;
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
  window.MuseumPoints.bind({getState:function(){return state;},save:persist});
  if (window.MuseumHumanity) window.MuseumHumanity.bind({getState:function(){return state;},save:persist,onZero:goEndingD});
  window.MuseumPanel.bind({getState:function(){return state;},save:persist,canOpen:function(){return els.review.hidden && els.end.hidden && els.pause.hidden && !stage.isOpen();},onOpen:pausePlayback,onClose:function(){schedulePlayback();}});
  window.MuseumShop.bind({getState:function(){return state;},save:persist});
  var panelButton = document.getElementById("novel-panel-button");
  if (panelButton) panelButton.addEventListener("click", function () { window.MuseumPanel.open(); });

  // 浮层焦点管理：剧情暂停与文本回顾原先打开后焦点留在工具栏，Tab 会跑到浮层背后。
  if (window.MuseumFocus) {
    window.MuseumFocus.mark(els.pause, { initial: "#novel-resume-button" });
    window.MuseumFocus.mark(els.review, { initial: "#novel-review-close" });
  }

  function getScene(sceneId) {
    var scene = story.scenes[sceneId] || story.scenes[story.fallback];
    // 不摘面具路线不会获得“渣男”记忆。场景 25 是地图重新进入的独立
    // 场次，不能只修 scene-16-no-mask，否则玩家后面仍会从纸片独白里
    // 重新看到同一段回忆。
    if (sceneId === "scene-23" && state.flags.remainedMasked && !state.flags.removedMask) {
      var variant = Object.assign({}, scene);
      variant.lines = (scene.lines || []).filter(function (line) {
        return !/渣男|以前是不是见过|看到你的样子之后/.test(String(line.text || ""));
      });
      if (scene.events) {
        variant.events = scene.events.filter(function (event) {
          return !/渣男|以前是不是见过|看到你的样子之后/.test(String(event.text || ""));
        });
      }
      return variant;
    }
    return scene;
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

  // System notices used to be marked only in the handful of scenes that were
  // converted to `events` by chapter-story.js.  Later scenes still keep their
  // authored lines array, so the same MOSS/system speaker fell through to the
  // ordinary bottom dialogue box.  Keep the classification at the page
  // boundary so every source shape (events or lines) uses the same renderer.
  function isSystemSpeaker(value) {
    return /MOSS|系统/.test(String(value || ""));
  }

  function buildPages(scene) {
    var pages = [];
    if (scene.events) {
      scene.events.forEach(function (event, index) {
        var normalized = Object.assign({}, event, { sourceIndex: index });
        // A legacy event may still say "dialogue" even though its speaker is
        // MOSS.  Normalize it before splitting so the stage can render the
        // blue system panel instead of the bottom dialogue box.
        if (isSystemSpeaker(normalized.speaker) && (!normalized.type || normalized.type === "dialogue")) normalized.type = "system";
        if (normalized.type === "dialogue") splitNarrativeText(normalized.text).forEach(function (text) { pages.push(Object.assign({},normalized,{text:text})); });
        else pages.push(normalized);
      });
      return pages;
    }
    (scene.lines || []).forEach(function (line, sourceIndex) {
      if (/^\s*[△▲▼▽]/.test(line.text)) return;
      splitNarrativeText(line.text).forEach(function (text) {
        var page = { speaker: line.speaker, text: text, sourceIndex: sourceIndex };
        if (isSystemSpeaker(line.speaker)) page.type = "system";
        pages.push(page);
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
    // 原来这里会剥掉「第二周剧本 · 」前缀——那是剧本还按「周」组织时留下的代码标签。
    // 2026-09-19 起数据里已无这个字符串（副标题改成 009 的幕名），剥离逻辑随之删除。
    return String(value || currentScene.title || "剧情").trim();
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
  // main script.  scene-08 is excluded for the same reason it always was: its
  // completion is decided by the branch scene, not by the parent dialogue.
  function isReplayScene(id) {
    return id === "scene-08" || /(?:-repeat|-inspect)$/.test(id) || id === "mirror";
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
      unlockAchievement("blood-note", false);
    }
    if (currentSceneId === "scene-04") unlockAchievement("corridor-meeting", false);
    if (/^scene-08-[a-d]$/.test(currentSceneId)) unlockAchievement("director-talk", false);
    if (currentSceneId === "scene-15-diary") unlockAchievement("diary-reader", false);
    syncAchievementProgress();
    // 012 §4.2：一场结束就结算里程碑（每日存活、以及挂在场次旗标上的成就条件）。
    // 放在函数最后——上面各分支写的旗标这一轮扫描就都看得到。settle 是幂等的。
    if (window.MuseumMilestones) window.MuseumMilestones.settle(state);
    // 013 §3.1：时间流逝（每过一天 −10）与线索回血也挂在场次旗标上，同一轮扫掉。
    if (window.MuseumHumanity && !currentScene.ending) window.MuseumHumanity.settle(state);
    return !pendingDeath;
  }

  function saveEnding() {
    if (!currentScene.ending || lineIndex < currentPages.length - 1) return false;
    var before = JSON.parse(JSON.stringify(state));
    endingFlow.complete(state, currentScene.endingId);
    markSceneRead();
    state.narrativeNode = currentSceneId;
    state.narrativeIndex = lineIndex;
    state.narrativeChoice = endingChoice;
    unlockAchievement("first-ending", false);
    window.MuseumAchievements.setProgress(state, "ending-collector", MuseumState.collectedEndingCount(state), { save: function () {} });
    if (persist()) return true;
    Object.assign(state, before);
    return false;
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
    if ((currentSceneId !== "scene-29" && currentSceneId !== "ending-choice") || finalChoiceTimer || els.choices.hidden) return;
    if (finalChoiceRemaining === null) finalChoiceRemaining = finalChoiceSeconds;
    els.next.hidden = false;
    eventNext.hidden = true;
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
          || (currentSceneId === "scene-29" || currentSceneId === "ending-choice" ? { id: "ending-d", nextScene: "ending-d" } : null);
        if (timeoutChoice) { state.flags.endingCause = "timeout"; choose(timeoutChoice); }
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

    // A choice can be gated on progress. Unknown gates are logged rather than silently
    // ignored, so a typo cannot quietly change a route.
    var offered = currentScene.choices.filter(function (choice) {
      if (!choice.availableIf) return true;
      console.warn("未知的 availableIf 取值，已按可用处理：" + choice.availableIf + "（选项 " + choice.id + "）");
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

  var sfxPage = null;
  function render() {
    pausePlayback();
    window.MuseumInventory.refresh();
    window.MuseumAchievements.refresh();
    var line = currentLine();
    var soundPage = currentSceneId + ":" + lineIndex;
    if (sfxPage !== soundPage && line.type === "system" && window.MuseumSfx) window.MuseumSfx.play("system");
    sfxPage = soundPage;
    els.location.textContent = displayLocation(currentScene.location || currentScene.title);
    els.title.textContent = currentScene.title;
    els.subtitle.textContent = currentScene.subtitle || "";
    els.speaker.textContent = displaySpeaker(line.speaker);
    els.dialogue.classList.toggle("is-system", line.type === "system" || isSystemSpeaker(line.speaker));
    startTextReveal(displayText(line.text));
    document.body.dataset.theme = currentScene.theme || "dorm";
    var briefing = document.getElementById("novel-briefing");
    briefing.hidden = !currentScene.briefing;
    briefing.textContent = currentScene.briefing ? currentScene.briefing.join("\n") : "";
    var inspection = document.getElementById("novel-inspection");
    inspection.hidden = !currentScene.inspection;
    if (currentScene.inspection) {
      inspection.querySelector("img").src = window.MuseumAssets ? window.MuseumAssets.url("wardrobe-detail.webp","items") : "../assets/images/items/closeups/wardrobe-detail.webp";
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
    // Plain line-based scenes also contain system notices.  Pass those pages
    // to the stage so they get the same top system-message treatment as event
    // based scenes; ordinary dialogue still leaves the event layer empty.
    stage.render((currentScene.events || line.type === "system") ? line : null, {
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
    // skip-nightmare（不进入小游戏，直接去出口）已于 2026-09-20 取消：
    // 玩家现在**必须**进地牢，A/C 在地牢内部的两条路线里分。这里原来的处理器
    // 一并删掉，避免留下死代码。老存档里已有的 nightmareMinigameChoice === "skip"
    // 不受影响——resolveChoice 只对 "enter" 分支特判，其余一律落到 ending-a。
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
    if (choice.id === "remove-mask" || choice.id === "reveal-name") state.flags.removedMask = true;
    if (choice.id === "keep-mask" || choice.id === "keep-name-secret") state.flags.remainedMasked = true;
    if (["ending-a", "ending-b", "ending-c", "ending-d"].indexOf(choice.id) !== -1) state.ending = choice.id;
  }

  function loadScene(sceneId) {
    pausePlayback();clearChoices();
    if(window.MuseumSfx)window.MuseumSfx.play("transition");
    endingFlow.enter(state, sceneId);
    currentSceneId = sceneId;
    currentScene = getScene(sceneId);
    currentPages = buildPages(currentScene);
    lineIndex = 0;
    endingChoice = currentScene.endingId || endingChoice;
    els.end.hidden = true;
    // 场次级默认曲（没标 bgm 的场一律回默认曲）。放在这里是为了兜住"从结局页读旧档"
    // 那条路：否则在结局 C 的曲子下读一份中场存档，那首会一直播下去。
    if (window.MuseumAudio && window.MuseumAudio.play) window.MuseumAudio.play(currentScene.bgm || "main");
    window.history.replaceState({}, "", "?scene=" + encodeURIComponent(sceneId) + (preview ? "&preview=1&resume=1" : ""));
    render();
  }

  function startBattle(choice) {
    var beforeBattle=JSON.parse(JSON.stringify(state));
    if (choice.battleContext === "final-boss") {
      state.flags.nightmareMinigameChoice = "enter";
      state.flags.nightmareMinigameWon = false;
      // 最终战发生在食堂内部，胜利后必须从博物馆大门继续，而不是回到
      // 进入剧情前的食堂出生点。
      state.returnRoom = "museum";
      state.returnX = 610;
      state.returnY = 620;
      state.battleContext = "final-boss";
    } else {
      state.returnRoom = state.returnRoom || state.roomId;
      state.returnX = state.returnX == null ? state.playerX : state.returnX;
      state.returnY = state.returnY == null ? state.playerY : state.returnY;
      state.battleContext = null;
    }
    state.returnScene = choice.afterBattle || "guard-after-battle";
    state.battleAttempt = {
      id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2),
      source: choice.demo === "pixel-dungeon" ? "pixel-dungeon" : "battle",
      retryScene: currentSceneId, retryIndex: lineIndex, returnScene: state.returnScene
    };
    state.mode = "battle";
    state.narrativeNode = state.returnScene;
    if (!persist()) { Object.assign(state,beforeBattle); render(); showToast("保存失败，暂未进入战斗，请重试。"); return; }
    // 【剧情测试开关】跳过战斗：直接写一份「打赢」的结果，剩下的交给主页面原有结算。
    // 放在 persist() 之后是**故意的**：state.battleAttempt 已经落盘，结算校验才认得这份结果。
    if (autoWinMode()) {
      var auto = {
        status: "win",
        remainingHp: state.hp,   // 没打，血是满的
        hitsTaken: 0,            // 一次没挨打；但 013 的公式仍会按「基础 14」扣一场正常损耗
        coins: 0,
        liveCoins: true,         // 跳过战斗自然没有金币；标成"已处理"，结算端不会再算一遍
        battleAttempt: state.battleAttempt.id,
        source: choice.demo === "pixel-dungeon" ? "pixel-dungeon" : "battle",
        userId: user.id
      };
      // 最终战有两条通关路线，用参数挑一条——A / C 两个结局要分别试。
      if (choice.battleContext === "final-boss") auto.route = autoWinMode() === "evacuate" ? "evacuate" : "boss";
      try { (preview ? sessionStorage : localStorage).setItem("museum_pending_battle_v1", JSON.stringify(auto)); } catch (error) { /* 存储不可用也不能卡住 */ }
      window.location.href = preview
        ? "novel.html?scene=" + encodeURIComponent(state.returnScene) + "&preview=1&resume=1"
        : "../index.html?fromBattle=1";
      return;
    }
    // 最终 boss 战走像素地牢（demos/pixel-dungeon-html），普通交涉走回合制 demo。
    // 两边与主游戏的约定完全一样（写法相同：写 museum_pending_battle_v1 后回
    // index.html?fromBattle=1），所以 game.js 的结算逻辑不用分叉。
    var demo = choice.demo === "pixel-dungeon" ? "pixel-dungeon-html" : "battle";
    var battleUrl = "../demos/" + demo + "/index.html?from=novel&user=" + encodeURIComponent(user.id) + "&returnScene=" + encodeURIComponent(state.returnScene);
    battleUrl += "&battleAttempt=" + encodeURIComponent(state.battleAttempt.id);
    // 暗影地牢的叠加式道具（012 §5.6 的 01/02/05）把已购件数带过去，由地牢自己乘上单份效果。
    // 回合制 demo（demos/battle）不用这套参数。
    if (choice.demo === "pixel-dungeon" && window.MuseumShopData) {
      var dungeonParams = window.MuseumShopData.dungeonParams(state.shopOwned);
      if (dungeonParams) battleUrl += "&" + dungeonParams;
    }
    // 战斗类（012 §5.1）作用于回合制那场，同样把已购件数带过去。
    if (choice.demo !== "pixel-dungeon" && window.MuseumShopData) {
      var battleParams = window.MuseumShopData.battleParams(state.shopOwned);
      if (battleParams) battleUrl += "&" + battleParams;
    }
    if (preview) battleUrl += "&preview=1&resume=1";
    window.location.href = battleUrl;
  }

  /*
   * 森林极速跑（demos/forest-speed-run）的发起。与 startBattle 走**完全相同的一套**：
   * 深拷贝快照 → 写 attempt → 落盘（失败就回滚并中止跳转）→ 跳转到 demo。
   *
   * 两处不同：
   *   1. 结果通道是 museum_pending_runner_v1，不是战斗那个 key —— 战斗的胜利分支
   *      会发无脸面具、解锁蜡像馆，追逐不该拿到那些东西（见 game.js 的 settleBattleWin）。
   *   2. 带上商店那 4 件追逐向道具折算出的参数（012 §5.6 的 07/08/09/10）。
   */
  function startRunner(choice) {
    var before = JSON.parse(JSON.stringify(state));
    state.returnRoom = state.returnRoom || state.roomId;
    state.returnX = state.returnX == null ? state.playerX : state.returnX;
    state.returnY = state.returnY == null ? state.playerY : state.returnY;
    state.returnScene = choice.afterRunner || "scene-27";
    state.runnerAttempt = {
      id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2),
      retryScene: currentSceneId, retryIndex: lineIndex, returnScene: state.returnScene
    };
    state.mode = "runner";
    state.narrativeNode = state.returnScene;
    if (!persist()) { Object.assign(state, before); render(); showToast("保存失败，暂未进入追逐，请重试。"); return; }
    // 【剧情测试开关】跳过追逐，同 startBattle —— 走主页面原有的 applyRunnerResult。
    if (autoWinMode()) {
      var autoRun = {
        status: "win", elapsed: 0, score: 0, distance: 0, coins: 0, wallHits: 0,
        liveCoins: true,   // 跳过追逐没有金币，标成"已处理"
        userId: user.id, runId: state.runnerAttempt.id, kind: "museum-runner", version: 1
      };
      try { (preview ? sessionStorage : localStorage).setItem("museum_pending_runner_v1", JSON.stringify(autoRun)); } catch (error) { /* 存储不可用也不能卡住 */ }
      window.location.href = preview
        ? "novel.html?scene=" + encodeURIComponent(state.returnScene) + "&preview=1&resume=1"
        : "../index.html?fromRunner=1";
      return;
    }
    var runnerUrl = "../demos/forest-speed-run/index.html?from=novel&user=" + encodeURIComponent(user.id)
      + "&runId=" + encodeURIComponent(state.runnerAttempt.id)
      + "&returnScene=" + encodeURIComponent(state.returnScene)
      + "&cancelScene=" + encodeURIComponent(currentSceneId)
      + "&" + window.MuseumShopData.runnerParams(state.shopOwned);
    if (preview) runnerUrl += "&preview=1&resume=1";
    window.location.href = runnerUrl;
  }

  function choose(choice) {
    if (pendingDeath) return;
    choice = endingFlow.resolveChoice(state, choice);
    if (choice.nextScene === "scene-27-boss" && choice.id === "scene-27-boss") {
      loadScene("scene-27-boss");
      showToast("上次的梦魇挑战尚未完成，请重新选择行动。");
      return;
    }
    if (!window.MuseumTutorial.isDone("branch")) window.MuseumTutorial.complete("branch");
    // A battle choice must NOT complete the scene yet: doing so awarded scene11Seen and
    // completed:scene-11 the moment 战斗 was clicked, so losing the fight still unlocked
    // scene-10. The outcome is decided by the battle itself, and the after-battle scene
    // (scene-11-after / guard-after-battle) is what records the completion.
    if (choice.action !== "battle" && choice.action !== "runner" && !completeCurrentScene()) return;
    applyChoice(choice);
    clearChoices();
    if (choice.effect === "take-key") { persist(); render(); showToast("获得物品：宿舍钥匙"); return; }
    if (choice.action === "battle") {
      startBattle(choice);
      return;
    }
    if (choice.action === "runner") {
      startRunner(choice);
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
    if(!persist()){Object.assign(state,before);showToast("保存失败，请重试后再返回地图。");return;}
    if(window.MuseumSfx)window.MuseumSfx.queueTransition();
    window.location.href = "../index.html?fromStory=1";
  }

  function showEndingScreen() {
    pausePlayback();
    var card=els.end.querySelector(".novel-end-card");
    var art=card.querySelector(".ending-art");
    if(currentScene.endArt){
      if(!art){art=document.createElement("img");art.className="ending-art";card.prepend(art);}
      art.src=window.MuseumAssets.url(currentScene.endArt,"cg");art.alt=currentScene.title;
    }else if(art)art.remove();
    var descriptions = {
      "ending-a": "你选择回头。这个结局已记录到当前档案。",
      "ending-b": "你执行了系统建议。这个结局已记录到当前档案。",
      "ending-c": "你拒绝了最优解。这个结局已记录到当前档案。",
      "ending-d": state.flags.endingCause === "humanity" ? "人性值归零，你成为了怪谈的一部分。这个结局已记录到当前档案。" : "出口关闭了。这个结局已记录到当前档案。",
      "ending-e": "你回到了最近的存档点。这个结局已记录到当前档案。"
    };
    els.endTitle.textContent = currentScene.title;
    els.endDescription.textContent = descriptions[currentScene.endingId] || "这个结局已记录到当前档案。";
    els.end.hidden = false;
  }

  function completeEnding() {
    if (!saveEnding()) { showToast("结局保存失败，请重试。"); return; }
    showEndingScreen();
  }

  function advance() {
    if (pendingDeath || !els.pause.hidden || !els.review.hidden || !els.end.hidden || stage.isOpen() || !eventAdvance) return;
    if (!automatic && els.choices.hidden && window.MuseumSfx) window.MuseumSfx.play("advance");
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
    if (!completeCurrentScene()) return;
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
    var previousState=state;state=loaded;
    if (!preview) MuseumState.adoptRevision(user.id, state);
    if(!persist()){state=previousState;return false;}
    pausePlayback();clearChoices();els.end.hidden=true;els.review.hidden=true;
    if (state.mode === "novel" || state.mode === "ending") {
      currentSceneId = state.narrativeNode || story.fallback;
      currentScene = getScene(currentSceneId);
      currentPages = buildPages(currentScene);
      lineIndex = Math.min(Math.max(Number(state.narrativeIndex) || 0, 0), Math.max(0, currentPages.length - 1));
      endingChoice = state.narrativeChoice || state.ending || null;
      window.history.replaceState({}, "", "?scene=" + encodeURIComponent(currentSceneId) + (preview ? "&preview=1&resume=1" : ""));
      render();
      if (endingFlow.isComplete(state, currentSceneId)) showEndingScreen();
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
  els.review.addEventListener("click", function (event) { if (event.target === els.review) { els.review.hidden = true; schedulePlayback(); } });
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

  if (previewResume && state.mode === "battle") {
    var previewBefore = JSON.parse(JSON.stringify(state));
    var previewRaw = sessionStorage.getItem("museum_pending_battle_v1");
    var previewResult = null;
    try { previewResult = JSON.parse(previewRaw); } catch (error) { /* invalid result retries safely */ }
    settlingPreview = true;
    var previewDestination = window.MuseumPreviewBattle.settle(state, previewResult);
    settlingPreview = false;
    pendingDeath = false;
    if (!persist()) {
      Object.assign(state, previewBefore);
      showToast("预览战斗结果未能保存，请刷新页面重试。");
      return;
    }
    if (sessionStorage.getItem("museum_pending_battle_v1") === previewRaw) sessionStorage.removeItem("museum_pending_battle_v1");
    currentSceneId = previewDestination;
    currentScene = getScene(currentSceneId);
    currentPages = buildPages(currentScene);
    lineIndex = Number(state.narrativeIndex) || 0;
    endingChoice = currentScene.endingId || null;
    window.history.replaceState({}, "", "?scene=" + encodeURIComponent(currentSceneId) + "&preview=1&resume=1");
  }
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
  var restoredEnding = endingFlow.isComplete(state, currentSceneId);
  if (!restoredEnding) {
    state.mode = "novel";
    state.endingComplete = false;
    state.ending = currentScene.endingId || null;
  } else {
    lineIndex = Math.max(0, currentPages.length - 1);
  }
  render();
  if (restoredEnding) showEndingScreen();
}());
