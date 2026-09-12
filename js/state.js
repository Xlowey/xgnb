(function () {
  "use strict";

  var SLOT_LIMIT = 20;
  var AUTO_PREFIX = "museum_save_v5_auto_";
  var SLOTS_PREFIX = "museum_save_v5_slots_";
  var CHECKPOINT_PREFIX = "museum_save_v5_checkpoint_";
  var READ_PREFIX = "museum_read_v1_";
  var LEGACY_PREFIXES = ["museum_save_v4_auto_", "museum_save_v3_auto_", "museum_save_v2_auto_", "museum_save_v1_"];
  var LEGACY_SLOT_PREFIXES = ["museum_save_v4_slots_", "museum_save_v3_slots_", "museum_save_v2_slots_", "museum_save_v1_slots_"];
  var DEFAULT_FLAGS = {
    readNote: false,
    hasKey: false,
    cabinetOpen: false,
    cabinetKeyTaken: false,
    openedDormDoor: false,
    rulesGameCompleted: false,
    battleDemoCompleted: false,
    waxDoorUnlocked: false,
    foundContract: false,
    understoodTruth: false,
    // 新剧本第八场：提交调查记录后永久关闭 C 完美结局（见 novel.js renderChoices）。
    submitted: false,
    refusedSubmit: false,
    tutorialChoiceSaved: false
  };
  var DEFAULT_TUTORIAL = {
    movement: false,
    investigation: false,
    dialogue: false,
    inventory: false,
    itemRead: false,
    save: false,
    branch: false
  };
  var DEFAULT_STATE = {
    schemaVersion: 6,
    userId: null,
    playerName: "",
    characterName: "",
    roomId: "dorm",
    currentNode: "dorm",
    playerX: 300,
    playerY: 520,
    facing: "down",
    mode: "explore",
    narrativeNode: null,
    narrativeIndex: 0,
    narrativeChoice: null,
    narrativeLogKeys: [],
    narrativeText: "",
    narrativeChoices: [],
    chapter: "序章",
    day: 1,
    hp: 25,
    systemTrust: 50,
    clues: [],
    inventory: [],
    discovered: [],
    unlockedRooms: ["dorm"],
    achievements: [],
    achievementRecords: {},
    dialogueLog: [],
    task: "调查宿舍，寻找离开的办法。",
    mapReturnPoint: null,
    returnRoom: null,
    returnX: null,
    returnY: null,
    returnFacing: "down",
    returnScene: null,
    ending: null,
    endingComplete: false,
    tutorial: DEFAULT_TUTORIAL,
    tutorialDismissed: {},
    savedAt: null,
    checkpoint: null,
    flags: DEFAULT_FLAGS
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function userKey(prefix, userId) { return prefix + encodeURIComponent(userId || "guest"); }
  function createState(user) {
    var state = clone(DEFAULT_STATE);
    if (user) { state.userId = user.id; state.playerName = user.username; }
    return state;
  }
  function hydrate(loaded, userId) {
    if (!loaded || typeof loaded !== "object") return null;
    var state = createState({ id: userId, username: loaded.playerName || "" });
    Object.keys(state).forEach(function (key) { if (loaded[key] !== undefined) state[key] = loaded[key]; });
    state.userId = userId;
    state.schemaVersion = 6;
    state.tutorial = Object.assign({}, DEFAULT_TUTORIAL, loaded.tutorial || {});
    state.tutorialDismissed = loaded.tutorialDismissed && typeof loaded.tutorialDismissed === "object" ? loaded.tutorialDismissed : {};
    state.flags = Object.assign({}, DEFAULT_FLAGS, loaded.flags || {});
    state.clues = Array.isArray(state.clues) ? state.clues : [];
    state.inventory = Array.isArray(state.inventory) ? state.inventory : [];
    if(window.MuseumInventory)window.MuseumInventory.normalize(state);
    state.discovered = Array.isArray(state.discovered) ? state.discovered : [];
    state.unlockedRooms = Array.isArray(state.unlockedRooms) ? state.unlockedRooms : ["dorm"];
    // Version 6 introduced the walkable museum overview. Existing records
    // that have already completed the prologue can enter it immediately;
    // new records unlock it when scene-03 is completed.
    if ((state.flags.prologueComplete || state.roomId === "museum" || state.returnRoom === "museum") && state.unlockedRooms.indexOf("museum") === -1) state.unlockedRooms.push("museum");
    state.achievements = Array.isArray(state.achievements) ? state.achievements : [];
    if(window.MuseumAchievements)window.MuseumAchievements.normalize(state);
    state.dialogueLog = Array.isArray(state.dialogueLog) ? state.dialogueLog : [];
    state.narrativeLogKeys = Array.isArray(state.narrativeLogKeys) ? state.narrativeLogKeys : [];
    if (state.mode === "dialogue" || state.mode === "mini" || state.mode === "battle" || state.mode === "paused") state.mode = "explore";
    if (loaded.currentNode && !loaded.roomId) state.roomId = loaded.currentNode;
    if (!Number.isFinite(state.playerX)) state.playerX = state.roomId === "hall" ? 260 : 300;
    if (!Number.isFinite(state.playerY)) state.playerY = state.roomId === "dorm" ? 520 : 460;
    return state;
  }
  function parse(raw, fallback) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (error) { console.warn("存档数据损坏，已忽略。", error); return fallback; }
  }
  function snapshot(state, userId) { var data = clone(state); data.userId = userId || state.userId; data.savedAt = new Date().toISOString(); return data; }
  function write(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (error) { console.warn("存档写入失败。", error); return false; }
  }
  function remove(key) { try { localStorage.removeItem(key); } catch (error) { console.warn("存档清理失败。", error); } }

  // ---------------------------------------------------------------------------
  // 自动存档的写入保护（多标签页 / 切后台）。
  //
  // 地图页只在加载时读一次 state，之后每 6 秒和 pagehide 都会把那份快照写回去，
  // 于是停着不动的那一个标签页会把另一个标签页的新进度整份覆盖掉。
  //
  // 做法：给存档配一个**单调递增的修订号**（REVISION_PREFIX）。任何一次写入都推进它。
  // 每个页面加载时取一个 writerId；写入前比较：
  //   存档修订号 > 我自己写过的最大修订号 -> 别人写过，放弃本次写入
  //   否则                                -> 正常写入，基线前移
  //
  // 注意：**不能**用 savedAt 时间戳判断新旧。第一版就是这么写的，有两个致命缺陷：
  //   a) 被拒绝时什么都不更新，同一个拒绝会永远重复——该标签页的自动存档、pagehide、
  //      保存面板、"保存并返回标题"全部失效，还会误报"存储空间不足"。
  //   b) savedAt 只在自己写入时更新，别人写的新档反而可能看起来更旧。
  // 修订号由每次写入推进，所以基线永远不会卡住，也永远能发现别人的写入。
  // ---------------------------------------------------------------------------
  var GUARD_PREFIX = "museum_save_guard_v1_";
  var REVISION_PREFIX = "museum_save_rev_v1_";
  var WRITER_ID = "w_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

  function readRevision(userId) {
    var value = Number(localStorage.getItem(userKey(REVISION_PREFIX, userId)));
    return Number.isFinite(value) ? value : 0;
  }
  function bumpRevision(userId) {
    var next = readRevision(userId) + 1;
    write(userKey(REVISION_PREFIX, userId), String(next));
    return next;
  }
  function readGuard(userId) {
    var raw = localStorage.getItem(userKey(GUARD_PREFIX, userId));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (error) { return null; }
  }
  function writeGuard(userId, revision) {
    write(userKey(GUARD_PREFIX, userId), JSON.stringify({ writerId: WRITER_ID, revision: revision, at: Date.now() }));
  }
  // 本页最后一次"见过"的修订号。**必须存在内存里**，不能每次去读 guard 键：
  // guard 键在存档里，别的页面会覆盖它，于是"别的页面写过了"这件事会被它自己的写入抹掉，
  // 判断就永远放行。这是第三版之前的 bug。
  // 页面加载时用见到的修订号初始化（见 initGuard），之后每次本页写入都前移。
  var BASELINE = null;

  function baselineFor(userId) {
    if (BASELINE !== null && BASELINE.id === userId) return BASELINE.revision;
    var seen = readGuard(userId);
    var revision = (seen && Number.isFinite(seen.revision)) ? seen.revision : 0;
    BASELINE = { id: userId, revision: revision };
    return revision;
  }
  function setBaseline(userId, revision) { BASELINE = { id: userId, revision: revision }; }

  function save(state, userId) {
    var id = userId || state.userId; if (!id) return false;
    var data = snapshot(state, id); if (!write(userKey(AUTO_PREFIX, id), JSON.stringify(data))) return false;
    state.savedAt = data.savedAt;
    // 每一次写入都推进修订号，别处才能发现"这个存档变了"；并把本页基线前移。
    var revision = bumpRevision(id);
    writeGuard(id, revision);
    setBaseline(id, revision);
    return data.savedAt;
  }
  // 只在没有别的页面写过更新的快照时才写入。
  // 返回值区分三种情况，调用方才能给出正确的提示：
  //   时间戳字符串 = 写入成功
  //   "stale"     = 别的页面写了更新的进度，本次**故意不写**（不是错误，不该报存储空间）
  //   false       = 真的写不进去（存储满、被禁用等）
  function saveGuarded(state, userId) {
    var id = userId || state.userId;
    if (!id) return false;
    var stored = readRevision(id);
    var seen = baselineFor(id);
    if (stored > seen) return "stale";
    return save(state, id);
  }
  // 页面切回前台/重新可见时调用：接受当前存档版本，之后本页才有权继续写入。
  function adoptRevision(userId) {
    if (!userId) return;
    setBaseline(userId, readRevision(userId));
  }
  function load(userId) {
    if (!userId) return null;
    var raw = localStorage.getItem(userKey(AUTO_PREFIX, userId));
    if (!raw) LEGACY_PREFIXES.some(function (prefix) { raw = localStorage.getItem(userKey(prefix, userId)); return Boolean(raw); });
    return hydrate(parse(raw, null), userId);
  }
  function normalizeSlots(slots) {
    if (!Array.isArray(slots)) slots = [];
    slots.length = SLOT_LIMIT;
    for (var i = 0; i < SLOT_LIMIT; i += 1) if (slots[i] === undefined) slots[i] = null;
    return slots;
  }
  function readSlots(userId) {
    var raw = localStorage.getItem(userKey(SLOTS_PREFIX, userId));
    if (!raw) LEGACY_SLOT_PREFIXES.some(function (prefix) {
      var legacyRaw = localStorage.getItem(userKey(prefix, userId));
      if (!legacyRaw) return false;
      var legacySlots = parse(legacyRaw, null);
      if (!Array.isArray(legacySlots)) return false;
      raw = JSON.stringify(legacySlots);
      write(userKey(SLOTS_PREFIX, userId), raw);
      return true;
    });
    return normalizeSlots(parse(raw, []));
  }
  function saveSlot(state, userId, slotIndex) {
    if (!userId || slotIndex < 0 || slotIndex >= SLOT_LIMIT) return null;
    var slots = readSlots(userId); var data = snapshot(state, userId); slots[slotIndex] = { savedAt: data.savedAt, state: data };
    var dataRaw = JSON.stringify(slots); if (!write(userKey(SLOTS_PREFIX, userId), dataRaw)) return null;
    save(state, userId); return clone(slots[slotIndex]);
  }
  function loadSlot(userId, slotIndex) { var entry = userId && slotIndex >= 0 && slotIndex < SLOT_LIMIT ? readSlots(userId)[slotIndex] : null; return entry ? hydrate(entry.state, userId) : null; }
  function saveCheckpoint(state, userId, meta) {
    var id = userId || state.userId; if (!id) return false;
    var data = snapshot(state, id); data.checkpoint = Object.assign({}, meta || {}, { savedAt: data.savedAt });
    if (!write(userKey(CHECKPOINT_PREFIX, id), JSON.stringify(data))) return false;
    state.checkpoint = data.checkpoint; return clone(data);
  }
  function loadCheckpoint(userId) {
    if (!userId) return null;
    try { return hydrate(parse(localStorage.getItem(userKey(CHECKPOINT_PREFIX, userId)), null), userId); }
    catch (error) { console.warn("检查点读取失败。", error); return null; }
  }
  function readKeys(userId) {
    if (!userId) return [];
    try { var value = parse(localStorage.getItem(userKey(READ_PREFIX, userId)), []); return Array.isArray(value) ? value.filter(function (key) { return typeof key === "string"; }) : []; }
    catch (error) { return []; }
  }
  function markRead(userId, key) {
    if (!userId || !key) return false;
    var keys = readKeys(userId); if (keys.indexOf(key) !== -1) return true;
    keys.push(key); if (keys.length > 5000) keys.splice(0, keys.length - 5000);
    return write(userKey(READ_PREFIX, userId), JSON.stringify(keys));
  }
  function hasRead(userId, key) { return readKeys(userId).indexOf(key) !== -1; }
  function deleteSlot(userId, slotIndex) { if (!userId || slotIndex < 0 || slotIndex >= SLOT_LIMIT) return false; var slots = readSlots(userId); if (!slots[slotIndex]) return false; slots[slotIndex] = null; return write(userKey(SLOTS_PREFIX, userId), JSON.stringify(slots)); }
  function listSlots(userId) { return clone(readSlots(userId)); }
  function clear(userId) { if (!userId) return; remove(userKey(AUTO_PREFIX, userId)); remove(userKey(SLOTS_PREFIX, userId)); remove(userKey(CHECKPOINT_PREFIX, userId)); remove(userKey(READ_PREFIX, userId)); remove(userKey(GUARD_PREFIX, userId)); remove(userKey(REVISION_PREFIX, userId)); LEGACY_PREFIXES.concat(LEGACY_SLOT_PREFIXES).forEach(function (prefix) { remove(userKey(prefix, userId)); }); }
  function hasSave(userId) { if (!userId) return false; return Boolean(localStorage.getItem(userKey(AUTO_PREFIX, userId)) || LEGACY_PREFIXES.some(function (prefix) { return localStorage.getItem(userKey(prefix, userId)); }) || readSlots(userId).some(Boolean)); }

  // Map entry checks share the same canonical scene ids as completion records.
  var sceneAliases = {
    opening: "scene-01", "note-intro": "scene-03", "note-repeat": "scene-03",
    "wardrobe-clue": "scene-02", "wardrobe-repeat": "scene-02", mirror: "mirror-inspect",
    terminal: "scene-03-tv", "guard-intro": "scene-07", "guard-repeat": "scene-07",
    contract: "scene-15", "contract-repeat": "scene-15", "ending-choice": "scene-31"
  };
  function canonicalScene(id) { return sceneAliases[id] || id; }
  function sceneCompleted(state, id) {
    // Documents and the television remain available for repeat inspection.
    if (["rules-inspect", "note-inspect", "tv-inspect"].indexOf(id) !== -1) return false;
    var key = canonicalScene(id);
    var flags = state.flags || {};
    if (flags["completed:" + key]) return true;
    var match = /^scene-(\d{2})$/.exec(key);
    return Boolean(match && flags["scene" + match[1] + "Seen"]);
  }
  function completeScene(state, id) {
    state.flags["completed:" + canonicalScene(id)] = true;
  }

  window.MuseumState = { sceneCompleted: sceneCompleted, completeScene: completeScene, SLOT_LIMIT: SLOT_LIMIT, create: createState, save: save, saveGuarded: saveGuarded, adoptRevision: adoptRevision, load: load, saveSlot: saveSlot, loadSlot: loadSlot, saveCheckpoint: saveCheckpoint, loadCheckpoint: loadCheckpoint, markRead: markRead, hasRead: hasRead, deleteSlot: deleteSlot, listSlots: listSlots, clear: clear, hasSave: hasSave };
}());
