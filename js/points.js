/*
 * 生存点（012 §3.1 / §3.2）。
 *
 * 生存点是一门**纯货币**，和 hp（战斗血量、结局 D 判定）彻底分开。所有增减都必须走
 * 这个模块，不要在别处直接改 state.points —— 因为 012 §3.2 要求：
 *
 *   1. 每一次增减都要飘字，并注明来源（`+25 第一幕结算`、`−70 规则豁免`）；
 *   2. 收支明细保留最近若干条，面板上显示最近 6 条；
 *   3. 收入只发给"第一次做到"的事，重复劳动不给钱。
 *
 * 用法：
 *   window.MuseumPoints.bind({ getState: function () { return state; }, save: save });
 *   window.MuseumPoints.add(25, "第一幕结算");
 *   if (window.MuseumPoints.spend(70, "规则豁免")) { ... }
 */
(function () {
  "use strict";

  // 存 20 条、显示 6 条：012 只规定面板上显示最近 6 条，多留一些给后续面板翻页用。
  var LOG_LIMIT = 20;
  var RECENT_LIMIT = 6;
  var FLOAT_LIFETIME = 2600;

  var context = null;
  var stack = null;
  var live = null;

  function node(tag, cls, text) {
    var element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function current() { return context && context.getState ? context.getState() : null; }
  function persist() { if (context && context.save) context.save(); }

  function balance() {
    return balanceOn(current());
  }

  function balanceOn(state) {
    var value = state ? Number(state.points) : 0;
    return Number.isFinite(value) ? value : 0;
  }

  // 012 §3.2 的写法：`+25 第一幕结算`、`−70 规则豁免`。
  // 减号用 U+2212（真减号）而不是连字符，和文档一致。
  function format(delta, source) {
    return (delta >= 0 ? "+" : "−") + Math.abs(delta) + (source ? " " + source : "");
  }

  function ensureUI() {
    if (stack && stack.isConnected) return;
    stack = node("div", "points-floats");
    // 飘字本身只是视觉反馈，逐条朗读会把读屏刷屏；改由下面这个礼貌级 live region 播报最新一条。
    stack.setAttribute("aria-hidden", "true");
    live = node("p", "points-live");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
    document.body.appendChild(live);
  }

  function drop(element) {
    if (element.isConnected) element.remove();
  }

  function float(delta, source, extraClass) {
    ensureUI();
    var text = format(delta, source);
    var item = node("span", "points-float " + (delta >= 0 ? "is-gain" : "is-cost") + (extraClass ? " " + extraClass : ""), text);
    stack.appendChild(item);
    // 动画结束就移除；animationend 有可能不触发（标签页切后台、动画被浏览器停掉），
    // 所以再加一条定时兜底，否则飘字会永远堆在那里。
    item.addEventListener("animationend", function () { drop(item); });
    window.setTimeout(function () { drop(item); }, FLOAT_LIFETIME);
    live.textContent = text;
  }

  // 余额不足之类的"没扣成"的提示，和收支飘字用同一条通道，但不是一个 delta。
  function notice(text) {
    ensureUI();
    var item = node("span", "points-float is-denied", text);
    stack.appendChild(item);
    item.addEventListener("animationend", function () { drop(item); });
    window.setTimeout(function () { drop(item); }, FLOAT_LIFETIME);
    live.textContent = text;
  }

  function record(delta, source, target) {
    var state = target || current();
    if (!state) return null;
    if (!Array.isArray(state.pointsLog)) state.pointsLog = [];
    var entry = { delta: delta, source: source || "", at: new Date().toISOString() };
    state.pointsLog.push(entry);
    if (state.pointsLog.length > LOG_LIMIT) state.pointsLog.splice(0, state.pointsLog.length - LOG_LIMIT);
    return entry;
  }

  // 收入。delta 必须是正数——扣钱一律走 spend，这样"够不够付"只有一个判定点。
  function addOn(state, delta, source, options) {
    var amount = Math.round(Number(delta));
    if (!Number.isFinite(amount) || amount <= 0) {
      console.warn("生存点收入必须是正数，已忽略：", delta, source);
      return balanceOn(state);
    }
    if (!state) return 0;
    state.points = balanceOn(state) + amount;
    record(amount, source, state);
    // Result settlement can run before UI binding, or on a restored snapshot.
    // Credit that snapshot; never redirect its reward into the bound account.
    if (state === current()) {
      if (!options || options.notify !== false) float(amount, source);
      refresh();
      if (!options || options.save !== false) persist();
    }
    return state.points;
  }

  function add(delta, source) { return addOn(current(), delta, source); }

  // 支出。余额不足时**不动余额**并返回 false，由调用方决定怎么提示。
  function spend(cost, source) {
    var amount = Math.round(Number(cost));
    if (!Number.isFinite(amount) || amount <= 0) {
      console.warn("生存点支出必须是正数，已忽略：", cost, source);
      return false;
    }
    var state = current();
    if (!state) return false;
    if (balance() < amount) {
      notice("生存点不足：还差 " + (amount - balance()) + " 点");
      return false;
    }
    state.points = balance() - amount;
    record(-amount, source);
    float(-amount, source);
    refresh();
    persist();
    return true;
  }

  // 违规扣罚之类的**惩罚**。和 spend 的区别只有一条：余额不够也照扣，扣到 0 为止。
  // 这不是新口径——改之前守则小游戏写的是 Math.max(0, hp - 3)，本来就是"扣到 0"。
  // 走 spend 的话，只剩 50 点的玩家答错会一分不扣，惩罚当场落空。
  // 记进明细的是**实际扣掉的数**，这样明细加起来才等于余额的变化。
  function penalize(amount, source) {
    var owed = Math.round(Number(amount));
    if (!Number.isFinite(owed) || owed <= 0) {
      console.warn("生存点扣罚必须是正数，已忽略：", amount, source);
      return 0;
    }
    var state = current();
    if (!state) return 0;
    var paid = Math.min(balance(), owed);
    if (paid <= 0) {
      notice("生存点不足：" + (source || "扣罚") + "未生效");
      return 0;
    }
    state.points = balance() - paid;
    record(-paid, source);
    float(-paid, source);
    refresh();
    persist();
    return paid;
  }

  function canAfford(cost) {
    var amount = Math.round(Number(cost));
    return Number.isFinite(amount) && amount > 0 && balance() >= amount;
  }

  // 最近 n 条收支，最新的在前（面板上的明细列表直接按顺序渲染即可）。
  function recent(count) {
    var state = current();
    var log = state && Array.isArray(state.pointsLog) ? state.pointsLog : [];
    return log.slice(-(count || RECENT_LIMIT)).reverse();
  }

  // 刷新页面上所有显示余额的位置（暂停面板、系统面板）。
  // 还没有 state 时（例如刚 bind、玩家还没登录）直接返回，让 HTML 里写死的初值留在原地——
  // 否则面板在进游戏之前会先显示一个 0。
  function refresh() {
    if (!current()) return;
    var value = String(balance());
    document.querySelectorAll("[data-points-value]").forEach(function (element) { element.textContent = value; });
    // 系统面板的收支明细也得跟着走：面板开着的时候改钱是常态（商城、券机都在面板里），
    // 只更新数字不更新明细的话，玩家会看到余额变了、最近记录还是旧的。
    // 别的页面没有面板，守卫一下（state.js 调用 MuseumInventory / MuseumAchievements 也是这个写法）。
    if (window.MuseumPanel && window.MuseumPanel.refresh) window.MuseumPanel.refresh();
  }

  function bind(options) {
    context = options || null;
    refresh();
  }

  window.MuseumPoints = {
    add: add,
    addOn: addOn,
    spend: spend,
    penalize: penalize,
    notice: notice,
    balance: balance,
    canAfford: canAfford,
    recent: recent,
    refresh: refresh,
    format: format,
    bind: bind
  };
}());
