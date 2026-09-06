(function () {
  "use strict";

  var currentUser = MuseumAuth.getCurrentUser();
  var state = currentUser ? (MuseumState.load(currentUser.id) || MuseumState.create(currentUser)) : null;
  var BATTLE_RESULT_KEY = "museum_pending_battle_v1";
  var canvas = document.getElementById("explore-canvas");
  var ctx = canvas ? canvas.getContext("2d") : null;
  var miniCanvas = document.getElementById("mini-map");
  var miniCtx = miniCanvas ? miniCanvas.getContext("2d") : null;
  var wardrobeImages = {
    closed: new Image(),
    open: new Image()
  };
  wardrobeImages.closed.src = "assets/images/wardrobe-closed.png";
  wardrobeImages.open.src = "assets/images/wardrobe-open.png";
  var keys = {};
  var heldTouch = null;
  var activeDialogue = null;
  var camera = { x: 0, y: 0 };
  var lastFrame = 0;
  var lastSave = 0;
  var savePanelMode = "save";

  var rooms = {
    dorm: {
      id: "dorm", title: "员工宿舍", chapter: "序章", width: 1500, height: 860, spawn: { x: 300, y: 520 },
      colliders: [{ x: 0, y: 0, w: 1500, h: 34 }, { x: 0, y: 826, w: 1500, h: 34 }, { x: 0, y: 0, w: 34, h: 860 }, { x: 1466, y: 0, w: 34, h: 860 }, { x: 130, y: 125, w: 360, h: 180 }, { x: 620, y: 104, w: 260, h: 100 }, { x: 1040, y: 120, w: 220, h: 200 }, { x: 170, y: 610, w: 310, h: 130 }, { x: 760, y: 610, w: 330, h: 110 }],
      objects: [
        { id: "dorm-note", type: "note", x: 580, y: 458, r: 72, label: "床边纸条" },
        { id: "dorm-wardrobe", type: "wardrobe", x: 1140, y: 420, r: 92, label: "衣柜" },
        { id: "dorm-terminal", type: "terminal", x: 930, y: 475, r: 75, label: "旧电视" },
        { id: "dorm-mirror", type: "mirror", x: 1250, y: 680, r: 70, label: "墙上的镜子" },
        { id: "dorm-door", type: "door", x: 1375, y: 460, r: 82, label: "宿舍门" }
      ]
    },
    hall: {
      id: "hall", title: "中央大厅", chapter: "第一幕", width: 1700, height: 860, spawn: { x: 160, y: 460 },
      colliders: [{ x: 0, y: 0, w: 1700, h: 34 }, { x: 0, y: 826, w: 1700, h: 34 }, { x: 0, y: 0, w: 34, h: 860 }, { x: 1666, y: 0, w: 34, h: 860 }, { x: 170, y: 110, w: 260, h: 170 }, { x: 570, y: 120, w: 280, h: 130 }, { x: 1080, y: 110, w: 320, h: 170 }, { x: 180, y: 640, w: 360, h: 80 }, { x: 1040, y: 630, w: 410, h: 90 }],
      objects: [
        { id: "hall-return", type: "returnDorm", x: 90, y: 460, r: 70, label: "回宿舍" },
        { id: "hall-guard", type: "guard", x: 710, y: 455, r: 100, label: "无脸保安" },
        { id: "hall-rules", type: "rules", x: 1020, y: 360, r: 88, label: "值班告示" },
        { id: "hall-wax-door", type: "waxDoor", x: 1530, y: 455, r: 95, label: "蜡像馆入口" }
      ]
    },
    wax: {
      id: "wax", title: "蜡像馆", chapter: "第二幕", width: 1600, height: 860, spawn: { x: 160, y: 460 },
      colliders: [{ x: 0, y: 0, w: 1600, h: 34 }, { x: 0, y: 826, w: 1600, h: 34 }, { x: 0, y: 0, w: 34, h: 860 }, { x: 1566, y: 0, w: 34, h: 860 }, { x: 170, y: 110, w: 260, h: 160 }, { x: 560, y: 105, w: 300, h: 170 }, { x: 1020, y: 110, w: 310, h: 170 }, { x: 220, y: 650, w: 300, h: 75 }, { x: 710, y: 650, w: 350, h: 75 }, { x: 1200, y: 650, w: 220, h: 75 }],
      objects: [
        { id: "wax-return", type: "returnHall", x: 90, y: 460, r: 70, label: "返回大厅" },
        { id: "wax-contract", type: "contract", x: 690, y: 445, r: 105, label: "张明诚展台" },
        { id: "wax-exit", type: "exit", x: 1480, y: 455, r: 95, label: "出口" }
      ]
    }
  };
  var achievements = [
    { id: "first-explore", name: "第一次调查" },
    { id: "rules-master", name: "规则观察者" },
    { id: "battle-clear", name: "交涉完成" },
    { id: "humanity", name: "人性的选择" }
  ];
  var tasks = {
    dorm: "调查宿舍，寻找离开的办法。",
    hall: "在大厅寻找进入下一处展厅的线索。",
    wax: "调查张明诚的展台，找出这里的真相。"
  };

  var el = {
    auth: document.getElementById("auth-screen"), loginTab: document.getElementById("login-tab"), registerTab: document.getElementById("register-tab"),
    loginForm: document.getElementById("login-form"), registerForm: document.getElementById("register-form"), authMessage: document.getElementById("auth-message"),
    cover: document.getElementById("cover-screen"), game: document.getElementById("game-screen"), coverMessage: document.getElementById("cover-message"),
    currentUser: document.getElementById("current-user-name"), continueButton: document.getElementById("continue-button"),
    canvas: canvas, roomTitle: document.getElementById("room-title"), roomChapter: document.getElementById("room-chapter"), prompt: document.getElementById("interaction-prompt"), toast: document.getElementById("map-toast"), gameMessage: document.getElementById("game-message"),
    hp: document.getElementById("hp-value"), trust: document.getElementById("trust-value"), clues: document.getElementById("clue-value"), task: document.getElementById("task-value"), rooms: document.getElementById("room-list"), achievements: document.getElementById("achievement-list"), achievementCount: document.getElementById("achievement-count"),
    vn: document.getElementById("vn-overlay"), vnLocation: document.getElementById("vn-location"), vnProgress: document.getElementById("vn-progress"), vnPortrait: document.getElementById("vn-portrait"), vnSpeaker: document.getElementById("vn-speaker"), vnText: document.getElementById("vn-text"), vnChoices: document.getElementById("vn-choices"), vnNext: document.getElementById("vn-next"),
    rules: document.getElementById("rules-overlay"), rulesOptions: document.getElementById("rules-options"), rulesFeedback: document.getElementById("rules-feedback"),
    logPanel: document.getElementById("log-panel"), logUserName: document.getElementById("log-user-name"), logList: document.getElementById("dialogue-log-list"),
    savePanel: document.getElementById("save-panel"), savePanelTitle: document.getElementById("save-panel-title"), savePanelMessage: document.getElementById("save-panel-message"), saveUserName: document.getElementById("save-user-name"), saveModeButton: document.getElementById("save-mode-button"), loadModeButton: document.getElementById("load-mode-button"), saveSlotList: document.getElementById("save-slot-list")
  };

  function currentRoom() { return rooms[state && state.roomId] || rooms.dorm; }
  function addUnique(list, value) { if (list.indexOf(value) === -1) list.push(value); }
  function has(list, value) { return list.indexOf(value) !== -1; }
  function markDiscovered(id) { addUnique(state.discovered, id); }
  function addClue(id) { addUnique(state.clues, id); }
  function addItem(id) { addUnique(state.inventory, id); }
  function award(id) { addUnique(state.achievements, id); }
  function showToast(message) { if (!el.toast) return; el.toast.textContent = message; el.toast.classList.add("visible"); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(function () { el.toast.classList.remove("visible"); }, 2600); }
  function save(message) { if (!currentUser || !state) return; MuseumState.save(state, currentUser.id); lastSave = Date.now(); if (message && el.gameMessage) el.gameMessage.textContent = message; refreshContinue(); }
  function refreshContinue() { if (!el.continueButton) return; var ok = currentUser && MuseumState.hasSave(currentUser.id); el.continueButton.disabled = !ok; el.continueButton.classList.toggle("button-primary", Boolean(ok)); }
  function setAuthMode(mode) { var login = mode === "login"; el.loginForm.hidden = !login; el.registerForm.hidden = login; el.loginTab.classList.toggle("active", login); el.registerTab.classList.toggle("active", !login); el.loginTab.setAttribute("aria-selected", String(login)); el.registerTab.setAttribute("aria-selected", String(!login)); el.authMessage.textContent = ""; }
  function showAuth() { el.auth.hidden = false; el.cover.hidden = true; el.game.hidden = true; el.authMessage.textContent = ""; }
  function showCover() { if (!currentUser) return showAuth(); el.auth.hidden = true; el.cover.hidden = false; el.game.hidden = true; el.currentUser.textContent = currentUser.username; refreshContinue(); }
  function showGame() { if (!currentUser) return showAuth(); el.auth.hidden = true; el.cover.hidden = true; el.game.hidden = false; }
  function roomName(id) { return rooms[id] ? rooms[id].title : "未知地点"; }

  function blocked(room, x, y, radius) {
    if (x < radius || y < radius || x > room.width - radius || y > room.height - radius) return true;
    return room.colliders.some(function (rect) { return x + radius > rect.x && x - radius < rect.x + rect.w && y + radius > rect.y && y - radius < rect.y + rect.h; });
  }
  function movePlayer(dx, dy, deltaMs) {
    if (!state || state.mode !== "explore") return;
    var room = currentRoom(); var speed = 235; var len = Math.hypot(dx, dy) || 1; var dt = Math.min(Number(deltaMs) || 16, 50) / 1000; dx = dx / len * speed; dy = dy / len * speed;
    var nextX = state.playerX + dx * dt; var nextY = state.playerY + dy * dt;
    if (!blocked(room, nextX, state.playerY, 22)) state.playerX = nextX;
    if (!blocked(room, state.playerX, nextY, 22)) state.playerY = nextY;
    if (Math.abs(dx) > Math.abs(dy)) state.facing = dx > 0 ? "right" : "left"; else state.facing = dy > 0 ? "down" : "up";
  }
  function playerDirection() {
    var x = 0, y = 0;
    if (keys.ArrowLeft || keys.a) x -= 1; if (keys.ArrowRight || keys.d) x += 1; if (keys.ArrowUp || keys.w) y -= 1; if (keys.ArrowDown || keys.s) y += 1;
    if (heldTouch === "left") x -= 1; if (heldTouch === "right") x += 1; if (heldTouch === "up") y -= 1; if (heldTouch === "down") y += 1;
    return { x: x, y: y };
  }
  function nearestObject() {
    if (!state) return null;
    var room = currentRoom(); var nearest = null; var distance = Infinity;
    room.objects.forEach(function (object) { var d = Math.hypot(state.playerX - object.x, state.playerY - object.y); if (d < object.r && d < distance) { nearest = object; distance = d; } });
    return nearest;
  }
  function interactionHint(object) {
    if (!object) { el.prompt.hidden = true; return; }
    var action;
    if (object.type === "wardrobe") {
      action = state.flags.cabinetOpen ? (state.flags.cabinetKeyTaken ? "调查" : "调查") : "打开";
    } else {
      action = object.type === "door" || object.type === "waxDoor" || object.type === "exit" ? "进入" : "调查";
    }
    el.prompt.textContent = "E　" + action + "「" + object.label + "」"; el.prompt.hidden = false;
  }
  function switchRoom(id, x, y) {
    if (!rooms[id]) return;
    state.roomId = id; state.currentNode = id; state.chapter = rooms[id].chapter; state.playerX = x === undefined ? rooms[id].spawn.x : x; state.playerY = y === undefined ? rooms[id].spawn.y : y; state.mode = "explore"; state.task = tasks[id];
    addUnique(state.unlockedRooms, id); renderAll(); save("已进入" + rooms[id].title + "。");
  }

  function dialogueLines(lines) { return lines.map(function (line) { return typeof line === "string" ? { speaker: "旁白", text: line } : line; }); }
  function openDialogue(config) {
    activeDialogue = { location: config.location || currentRoom().title, lines: dialogueLines(config.lines || []), choices: config.choices || [], index: 0, onChoice: config.onChoice || function () {}, onClose: config.onClose || function () {} };
    state.mode = "dialogue"; el.vn.hidden = false; renderDialogue();
  }
  function renderDialogue() {
    if (!activeDialogue) return;
    var line = activeDialogue.lines[activeDialogue.index] || { speaker: "旁白", text: "" };
    if (!activeDialogue.logged) activeDialogue.logged = {};
    if (!activeDialogue.logged[activeDialogue.index] && line.text) {
      state.dialogueLog.push({ location: activeDialogue.location, speaker: line.speaker || "旁白", text: line.text, readAt: new Date().toISOString() });
      if (state.dialogueLog.length > 300) state.dialogueLog.splice(0, state.dialogueLog.length - 300);
      activeDialogue.logged[activeDialogue.index] = true;
    }
    el.vnLocation.textContent = activeDialogue.location; el.vnProgress.textContent = (activeDialogue.index + 1) + " / " + activeDialogue.lines.length; el.vnSpeaker.textContent = line.speaker || "旁白"; el.vnText.textContent = line.text || "";
    el.vnPortrait.textContent = line.speaker && line.speaker !== "旁白" ? line.speaker.slice(0, 1) : ""; el.vnPortrait.classList.toggle("has-speaker", Boolean(line.speaker && line.speaker !== "旁白"));
    el.vnChoices.textContent = "";
    var last = activeDialogue.index >= activeDialogue.lines.length - 1;
    el.vnNext.hidden = last && activeDialogue.choices.length > 0; el.vnNext.textContent = last ? "关闭　◆" : "继续　◆";
    if (last && activeDialogue.choices.length) activeDialogue.choices.forEach(function (choice) { var button = document.createElement("button"); button.type = "button"; button.className = "vn-choice"; button.textContent = choice.label; button.addEventListener("click", function () { finishDialogue(choice.id); }); el.vnChoices.appendChild(button); });
  }
  function finishDialogue(choiceId) {
    if (!activeDialogue) return;
    var finished = activeDialogue; activeDialogue = null; el.vn.hidden = true; state.mode = "explore"; if (choiceId !== undefined) finished.onChoice(choiceId); else finished.onClose(); renderAll(); save();
  }
  function advanceDialogue() { if (!activeDialogue) return; if (activeDialogue.index < activeDialogue.lines.length - 1) { activeDialogue.index += 1; renderDialogue(); } else if (!activeDialogue.choices.length) finishDialogue(); }

  function openNote() {
    markDiscovered("dorm-note"); award("first-explore");
    if (state.flags.readNote) { openDialogue({ lines: [{ speaker: "旁白", text: "床边只剩下一道被压平的痕迹。你已经把纸条上的字记在脑中。" }] }); return; }
    openDialogue({ location: "员工宿舍 · 床边", lines: [{ speaker: "旁白", text: "你在床沿摸到一张折过两次的纸。纸面没有署名，字迹却像刚写下不久。" }, { speaker: "你", text: "我不是杀人魔……那个梦是假的？" }, { speaker: "MOSS", text: "检测到有效线索。建议记住：远离红制服，不要相信馆长，不要观看录像。" }], choices: [{ id: "remember", label: "把规则记下来" }, { id: "leave", label: "先放回原处" }], onChoice: function (id) { if (id === "remember") { state.flags.readNote = true; addClue("blood-note"); state.systemTrust += 3; state.task = "调查衣柜，寻找能打开宿舍门的东西。"; showToast("已记录血字纸条"); } } });
  }
  function openWardrobe() {
    markDiscovered("dorm-wardrobe");
    if (!state.flags.cabinetOpen) {
      state.flags.cabinetOpen = true;
      showToast("柜门发出轻响。再按 E 调查柜内。");
      save("衣柜已打开。");
      renderAll();
      return;
    }
    if (state.flags.cabinetKeyTaken || state.flags.hasKey) { openDialogue({ location: "员工宿舍 · 衣柜", lines: [{ speaker: "旁白", text: "衣柜门敞开着，里面只剩两套制服。藏在黑色制服夹层里的钥匙已经被你取走。" }] }); return; }
    openDialogue({ location: "员工宿舍 · 衣柜", lines: [{ speaker: "旁白", text: "衣柜里挂着两套尺寸相同的制服。红色那套散发着潮湿的蜡味。" }, { speaker: "MOSS", text: "发现可疑物件。是否取出黑色制服内侧的金属钥匙？" }], choices: [{ id: "take-key", label: "取出钥匙" }, { id: "wait", label: "暂时不动" }], onChoice: function (id) { if (id === "take-key") { state.flags.cabinetKeyTaken = true; state.flags.hasKey = true; addItem("dorm-key"); addClue("wardrobe-key"); state.task = "带着钥匙离开宿舍，去中央大厅。"; showToast("获得：宿舍钥匙"); } } });
  }
  function openTerminal() {
    markDiscovered("dorm-terminal");
    openDialogue({ location: "员工宿舍 · 旧电视", lines: [{ speaker: "旁白", text: "电视没有接通电源，屏幕上却浮出一行蓝色的字：系统已绑定。" }, { speaker: "MOSS", text: "欢迎，天选者。请从最容易理解的地方开始调查。" }] }); state.systemTrust += 2;
  }
  function openMirror() { markDiscovered("dorm-mirror"); openDialogue({ location: "员工宿舍 · 镜子", lines: [{ speaker: "旁白", text: "镜子里的你慢了半拍才抬起头。身后没有人，镜面里却多了一扇门。" }] }); }
  function openGuard() {
    markDiscovered("hall-guard");
    if (state.flags.battleDemoCompleted) { openDialogue({ lines: [{ speaker: "无脸保安", text: "你已经证明自己会观察。去蜡像馆吧，那里藏着真正的规则。" }] }); return; }
    openDialogue({ location: "中央大厅 · 值班台", lines: [{ speaker: "旁白", text: "红制服员工挡住了通往东侧的路。他没有五官，却像在对你微笑。" }, { speaker: "MOSS", text: "建议：观察目标，再决定是否与其交涉。" }], choices: [{ id: "battle", label: "进入规则型回合交涉" }, { id: "avoid", label: "先绕开他" }], onChoice: function (id) { if (id === "battle") goBattle(); } });
  }
  function openRules() {
    if (state.flags.rulesGameCompleted) { showToast("告示上的规则你已经记住了。"); return; }
    state.mode = "mini"; el.rules.hidden = false; el.rulesFeedback.textContent = ""; el.rulesOptions.textContent = "";
    [{ id: "red", text: "远离红色制服的工作人员" }, { id: "smile", text: "面对游客时保持微笑" }, { id: "exit", text: "直接询问工作人员出口" }].forEach(function (option) { var button = document.createElement("button"); button.type = "button"; button.className = "modal-option"; button.textContent = option.text; button.addEventListener("click", function () { if (option.id === "red") { state.flags.rulesGameCompleted = true; addClue("rule-red"); award("rules-master"); state.systemTrust += 4; el.rulesFeedback.textContent = "判断正确。红制服员工的规则暂时可信，去观察他吧。"; state.task = "观察大厅里的红制服员工。"; save(); } else { state.hp = Math.max(0, state.hp - 3); el.rulesFeedback.textContent = "这条信息无法解释纸条中的矛盾。生存点 -3。"; save(); } }); el.rulesOptions.appendChild(button); });
  }
  function openContract() {
    markDiscovered("wax-contract");
    if (state.flags.foundContract) { openDialogue({ lines: [{ speaker: "旁白", text: "展台底部的半张契约已经被你收好。" }] }); return; }
    openDialogue({ location: "蜡像馆 · 张明诚展台", lines: [{ speaker: "旁白", text: "展台里的蜡像和你的宿舍拥有同一张脸。底座刻着：张明诚，死于 1997 年 7 月 31 日。" }, { speaker: "你", text: "如果他已经死了，赵灵又是谁？" }, { speaker: "MOSS", text: "信息不足。建议前往出口，执行生存率最高的方案。" }], choices: [{ id: "take-contract", label: "取出半张契约" }, { id: "leave", label: "先离开展台" }], onChoice: function (id) { if (id === "take-contract") { state.flags.foundContract = true; state.flags.understoodTruth = true; addClue("contract"); award("battle-clear"); state.task = "前往出口，做出最后的选择。"; showToast("获得线索：契约残页"); } } });
  }
  function openExit() {
    if (!state.flags.foundContract) { showToast("出口前的雾太浓了，你还缺少关键线索。"); return; }
    openDialogue({ location: "蜡像馆 · 出口", lines: [{ speaker: "旁白", text: "出口就在前方。赵灵的声音从雾里传来，像一段快要断掉的录音。" }, { speaker: "MOSS", text: "检测到安全路径。离开此处，生存率 99.8%。" }], choices: [{ id: "escape", label: "执行最优解，独自离开" }, { id: "turn-back", label: "拒绝建议，回头寻找赵灵" }, { id: "understand", label: "带着契约，追问真相" }], onChoice: function (id) { state.ending = id; award("humanity"); state.task = "本章结束。可以返回标题或读取其他存档。"; showToast(id === "escape" ? "你选择了离开。" : "你选择了回头。"); } });
  }
  function interact(object) {
    if (!object || !state || state.mode !== "explore") return;
    if (object.type === "note") openNote();
    else if (object.type === "wardrobe") openWardrobe();
    else if (object.type === "terminal") openTerminal();
    else if (object.type === "mirror") openMirror();
    else if (object.type === "door") { if (!state.flags.hasKey) showToast("门锁着。衣柜里也许有能用的东西。"); else { state.flags.openedDormDoor = true; addUnique(state.unlockedRooms, "hall"); switchRoom("hall"); } }
    else if (object.type === "returnDorm") switchRoom("dorm", 1330, 460);
    else if (object.type === "guard") openGuard();
    else if (object.type === "rules") openRules();
    else if (object.type === "waxDoor") { if (!state.flags.battleDemoCompleted) showToast("东侧入口被无形的锁封住了。先完成保安的交涉。"); else { state.flags.waxDoorUnlocked = true; switchRoom("wax"); } }
    else if (object.type === "returnHall") switchRoom("hall", 1550, 455);
    else if (object.type === "contract") openContract();
    else if (object.type === "exit") openExit();
  }
  function goBattle() { if (!currentUser || !state) return; state.returnRoom = state.roomId; state.returnX = state.playerX; state.returnY = state.playerY; save("正在前往交涉现场……"); window.location.href = "demos/battle/index.html?from=game&user=" + encodeURIComponent(currentUser.id); }

  function drawText(text, x, y, size, color, align) { ctx.fillStyle = color; ctx.font = "600 " + size + "px system-ui, sans-serif"; ctx.textAlign = align || "left"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y); }
  function drawFurniture(rect, color, label) { ctx.fillStyle = color; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.strokeStyle = "rgba(25,39,45,.55)"; ctx.lineWidth = 4; ctx.strokeRect(rect.x, rect.y, rect.w, rect.h); if (label) drawText(label, rect.x + rect.w / 2, rect.y + rect.h / 2, 22, "rgba(245,241,232,.82)", "center"); }
  function drawWardrobe(object) {
    var image = state.flags.cabinetOpen ? wardrobeImages.open : wardrobeImages.closed;
    var width = 155;
    var height = 232;
    var x = object.x - width / 2;
    var y = object.y - height / 2;
    if (image.complete && image.naturalWidth) {
      ctx.drawImage(image, x, y, width, height);
    } else {
      drawFurniture({ x: x + 18, y: y + 18, w: width - 36, h: height - 36 }, state.flags.cabinetOpen ? "#3f3836" : "#554943", "");
    }
    if (state.flags.cabinetOpen && !state.flags.cabinetKeyTaken && !state.flags.hasKey) {
      ctx.save();
      ctx.fillStyle = "#d4ad62";
      ctx.strokeStyle = "#5b4027";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(object.x - 8, object.y + 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(object.x - 3, object.y + 7, 22, 6);
      ctx.fillRect(object.x + 13, object.y + 11, 5, 8);
      ctx.restore();
    }
  }
  function drawMiniMap(room) {
    if (!miniCtx || !miniCanvas) return;
    var scaleX = miniCanvas.width / room.width;
    var scaleY = miniCanvas.height / room.height;
    miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    miniCtx.fillStyle = "rgba(20, 31, 35, .94)";
    miniCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);
    miniCtx.fillStyle = "rgba(179, 193, 188, .76)";
    miniCtx.fillRect(4, 4, miniCanvas.width - 8, miniCanvas.height - 8);
    miniCtx.fillStyle = "rgba(38, 55, 62, .88)";
    room.colliders.forEach(function (rect) { miniCtx.fillRect(rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY); });
    room.objects.forEach(function (object) { miniCtx.fillStyle = object.type === "door" || object.type === "waxDoor" || object.type === "exit" ? "#9e6f63" : "#e4c898"; miniCtx.beginPath(); miniCtx.arc(object.x * scaleX, object.y * scaleY, 3, 0, Math.PI * 2); miniCtx.fill(); });
    miniCtx.fillStyle = "#ffffff";
    miniCtx.beginPath(); miniCtx.arc(state.playerX * scaleX, state.playerY * scaleY, 4, 0, Math.PI * 2); miniCtx.fill();
    miniCtx.strokeStyle = "rgba(236, 244, 235, .76)";
    miniCtx.lineWidth = 1;
    miniCtx.strokeRect(4, 4, miniCanvas.width - 8, miniCanvas.height - 8);
  }
  function drawRoom(room) {
    ctx.clearRect(0, 0, canvas.width, canvas.height); camera.x = Math.max(0, Math.min(room.width - canvas.width, state.playerX - canvas.width / 2)); camera.y = Math.max(0, Math.min(room.height - canvas.height, state.playerY - canvas.height / 2)); ctx.save(); ctx.translate(-camera.x, -camera.y);
    ctx.fillStyle = room.id === "wax" ? "#aaa7a2" : "#b8c1bd"; ctx.fillRect(0, 0, room.width, room.height);
    ctx.fillStyle = room.id === "hall" ? "#53616a" : "#6a7778"; ctx.fillRect(0, 0, room.width, 100); ctx.fillStyle = "#8e9793"; ctx.fillRect(0, 100, room.width, room.height - 200);
    ctx.strokeStyle = "rgba(34,52,58,.18)"; ctx.lineWidth = 2; for (var gx = 34; gx < room.width - 34; gx += 54) { ctx.beginPath(); ctx.moveTo(gx, 100); ctx.lineTo(gx, room.height - 34); ctx.stroke(); } for (var gy = 100; gy < room.height - 34; gy += 54) { ctx.beginPath(); ctx.moveTo(34, gy); ctx.lineTo(room.width - 34, gy); ctx.stroke(); }
    ctx.fillStyle = "#26373e"; ctx.fillRect(0, 0, room.width, 34); ctx.fillRect(0, room.height - 34, room.width, 34); ctx.fillRect(0, 0, 34, room.height); ctx.fillRect(room.width - 34, 0, 34, room.height);
    if (room.id === "dorm") { drawFurniture({ x: 130, y: 125, w: 360, h: 180 }, "#51656a", "铁床"); drawFurniture({ x: 620, y: 104, w: 260, h: 100 }, "#44565a", "书桌"); drawFurniture({ x: 170, y: 610, w: 310, h: 130 }, "#667477", "地毯"); drawFurniture({ x: 760, y: 610, w: 330, h: 110 }, "#46565c", "旧沙发"); }
    if (room.id === "hall") { drawFurniture({ x: 170, y: 110, w: 260, h: 170 }, "#465962", "接待台"); drawFurniture({ x: 570, y: 120, w: 280, h: 130 }, "#56656a", "展柜"); drawFurniture({ x: 1080, y: 110, w: 320, h: 170 }, "#4c5a60", "值班台"); drawFurniture({ x: 180, y: 640, w: 360, h: 80 }, "#647073", "长椅"); drawFurniture({ x: 1040, y: 630, w: 410, h: 90 }, "#59676b", "封锁门"); }
    if (room.id === "wax") { drawFurniture({ x: 170, y: 110, w: 260, h: 160 }, "#77736e", "空展台"); drawFurniture({ x: 560, y: 105, w: 300, h: 170 }, "#716d68", "蜡像展台"); drawFurniture({ x: 1020, y: 110, w: 310, h: 170 }, "#77736e", "旧展柜"); }
    room.objects.forEach(function (object) { var nearest = nearestObject(); var nearby = nearest && nearest.id === object.id; ctx.save(); ctx.globalAlpha = nearby ? 1 : .9; if (object.type === "note") { ctx.fillStyle = "#f1e7cd"; ctx.fillRect(object.x - 20, object.y - 15, 40, 30); ctx.strokeStyle = "#765e4c"; ctx.strokeRect(object.x - 20, object.y - 15, 40, 30); } else if (object.type === "wardrobe") { drawWardrobe(object); } else if (object.type === "terminal") { drawFurniture({ x: object.x - 48, y: object.y - 40, w: 96, h: 70 }, "#2b4650", ""); ctx.fillStyle = "#5ba2b8"; ctx.fillRect(object.x - 34, object.y - 28, 68, 40); } else if (object.type === "mirror") { ctx.fillStyle = "#293f48"; ctx.fillRect(object.x - 28, object.y - 55, 56, 110); ctx.strokeStyle = "#d6d2c3"; ctx.lineWidth = 5; ctx.strokeRect(object.x - 28, object.y - 55, 56, 110); } else if (object.type === "door" || object.type === "waxDoor" || object.type === "exit") { var isOpen = object.type === "door" ? state.flags.hasKey : object.type === "waxDoor" ? state.flags.battleDemoCompleted : true; ctx.fillStyle = isOpen ? "#3d6670" : "#5a3f41"; ctx.fillRect(object.x - 32, object.y - 72, 64, 144); ctx.strokeStyle = "#d9c9a9"; ctx.lineWidth = 4; ctx.strokeRect(object.x - 32, object.y - 72, 64, 144); } else if (object.type === "guard") { ctx.fillStyle = "#732f37"; ctx.fillRect(object.x - 25, object.y - 60, 50, 120); ctx.fillStyle = "#e3ded1"; ctx.beginPath(); ctx.arc(object.x, object.y - 82, 28, 0, Math.PI * 2); ctx.fill(); } else if (object.type === "rules") { ctx.fillStyle = "#d7cfbc"; ctx.fillRect(object.x - 50, object.y - 45, 100, 90); ctx.strokeStyle = "#4d5960"; ctx.strokeRect(object.x - 50, object.y - 45, 100, 90); } else if (object.type === "contract") { ctx.fillStyle = "#d8c9aa"; ctx.fillRect(object.x - 40, object.y - 25, 80, 50); ctx.strokeStyle = "#6c4e45"; ctx.strokeRect(object.x - 40, object.y - 25, 80, 50); } else { ctx.fillStyle = "#405057"; ctx.beginPath(); ctx.arc(object.x, object.y, 24, 0, Math.PI * 2); ctx.fill(); } if (nearby) { ctx.strokeStyle = "#b9e4e0"; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(object.x, object.y, 52, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); } drawText(object.label, object.x, object.y + object.r * .62, 18, nearby ? "#19363e" : "rgba(34,47,50,.84)", "center"); ctx.restore(); });
    drawPlayer(); ctx.restore(); drawMiniMap(room);
  }
  function drawPlayer() { var x = state.playerX, y = state.playerY; ctx.save(); ctx.fillStyle = "rgba(20,31,36,.3)"; ctx.beginPath(); ctx.ellipse(x, y + 25, 26, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#253f4a"; ctx.fillRect(x - 17, y - 6, 34, 42); ctx.fillStyle = "#d9c7ae"; ctx.beginPath(); ctx.arc(x, y - 24, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#1e3037"; ctx.beginPath(); ctx.arc(x, y - 29, 19, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#d2c08d"; ctx.fillRect(x - 5, y + 4, 10, 5); ctx.strokeStyle = "#d8e7e0"; ctx.lineWidth = 3; ctx.beginPath(); if (state.facing === "up") { ctx.moveTo(x, y - 45); ctx.lineTo(x, y - 57); } else if (state.facing === "down") { ctx.moveTo(x, y + 40); ctx.lineTo(x, y + 52); } else if (state.facing === "left") { ctx.moveTo(x - 25, y + 10); ctx.lineTo(x - 37, y + 10); } else { ctx.moveTo(x + 25, y + 10); ctx.lineTo(x + 37, y + 10); } ctx.stroke(); ctx.restore(); }

  function renderRooms() { el.rooms.textContent = ""; ["dorm", "hall", "wax"].forEach(function (id) { var button = document.createElement("button"); button.type = "button"; var unlocked = has(state.unlockedRooms, id); button.className = "room-button" + (state.roomId === id ? " current" : ""); button.disabled = !unlocked; button.innerHTML = "<strong>" + roomName(id) + "</strong><small>" + (unlocked ? (state.roomId === id ? "当前位置" : "已探索") : "尚未开放") + "</small>"; if (unlocked) button.addEventListener("click", function () { switchRoom(id); }); el.rooms.appendChild(button); }); }
  function renderStats() { el.hp.textContent = String(state.hp); el.trust.textContent = String(state.systemTrust); el.clues.textContent = String(state.clues.length); el.task.textContent = state.task || tasks[state.roomId] || "继续探索。"; el.achievements.textContent = ""; achievements.forEach(function (item) { var li = document.createElement("li"); li.textContent = item.name; li.className = has(state.achievements, item.id) ? "done" : ""; el.achievements.appendChild(li); }); el.achievementCount.textContent = state.achievements.length + " / " + achievements.length; }
  function renderAll() { if (!state) return; var room = currentRoom(); el.roomTitle.textContent = room.title; el.roomChapter.textContent = room.chapter; renderRooms(); renderStats(); drawRoom(room); interactionHint(nearestObject()); }

  function formatSaveTime(value) { if (!value) return "尚未保存"; var date = new Date(value); return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  function saveSummary(saveState) { if (!saveState) return "空存档位"; return roomName(saveState.roomId || saveState.currentNode) + " · 线索 " + ((saveState.clues || []).length); }
  function makeSlotCard(title, entry, index, auto) { var card = document.createElement("article"); card.className = "save-slot" + (entry ? " occupied" : " empty"); var info = document.createElement("div"); info.className = "save-slot-info"; var heading = document.createElement("strong"); heading.textContent = title; var detail = document.createElement("span"); var slotState = auto ? entry : entry && entry.state; detail.textContent = saveSummary(slotState); var time = document.createElement("small"); time.textContent = entry ? formatSaveTime(entry.savedAt) : "—"; info.appendChild(heading); info.appendChild(detail); info.appendChild(time); card.appendChild(info); var actions = document.createElement("div"); actions.className = "save-slot-actions"; var action = document.createElement("button"); action.type = "button"; action.className = "button button-small"; if (auto) { action.textContent = savePanelMode === "save" ? "当前自动档" : "读取"; action.disabled = savePanelMode === "save" || !entry; action.addEventListener("click", function () { loadSelected(MuseumState.load(currentUser.id), "自动存档"); }); } else if (savePanelMode === "save") { action.textContent = entry ? "覆盖" : "保存"; action.addEventListener("click", function () { if (entry && !window.confirm("确定覆盖存档位 " + (index + 1) + " 吗？")) return; MuseumState.saveSlot(state, currentUser.id, index); el.savePanelMessage.textContent = "已保存到存档位 " + (index + 1) + "。"; renderSavePanel(); }); } else { action.textContent = "读取"; action.disabled = !entry; action.addEventListener("click", function () { loadSelected(MuseumState.loadSlot(currentUser.id, index), "存档位 " + (index + 1)); }); } actions.appendChild(action); if (!auto && entry) { var del = document.createElement("button"); del.type = "button"; del.className = "text-button danger-button"; del.textContent = "删除"; del.addEventListener("click", function () { if (!window.confirm("确定删除存档位 " + (index + 1) + " 吗？")) return; MuseumState.deleteSlot(currentUser.id, index); renderSavePanel(); }); actions.appendChild(del); } card.appendChild(actions); return card; }
  function renderSavePanel() { if (!currentUser) return; el.savePanelTitle.textContent = savePanelMode === "save" ? "保存游戏" : "读取存档"; el.saveModeButton.classList.toggle("active", savePanelMode === "save"); el.loadModeButton.classList.toggle("active", savePanelMode === "load"); el.saveModeButton.setAttribute("aria-selected", String(savePanelMode === "save")); el.loadModeButton.setAttribute("aria-selected", String(savePanelMode === "load")); el.saveSlotList.textContent = ""; el.saveSlotList.appendChild(makeSlotCard("自动存档", MuseumState.load(currentUser.id), -1, true)); MuseumState.listSlots(currentUser.id).forEach(function (entry, index) { el.saveSlotList.appendChild(makeSlotCard("存档位 " + (index + 1), entry, index, false)); }); }
  function openSavePanel(mode) { if (!currentUser) return showAuth(); savePanelMode = mode; if (mode === "save") save(); el.saveUserName.textContent = currentUser.username; el.savePanelMessage.textContent = ""; renderSavePanel(); el.savePanel.hidden = false; }
  function loadSelected(loaded, label) { if (!loaded) { el.savePanelMessage.textContent = "这个存档无法读取。"; return; } state = loaded; state.mode = "explore"; MuseumState.save(state, currentUser.id); el.savePanel.hidden = true; showGame(); renderAll(); showToast("已读取" + label + "。"); }
  function renderLogPanel() {
    if (!currentUser || !el.logList) return;
    el.logUserName.textContent = currentUser.username;
    el.logList.textContent = "";
    if (!state.dialogueLog.length) { var empty = document.createElement("p"); empty.className = "log-empty"; empty.textContent = "还没有读过文本。先去房间里调查一些东西吧。"; el.logList.appendChild(empty); return; }
    state.dialogueLog.forEach(function (entry) { entry = typeof entry === "string" ? { speaker: "旁白", text: entry } : entry; var item = document.createElement("article"); item.className = "log-entry"; var heading = document.createElement("div"); heading.className = "log-entry-heading"; var speaker = document.createElement("strong"); speaker.textContent = entry.speaker || "旁白"; var location = document.createElement("span"); location.textContent = entry.location || "未知地点"; heading.appendChild(speaker); heading.appendChild(location); var text = document.createElement("p"); text.textContent = entry.text || ""; item.appendChild(heading); item.appendChild(text); el.logList.appendChild(item); });
    el.logList.scrollTop = el.logList.scrollHeight;
  }
  function openLogPanel() { if (!currentUser) return showAuth(); renderLogPanel(); el.logPanel.hidden = false; }

  function applyBattleResult(result) { if (!result || !state) return; if (result.status === "win") { state.flags.battleDemoCompleted = true; state.flags.waxDoorUnlocked = true; addClue("faceless-mask"); award("battle-clear"); addUnique(state.unlockedRooms, "wax"); var returnRoom = rooms[state.returnRoom] ? state.returnRoom : "hall"; state.roomId = returnRoom; state.currentNode = returnRoom; state.chapter = rooms[returnRoom].chapter; state.playerX = Number(state.returnX) || rooms[returnRoom].spawn.x; state.playerY = Number(state.returnY) || rooms[returnRoom].spawn.y; state.task = tasks[returnRoom]; openDialogue({ location: "中央大厅 · 交涉之后", lines: [{ speaker: "旁白", text: "无脸保安退到阴影里，手中的钥匙落在地上。东侧蜡像馆的门锁随之松开。" }, { speaker: "MOSS", text: "交涉结果已记录。你没有选择最短路径。" }] }); showToast("交涉完成，蜡像馆入口已解锁。"); } else { state.hp = Math.max(0, Number(result.remainingHp) || 0); showToast("交涉失败，生存点已更新。"); } save(); renderAll(); }
  function consumeBattleResult() { var raw = localStorage.getItem(BATTLE_RESULT_KEY); if (!raw) return null; var result; try { result = JSON.parse(raw); } catch (error) { localStorage.removeItem(BATTLE_RESULT_KEY); return null; } if (result && result.userId && currentUser && result.userId !== currentUser.id) return null; localStorage.removeItem(BATTLE_RESULT_KEY); return result; }

  function frame(timestamp) { if (!lastFrame) lastFrame = timestamp; var delta = timestamp - lastFrame; lastFrame = timestamp; var dir = playerDirection(); if (dir.x || dir.y) movePlayer(dir.x, dir.y, delta); if (state && state.mode === "explore") { interactionHint(nearestObject()); drawRoom(currentRoom()); if (timestamp - lastSave > 6000) save(); } window.requestAnimationFrame(frame); }

  el.loginTab.addEventListener("click", function () { setAuthMode("login"); }); el.registerTab.addEventListener("click", function () { setAuthMode("register"); }); document.getElementById("show-register-button").addEventListener("click", function () { setAuthMode("register"); }); document.getElementById("show-login-button").addEventListener("click", function () { setAuthMode("login"); });
  el.loginForm.addEventListener("submit", function (event) { event.preventDefault(); var result = MuseumAuth.login(document.getElementById("login-username").value, document.getElementById("login-password").value); if (!result.ok) { el.authMessage.textContent = result.message; return; } currentUser = result.user; state = MuseumState.load(currentUser.id) || MuseumState.create(currentUser); el.loginForm.reset(); showCover(); el.coverMessage.textContent = "档案已打开，可以继续上次探索。"; });
  el.registerForm.addEventListener("submit", function (event) { event.preventDefault(); var password = document.getElementById("register-password").value; if (password !== document.getElementById("register-password-again").value) { el.authMessage.textContent = "两次口令不一致。"; return; } var result = MuseumAuth.register(document.getElementById("register-username").value, password); if (!result.ok) { el.authMessage.textContent = result.message; return; } currentUser = result.user; state = MuseumState.create(currentUser); el.registerForm.reset(); showCover(); el.coverMessage.textContent = "档案已建立，今晚的探索从这里开始。"; });
  document.getElementById("start-button").addEventListener("click", function () { if (!currentUser) return showAuth(); state = MuseumState.create(currentUser); showGame(); renderAll(); save("已开始探索。"); }); el.continueButton.addEventListener("click", function () { if (!currentUser) return showAuth(); var loaded = MuseumState.load(currentUser.id); if (!loaded) return; state = loaded; showGame(); renderAll(); }); document.getElementById("cover-load-button").addEventListener("click", function () { openSavePanel("load"); }); document.getElementById("save-button").addEventListener("click", function () { openSavePanel("save"); }); document.getElementById("load-button").addEventListener("click", function () { openSavePanel("load"); }); document.getElementById("close-save-panel").addEventListener("click", function () { el.savePanel.hidden = true; }); el.saveModeButton.addEventListener("click", function () { savePanelMode = "save"; renderSavePanel(); }); el.loadModeButton.addEventListener("click", function () { savePanelMode = "load"; renderSavePanel(); }); el.savePanel.addEventListener("click", function (event) { if (event.target === el.savePanel) el.savePanel.hidden = true; });
  document.getElementById("log-button").addEventListener("click", openLogPanel); document.getElementById("close-log-panel").addEventListener("click", function () { el.logPanel.hidden = true; }); el.logPanel.addEventListener("click", function (event) { if (event.target === el.logPanel) el.logPanel.hidden = true; }); document.getElementById("back-to-cover-button").addEventListener("click", function () { save("已返回标题，进度已保存。"); showCover(); }); document.getElementById("logout-button").addEventListener("click", function () { MuseumAuth.logout(); currentUser = null; state = null; showAuth(); }); document.getElementById("map-toggle-button").addEventListener("click", function () { document.querySelector(".explore-sidebar").classList.toggle("collapsed"); this.textContent = document.querySelector(".explore-sidebar").classList.contains("collapsed") ? "展开" : "收起"; }); document.getElementById("rules-close").addEventListener("click", function () { el.rules.hidden = true; state.mode = "explore"; renderAll(); save(); }); el.vnNext.addEventListener("click", advanceDialogue); el.vn.addEventListener("click", function (event) { if (event.target === el.vn) advanceDialogue(); });
  document.addEventListener("keydown", function (event) { var key = event.key; keys[key] = true; if ((key === "e" || key === "E") && state && state.mode === "explore") { event.preventDefault(); interact(nearestObject()); } if ((key === "Enter" || key === " ") && state && state.mode === "dialogue") { event.preventDefault(); advanceDialogue(); } if (key === "Escape") { if (!el.savePanel.hidden) el.savePanel.hidden = true; else if (!el.logPanel.hidden) el.logPanel.hidden = true; else if (!el.rules.hidden) { el.rules.hidden = true; if (state) state.mode = "explore"; } } }); document.addEventListener("keyup", function (event) { keys[event.key] = false; });
  el.canvas.addEventListener("click", function (event) { if (!state || state.mode !== "explore") return; var rect = canvas.getBoundingClientRect(); var scaleX = canvas.width / rect.width; var scaleY = canvas.height / rect.height; var x = event.clientX - rect.left; var y = event.clientY - rect.top; var worldX = x * scaleX + camera.x; var worldY = y * scaleY + camera.y; var object = currentRoom().objects.slice().sort(function (a, b) { return Math.hypot(worldX - a.x, worldY - a.y) - Math.hypot(worldX - b.x, worldY - b.y); })[0]; if (!object || Math.hypot(worldX - object.x, worldY - object.y) >= object.r * 1.1) return; var playerDistance = Math.hypot(state.playerX - object.x, state.playerY - object.y); if (playerDistance < object.r) interact(object); else showToast("请先走近「" + object.label + "」再调查。"); });
  document.querySelectorAll("[data-move]").forEach(function (button) { button.addEventListener("pointerdown", function () { heldTouch = button.getAttribute("data-move"); }); button.addEventListener("pointerup", function () { heldTouch = null; }); button.addEventListener("pointerleave", function () { heldTouch = null; }); });
  var pendingResult = currentUser ? consumeBattleResult() : null;
  var openSavedGame = new URLSearchParams(window.location.search).get("fromSave") === "1";
  if (currentUser && pendingResult) {
    showGame();
    applyBattleResult(pendingResult);
  } else if (currentUser && openSavedGame && state) {
    showGame();
    renderAll();
    showToast("已载入所选存档。");
  } else if (currentUser) {
    showCover();
  } else {
    showAuth();
  }
  window.requestAnimationFrame(frame);
}());
