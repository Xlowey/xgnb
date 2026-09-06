(function () {
  "use strict";

  var user = MuseumAuth.getCurrentUser();
  if (!user) { window.location.href = "login.html?next=novel"; return; }
  var state = MuseumState.load(user.id) || MuseumState.create(user);
  var params = new URLSearchParams(window.location.search);
  var requestedScene = params.get("scene");
  var currentSceneId = requestedScene || state.narrativeNode || "note-intro";
  var currentScene;
  var index = Number(state.narrativeIndex) || 0;
  var endingChoice = null;
  var els = {
    location: document.getElementById("novel-location"), title: document.getElementById("novel-title"), subtitle: document.getElementById("novel-subtitle"),
    choices: document.getElementById("novel-choices"), dialogue: document.getElementById("novel-dialogue"), speaker: document.getElementById("novel-speaker"),
    text: document.getElementById("novel-text"), next: document.getElementById("novel-next"), progress: document.getElementById("novel-progress"), toast: document.getElementById("novel-toast"),
    end: document.getElementById("novel-end"), endTitle: document.getElementById("novel-end-title"), endDescription: document.getElementById("novel-end-description"),
    review: document.getElementById("novel-review"), reviewList: document.getElementById("novel-review-list")
  };

  function line(speaker, text) { return { speaker: speaker || "旁白", text: text }; }
  var scenes = {
    "note-intro": {
      title: "员工宿舍 · 床边", subtitle: "第一夜 · 规则记录", location: "员工宿舍 · 床边",
      lines: [line("旁白", "你在床沿摸到一张折过两次的纸。纸面没有署名，字迹却像刚写下不久。"), line("你", "我不是杀人魔……那个梦是假的？"), line("MOSS", "检测到有效线索。建议记住：远离红制服，不要相信馆长，不要观看录像。"), line("旁白", "纸条背面还有一行几乎被擦掉的小字：钥匙在黑色制服里。")],
      choices: [{ id: "remember", label: "把规则记下来" }, { id: "leave", label: "先放回原处" }]
    },
    "note-repeat": {
      title: "员工宿舍 · 床边", subtitle: "已经读过的记录", location: "员工宿舍 · 床边",
      lines: [line("旁白", "床边只剩下一道被压平的痕迹。你已经把纸条上的字记在脑中。")]
    },
    "wardrobe-clue": {
      title: "员工宿舍 · 衣柜", subtitle: "钥匙的气味混着潮湿的蜡", location: "员工宿舍 · 衣柜",
      lines: [line("旁白", "衣柜里挂着两套尺寸相同的制服。红色那套散发着潮湿的蜡味。"), line("MOSS", "发现可疑物件。黑色制服夹层内有金属碰撞声。"), line("你", "这把钥匙，应该能打开宿舍门。")],
      choices: [{ id: "take-key", label: "取出钥匙" }, { id: "wait", label: "暂时不动" }]
    },
    "wardrobe-repeat": {
      title: "员工宿舍 · 衣柜", subtitle: "留下的制服", location: "员工宿舍 · 衣柜",
      lines: [line("旁白", "衣柜门敞开着，里面只剩两套制服。藏在黑色制服夹层里的钥匙已经被你取走。")]
    },
    "terminal": {
      title: "员工宿舍 · 旧电视", subtitle: "系统已绑定", location: "员工宿舍 · 旧电视",
      lines: [line("旁白", "电视没有接通电源，屏幕上却浮出一行蓝色的字：系统已绑定。"), line("MOSS", "欢迎，天选者。请从最容易理解的地方开始调查。"), line("旁白", "蓝光熄灭，房间又只剩下老旧电流的嗡鸣。")]
    },
    "mirror": {
      title: "员工宿舍 · 镜子", subtitle: "镜面比房间慢半拍", location: "员工宿舍 · 镜子",
      lines: [line("旁白", "镜子里的你慢了半拍才抬起头。身后没有人，镜面里却多了一扇门。"), line("你", "门后会是什么？")]
    },
    "guard-intro": {
      title: "中央大厅 · 无脸保安", subtitle: "第一幕 · 规则交涉", location: "中央大厅 · 值班台",
      lines: [line("旁白", "红制服员工挡住了通往东侧的路。他没有五官，却像在对你微笑。"), line("MOSS", "建议：观察目标，再决定是否与其交涉。")],
      choices: [{ id: "battle", label: "进入规则型回合交涉" }, { id: "avoid", label: "先绕开他" }]
    },
    "guard-repeat": {
      title: "中央大厅 · 无脸保安", subtitle: "交涉已经留下结果", location: "中央大厅 · 值班台",
      lines: [line("无脸保安", "你已经证明自己会观察。去蜡像馆吧，那里藏着真正的规则。")]
    },
    "guard-after-battle": {
      title: "中央大厅 · 交涉之后", subtitle: "规则没有告诉你全部答案", location: "中央大厅 · 值班台",
      lines: [line("旁白", "无脸保安退到阴影里，手中的钥匙落在地上。东侧蜡像馆的门锁随之松开。"), line("MOSS", "交涉结果已记录。你没有选择最短路径。"), line("你", "如果规则也会撒谎，那我只能继续自己找答案。")]
    },
    "contract": {
      title: "蜡像馆 · 张明诚展台", subtitle: "第二幕 · 半张契约", location: "蜡像馆 · 张明诚展台",
      lines: [line("旁白", "展台里的蜡像和你的宿舍拥有同一张脸。底座刻着：张明诚，死于 1997 年 7 月 31 日。"), line("你", "如果他已经死了，赵灵又是谁？"), line("MOSS", "信息不足。建议前往出口，执行生存率最高的方案。")],
      choices: [{ id: "take-contract", label: "取出半张契约" }, { id: "leave", label: "先离开展台" }]
    },
    "contract-repeat": {
      title: "蜡像馆 · 张明诚展台", subtitle: "已经取走的契约", location: "蜡像馆 · 张明诚展台",
      lines: [line("旁白", "展台底部的半张契约已经被你收好。纸边残留着一枚红色印章。")]
    },
    "ending-choice": {
      title: "蜡像馆 · 出口", subtitle: "终幕 · 选择你愿意相信的答案", location: "蜡像馆 · 出口",
      lines: [line("旁白", "出口就在前方。赵灵的声音从雾里传来，像一段快要断掉的录音。"), line("MOSS", "检测到安全路径。离开此处，生存率 99.8%。")],
      choices: [{ id: "escape", label: "执行最优解，独自离开" }, { id: "turn-back", label: "拒绝建议，回头寻找赵灵" }, { id: "understand", label: "带着契约，追问真相" }]
    },
    "ending-escape": {
      ending: true, endingId: "escape", title: "结局一 · 雾外的生还者", subtitle: "你把门关在了身后", location: "蜡像馆 · 出口",
      lines: [line("旁白", "你沿着 MOSS 标出的安全路径穿过雾。门外没有掌声，只有清晨冷得发白的街道。"), line("MOSS", "生存率确认。你选择了离开。"), line("旁白", "身后的博物馆重新亮起灯，像从未有人进去过。")]
    },
    "ending-turn-back": {
      ending: true, endingId: "turn-back", title: "结局二 · 回声中的赵灵", subtitle: "你没有把同伴留在雾里", location: "蜡像馆 · 旧展厅",
      lines: [line("旁白", "你转身走回展厅。赵灵的声音从一具没有五官的蜡像里传出，叫出了你的名字。"), line("赵灵", "谢谢你没有相信那条最容易的路。"), line("旁白", "契约在你手中发热，博物馆的地图开始改写。出口仍在，但故事没有结束。")]
    },
    "ending-understand": {
      ending: true, endingId: "understand", title: "结局三 · 契约的另一面", subtitle: "你把答案留在了馆内", location: "蜡像馆 · 契约展台",
      lines: [line("旁白", "你把半张契约贴回展台。缺失的另一半从蜡像胸口浮现，写着你的名字。"), line("MOSS", "身份匹配完成。你不是来参观的，你是下一位记录者。"), line("旁白", "红制服员工摘下空白面具。雾合拢之前，你听见博物馆向你合上门。")]
    }
  };

  function save() {
    if (state.mode !== "ending") state.mode = "novel";
    state.narrativeNode = currentSceneId;
    state.narrativeIndex = index;
    state.narrativeChoice = endingChoice;
    MuseumState.save(state, user.id);
  }
  function saveEnding() {
    state.mode = "ending";
    state.narrativeNode = currentSceneId;
    state.narrativeIndex = index;
    state.narrativeChoice = endingChoice;
    state.ending = currentScene.endingId || state.ending;
    MuseumState.save(state, user.id);
  }
  function showEndingScreen() {
    els.endTitle.textContent = currentScene.title;
    els.endDescription.textContent = "这个结局已记录到当前档案。你可以保存后回到主菜单，也可以稍后从存档继续回顾。";
    els.end.hidden = false;
  }
  function toast(message) { els.toast.textContent = message; els.toast.hidden = false; window.clearTimeout(toast.timer); toast.timer = window.setTimeout(function () { els.toast.hidden = true; }, 2200); }
  function addLog(lineData) {
    var key = currentSceneId + ":" + index;
    if (state.narrativeLogKeys.indexOf(key) !== -1) return;
    state.narrativeLogKeys.push(key);
    state.dialogueLog.push({ location: currentScene.location, speaker: lineData.speaker, text: lineData.text, readAt: new Date().toISOString() });
    if (state.dialogueLog.length > 300) state.dialogueLog.splice(0, state.dialogueLog.length - 300);
  }
  function render() {
    var item = currentScene.lines[index] || line("旁白", "");
    els.location.textContent = currentScene.location || currentScene.title;
    els.title.textContent = currentScene.title;
    els.subtitle.textContent = currentScene.subtitle || "";
    els.speaker.textContent = item.speaker || "旁白";
    els.text.textContent = item.text || "";
    els.progress.textContent = (index + 1) + " / " + currentScene.lines.length;
    els.next.textContent = index < currentScene.lines.length - 1 ? "点击继续　◆" : (currentScene.choices && currentScene.choices.length ? "请选择行动" : "剧情结束");
    addLog(item); save();
    els.choices.textContent = "";
    var showChoices = index >= currentScene.lines.length - 1 && currentScene.choices && currentScene.choices.length;
    els.choices.hidden = !showChoices;
    if (showChoices) currentScene.choices.forEach(function (choice) { var button = document.createElement("button"); button.type = "button"; button.className = "novel-choice"; button.textContent = choice.label; button.addEventListener("click", function (event) { event.stopPropagation(); choose(choice.id); }); els.choices.appendChild(button); });
  }
  function applyChoice(choiceId) {
    state.narrativeChoice = choiceId;
    if (currentSceneId === "note-intro" && choiceId === "remember") { state.flags.readNote = true; if (state.clues.indexOf("blood-note") === -1) state.clues.push("blood-note"); state.systemTrust += 3; state.task = "调查衣柜，寻找能打开宿舍门的东西。"; }
    if (currentSceneId === "wardrobe-clue" && choiceId === "take-key") { state.flags.cabinetKeyTaken = true; state.flags.hasKey = true; if (state.inventory.indexOf("dorm-key") === -1) state.inventory.push("dorm-key"); if (state.clues.indexOf("wardrobe-key") === -1) state.clues.push("wardrobe-key"); state.task = "带着钥匙离开宿舍，去中央大厅。"; }
    if (currentSceneId === "contract" && choiceId === "take-contract") { state.flags.foundContract = true; state.flags.understoodTruth = true; if (state.clues.indexOf("contract") === -1) state.clues.push("contract"); state.task = "前往出口，做出最后的选择。"; }
  }
  function choose(choiceId) {
    applyChoice(choiceId);
    if (currentSceneId === "guard-intro" && choiceId === "battle") {
      state.returnRoom = state.roomId; state.returnX = state.playerX; state.returnY = state.playerY; state.returnFacing = state.facing; state.mode = "battle"; MuseumState.save(state, user.id); window.location.href = "../demos/battle/index.html?from=novel&user=" + encodeURIComponent(user.id); return;
    }
    if (currentSceneId === "guard-intro" && choiceId === "avoid") { state.task = "调查大厅里的值班告示。"; finishToMap(); return; }
    if (currentSceneId === "ending-choice") { currentSceneId = "ending-" + choiceId; currentScene = scenes[currentSceneId]; index = 0; endingChoice = choiceId; state.ending = choiceId; window.history.replaceState({}, "", "?scene=" + encodeURIComponent(currentSceneId)); render(); return; }
    if (currentSceneId === "note-intro" || currentSceneId === "wardrobe-clue" || currentSceneId === "contract") { finishToMap(); return; }
    render();
  }
  function finishToMap() { state.mode = "explore"; state.narrativeNode = null; state.narrativeIndex = 0; state.narrativeChoice = null; state.playerX = Number(state.returnX) || state.playerX; state.playerY = Number(state.returnY) || state.playerY; MuseumState.save(state, user.id); window.location.href = "../index.html?fromStory=1"; }
  function completeEnding() { state.endingComplete = true; saveEnding(); showEndingScreen(); }
  function advance() { if (els.choices.hidden === false) return; if (index < currentScene.lines.length - 1) { index += 1; render(); } else if (currentScene.ending) completeEnding(); else finishToMap(); }
  function showReview() { els.reviewList.textContent = ""; var log = state.dialogueLog || []; if (!log.length) { els.reviewList.textContent = "还没有读过文本。"; } else log.forEach(function (entry) { var item = document.createElement("article"); item.className = "novel-review-item"; item.innerHTML = "<strong></strong><small></small><p></p>"; item.querySelector("strong").textContent = entry.speaker || "旁白"; item.querySelector("small").textContent = entry.location || "未知地点"; item.querySelector("p").textContent = entry.text || ""; els.reviewList.appendChild(item); }); els.review.hidden = false; }
  function loadSaved() { var loaded = MuseumState.load(user.id); if (!loaded) { toast("当前没有可读取的自动存档。"); return; } state = loaded; if (state.mode === "novel" || state.mode === "ending") { currentSceneId = state.narrativeNode || currentSceneId; currentScene = scenes[currentSceneId] || scenes["note-intro"]; index = Number(state.narrativeIndex) || 0; endingChoice = state.narrativeChoice || state.ending; els.end.hidden = true; render(); if (state.mode === "ending" && currentScene.ending) showEndingScreen(); toast("已读取剧情存档。"); } else { window.location.href = "../index.html?fromSave=1"; } }
  function toMenu() { if (state.mode === "ending") saveEnding(); else save(); window.location.href = "../index.html?fromMenu=1"; }

  currentScene = scenes[currentSceneId] || scenes["note-intro"];
  if (state.narrativeNode === currentSceneId && state.mode === "novel") index = Math.min(Math.max(index, 0), currentScene.lines.length - 1); else index = 0;
  document.getElementById("novel-dialogue").addEventListener("click", advance);
  document.getElementById("novel-dialogue").addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); advance(); } });
  document.getElementById("novel-review-button").addEventListener("click", showReview);
  document.getElementById("novel-review-close").addEventListener("click", function () { els.review.hidden = true; });
  els.review.addEventListener("click", function (event) { if (event.target === els.review) els.review.hidden = true; });
  document.getElementById("novel-save-button").addEventListener("click", function () { save(); toast("剧情已保存。"); });
  document.getElementById("novel-load-button").addEventListener("click", loadSaved);
  document.getElementById("novel-menu-button").addEventListener("click", toMenu);
  document.getElementById("novel-end-save").addEventListener("click", function () { saveEnding(); toast("结局已保存。"); });
  document.getElementById("novel-end-menu").addEventListener("click", function () { saveEnding(); window.location.href = "../index.html?fromEnding=1"; });
  document.addEventListener("keydown", function (event) { if (event.key === "Escape") { if (!els.review.hidden) els.review.hidden = true; else toMenu(); } });
  render();
}());
