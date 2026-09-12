(function () {
  "use strict";

  var currentUser = MuseumAuth.getCurrentUser();
  var state = currentUser ? (MuseumState.load(currentUser.id) || MuseumState.create(currentUser)) : null;
  var BATTLE_RESULT_KEY = "museum_pending_battle_v1";
  var canvas = document.getElementById("explore-canvas");
  var ctx = canvas ? canvas.getContext("2d") : null;
  var miniCanvas = document.getElementById("mini-map");
  var miniCtx = miniCanvas ? miniCanvas.getContext("2d") : null;
  // 衣柜特写是 1.9 MB，而它只在宿舍画衣柜时才用得上。改成一个按需加载的 Image：
  // 走到衣柜旁边才请求，避免开局为主菜单/第一个房间多拉 1.9 MB。
  var wardrobeImage = window.MuseumLazyImage
    ? window.MuseumLazyImage.create("wardrobe-detail.webp", "items", function () { if (window.MuseumGameRedraw) window.MuseumGameRedraw(); })
    : (function () { var img = new Image(); img.src = "assets/images/items/closeups/wardrobe-detail.webp"; return img; }());
  var keys = {};
  var heldTouch = null;
  var camera = { x: 0, y: 0 };
  var renderView = { scale: 1, offsetX: 0, offsetY: 0 };
  var lastFrame = 0;
  var lastSave = 0;
  var avatarMoving = false, avatarTravelled = 0;
  var savePanelMode = "save";

  var rooms = window.MuseumMapData.create();
  if (window.MuseumMapArt) window.MuseumMapArt(rooms);
  window.MuseumChapterMaps(rooms);
  if (state && rooms[state.roomId] && rooms[state.roomId].art && blocked(rooms[state.roomId], state.playerX, state.playerY, rooms[state.roomId].id === "museum" ? 10 : 22)) {
    state.playerX=rooms[state.roomId].spawn.x;state.playerY=rooms[state.roomId].spawn.y;
  }
  var tasks = {
    museum: "沿着总地图探索展厅，找到下一条线索。",
    dorm: "调查宿舍，寻找离开的办法。",
    hall: "在大厅寻找进入下一处展厅的线索。",
    wax: "调查张明诚的展台，找出这里的真相。"
  };

  var el = {
    cover: document.getElementById("cover-screen"), game: document.getElementById("game-screen"), coverMessage: document.getElementById("cover-message"),
    currentUser: document.getElementById("current-user-name"), continueButton: document.getElementById("continue-button"),
    canvas: canvas, roomTitle: document.getElementById("room-title"), roomChapter: document.getElementById("room-chapter"), prompt: document.getElementById("interaction-prompt"), toast: document.getElementById("map-toast"), gameMessage: document.getElementById("game-message"),
    hp: document.getElementById("hp-value"), trust: document.getElementById("trust-value"), clues: document.getElementById("clue-value"), task: document.getElementById("task-value"), rooms: document.getElementById("room-list"),
    rules: document.getElementById("rules-overlay"), rulesOptions: document.getElementById("rules-options"), rulesFeedback: document.getElementById("rules-feedback"),
    pause: document.getElementById("pause-overlay"), resumeButton: document.getElementById("resume-button"),
    logPanel: document.getElementById("log-panel"), logUserName: document.getElementById("log-user-name"), logList: document.getElementById("dialogue-log-list"),
    savePanel: document.getElementById("save-panel"), savePanelTitle: document.getElementById("save-panel-title"), savePanelMessage: document.getElementById("save-panel-message"), saveUserName: document.getElementById("save-user-name"), saveModeButton: document.getElementById("save-mode-button"), loadModeButton: document.getElementById("load-mode-button"), saveSlotList: document.getElementById("save-slot-list")
  };

  window.MuseumTutorial.bind({
    getState: function () { return state; },
    save: function () { save(); }
  });

  // 浮层焦点管理：打开时移入焦点、Tab 不逃逸、关闭时归还焦点。
  // 原生 <dialog>（背包 / 成就）由浏览器自己处理，这里不接。
  if (window.MuseumFocus) {
    window.MuseumFocus.mark(el.pause, { initial: "#resume-button" });
    window.MuseumFocus.mark(el.savePanel, { initial: "#save-mode-button" });
    window.MuseumFocus.mark(el.logPanel, { initial: "#close-log-panel" });
    window.MuseumFocus.mark(el.rules, { initial: "#rules-close" });
  }

  function currentRoom() { return rooms[state && state.roomId] || rooms.dorm; }
  function addUnique(list, value) { if (list.indexOf(value) === -1) list.push(value); }
  function has(list, value) { return list.indexOf(value) !== -1; }
  function markDiscovered(id) { addUnique(state.discovered, id); }
  function addClue(id) { addUnique(state.clues, id); }
  // addItem() 已删除：全仓没有调用者，物品发放走 items.js / 剧情事件。
  function showToast(message) { if (!el.toast) return; el.toast.textContent = message; el.toast.classList.add("visible"); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(function () { el.toast.classList.remove("visible"); }, 2600); }
  function showMapTutorial() {
    if (!state || !el.game || el.game.hidden || overlaysOpen()) return;
    if (!window.MuseumTutorial.isDone("movement")) {
      window.MuseumTutorial.show("movement", { kind: "map", title: "先熟悉一下移动", body: "用 WASD 或方向键走两步。靠近物件时，地图会告诉你下一步能做什么。" });
    } else if (!window.MuseumTutorial.isDone("investigation")) {
      window.MuseumTutorial.show("investigation", { kind: "map", title: "靠近一个物件", body: "走到物件旁边，按 E 调查；点击地图上的物件只能作为辅助入口。" });
    } else if ((state.roomId === "museum" || state.roomId === "hall") && !window.MuseumTutorial.isDone("save")) {
      window.MuseumTutorial.show("save", { kind: "save", title: "进度已经自动保存", body: "重要调查和场景切换会自动保存。第一次想保留节点时，可以打开暂停菜单保存一个手动存档。", action: function () { openTutorialSave(); }, actionLabel: "现在保存一次" });
    }
  }
  function save(message) {
    if (!currentUser || !state) return false;
    var result = window.MuseumState.saveGuarded ? MuseumState.saveGuarded(state, currentUser.id) : MuseumState.save(state, currentUser.id);
    // "stale" 表示另一个窗口写了更新的进度，本页故意不覆盖它——这是设计行为，不是错误。
    // 以前这里统一按失败处理，于是每 6 秒弹一次"检查浏览器存储空间"，把玩家吓一跳，
    // 而且原因完全不对。
    if (result === "stale") { return false; }
    if (!result) { if (message && el.gameMessage) el.gameMessage.textContent = "存档写入失败，请检查浏览器存储空间。"; return false; }
    lastSave = performance.now();
    if (message && el.gameMessage) el.gameMessage.textContent = message;
    refreshContinue();
    return true;
  }
  function saveBeforeLeave() {
    if (!currentUser || !state || (el.game && el.game.hidden)) return;
    // Guarded: if another tab wrote newer progress while this one sat idle, this
    // unload must not overwrite it. The player keeps the newer save instead of
    // silently losing it.
    save();
  }
  window.addEventListener("pagehide", saveBeforeLeave);
  window.addEventListener("beforeunload", saveBeforeLeave);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") { saveBeforeLeave(); return; }
    // 回到前台：先接受当前存档版本，之后本页才有权继续写入。
    // 然后把别人的进度载进来——但只在它也是"探索中"的时候。如果那份快照是剧情中
    // （mode novel/ending），直接套用会让地图页卡住：地图的一切行为都以
    // state.mode === "explore" 为前提（frame 循环、暂停菜单都会静默失效），
    // 那种情况应当交给剧情页继续。
    if (!currentUser) return;
    MuseumState.adoptRevision(currentUser.id);
    var stored = MuseumState.load(currentUser.id);
    if (!stored) return;
    if (stored.mode === "novel" || stored.mode === "ending") {
      if (stored.narrativeNode) window.location.href = "pages/novel.html?scene=" + encodeURIComponent(stored.narrativeNode);
      return;
    }
    if (state && (stored.savedAt !== state.savedAt || stored.roomId !== state.roomId)) { state = stored; renderAll(); }
  });
  function refreshContinue() { if (!el.continueButton) return; var ok = currentUser && MuseumState.hasSave(currentUser.id); el.continueButton.disabled = !ok; el.continueButton.classList.toggle("button-primary", Boolean(ok)); }
  function showAuth(next) {
    var target = "pages/login.html";
    if (next) target += "?next=" + encodeURIComponent(next);
    window.location.href = target;
  }
  function showCover(message) {
    el.cover.hidden = false;
    el.game.hidden = true;
    if (el.pause) el.pause.hidden = true;
    keys = {};
    heldTouch = null;
    if (el.currentUser) el.currentUser.textContent = currentUser ? currentUser.username : "未登录";
    if (el.coverMessage) el.coverMessage.textContent = message || "";
    var loginButton = document.getElementById("cover-login-button");
    if (loginButton) loginButton.textContent = "登录档案";
    refreshContinue();
  }
  function showGame() {
    if (!currentUser) return showAuth("game");
    el.cover.hidden = true;
    el.game.hidden = false;
  }
  function openPauseMenu() {
    if (!state || state.mode !== "explore" || !el.pause) return;
    state.mode = "paused";
    keys = {};
    heldTouch = null;
    renderStats();
    renderRooms();
    el.pause.hidden = false;
  }
  function closePauseMenu() {
    if (!el.pause) return;
    el.pause.hidden = true;
    if (state) state.mode = "explore";
    keys = {};
    heldTouch = null;
    renderAll();
    showMapTutorial();
  }
  function overlaysOpen() {
    return window.MuseumInventory.isOpen() || window.MuseumAchievements.isOpen() || (el.savePanel && !el.savePanel.hidden) || (el.logPanel && !el.logPanel.hidden) || (el.rules && !el.rules.hidden) || (el.pause && !el.pause.hidden);
  }
  function roomName(id) { return rooms[id] ? rooms[id].title : "未知地点"; }

  function blocked(room, x, y, radius) {
    if (x < radius || y < radius || x > room.width - radius || y > room.height - radius) return true;
    if (room.walkable) {
      var inside = function (px, py) {
        return room.walkable.some(function (area) { return px >= area.x && px <= area.x + area.w && py >= area.y && py <= area.y + area.h; });
      };
      if (![[x-radius,y],[x+radius,y],[x,y-radius],[x,y+radius]].every(function (point) { return inside(point[0],point[1]); })) return true;
    }
    return room.colliders.some(function (rect) { return x + radius > rect.x && x - radius < rect.x + rect.w && y + radius > rect.y && y - radius < rect.y + rect.h; });
  }
  function movePlayer(dx, dy, deltaMs) {
    if (!state || state.mode !== "explore") return;
    var room = currentRoom(); var speed = room.id === "museum" ? 100 : 235; var len = Math.hypot(dx, dy) || 1; var dt = Math.min(Number(deltaMs) || 16, 50) / 1000; dx = dx / len * speed; dy = dy / len * speed;
    var previousX = state.playerX, previousY = state.playerY;
    var nextX = state.playerX + dx * dt; var nextY = state.playerY + dy * dt;
    if (!blocked(room, nextX, state.playerY, room.id === "museum" ? 10 : 22)) state.playerX = nextX;
    if (!blocked(room, state.playerX, nextY, room.id === "museum" ? 10 : 22)) state.playerY = nextY;
    var distance = Math.hypot(state.playerX - previousX, state.playerY - previousY);
    avatarMoving = distance > 0; avatarTravelled += distance;
    if (distance > 0 && !window.MuseumTutorial.isDone("movement")) window.MuseumTutorial.complete("movement");
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
    room.objects.forEach(function (object) { if (!window.MuseumChapterMaps.visible(object,state)) return; var d = Math.hypot(state.playerX - object.x, state.playerY - object.y); if (d < object.r && (d < distance || (d === distance && object.type === "scene")) && (room.id !== "museum" || [0,.25,.5,.75,1].every(function (t) { return !blocked(room,state.playerX+(object.x-state.playerX)*t,state.playerY+(object.y-state.playerY)*t,2); }))) { nearest = object; distance = d; } });
    return nearest;
  }
  function interactionHint(object) {
    if (!object) { el.prompt.hidden = true; return; }
    if (object.requiredFlag && !state.flags[object.requiredFlag]) {
      el.prompt.textContent = "「" + object.label + "」尚未开放";
      el.prompt.hidden = false;
      return;
    }
    var action;
    if (object.type === "wardrobe") {
      action = state.flags.cabinetOpen ? (state.flags.cabinetKeyTaken ? "调查" : "调查") : "打开";
    } else {
      action = object.type === "door" || object.type === "waxDoor" || object.type === "exit" ? "进入" : "调查";
    }
    if (object.type === "scene" && MuseumState.sceneCompleted(state, object.scene)) {
      el.prompt.textContent = "「" + object.label + "」已调查";
      el.prompt.hidden = false;
      return;
    }
    el.prompt.textContent = "E　" + action + "「" + object.label + "」"; el.prompt.hidden = false;
  }
  function switchRoom(id, x, y) {
    if (!rooms[id]) return;
    state.roomId = id; state.currentNode = id; state.chapter = rooms[id].chapter; state.playerX = x === undefined ? rooms[id].spawn.x : x; state.playerY = y === undefined ? rooms[id].spawn.y : y; state.mode = "explore"; if (el.pause) el.pause.hidden = true; state.task = window.MuseumChapterProgress.objective(state).text;
    addUnique(state.unlockedRooms, id); renderAll(); save("已进入" + rooms[id].title + "。");
  }

  function switchRoomAt(id, entry) {
    var point = entry || {};
    switchRoom(id, Number.isFinite(point.x) ? point.x : undefined, Number.isFinite(point.y) ? point.y : undefined);
  }

  function startNovel(sceneId) {
    if (!currentUser || !state) return;
    // Map objects can intentionally expose a short repeat/inspection record.
    // Only one-shot chapter scenes are blocked after completion; otherwise a
    // repeat alias would be mistaken for the completed canonical scene.
    var replayable = /(?:-repeat|-(?:inspect)|^terminal$|^mirror$)/.test(String(sceneId));
    if (!replayable && MuseumState.sceneCompleted(state, sceneId)) {
      showToast("这段剧情已经完成，可以在文本回顾中查看。");
      return;
    }
    var beforeStory = JSON.parse(JSON.stringify(state));
    window.MuseumTransition.enterStory(state,sceneId);
    if (!MuseumState.save(state, currentUser.id)) {
      state = beforeStory;
      showToast("进度保存失败，请检查浏览器存储空间后重试。");
      return;
    }
    window.location.href = "pages/novel.html?scene=" + encodeURIComponent(sceneId);
  }
  function openNote() {
    markDiscovered("dorm-note");
    startNovel(state.flags.readNote ? "note-repeat" : "note-intro");
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
    if (state.flags.cabinetKeyTaken || state.flags.hasKey) { startNovel("wardrobe-repeat"); return; }
    startNovel("wardrobe-clue");
  }
  function openTerminal() {
    markDiscovered("dorm-terminal");
    if (!MuseumState.sceneCompleted(state, "terminal")) state.systemTrust += 2; startNovel("terminal");
  }
  function openMirror() { markDiscovered("dorm-mirror"); startNovel("mirror"); }
  function openGuard() {
    markDiscovered("hall-guard");
    if (state.flags.battleDemoCompleted) { startNovel("guard-repeat"); return; }
    startNovel("guard-intro");
  }
  function openRules() {
    if (state.flags.rulesGameCompleted) { showToast("告示上的规则你已经记住了。"); return; }
    state.mode = "mini"; el.rules.hidden = false; el.rulesFeedback.textContent = ""; el.rulesOptions.textContent = "";
    [{ id: "red", text: "远离红色制服的工作人员" }, { id: "smile", text: "面对游客时保持微笑" }, { id: "exit", text: "直接询问工作人员出口" }].forEach(function (option) { var button = document.createElement("button"); button.type = "button"; button.className = "modal-option"; button.textContent = option.text; button.addEventListener("click", function () { if (state.flags.rulesGameCompleted) return; if (option.id === "red") { state.flags.rulesGameCompleted = true; addClue("rule-red"); state.systemTrust += 4; el.rulesFeedback.textContent = "判断正确。红制服员工的规则暂时可信，去观察他吧。"; state.task = "观察大厅里的红制服员工。"; save(); } else { state.hp = Math.max(0, state.hp - 3); el.rulesFeedback.textContent = "这条信息无法解释纸条中的矛盾。生存点 -3。"; save(); } }); el.rulesOptions.appendChild(button); });
  }
  function openContract() {
    markDiscovered("wax-contract");
    if (state.flags.foundContract) { startNovel("contract-repeat"); return; }
    startNovel("contract");
  }
  function openExit() {
    if (!state.flags.scene30Seen) { showToast("出口前的雾还没有散去。先沿着线索走到最后一幕。"); return; }
    startNovel("ending-choice");
  }
  function interact(object) {
    if (!object || !state || state.mode !== "explore" || !window.MuseumChapterMaps.visible(object,state)) return;
    if (currentRoom().id === "museum" && nearestObject() !== object) return;
    if (object.type !== "travel" && !window.MuseumTutorial.isDone("investigation")) window.MuseumTutorial.complete("investigation");
    if (object.id === "dorm-door" && !state.flags.hasKey) {
      showToast("宿舍钥匙还在更衣柜里。先完成宿舍调查。");
      return;
    }
    // Apply stage locks consistently to every object type.  Previously only
    // travel and scene branches checked requiredFlag, so a locked guard/door
    // could still be activated with E or a direct click from an old save.
    if (object.requiredFlag && !state.flags[object.requiredFlag]) {
      showToast("这段线索还没有出现。先完成前面的调查。");
      return;
    }
    if (object.type === "travel") {
      if (object.requiredFlag && !state.flags[object.requiredFlag]) {
        showToast("这条通路还没有开放。先完成前面的调查。");
        return;
      }
      if (state.roomId === "museum" && object.target !== "museum") {
        state.mapReturnPoint = { x: state.playerX, y: state.playerY, facing: state.facing };
      }
      if (object.target === "museum" && state.mapReturnPoint) {
        var point = state.mapReturnPoint;
        state.facing = point.facing || "down";
        switchRoomAt("museum", point);
      } else {
        switchRoomAt(object.target, object.entry);
        // 走廊那段剧情（scene-04）不再在走出宿舍门时自动播放：剧本里它是赵灵的自我
        // 介绍，应当由玩家走到她身边按 E 触发（见下面的 npc 分支与 js/map-npc.js）。
      }
      return;
    }
    if (object.type === "note") openNote();
    else if (object.type === "npc") startNovel(object.scene);
    else if (object.type === "wardrobe") openWardrobe();
    else if (object.type === "terminal") openTerminal();
    else if (object.type === "mirror") openMirror();
    else if (object.type === "scene") startNovel(object.scene);
    else if (object.type === "door") { if (!state.flags.hasKey) showToast("门锁着。衣柜里也许有能用的东西。"); else { state.flags.openedDormDoor = true; addUnique(state.unlockedRooms, "corridor"); switchRoomAt(object.target || "corridor", object.entry || {x:1040,y:400}); if (!state.flags.scene04Seen) startNovel("scene-04"); } }
    else if (object.type === "returnDorm") switchRoom("dorm", 1330, 460);
    else if (object.type === "guard") openGuard();
    else if (object.type === "rules") openRules();
    else if (object.type === "waxDoor") { if (!state.flags.scene07Seen && !state.flags.battleDemoCompleted) showToast("东侧入口被无形的锁封住了。先完成保安的交涉。"); else { state.flags.waxDoorUnlocked = true; switchRoom("wax"); } }
    else if (object.type === "returnHall") switchRoom("hall", 835, 700);
    else if (object.type === "contract") openContract();
    else if (object.type === "exit") openExit();
  }
  // 死代码提醒：这里原本有一个 goBattle()，跳到 demos/battle 并依赖 flags.waxDoorUnlocked，
  // 但**全仓没有任何地方调用它**，那个旗标也**只被写、从没被读过**（grep 0 处读取）。
  // 战斗演示其实是从剧情进入的：scene-11 的战斗选项在 js/novel.js 里跳转到 demos/battle。
  // 已删除，避免下一个人以为地图上还有一条战斗入口。

  function drawText(text, x, y, size, color, align) { ctx.fillStyle = color; ctx.font = "600 " + size + "px system-ui, sans-serif"; ctx.textAlign = align || "left"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y); }
  function drawFurniture(rect, color, label) { ctx.fillStyle = color; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.strokeStyle = "rgba(25,39,45,.55)"; ctx.lineWidth = 4; ctx.strokeRect(rect.x, rect.y, rect.w, rect.h); if (label) drawText(label, rect.x + rect.w / 2, rect.y + rect.h / 2, 22, "rgba(245,241,232,.82)", "center"); }
  function drawWardrobe(object) {
    // 只有真的要画衣柜时才请求那 1.9 MB 的特写素材。
    if (typeof wardrobeImage.load === "function") wardrobeImage.load();
    var image = wardrobeImage;
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
    if(window.MuseumMapGuide){window.MuseumMapGuide(miniCtx,miniCanvas,rooms,state);return;}
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
  function drawOverviewMarkers(room) {
    room.objects.forEach(function (object) {
      if (!window.MuseumChapterMaps.visible(object,state)) return;
      var locked = object.requiredFlag && !state.flags[object.requiredFlag];
      var nearby = nearestObject() && nearestObject().id === object.id;
      ctx.save();
      var target=window.MuseumChapterProgress.objective(state).entrance===object.id;
      ctx.globalAlpha = locked ? .38 : (nearby ? 1 : .82);
      ctx.fillStyle = object.type === "scene" ? "#9ed9d6" : "#f0c875";
      ctx.strokeStyle = nearby || target ? "#ffffff" : "#263b42";
      ctx.lineWidth = nearby ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(object.x, object.y - 6);
      ctx.lineTo(object.x + 6, object.y);
      ctx.lineTo(object.x, object.y + 6);
      ctx.lineTo(object.x - 6, object.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (nearby) {
        ctx.strokeStyle = "rgba(231, 211, 144, .95)";
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.arc(object.x, object.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (nearby) {
        ctx.font = "600 14px system-ui, sans-serif";
        var labelWidth = ctx.measureText(object.label).width + 18;
        ctx.fillStyle = "rgba(15, 24, 29, .82)";
        ctx.fillRect(object.x - labelWidth / 2, object.y + 17, labelWidth, 23);
        drawText(object.label, object.x, object.y + 28, 14, "#f4ead4", "center");
      }
      ctx.restore();
    });
  }
  function drawRoom(room) {
    // 地图按需加载：进入房间时才请求这张地图（见 js/lazy-image.js）。加载完成后
    // lazy-image 会回调 MuseumGameRedraw，所以这里每帧调用也不会重复发请求。
    if (room.art && typeof room.art.load === "function") room.art.load();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Room coordinates are authored in the source-map pixels (1670x942,
    // 1774x887, ...), while the display canvas is only 960x540. The old
    // renderer painted those pixels directly into the smaller canvas, which
    // cropped the room and made the avatar several times too large. Fit the
    // authored room to the viewport first, then apply only the room's small
    // camera zoom so the map remains readable and movement still follows the
    // player when a room is larger than the view.
    var fitScale = Math.min(canvas.width / room.width, canvas.height / room.height);
    var scale = fitScale * (room.cameraZoom || 1);
    var viewWidth = canvas.width / scale;
    var viewHeight = canvas.height / scale;
    camera.x = Math.max(0, Math.min(Math.max(0, room.width - viewWidth), state.playerX - viewWidth / 2));
    camera.y = Math.max(0, Math.min(Math.max(0, room.height - viewHeight), state.playerY - viewHeight / 2));
    renderView.scale = scale;
    renderView.offsetX = Math.max(0, (canvas.width - room.width * scale) / 2);
    renderView.offsetY = Math.max(0, (canvas.height - room.height * scale) / 2);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(renderView.offsetX, renderView.offsetY);
    ctx.scale(scale, scale);
    ctx.translate(-camera.x, -camera.y);
    if (room.art) {
      if (room.art.complete && room.art.naturalWidth) ctx.drawImage(room.art,0,0,room.width,room.height);
      drawOverviewMarkers(room);
      var nearby = nearestObject();
      if (nearby && (!nearby.requiredFlag || state.flags[nearby.requiredFlag])) {ctx.strokeStyle="#e7d390";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(nearby.x,nearby.y,40,17,0,0,Math.PI*2);ctx.stroke();}
      drawPlayer();ctx.restore();drawMiniMap(room);return;
    }
    ctx.fillStyle = room.id === "wax" ? "#aaa7a2" : "#b8c1bd"; ctx.fillRect(0, 0, room.width, room.height);
    ctx.fillStyle = room.id === "hall" ? "#53616a" : "#6a7778"; ctx.fillRect(0, 0, room.width, 100); ctx.fillStyle = "#8e9793"; ctx.fillRect(0, 100, room.width, room.height - 200);
    ctx.strokeStyle = "rgba(34,52,58,.18)"; ctx.lineWidth = 2; for (var gx = 34; gx < room.width - 34; gx += 54) { ctx.beginPath(); ctx.moveTo(gx, 100); ctx.lineTo(gx, room.height - 34); ctx.stroke(); } for (var gy = 100; gy < room.height - 34; gy += 54) { ctx.beginPath(); ctx.moveTo(34, gy); ctx.lineTo(room.width - 34, gy); ctx.stroke(); }
    ctx.fillStyle = "#26373e"; ctx.fillRect(0, 0, room.width, 34); ctx.fillRect(0, room.height - 34, room.width, 34); ctx.fillRect(0, 0, 34, room.height); ctx.fillRect(room.width - 34, 0, 34, room.height);
    if (room.id === "dorm") { drawFurniture({ x: 130, y: 125, w: 360, h: 180 }, "#51656a", "铁床"); drawFurniture({ x: 620, y: 104, w: 260, h: 100 }, "#44565a", "书桌"); drawFurniture({ x: 170, y: 610, w: 310, h: 130 }, "#667477", "地毯"); drawFurniture({ x: 760, y: 610, w: 330, h: 110 }, "#46565c", "旧沙发"); }
    if (room.id === "hall") { drawFurniture({ x: 170, y: 110, w: 260, h: 170 }, "#465962", "接待台"); drawFurniture({ x: 570, y: 120, w: 280, h: 130 }, "#56656a", "展柜"); drawFurniture({ x: 1080, y: 110, w: 320, h: 170 }, "#4c5a60", "值班台"); drawFurniture({ x: 180, y: 640, w: 360, h: 80 }, "#647073", "长椅"); drawFurniture({ x: 1040, y: 630, w: 410, h: 90 }, "#59676b", "封锁门"); }
    if (room.id === "wax") { drawFurniture({ x: 170, y: 110, w: 260, h: 160 }, "#77736e", "空展台"); drawFurniture({ x: 560, y: 105, w: 300, h: 170 }, "#716d68", "蜡像展台"); drawFurniture({ x: 1020, y: 110, w: 310, h: 170 }, "#77736e", "旧展柜"); }
    room.objects.forEach(function (object) { var nearest = nearestObject(); var nearby = nearest && nearest.id === object.id; ctx.save(); ctx.globalAlpha = nearby ? 1 : .9; if (object.type === "note") { ctx.fillStyle = "#f1e7cd"; ctx.fillRect(object.x - 20, object.y - 15, 40, 30); ctx.strokeStyle = "#765e4c"; ctx.strokeRect(object.x - 20, object.y - 15, 40, 30); } else if (object.type === "wardrobe") { drawWardrobe(object); } else if (object.type === "terminal") { drawFurniture({ x: object.x - 48, y: object.y - 40, w: 96, h: 70 }, "#2b4650", ""); ctx.fillStyle = "#5ba2b8"; ctx.fillRect(object.x - 34, object.y - 28, 68, 40); } else if (object.type === "mirror") { ctx.fillStyle = "#293f48"; ctx.fillRect(object.x - 28, object.y - 55, 56, 110); ctx.strokeStyle = "#d6d2c3"; ctx.lineWidth = 5; ctx.strokeRect(object.x - 28, object.y - 55, 56, 110); } else if (object.type === "door" || object.type === "waxDoor" || object.type === "exit") { var isOpen = object.type === "door" ? state.flags.hasKey : object.type === "waxDoor" ? (state.flags.scene07Seen || state.flags.battleDemoCompleted) : state.flags.scene30Seen; ctx.fillStyle = isOpen ? "#3d6670" : "#5a3f41"; ctx.fillRect(object.x - 32, object.y - 72, 64, 144); ctx.strokeStyle = "#d9c9a9"; ctx.lineWidth = 4; ctx.strokeRect(object.x - 32, object.y - 72, 64, 144); } else if (object.type === "guard") { ctx.fillStyle = "#732f37"; ctx.fillRect(object.x - 25, object.y - 60, 50, 120); ctx.fillStyle = "#e3ded1"; ctx.beginPath(); ctx.arc(object.x, object.y - 82, 28, 0, Math.PI * 2); ctx.fill(); } else if (object.type === "rules") { ctx.fillStyle = "#d7cfbc"; ctx.fillRect(object.x - 50, object.y - 45, 100, 90); ctx.strokeStyle = "#4d5960"; ctx.strokeRect(object.x - 50, object.y - 45, 100, 90); } else if (object.type === "contract") { ctx.fillStyle = "#d8c9aa"; ctx.fillRect(object.x - 40, object.y - 25, 80, 50); ctx.strokeStyle = "#6c4e45"; ctx.strokeRect(object.x - 40, object.y - 25, 80, 50); } else { ctx.fillStyle = object.type === "scene" ? "#9a6c50" : "#405057"; ctx.beginPath(); ctx.arc(object.x, object.y, 24, 0, Math.PI * 2); ctx.fill(); } if (nearby) { ctx.strokeStyle = "#b9e4e0"; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(object.x, object.y, 52, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); } drawText(object.label, object.x, object.y + object.r * .62, 18, nearby ? "#19363e" : "rgba(34,47,50,.84)", "center"); ctx.restore(); });
    drawPlayer(); ctx.restore(); drawMiniMap(room);
  }
  function drawPlayer() {
    // 赵灵作为地图 NPC 站在主角之前，这样两人重叠时主角在前，符合"走向她"的观感。
    if (window.MuseumNpc) window.MuseumNpc.draw(ctx, state.roomId, state);
    window.MuseumPlayerAvatar.draw(ctx, state.playerX, state.playerY, state.facing, avatarMoving && state.mode === "explore" && !overlaysOpen(), avatarTravelled, state.roomId);
  }

  // ---------------------------------------------------------------------------
  // 画布几何：唯一来源。
  //
  // 这里必须让「绘制缓冲区」严格等于「CSS 盒子」，因为别处都依赖这一点：
  //   - 命中测试 (event.clientX - rect.left) * canvas.width / rect.width 只有在缓冲区
  //     与盒子同尺寸时才等于 clientX - rect.left；
  //   - 反过来，盒子若被 CSS 拉伸成 aspect-ratio + object-fit:contain，画出来的位图就
  //     比盒子小，于是地图看起来缩水（2560x1380 这类非 16:9 窗口最明显），点击坐标也
  //     会整体偏移。
  // 同时按 devicePixelRatio 提高缓冲区分辨率，HiDPI 下地图不再发虚。
  // ---------------------------------------------------------------------------
  function syncCanvasToBox() {
    if (!canvas || !el.game || el.game.hidden) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var nextW = Math.round(rect.width * dpr);
    var nextH = Math.round(rect.height * dpr);
    if (canvas.width === nextW && canvas.height === nextH) return;
    canvas.width = nextW;
    canvas.height = nextH;
    if (state) drawRoom(currentRoom());
  }
  var resizeTimer = null;
  // 地图素材加载完成后重绘一次，让背景立刻出现而不是等到下一帧。
  window.MuseumGameRedraw = function () {
    if (state && el.game && !el.game.hidden) drawRoom(currentRoom());
  };
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    // 拖动窗口时不必每帧重建缓冲区，停稳后再同步一次。
    resizeTimer = window.setTimeout(syncCanvasToBox, 120);
  });
  if (window.ResizeObserver) {
    try { new ResizeObserver(function () { syncCanvasToBox(); }).observe(canvas); } catch (error) { /* 老浏览器忽略 */ }
  }

  function renderRooms() { el.rooms.textContent = ""; Object.keys(rooms).forEach(function (id) { if (!rooms[id]) return; var button = document.createElement("button"); button.type = "button"; var unlocked = has(state.unlockedRooms, id); button.className = "room-button" + (state.roomId === id ? " current" : ""); button.disabled = true; button.innerHTML = "<strong>" + roomName(id) + "</strong><small>" + (unlocked ? (state.roomId === id ? "当前位置" : "已探索") : "尚未开放") + "</small>";  el.rooms.appendChild(button); }); }
  function renderStats() { var objective=window.MuseumChapterProgress.objective(state); state.task=objective.text; var hint=document.getElementById("chapter-objective"); if(hint)hint.textContent=objective.text;  el.hp.textContent = String(state.hp); el.trust.textContent = String(state.systemTrust); el.clues.textContent = String(state.clues.length); el.task.textContent = objective.text || tasks[state.roomId] || "继续探索。"; window.MuseumAchievements.refresh(); }
  function renderAll() {
    if (!state) return; var room = currentRoom();
    if (!Number.isFinite(state.playerX) || !Number.isFinite(state.playerY) || blocked(room,state.playerX,state.playerY,room.id === "museum" ? 10 : 22)) {
      state.playerX=room.spawn.x; state.playerY=room.spawn.y;
    } el.roomTitle.textContent = room.title; el.roomChapter.textContent = room.chapter; renderRooms(); renderStats(); drawRoom(room); interactionHint(nearestObject()); showMapTutorial(); }

  function formatSaveTime(value) { if (!value) return "尚未保存"; var date = new Date(value); return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  function saveSummary(saveState) { if (!saveState) return "空存档位"; return roomName(saveState.roomId || saveState.currentNode) + " · 线索 " + ((saveState.clues || []).length); }
  function makeSlotCard(title, entry, index, auto) { var card = document.createElement("article"); card.className = "save-slot" + (entry ? " occupied" : " empty"); var info = document.createElement("div"); info.className = "save-slot-info"; var heading = document.createElement("strong"); heading.textContent = title; var detail = document.createElement("span"); var slotState = auto ? entry : entry && entry.state; detail.textContent = saveSummary(slotState); var time = document.createElement("small"); time.textContent = entry ? formatSaveTime(entry.savedAt) : "—"; info.appendChild(heading); info.appendChild(detail); info.appendChild(time); card.appendChild(info); var actions = document.createElement("div"); actions.className = "save-slot-actions"; var action = document.createElement("button"); action.type = "button"; action.className = "button button-small"; if (auto) { action.textContent = savePanelMode === "save" ? "当前自动档" : "读取"; action.disabled = savePanelMode === "save" || !entry; action.addEventListener("click", function () { loadSelected(MuseumState.load(currentUser.id), "自动存档"); }); } else if (savePanelMode === "save") { action.textContent = entry ? "覆盖" : "保存"; action.addEventListener("click", function () { if (entry && !window.confirm("确定覆盖存档位 " + (index + 1) + " 吗？")) return; if (!save()) { el.savePanelMessage.textContent = "存档写入失败，请检查浏览器存储空间。"; return; } window.MuseumTutorial.complete("save"); var saved = MuseumState.saveSlot(state, currentUser.id, index); if (!saved) { el.savePanelMessage.textContent = "存档写入失败，请重试。"; return; } el.savePanelMessage.textContent = "已保存到存档位 " + (index + 1) + "。"; renderSavePanel(); }); } else { action.textContent = "读取"; action.disabled = !entry; action.addEventListener("click", function () { loadSelected(MuseumState.loadSlot(currentUser.id, index), "存档位 " + (index + 1)); }); } actions.appendChild(action); if (!auto && entry) { var del = document.createElement("button"); del.type = "button"; del.className = "text-button danger-button"; del.textContent = "删除"; del.addEventListener("click", function () { if (!window.confirm("确定删除存档位 " + (index + 1) + " 吗？")) return; MuseumState.deleteSlot(currentUser.id, index); renderSavePanel(); }); actions.appendChild(del); } card.appendChild(actions); return card; }
  function renderSavePanel() { if (!currentUser) return; el.savePanelTitle.textContent = savePanelMode === "save" ? "保存游戏" : "读取存档"; el.saveModeButton.classList.toggle("active", savePanelMode === "save"); el.loadModeButton.classList.toggle("active", savePanelMode === "load"); el.saveModeButton.setAttribute("aria-selected", String(savePanelMode === "save")); el.loadModeButton.setAttribute("aria-selected", String(savePanelMode === "load")); el.saveSlotList.textContent = ""; el.saveSlotList.appendChild(makeSlotCard("自动存档", MuseumState.load(currentUser.id), -1, true)); var checkpoint = MuseumState.loadCheckpoint(currentUser.id); if (checkpoint) { var checkpointCard = document.createElement("article"); checkpointCard.className = "save-slot occupied save-checkpoint"; var checkpointInfo = document.createElement("div"); checkpointInfo.className = "save-slot-info"; var checkpointTitle = document.createElement("strong"); checkpointTitle.textContent = "选择前检查点"; var checkpointDetail = document.createElement("span"); checkpointDetail.textContent = (checkpoint.checkpoint && checkpoint.checkpoint.label) || "重要选择前"; checkpointInfo.appendChild(checkpointTitle); checkpointInfo.appendChild(checkpointDetail); var checkpointButton = document.createElement("button"); checkpointButton.type = "button"; checkpointButton.className = "button button-small"; checkpointButton.textContent = savePanelMode === "load" ? "读取" : "仅供读取"; checkpointButton.disabled = savePanelMode !== "load"; checkpointButton.addEventListener("click", function () { if (savePanelMode === "load") loadSelected(MuseumState.loadCheckpoint(currentUser.id), "选择前检查点", { checkpoint: true }); }); checkpointCard.append(checkpointInfo, checkpointButton); el.saveSlotList.appendChild(checkpointCard); } MuseumState.listSlots(currentUser.id).forEach(function (entry, index) { el.saveSlotList.appendChild(makeSlotCard("存档位 " + (index + 1), entry, index, false)); }); }
  function openTutorialSave() { openPauseMenu(); window.setTimeout(function () { if (el.pause && !el.pause.hidden) openSavePanel("save"); }, 0); }
  function openSavePanel(mode) { if (!currentUser) return showAuth("game"); window.MuseumTutorial.hide(); savePanelMode = mode; if (mode === "save") save(); el.saveUserName.textContent = currentUser.username; el.savePanelMessage.textContent = ""; renderSavePanel(); el.savePanel.hidden = false; }
  function loadSelected(loaded, label, options) {
    if (!loaded) { el.savePanelMessage.textContent = "这个存档无法读取。"; return; }
    state = loaded;
    el.pause.hidden=true;keys={};heldTouch=null;avatarMoving=false;
    // The write can fail (full or blocked storage). Reporting "已读取" while the store
    // still holds the old save is worse than refusing: the player would only discover
    // it after a reload. startNovel() and finishToMap() already check this return value.
    if (!MuseumState.save(state, currentUser.id)) {
      el.savePanelMessage.textContent = "存档写入失败，无法保存这次的读取结果。请检查浏览器存储空间后重试。";
      showToast("读取失败：存档无法写入。");
      return;
    }
    if ((state.mode === "novel" || state.mode === "ending") && state.narrativeNode) { window.location.href = "pages/novel.html?scene=" + encodeURIComponent(state.narrativeNode); return; }
    // 回到"重要选择前"的检查点就是剧本里的第五个结局「循环」——script 第三十场的
    // 结局表里写着「你回到了最近的存档点。」。这条路径以前没有任何调用方
    // （MuseumState.loadCheckpoint 只在存档面板里被读，从来没有把结局播出来），
    // 所以 ending-e 是永远触发不到的死内容。现在由这里触发。
    if (options && options.checkpoint) {
      state.mode = "ending";
      state.ending = "ending-e";
      state.narrativeNode = "ending-e";
      state.narrativeChoice = "ending-e";
      if (MuseumState.save(state, currentUser.id)) {
        window.location.href = "pages/novel.html?scene=ending-e";
        return;
      }
      el.savePanelMessage.textContent = "存档写入失败，无法保存这次的读取结果。请检查浏览器存储空间后重试。";
      return;
    }
    state.mode = "explore"; el.savePanel.hidden = true; showGame(); renderAll(); showToast("已读取" + label + "。");
  }
  function renderLogPanel() {
    if (!currentUser || !el.logList) return;
    el.logUserName.textContent = currentUser.username;
    el.logList.textContent = "";
    if (!state.dialogueLog.length) { var empty = document.createElement("p"); empty.className = "log-empty"; empty.textContent = "还没有读过文本。先去房间里调查一些东西吧。"; el.logList.appendChild(empty); return; }
    state.dialogueLog.forEach(function (entry) { entry = typeof entry === "string" ? { speaker: "旁白", text: entry } : entry; var item = document.createElement("article"); item.className = "log-entry"; var heading = document.createElement("div"); heading.className = "log-entry-heading"; var speaker = document.createElement("strong"); speaker.textContent = entry.speaker || "旁白"; var location = document.createElement("span"); location.textContent = entry.location || "未知地点"; heading.appendChild(speaker); heading.appendChild(location); var text = document.createElement("p"); text.textContent = entry.text || ""; item.appendChild(heading); item.appendChild(text); el.logList.appendChild(item); });
    el.logList.scrollTop = el.logList.scrollHeight;
  }
  function openLogPanel() { if (!currentUser) return showAuth("game"); renderLogPanel(); el.logPanel.hidden = false; }

  function applyBattleResult(result) {
    if (!result || !state) return;
    if (result.status === "win") {
      var remainingHp = Number(result.remainingHp);
      if (Number.isFinite(remainingHp)) state.hp = Math.max(0, remainingHp);
      state.flags.battleDemoCompleted = true; state.flags.waxDoorUnlocked = true; addClue("faceless-mask"); addUnique(state.unlockedRooms, "wax");
      var returnRoom = rooms[state.returnRoom] ? state.returnRoom : "hall";
      state.roomId = returnRoom; state.currentNode = returnRoom; state.chapter = rooms[returnRoom].chapter; state.playerX = Number(state.returnX) || rooms[returnRoom].spawn.x; state.playerY = Number(state.returnY) || rooms[returnRoom].spawn.y; state.task = tasks[returnRoom];
      state.mode = "novel"; state.narrativeNode = state.returnScene || "guard-after-battle"; state.narrativeIndex = 0; state.narrativeChoice = null; var nextScene = state.narrativeNode; state.returnScene = null;
      if (MuseumState.save(state, currentUser.id)) { window.location.href = "pages/novel.html?scene=" + encodeURIComponent(nextScene); }
      else { state.mode = "explore"; showToast("战斗结果无法写入存档，请检查浏览器存储空间后重试。"); save(); renderAll(); }
      return;
    }
    state.hp = Math.max(0, Number(result.remainingHp) || 0);
    if (state.hp <= 0) {
      state.mode = "novel";
      state.narrativeNode = "ending-d";
      state.narrativeIndex = 0;
      state.narrativeChoice = "ending-d";
      if (MuseumState.save(state, currentUser.id)) { window.location.href = "pages/novel.html?scene=ending-d"; }
      else { state.mode = "explore"; showToast("结局无法写入存档，请检查浏览器存储空间后重试。"); renderAll(); }
      return;
    }
    state.mode = "explore";
    showToast("交涉失败，生存点已更新。");
    save();
    renderAll();
  }
  function consumeBattleResult() { var raw = localStorage.getItem(BATTLE_RESULT_KEY); if (!raw) return null; var result; try { result = JSON.parse(raw); } catch (error) { localStorage.removeItem(BATTLE_RESULT_KEY); return null; } if (result && result.userId && currentUser && result.userId !== currentUser.id) return null; localStorage.removeItem(BATTLE_RESULT_KEY); return result; }

  function frame(timestamp) {
    if (!lastFrame) lastFrame = timestamp;
    var delta = timestamp - lastFrame;
    lastFrame = timestamp;
    var gameVisible = el.game && !el.game.hidden;
    var overlayOpen = overlaysOpen();
    avatarMoving = false;
    if (gameVisible && !overlayOpen && state && state.mode === "explore") {
      // 每帧确认一次画布几何：从剧情页返回、切换房间、窗口变化都靠它收敛，
      // 保证地图始终按当前窗口尺寸铺满，不会缩成 960x540 的原始尺寸。
      syncCanvasToBox();
      var dir = playerDirection();
      if (dir.x || dir.y) movePlayer(dir.x, dir.y, delta);
      interactionHint(nearestObject());
      drawRoom(currentRoom());
      if (timestamp - lastSave > 6000) save();
      showMapTutorial();
    }
    window.requestAnimationFrame(frame);
  }

  function beginNewGame() {
    if (!currentUser) return showAuth("newGame");
    if (MuseumState.hasSave(currentUser.id) && !window.confirm("开始新游戏会覆盖当前自动进度，手动存档仍会保留。确定继续吗？")) return;
    localStorage.removeItem("museum_novel_quick_" + currentUser.id);
    state = MuseumState.create(currentUser);
    window.MuseumTutorial.resetDismissed();
    startNovel("scene-01");
  }
  document.getElementById("start-button").addEventListener("click", beginNewGame);
  el.continueButton.addEventListener("click", function () {
    if (!currentUser) return showAuth("game");
    var loaded = MuseumState.load(currentUser.id);
    if (!loaded) return;
    state = loaded;
    el.pause.hidden=true;keys={};heldTouch=null;avatarMoving=false;
    if ((state.mode === "novel" || state.mode === "ending") && state.narrativeNode) { window.location.href = "pages/novel.html?scene=" + encodeURIComponent(state.narrativeNode); return; }
    showGame();
    renderAll();
  });
  document.getElementById("cover-load-button").addEventListener("click", function () { openSavePanel("load"); });
  document.getElementById("save-button").addEventListener("click", function () { openSavePanel("save"); });
  document.getElementById("load-button").addEventListener("click", function () { openSavePanel("load"); });
  document.getElementById("close-save-panel").addEventListener("click", function () { el.savePanel.hidden = true; showMapTutorial(); });
  el.saveModeButton.addEventListener("click", function () { savePanelMode = "save"; renderSavePanel(); });
  el.loadModeButton.addEventListener("click", function () { savePanelMode = "load"; renderSavePanel(); });
  el.savePanel.addEventListener("click", function (event) { if (event.target === el.savePanel) { el.savePanel.hidden = true; showMapTutorial(); } });
  document.getElementById("log-button").addEventListener("click", openLogPanel);
  document.getElementById("close-log-panel").addEventListener("click", function () { el.logPanel.hidden = true; });
  el.logPanel.addEventListener("click", function (event) { if (event.target === el.logPanel) el.logPanel.hidden = true; });
  el.resumeButton.addEventListener("click", closePauseMenu);
  document.getElementById("back-to-cover-button").addEventListener("click", function () {
    if (!state) { showCover(); return; }
    state.mode = "explore";
    if (!save()) { state.mode = "paused"; renderStats(); if (el.gameMessage) el.gameMessage.textContent = "保存失败，仍停留在暂停菜单。"; return; }
    showCover("当前进度已保存。点击“继续游戏”可以从这里继续。");
  });
  // 退出登录（切换账号）。MuseumAuth.logout() 本来就有，但此前没有任何元素触发它，
  // 所以玩家换不了账号。这里先存一次进度再登出，然后回到标题页（标题页会显示登录/注册）。
  var logoutButton = document.getElementById("logout-button");
  if (logoutButton) logoutButton.addEventListener("click", function () {
    if (state) save();
    keys = {}; heldTouch = null;
    MuseumAuth.logout();
    currentUser = null; state = null;
    if (el.pause) el.pause.hidden = true;
    if (el.game) el.game.hidden = true;
    showCover("已退出登录。可以登录其他账号，或注册新账号。");
  });
  document.getElementById("rules-close").addEventListener("click", function () { el.rules.hidden = true; if (state) state.mode = "explore"; renderAll(); save(); });
  document.addEventListener("keydown", function (event) {
    var key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === "Escape") {
      if (el.savePanel && !el.savePanel.hidden) el.savePanel.hidden = true;
      else if (el.logPanel && !el.logPanel.hidden) el.logPanel.hidden = true;
      else if (el.rules && !el.rules.hidden) {
        el.rules.hidden = true;
        if (state) state.mode = "explore";
      } else if (el.pause && !el.pause.hidden) closePauseMenu();
      else if (el.game && !el.game.hidden && state && state.mode === "explore") openPauseMenu();
      return;
    }
    if (overlaysOpen()) {
      keys[key] = false;
      return;
    }
    if (event.repeat && (key === "e" || key === "E")) return;
    keys[key] = true;
    if ((key === "e" || key === "E") && state && state.mode === "explore") {
      event.preventDefault();
      interact(nearestObject());
    }
  });
  window.addEventListener("blur", function () { keys = {}; heldTouch = null; avatarMoving = false; });
  document.addEventListener("keyup", function (event) { keys[event.key.length === 1 ? event.key.toLowerCase() : event.key] = false; });
  el.canvas.addEventListener("click", function (event) {
    if (!state || state.mode !== "explore" || overlaysOpen()) return;
    var room = currentRoom();
    var rect = canvas.getBoundingClientRect();
    var canvasX = (event.clientX - rect.left) * canvas.width / rect.width;
    var canvasY = (event.clientY - rect.top) * canvas.height / rect.height;
    var worldX = (canvasX - renderView.offsetX) / renderView.scale + camera.x;
    var worldY = (canvasY - renderView.offsetY) / renderView.scale + camera.y;
    if (worldX < 0 || worldY < 0 || worldX > room.width || worldY > room.height) return;
    var object = room.objects.filter(function(o){return window.MuseumChapterMaps.visible(o,state);}).sort(function (a, b) { return Math.hypot(worldX - a.x, worldY - a.y) - Math.hypot(worldX - b.x, worldY - b.y) || (a.type === "scene" ? -1 : 0) - (b.type === "scene" ? -1 : 0); })[0];
    if (!object || Math.hypot(worldX - object.x, worldY - object.y) >= object.r * 1.1) return;
    var playerDistance = Math.hypot(state.playerX - object.x, state.playerY - object.y);
    if (playerDistance < object.r) interact(object); else showToast("请先走近「" + object.label + "」再调查。");
  });
  document.querySelectorAll("[data-move]").forEach(function (button) { button.addEventListener("pointerdown", function () { heldTouch = button.getAttribute("data-move"); }); button.addEventListener("pointerup", function () { heldTouch = null; }); button.addEventListener("pointerleave", function () { heldTouch = null; }); });
  window.MuseumInventory.bind({getState:function(){return state;},save:save,canOpen:function(){return el.game && !el.game.hidden && !overlaysOpen();},onOpen:function(){keys={};heldTouch=null;avatarMoving=false;window.MuseumTutorial.complete("inventory");drawRoom(currentRoom());},onClose:function(){keys={};heldTouch=null;renderAll();showMapTutorial();}});
  document.getElementById("map-bag-button").addEventListener("click",function(){window.MuseumInventory.open();});
  window.MuseumAchievements.bind({getState:function(){return state;},save:save,canOpen:function(){return el.game && !el.game.hidden && !overlaysOpen();},onOpen:function(){keys={};heldTouch=null;avatarMoving=false;drawRoom(currentRoom());},onClose:function(){keys={};heldTouch=null;renderAll();}});
  document.getElementById("map-achievements-button").addEventListener("click",function(){window.MuseumAchievements.open();});
  var pendingResult = currentUser ? consumeBattleResult() : null;
  var query = new URLSearchParams(window.location.search);
  var openSavedGame = query.get("fromSave") === "1";
  var openNewGame = query.get("newGame") === "1";
  var openStoryReturn = query.get("fromStory") === "1";
  var openMenuReturn = query.get("fromMenu") === "1";
  var openEndingReturn = query.get("fromEnding") === "1";
  if (currentUser && pendingResult) {
    showGame();
    applyBattleResult(pendingResult);
  } else if (currentUser && openSavedGame && state && (state.mode === "novel" || state.mode === "ending") && state.narrativeNode) {
    window.location.href = "pages/novel.html?scene=" + encodeURIComponent(state.narrativeNode);
  } else if (currentUser && openSavedGame && state) {
    showGame();
    renderAll();
    showToast("已载入所选存档。");
  } else if (currentUser && openNewGame) {
    localStorage.removeItem("museum_novel_quick_" + currentUser.id);
    state = MuseumState.create(currentUser);
    startNovel("scene-01");
  } else if (currentUser && openStoryReturn) {
    showGame();
    state.mode = "explore";
    renderAll();
    save("已自动保存：你已返回" + roomName(state.roomId) + "。");
  } else if (currentUser && openMenuReturn) {
    showCover("当前进度已保存。点击“继续游戏”可以从这里继续。");
  } else if (currentUser && openEndingReturn) {
    showCover();
    showToast("结局已保存。可以开始新的探索或读取其他存档。");
  } else {
    showCover();
  }
  window.requestAnimationFrame(frame);
}());
