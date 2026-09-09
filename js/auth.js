(function () {
  "use strict";

  // 这是课堂原型的本地账号，不是联网认证：账号只存在 localStorage。
  var USERS_KEY = "museum_users_v1";
  var SESSION_KEY = "museum_session_v1";

  function readUsers() {
    try {
      var raw = localStorage.getItem(USERS_KEY);
      var users = raw ? JSON.parse(raw) : [];
      return Array.isArray(users) ? users : [];
    } catch (error) {
      return [];
    }
  }

  function writeUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function makeId() {
    return "u_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function textHash(text) {
    // 仅用于避免明文显示；本地 demo 不具备真正的安全认证能力。
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function normalizeName(name) { return name.trim(); }
  function findByName(users, name) {
    var lower = normalizeName(name).toLowerCase();
    return users.find(function (user) { return user.username.toLowerCase() === lower; });
  }

  function register(username, password) {
    if (typeof password !== "string" || !password.trim()) return { ok: false, message: "请填写口令。" };
    var name = normalizeName(username);
    if (name.length < 1 || name.length > 16) return { ok: false, message: "档案名称需要 1—16 个字符。" };
    var users = readUsers();
    if (findByName(users, name)) return { ok: false, message: "这个档案名称已经存在，请换一个。" };
    var user = { id: makeId(), username: name, passwordHash: textHash(password), createdAt: new Date().toISOString() };
    users.push(user);
    writeUsers(users);
    localStorage.setItem(SESSION_KEY, user.id);
    return { ok: true, user: { id: user.id, username: user.username } };
  }

  function login(username, password) {
    if (typeof password !== "string" || !password.trim()) return { ok: false, message: "请填写口令。" };
    var user = findByName(readUsers(), username);
    if (!user || user.passwordHash !== textHash(password)) return { ok: false, message: "档案名称或口令不正确。" };
    localStorage.setItem(SESSION_KEY, user.id);
    return { ok: true, user: { id: user.id, username: user.username } };
  }

  function getCurrentUser() {
    var id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    var user = readUsers().find(function (item) { return item.id === id; });
    return user ? { id: user.id, username: user.username } : null;
  }

  function logout() { localStorage.removeItem(SESSION_KEY); }

  window.MuseumAuth = {
    register: register,
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    hasSession: function () { return Boolean(getCurrentUser()); }
  };
}());
