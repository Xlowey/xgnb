/*
 * 人性值（013）。
 *
 * 013 §一：同样是「掉到 0 就死」，把这条数值命名为**人性**，整个系统的含义就变了——
 * 它往下掉的意思不是「你受伤了」，而是「**你正在变成怪谈的一部分**」。
 *
 * 历史：这个字段原来叫 `state.hp`，量纲 0–25，只当战斗血量用。013 落地后改成
 * **0–100 的人性值**；字段名保留 `hp`（老存档靠 humanityVersion 标记区分，见 state.js）。
 *
 * 与 `js/points.js` 的分工：生存点是**纯货币**（买得到东西），人性值**买不到**——
 * 它只能被消耗（战斗、时间）或被挽回（线索、锚点道具）。两者互不换算。
 *
 * 三条硬规矩：
 *   1. **所有增减都走这个模块**，不要在别处直接改 state.hp——否则飘字、刷新、
 *      归零判定都会漏掉；
 *   2. 每一次增减都要飘字并注明来源（013 §一「让玩家看见自己正在失去什么」）；
 *   3. 归零不是立刻死：先看有没有【回滚】，有就消耗一枚回满，没有才走结局 D。
 *
 * 用法：
 *   window.MuseumHumanity.bind({ getState: ..., save: ..., onZero: ... });
 *   window.MuseumHumanity.damage(14 + hits * 6, "馆长战");
 *   window.MuseumHumanity.heal(15, "【锚点 · 与赵灵的一次独处】");
 */
(function () {
  "use strict";

  // 013 §二：初值 100，归零即「完全怪谈化」。
  var MAX = 100;
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

  function clamp(number) {
    var value = Math.round(Number(number));
    if (!Number.isFinite(value)) return MAX;
    return Math.max(0, Math.min(MAX, value));
  }

  function read(state) {
    var raw = state ? Number(state.hp) : MAX;
    // state.hp 是全仓唯一没有数值校验的字段（hydrate 也不查它），所以这里自己兜底，
    // 免得 NaN 顺着面板显示出去（js/panel.js 那格原来是裸的 String(state.hp)）。
    return Number.isFinite(raw) ? clamp(raw) : MAX;
  }

  function write(state, value) {
    if (!state) return;
    state.hp = clamp(value);
  }

  function value() { return read(current()); }

  // 013 §一要求的写法：`−14 战斗损耗`、`+15 【锚点 · 与赵灵的一次独处】`。
  // 减号用 U+2212（真减号），与 012 / 013 的行文一致。
  function format(delta, source) {
    return (delta >= 0 ? "+" : "−") + Math.abs(delta) + (source ? " " + source : "");
  }

  function ensureUI() {
    if (stack && stack.isConnected) return;
    stack = node("div", "humanity-floats");
    // 飘字只是视觉反馈，逐条朗读会把读屏刷屏；改由下面这个礼貌级 live region 播报最新一条。
    stack.setAttribute("aria-hidden", "true");
    live = node("p", "humanity-live");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
    document.body.appendChild(live);
  }

  function drop(element) {
    if (element.isConnected) element.remove();
  }

  function float(delta, source) {
    ensureUI();
    var text = format(delta, source);
    var item = node("span", "humanity-float " + (delta >= 0 ? "is-heal" : "is-drain"), text);
    stack.appendChild(item);
    // animationend 有可能不触发（标签页切后台、动画被浏览器停掉），加一条定时兜底，
    // 否则飘字会永远堆在那里。和 js/points.js 的做法一致。
    item.addEventListener("animationend", function () { drop(item); });
    window.setTimeout(function () { drop(item); }, FLOAT_LIFETIME);
    live.textContent = text;
  }

  // 没扣成 / 触发复活之类的提示，和飘字同一条通道，但不是一个 delta。
  function notice(text) {
    ensureUI();
    var item = node("span", "humanity-float is-notice", text);
    stack.appendChild(item);
    item.addEventListener("animationend", function () { drop(item); });
    window.setTimeout(function () { drop(item); }, FLOAT_LIFETIME);
    live.textContent = text;
  }

  // ---------- 增减 ----------

  function applyDamage(state, amount, source) {
    var owed = Math.round(Number(amount));
    if (!Number.isFinite(owed) || owed <= 0) {
      console.warn("人性值扣减必须是正数，已忽略：", amount, source);
      return read(state);
    }
    // 下限钳到 0：扣到 0 就停，溢出的部分不记在账上——归零本来就是终局，不是欠债。
    var paid = Math.min(read(state), owed);
    if (paid <= 0) return 0;
    write(state, read(state) - paid);
    float(-paid, source);
    return read(state);
  }

  function applyHeal(state, amount, source) {
    var gained = Math.round(Number(amount));
    if (!Number.isFinite(gained) || gained <= 0) {
      console.warn("人性值回复必须是正数，已忽略：", amount, source);
      return read(state);
    }
    var before = read(state);
    // 上限钳到 MAX：满了就不涨，也不记溢出。
    write(state, before + gained);
    var real = read(state) - before;
    if (real > 0) float(real, source);
    return read(state);
  }

  // 归零结算。返回 "rollback" / "ending-d" / null（没归零）。
  //
  // 【回滚】是玩家自己买的那件免死道具（js/shop-data.js 的 rollback，300 点）。
  // 013 §四：复活干净利落、回满 100 无后患——**人性值归零 = 一张 300 生存点的账单**。
  // 没有回滚就交给 onZero，由各页面自己决定怎么走结局 D（地图页要跳转、剧情页要切场景）。
  function settleZero(state) {
    if (read(state) > 0) return null;
    if (spendRollback(state)) return "rollback";
    if (context && typeof context.onZero === "function") context.onZero(state);
    return "ending-d";
  }

  function rollbackHeld(state) {
    if (!window.MuseumShop || typeof window.MuseumShop.count !== "function") return 0;
    return window.MuseumShop.count("rollback");
  }

  function spendRollback(state) {
    if (rollbackHeld(state) <= 0) return false;
    window.MuseumShop.consume("rollback");
    write(state, MAX);
    // ⚠️ 这一行不能省：`consume()` 内部会 persist，但那一刻 state.hp 还是 0——
    // 盘上会留下「hp:0 且回滚已被扣掉」的存档。玩家一刷新就被判成归零且无回滚，
    // 直接推进结局 D，等于花 300 点买了张废纸。必须回满之后再写一次盘。
    persist();
    notice("【回滚】已消耗 · 人性值回满 100");
    return true;
  }

  // ---------- 公开接口 ----------

  // 扣，**显式指定 state**。给「还没 bind 就得结算」的场景用——典型的是 js/novel.js 顶部的
  // 课堂预览结算（`previewResume` 那段在 IIFE 顶部跑，早于 bind）。同一个文件里的
  // unlockAchievement() 也是这个写法。
  // 注意：没 bind 时 persist() 是空转，所以调用方自己负责存盘。
  function damageOn(state, amount, source) {
    if (!state) return MAX;
    applyDamage(state, amount, source);
    refresh();
    persist();
    settleZero(state);
    refresh();
    return read(state);
  }

  // 扣。返回扣完之后的值。扣到 0 会立刻结算归零（有【回滚】就消耗一枚回满，没有就走结局 D）。
  function damage(amount, source) { return damageOn(current(), amount, source); }

  // 回。返回回完之后的值。
  function heal(amount, source) {
    var state = current();
    if (!state) return MAX;
    applyHeal(state, amount, source);
    refresh();
    persist();
    return read(state);
  }

  // 直接设值（迁移、测试、剧情硬置）。会做钳制，但**不**做归零结算——
  // 它是"设定"不是"造成伤害"，不该因为没有回滚就把玩家推进结局 D。
  function set(next, options) {
    var state = current();
    if (!state) return MAX;
    write(state, next);
    refresh();
    if (!options || options.save !== false) persist();
    return read(state);
  }

  // 013 §8.2 的预警线（「人性值低于 30 时，面板人形应该明显变形、画面出现蜡像化滤镜，
  // 并有明确文字提示。让玩家死得明白，而不是被偷袭」）。旋钮在 js/humanity-data.js。
  function lowWarn() {
    var table = window.MuseumHumanityTuning || {};
    var value = Number(table.lowWarn);
    return Number.isFinite(value) ? value : 30;
  }

  function refresh() {
    var state = current();
    if (!state) return;
    var amount = read(state);
    var text = String(amount);
    document.querySelectorAll("[data-humanity-value]").forEach(function (element) {
      element.textContent = text;
    });
    // 013 §二 / §8.2 的接口留给下一轮：这个比值和 .is-low 就是蜡像化人形与预警滤镜的全部输入，
    // 届时只需要写 CSS（见 js/panel.js 里那个 [data-humanity-figure] 占位容器）。
    document.querySelectorAll("[data-humanity-row]").forEach(function (row) {
      row.setAttribute("data-humanity-ratio", (amount / MAX).toFixed(3));
      row.classList.toggle("is-low", amount < lowWarn());
    });
    // 面板那格也要跟着走（面板开着的时候掉血是常态）。别的页面没有面板，守卫一下。
    if (window.MuseumPanel && window.MuseumPanel.refresh) window.MuseumPanel.refresh();
  }

  function bind(options) {
    context = options || null;
    refresh();
  }

  // ---------- 旗标扫描（013 §3.1 的时间流逝 + §3.3 的回血）----------
  //
  // 与 js/milestones.js 同构：一条 = 「某个旗标成立 → 变一笔人性值，且只变一次」，
  // 幂等靠 state.flags["humanity:<id>"]，复用现成的旗标袋，不加新变量、不改存档结构。
  //
  // 做成扫描而不是事件点，理由和里程碑一样：**老存档也能补**。玩家旗标早就在存档里了，
  // 扫描一跑就该把欠的人性值补上。
  function claimed(state, id) {
    return Boolean(state && state.flags && state.flags["humanity:" + id]);
  }

  function settle(state) {
    if (!state) return [];
    var table = window.MuseumHumanityDefinitions || [];
    var fired = [];

    table.forEach(function (item) {
      if (!item || claimed(state, item.id)) return;
      var hit = false;
      // 单条判定出错不能卡住整轮：漏一次下次扫描还会补，抛出去就全都结算不了了。
      try {
        if (typeof item.check === "function") hit = Boolean(item.check(state));
        else if (item.flag) hit = Boolean(state.flags && state.flags[item.flag]);
      } catch (error) {
        console.warn("人性值判定出错，已跳过：" + item.id, error);
        return;
      }
      if (!hit) return;
      // 先记旗标再改数值：万一后面抛错，也不会变成每次扫描都重来一遍。
      state.flags["humanity:" + item.id] = true;
      var delta = Math.round(Number(item.delta));
      if (Number.isFinite(delta) && delta > 0) applyHeal(state, delta, item.source);
      else if (Number.isFinite(delta) && delta < 0) applyDamage(state, -delta, item.source);
      fired.push(item.id);
    });

    if (fired.length) { refresh(); persist(); }
    // 归零判定**每轮都做**，不能只在 fired 非空时做：从 0–25 量纲换算过来的老档可能
    // 本来就是 0（旧档 hp:0），那之后若再也没有旗标触发，玩家会一直停在 0 上不结算。
    settleZero(state);
    refresh();
    return fired;
  }

  window.MuseumHumanity = {
    MAX: MAX,
    value: value,
    set: set,
    damage: damage,
    damageOn: damageOn,
    heal: heal,
    settle: settle,
    settleZero: settleZero,
    rollbackHeld: rollbackHeld,
    notice: notice,
    refresh: refresh,
    format: format,
    bind: bind
  };
}());
