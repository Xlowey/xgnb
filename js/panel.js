/*
 * 系统面板（012 §3.2）。按 M 打开。
 *
 * 012 的原话是「本面板只用已经存在的东西组成，不新增任何未定案机制」，所以这里
 * 每一个格子都对着一个真实变量，没有一个是写死的：
 *
 *   等级      state.level      Lv.03  ← 009 第四场面板
 *   生存点    state.points     240    ← 012 §3.1
 *   生命      state.hp         25     ← 013 的人性值落地后改叫「人性值」，量纲 100
 *   NPC 信任度 state.npcTrust   31%    ← 009 第四场面板 / 008（009 第十二场「角色信任松动」靠它）
 *   任务列表   009 第一场        ①②③ + 隐藏任务
 *   券机的账   state.machine.*        ← 012 §3.2 规则三
 *
 * 两条交互规则（012 §3.2）：
 *   规则二：点生存点 → 展开收支明细，只显示最近 6 条（排版与券机的「最近记录」同构）；
 *   规则三：券机入口旁常驻一行券机自己的账，而且这行数字应该一直是负的、系统不会提醒你。
 *
 * 本版明确不做（012 §3.2 末）：建议记录、面具完整度、倒计时、规则对照表、信任双轴联动、被注视度。
 */
(function () {
  "use strict";

  var LEDGER_LIMIT = 6; // 012 §3.2 规则二

  // 009 第一场的系统任务原文：
  //   「请扮演好博物馆的保安的角色，并完成以下任务：① 存活三天 ② 找出异变源头 ③ 找出唯一活人。」
  // 012 §3.2 给的初值是「全未完成」。
  var TASKS = [
    { id: "survive", label: "存活三天" },
    { id: "source", label: "找出异变源头" },
    { id: "alive", label: "找出唯一活人" }
  ];

  // 完成信号表。**现在是空的，这是有意的**：代码里还没有任何一条任务有真实信号——
  // state.js 的 understoodTruth 从来没被写过，012 §4.2 的三天节点（第十三 / 二十三 / 二十五场）
  // 也还没接，而 008 的 SC 编号 ↔ 009 场次编号对照表本来就缺（012 §11 的待办）。
  // 与其编一个假的勾，不如留空：接好一条就往这里加一行，done 自动生效。
  var TASK_DONE = {
    // survive: function (state) { return state.day >= 3; },
    // source: function (state) { return Boolean(state.flags.understoodTruth); },
    // alive: function (state) { /* 待定：009 里「唯一活人」的结论没有对应旗标 */ }
  };

  function taskDone(state, id) {
    var fn = TASK_DONE[id];
    return typeof fn === "function" ? Boolean(fn(state)) : false;
  }

  var dialog = null, closeButton = null;
  var levelCell = null, pointsCell = null, humanCell = null, trustCell = null;
  var ledgerBox = null, ledgerList = null, taskList = null, machineLine = null;
  // 面板有两个视图：概览（012 §3.2 那张草图）和商城。商城点入口切过去，
  // 不另开一个 dialog —— 012 的草图上 商城 就是面板上的一个入口。
  var overviewView = null, shopView = null, shopContainer = null, currentView = "overview";
  var context = null, returnFocus = null, ledgerOpen = false;
  // 券机在 demos/scratch/。从 js/panel.js 往上二级就是仓库根，index.html 和 pages/novel.html 都适用。
  var SCRIPT = document.currentScript;
  var ROOT_URL = SCRIPT ? new URL("../", SCRIPT.src).href : "../";

  // 012 §3.2 的福利券机入口。券机是高频反复的，不塞进这个 dialog（它的票面比面板大得多），
  // 走小游戏那套跳转：带着 userId 和回跳地址过去，余额由它直接读写主游戏的 points。
  function openScratchMachine() {
    var state = current();
    if (!state || !state.userId) return;
    window.location.href = ROOT_URL + "demos/scratch/index.html" +
      "?from=panel&user=" + encodeURIComponent(state.userId) +
      "&returnTo=" + encodeURIComponent(window.location.href);
  }

  function node(tag, cls, text) {
    var element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function button(label, onClick, cls) {
    var element = node("button", cls || "panel-button", label);
    element.type = "button";
    if (onClick) element.addEventListener("click", onClick);
    return element;
  }
  function current() { return context && context.getState ? context.getState() : null; }
  function isOpen() { return Boolean(dialog && dialog.open); }

  function clockOf(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }

  function ensureUI() {
    if (dialog) return;
    dialog = node("dialog", "panel-dialog");
    dialog.setAttribute("aria-labelledby", "panel-title");

    var header = node("header", "panel-header");
    var titleBox = node("div", "panel-title-box");
    titleBox.appendChild(node("small", "panel-eyebrow", "系统 · 怪谈博物馆副本"));
    var title = node("h2", "", "Lv.03");
    title.id = "panel-title";
    levelCell = title;
    titleBox.appendChild(title);
    header.appendChild(titleBox);
    closeButton = button("关闭", function () { close(); }, "panel-button panel-close");
    header.appendChild(closeButton);
    dialog.appendChild(header);

    var body = node("div", "panel-body");
    overviewView = node("div", "panel-view");

    // ---- 生存点 / 生命 / 两个入口 ----
    var vitals = node("section", "panel-vitals");
    var stats = node("div", "panel-stats");

    var pointsRow = button("", function () { setLedgerOpen(!ledgerOpen); }, "panel-points");
    pointsRow.appendChild(node("span", "panel-label", "生存点"));
    pointsCell = node("strong", "panel-value");
    pointsCell.setAttribute("data-points-value", "");
    pointsRow.appendChild(pointsCell);
    pointsRow.appendChild(node("span", "panel-caret", "▾"));
    stats.appendChild(pointsRow);

    var humanRow = node("div", "panel-stat");
    humanRow.appendChild(node("span", "panel-label", "生命"));
    humanCell = node("strong", "panel-value");
    humanRow.appendChild(humanCell);
    stats.appendChild(humanRow);
    vitals.appendChild(stats);

    var entries = node("div", "panel-entries");
    var machineButton = button("福利券机", function () { openScratchMachine(); }, "panel-entry");
    machineButton.setAttribute("data-machine-open", "");
    entries.appendChild(machineButton);
    machineLine = node("p", "panel-machine");
    entries.appendChild(machineLine);
    var shopButton = button("商　城", function () { showView("shop"); }, "panel-entry");
    shopButton.setAttribute("data-shop-open", "");
    entries.appendChild(shopButton);
    vitals.appendChild(entries);
    overviewView.appendChild(vitals);

    // ---- 收支明细（012 §3.2 规则二：点生存点展开，只显示最近 6 条）----
    ledgerBox = node("section", "panel-ledger");
    ledgerBox.hidden = true;
    var ledgerHeading = node("div", "panel-ledger-heading");
    var ledgerTitleBox = node("div");
    ledgerTitleBox.appendChild(node("p", "panel-eyebrow", "收支存根"));
    ledgerTitleBox.appendChild(node("h3", "", "最近记录"));
    ledgerHeading.appendChild(ledgerTitleBox);
    ledgerHeading.appendChild(node("span", "panel-ledger-note", "最多保留 " + LEDGER_LIMIT + " 条"));
    ledgerBox.appendChild(ledgerHeading);
    ledgerList = node("div", "panel-ledger-list");
    ledgerBox.appendChild(ledgerList);
    overviewView.appendChild(ledgerBox);

    // ---- NPC 信任度 ----
    var trust = node("section", "panel-trust");
    trust.appendChild(node("span", "panel-label", "NPC 信任度"));
    trustCell = node("strong", "panel-value");
    trust.appendChild(trustCell);
    overviewView.appendChild(trust);

    // ---- 任务列表 ----
    var tasks = node("section", "panel-tasks");
    tasks.appendChild(node("h3", "", "任务"));
    taskList = node("ul", "panel-task-list");
    tasks.appendChild(taskList);
    overviewView.appendChild(tasks);
    body.appendChild(overviewView);

    // ---- 商城视图（同一块面板里切过来，不另开 dialog）----
    shopView = node("div", "panel-view");
    shopView.hidden = true;
    var shopBar = node("div", "panel-subbar");
    shopBar.appendChild(button("← 返回面板", function () { showView("overview"); }, "panel-button panel-back"));
    shopBar.appendChild(node("span", "panel-subbar-title", "商城"));
    shopView.appendChild(shopBar);
    shopContainer = node("div", "panel-shop");
    shopView.appendChild(shopContainer);
    body.appendChild(shopView);

    dialog.appendChild(body);
    dialog.appendChild(node("footer", "panel-footer", "M / Esc 关闭"));

    // 点遮罩关闭，和 achievements 一致。
    dialog.addEventListener("cancel", function (event) { event.preventDefault(); close(); });
    dialog.addEventListener("click", function (event) { if (event.target === dialog) close(); });
    document.body.appendChild(dialog);
  }

  function renderLedger() {
    var points = window.MuseumPoints;
    ledgerList.textContent = "";
    var entries = points ? points.recent(LEDGER_LIMIT) : [];
    if (!entries.length) {
      ledgerList.appendChild(node("p", "panel-ledger-empty", "还没有任何收支。"));
      return;
    }
    entries.forEach(function (entry) {
      var item = node("div", "panel-ledger-item");
      var copy = node("div", "panel-ledger-copy");
      copy.appendChild(node("strong", "", entry.source || "未注明"));
      copy.appendChild(node("span", "", clockOf(entry.at)));
      item.appendChild(copy);
      var amount = node("span", "panel-ledger-amount " + (entry.delta >= 0 ? "is-gain" : "is-cost"), points.format(entry.delta, ""));
      item.appendChild(amount);
      ledgerList.appendChild(item);
    });
  }

  function renderTasks(state) {
    taskList.textContent = "";
    TASKS.forEach(function (task, index) {
      var done = taskDone(state, task.id);
      var item = node("li", "panel-task" + (done ? " is-done" : ""));
      item.appendChild(node("span", "panel-task-index", "①②③"[index] || "·"));
      item.appendChild(node("span", "panel-task-label", task.label));
      item.appendChild(node("span", "panel-task-mark", done ? "☑" : "□"));
      taskList.appendChild(item);
    });
    // 隐藏任务：009 的原文就是「？？？？？」，012 §3.2 的初值也是未完成。
    var hidden = node("li", "panel-task is-hidden");
    hidden.appendChild(node("span", "panel-task-index", ""));
    hidden.appendChild(node("span", "panel-task-label", "？？？？？"));
    hidden.appendChild(node("span", "panel-task-mark", "？"));
    taskList.appendChild(hidden);
  }

  function render() {
    var state = current();
    if (!state) return;
    levelCell.textContent = "Lv." + String(Math.max(0, Math.round(state.level))).padStart(2, "0");
    pointsCell.textContent = String(window.MuseumPoints ? window.MuseumPoints.balance() : state.points);
    humanCell.textContent = String(state.hp);
    trustCell.textContent = Math.round(state.npcTrust) + "%";

    // 012 §3.2 规则三：这行数字应该一直是负的，而且系统不会提醒你。
    var machine = state.machine || { tickets: 0, spent: 0 };
    machineLine.textContent = "已购 " + machine.tickets + " 张 · 累计 " + (machine.spent > 0 ? "−" + machine.spent : "0") + " 点";

    renderLedger();
    renderTasks(state);
    // 商城开着的时候也要跟着刷新：买完一件余额就变了。
    if (currentView === "shop" && window.MuseumShop) window.MuseumShop.render();
  }

  function refresh() { if (isOpen()) render(); }

  function showView(name) {
    var shop = name === "shop";
    currentView = shop ? "shop" : "overview";
    if (overviewView) overviewView.hidden = shop;
    if (shopView) shopView.hidden = !shop;
    if (window.MuseumShop) {
      if (shop && shopContainer) window.MuseumShop.mount(shopContainer);
      else window.MuseumShop.unmount();
    }
    // 切走以后焦点还留在被隐藏的那个按钮上，Tab 就会跑到看不见的地方去。
    if (dialog) {
      var target = shop ? dialog.querySelector(".panel-back") : dialog.querySelector(".panel-entry:not([disabled])");
      if (target) target.focus();
    }
  }

  function setLedgerOpen(open) {
    ledgerOpen = Boolean(open);
    if (ledgerBox) ledgerBox.hidden = !ledgerOpen;
    var row = dialog && dialog.querySelector(".panel-points");
    if (row) row.setAttribute("aria-expanded", String(ledgerOpen));
    if (ledgerOpen) renderLedger();
  }

  function open() {
    if (!context || !current() || (context.canOpen && !context.canOpen()) || isOpen()) return;
    ensureUI();
    returnFocus = document.activeElement;
    if (context.onOpen) context.onOpen();
    ledgerOpen = false;
    setLedgerOpen(false);
    showView("overview");
    render();
    dialog.showModal();
    closeButton.focus();
  }

  function close() {
    if (!isOpen()) return;
    if (window.MuseumShop) window.MuseumShop.unmount();
    dialog.close();
    if (context && context.onClose) context.onClose();
    if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
  }

  function bind(options) { context = options || null; }

  document.addEventListener("keydown", function (event) {
    if (isOpen()) {
      event.stopImmediatePropagation();
      if (event.key === "Escape" || event.key.toLowerCase() === "m") {
        event.preventDefault();
        if (!event.repeat) close();
      }
      return;
    }
    if (event.key.toLowerCase() !== "m" || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest && event.target.closest("input,textarea,select,[contenteditable=true]")) return;
    if (context && current() && (!context.canOpen || context.canOpen())) {
      event.preventDefault();
      event.stopImmediatePropagation();
      open();
    }
  }, true);

  // 页面上的「系统 · M」按钮由各页面自己接线（和背包 / 成就一致，不用事件委托）。
  // 按钮上留了 data-panel-open 供测试和后续刷新用。

  window.MuseumPanel = {
    bind: bind,
    open: open,
    close: close,
    isOpen: isOpen,
    refresh: refresh,
    taskDone: taskDone,
    TASKS: TASKS
  };
}());
