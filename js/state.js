(function () {
  "use strict";

  var SLOT_LIMIT = 20;
  var AUTO_PREFIX = "museum_save_v4_auto_";
  var SLOTS_PREFIX = "museum_save_v4_slots_";
  var LEGACY_PREFIXES = ["museum_save_v3_auto_", "museum_save_v2_auto_", "museum_save_v1_"];
  var LEGACY_SLOT_PREFIXES = ["museum_save_v3_slots_", "museum_save_v2_slots_", "museum_save_v1_slots_"];
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
    understoodTruth: false
  };
  var DEFAULT_STATE = {
    schemaVersion: 4,
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
    dialogueLog: [],
    task: "调查宿舍，寻找离开的办法。",
    returnRoom: null,
    returnX: null,
    returnY: null,
    returnFacing: "down",
    returnScene: null,
    ending: null,
    endingComplete: false,
    savedAt: null,
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
    state.schemaVersion = 4;
    state.flags = Object.assign({}, DEFAULT_FLAGS, loaded.flags || {});
    state.clues = Array.isArray(state.clues) ? state.clues : [];
    state.inventory = Array.isArray(state.inventory) ? state.inventory : [];
    state.discovered = Array.isArray(state.discovered) ? state.discovered : [];
    state.unlockedRooms = Array.isArray(state.unlockedRooms) ? state.unlockedRooms : ["dorm"];
    state.achievements = Array.isArray(state.achievements) ? state.achievements : [];
    state.dialogueLog = Array.isArray(state.dialogueLog) ? state.dialogueLog : [];
    state.narrativeLogKeys = Array.isArray(state.narrativeLogKeys) ? state.narrativeLogKeys : [];
    if (state.mode === "dialogue" || state.mode === "mini" || state.mode === "battle") state.mode = "explore";
    if (loaded.currentNode && !loaded.roomId) state.roomId = loaded.currentNode;
    if (typeof state.playerX !== "number") state.playerX = state.roomId === "hall" ? 260 : 300;
    if (typeof state.playerY !== "number") state.playerY = state.roomId === "dorm" ? 520 : 460;
    return state;
  }
  function parse(raw, fallback) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (error) { console.warn("存档数据损坏，已忽略。", error); return fallback; }
  }
  function snapshot(state, userId) { var data = clone(state); data.userId = userId || state.userId; data.savedAt = new Date().toISOString(); return data; }
  function save(state, userId) {
    var id = userId || state.userId; if (!id) return null;
    var data = snapshot(state, id); state.savedAt = data.savedAt; localStorage.setItem(userKey(AUTO_PREFIX, id), JSON.stringify(data)); return data.savedAt;
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
      localStorage.setItem(userKey(SLOTS_PREFIX, userId), raw);
      return true;
    });
    return normalizeSlots(parse(raw, []));
  }
  function saveSlot(state, userId, slotIndex) {
    if (!userId || slotIndex < 0 || slotIndex >= SLOT_LIMIT) return null;
    var slots = readSlots(userId); var data = snapshot(state, userId); slots[slotIndex] = { savedAt: data.savedAt, state: data };
    localStorage.setItem(userKey(SLOTS_PREFIX, userId), JSON.stringify(slots)); save(state, userId); return clone(slots[slotIndex]);
  }
  function loadSlot(userId, slotIndex) { var entry = userId && slotIndex >= 0 && slotIndex < SLOT_LIMIT ? readSlots(userId)[slotIndex] : null; return entry ? hydrate(entry.state, userId) : null; }
  function deleteSlot(userId, slotIndex) { if (!userId || slotIndex < 0 || slotIndex >= SLOT_LIMIT) return false; var slots = readSlots(userId); if (!slots[slotIndex]) return false; slots[slotIndex] = null; localStorage.setItem(userKey(SLOTS_PREFIX, userId), JSON.stringify(slots)); return true; }
  function listSlots(userId) { return clone(readSlots(userId)); }
  function clear(userId) { if (!userId) return; localStorage.removeItem(userKey(AUTO_PREFIX, userId)); localStorage.removeItem(userKey(SLOTS_PREFIX, userId)); LEGACY_PREFIXES.concat(LEGACY_SLOT_PREFIXES).forEach(function (prefix) { localStorage.removeItem(userKey(prefix, userId)); }); }
  function hasSave(userId) { if (!userId) return false; return Boolean(localStorage.getItem(userKey(AUTO_PREFIX, userId)) || LEGACY_PREFIXES.some(function (prefix) { return localStorage.getItem(userKey(prefix, userId)); }) || readSlots(userId).some(Boolean)); }

  window.MuseumState = { SLOT_LIMIT: SLOT_LIMIT, create: createState, save: save, load: load, saveSlot: saveSlot, loadSlot: loadSlot, deleteSlot: deleteSlot, listSlots: listSlots, clear: clear, hasSave: hasSave };
}());
