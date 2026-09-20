/*
 * 小游戏（demos/）里的系统面板外壳。
 *
 * 森林极速跑和暗影地牢都跑在**独立页面**里，玩家一进去就看不见主界面的系统面板了。
 * 但 012 的两条要求都指向"小游戏里也得能买"：
 *   - §5.1 的铁律是「买过系统商品 = 选择系统」，玩家得**有机会**在决战之前买；
 *   - §5.6 的玩法类道具（补给、破绽分析、助手…）本来就是战斗中途用的。
 * 所以这两个页面也要能按 M 开面板。
 *
 * 这个文件负责：
 *   1. 按同一个账号读回主游戏的存档（不是另开一份）
 *   2. 照主游戏的方式 bind 生存点 / 人性值 / 商城 / 面板
 *   3. M 键开关面板、Esc 关闭，开面板时把小游戏暂停（否则你在挑道具时会被撞死）
 *   4. 暴露已购道具折算出的参数，给小游戏自己读（见 MuseumShopData.runnerParams）
 *
 * **独立打开时什么都不做。** 如果主游戏的脚本没跟着加载（把 demo 目录单独拷出去、
 * 或者老师双击压缩包里的 index.html），window.MuseumState 之类就不存在，这里直接
 * 静默退出，小游戏照常能玩 —— 这条独立可玩的性质不能因为接了面板就丢掉。
 */
(function () {
  "use strict";

  var SCRIPT = document.currentScript;
  // 从 js/demo-shell.js 往上二级 = 仓库根。页面在 demos/<name>/ 下时同样成立。
  var ROOT_URL = SCRIPT ? new URL("../", SCRIPT.src).href : "../../";

  var query = new URLSearchParams(location.search);
  // 只有从主线进来的（带 user= 且不是课堂预览）才接面板：
  // 独立试玩没有账号、没有存档，课堂预览用的是临时状态，都不该往真存档里写。
  var userId = query.get("user");
  if (!userId || userId === "class-preview" || query.get("preview") === "1") return;

  var shell = {
    enabled: false,
    state: null,
    save: null,
    // 小游戏在创建完自己的 Game 之后调这个，面板开合时就会暂停/恢复它。
    attach: function (hooks) { gameHooks = hooks || null; },
    // 小游戏捡到金币时调这个，立即换成生存点（有上限、有节流，见上面的注释）。
    // 独立游玩 / 课堂预览时 shell.enabled 为假，这里自然什么都不做。
    earnCoins: function (count, source) {
      if (!shell.enabled) return 0;
      return earnCoins(count, source);
    },
    flushCoins: flushCoins,
    // 已购道具折算成小游戏参数（形如 "target=90&magnet=14"）。
    params: function () {
      if (!shell.state || !window.MuseumShopData) return "";
      return window.MuseumShopData.runnerParams(shell.state.shopOwned);
    }
  };
  var gameHooks = null;
  // 只有"是面板把它暂停的"才由面板恢复。玩家自己先按了暂停再开面板时，
  // 关掉面板不该把人家的暂停菜单一起关掉。
  var pausedByPanel = false;

  /*
   * 金币**实时**换生存点（2026-09-20）。
   *
   * 原来是等小游戏打完、把金币数带回主页面才一次性换算。问题是：面板就在小游戏里，
   * 可玩家中途攒的金币一分都花不了——面板等于只有一半用处。改成捡到就进账。
   *
   * 三条口径：
   *   1. **上限按"本次累计"算**（COIN_CAP = 40，与 js/game.js 的 coinPointCap 一致）。
   *      超额之后金币照收，只是不再换点。
   *   2. **输了也保留**——已经是实时的了，死了当然也留。这比原来"输了颗粒无收"宽容。
   *   3. **节流落盘**：MuseumPoints.add 每次都全量写存档，跑一趟几十枚就是几十次写盘。
   *      所以先在内存里攒，够 5 点或过了 2 秒才写一次；页面隐藏/卸载时补一次，
   *      否则玩家直接关标签页会丢掉没落盘的那部分。
   */
  // 汇率与上限的**唯一出处**是 js/shop-data.js（面板、结算兜底也要用同一个数）。
  // 万一那个模块没加载到，退回同样的默认值。金币在下面统一按"点"记账。
  var COIN_PER_POINT = (window.MuseumShopData && Number(window.MuseumShopData.COIN_PER_POINT)) || 1;
  // **0（或取不到）= 不设上限**，见 js/shop-data.js 的 COIN_POINT_CAP。
  var COIN_CAP = (window.MuseumShopData && Number(window.MuseumShopData.COIN_POINT_CAP)) || 0;
  var FLUSH_EVERY_POINTS = 5;
  var FLUSH_EVERY_MS = 2000;

  var coinPending = 0;       // 已换算、但还没落盘的点数
  var coinLabel = "";
  var lastFlushAt = 0;

  /*
   * 额度记在**存档**里（state.flags.liveCoinsEarned），不是内存里。
   *
   * 记内存的话有两个洞：**打输了重试一次就重新发 40 点**，**刷新页面也能清零重来**——
   * 上限形同虚设，玩家可以刷钱，012 那张「总收入 1010」的表直接失效。
   * 记进 flags 之后，重试和刷新都算在同一份额度里。
   * （state.flags 是自由合并的，不受 hydrate 的白名单限制，所以能存住。）
   */
  function coinsEarnedSoFar() {
    var flags = shell.state && shell.state.flags;
    var used = flags ? Number(flags.liveCoinsEarned) : 0;
    return Number.isFinite(used) && used > 0 ? used : 0;
  }

  function flushCoins() {
    if (!coinPending || !window.MuseumPoints) { coinPending = 0; return; }
    var amount = coinPending;
    coinPending = 0;
    lastFlushAt = Date.now();
    window.MuseumPoints.add(amount, coinLabel || "小游戏金币");
  }

  // 小游戏捡到金币时调这个。返回本次实际换到了几点（0 = 额度用完了）。
  function earnCoins(count, source) {
    if (!window.MuseumPoints) return 0;
    // 金币先折成"点"再记账，这样汇率改动时只有这一处要跟。
    var amount = Math.floor(Math.max(0, Number(count) || 0) / COIN_PER_POINT);
    // COIN_CAP 为 0 表示不设上限，这时 room 是 Infinity，下面 Math.min 会直接放过全额。
    var room = COIN_CAP > 0 ? Math.max(0, COIN_CAP - coinsEarnedSoFar()) : Infinity;
    if (!amount || room <= 0) return 0;
    var granted = Math.min(amount, room);
    coinPending += granted;
    if (shell.state && shell.state.flags) shell.state.flags.liveCoinsEarned = coinsEarnedSoFar() + granted;
    if (source) coinLabel = source;
    // ⚠️ 这里的初值判断不能省：lastFlushAt 初值是 0，而 Date.now() 是个巨大的数，
    //    直接去比 Date.now() - lastFlushAt >= 2000 会**恒真**，于是第一枚金币就落一次盘，
    //    节流形同虚设（2026-09-20 踩到）。所以第一次真正换算时先把计时起点立起来。
    if (!lastFlushAt) lastFlushAt = Date.now();
    // 让结果回传能告诉主游戏"这边已经换过了"，免得结算时再换一次（双重发钱）。
    window.__liveCoinsGranted = true;
    if (coinPending >= FLUSH_EVERY_POINTS || Date.now() - lastFlushAt >= FLUSH_EVERY_MS) flushCoins();
    return granted;
  }

  /*
   * 暂停 / 恢复小游戏。
   *
   * 两条来路：小游戏自己 attach 进来（森林极速跑在 Game 构造里调），或者它把
   * window.__dungeonPause / __dungeonResume 挂出来（暗影地牢那样，因为它的接入段
   * 在另一个 IIFE 里、拿不到 game.current）。谁在就用谁。
   * 返回 false = "当时不在可暂停的状态"，关面板时就不该去恢复。
   */
  function pauseGame() {
    if (gameHooks && gameHooks.pause) { try { return gameHooks.pause() !== false; } catch (error) { return false; } }
    if (typeof window.__dungeonPause === "function") { try { return window.__dungeonPause() !== false; } catch (error) { return false; } }
    return false;
  }
  function resumeGame() {
    if (gameHooks && gameHooks.resume) { try { gameHooks.resume(); return; } catch (error) { /* 落到下面的兜底 */ } }
    if (typeof window.__dungeonResume === "function") { try { window.__dungeonResume(); } catch (error) { /* 恢复失败就让玩家自己处理 */ } }
  }

  function modulesReady() {
    return Boolean(window.MuseumState && window.MuseumState.load && window.MuseumState.save &&
      window.MuseumPoints && window.MuseumShop && window.MuseumShopData && window.MuseumPanel);
  }

  function boot() {
    // 主游戏的模块不在（把小游戏单独拷出去）→ 静默退出，不要报错吓玩家。
    if (!modulesReady()) return;
    var state = window.MuseumState.load(userId);
    if (!state) return;
    // 裸 save 而不是 saveGuarded：这是**另一个页面里的另一个 state 对象**，
    // 它没在 snapshotRevisions 里登记过，saveGuarded 必然判 stale。
    // 券机（demos/scratch）接余额时用的是同一条理由、同一个写法。
    function save() { return window.MuseumState.save(state, userId) !== false; }

    window.MuseumPoints.bind({ getState: function () { return state; }, save: save });
    if (window.MuseumHumanity) {
      window.MuseumHumanity.bind({ getState: function () { return state; }, save: save });
    }
    window.MuseumShop.bind({ getState: function () { return state; }, save: save });
    window.MuseumPanel.bind({
      getState: function () { return state; },
      save: save,
      canOpen: function () { return true; },
      // 开面板时把小游戏停住 —— 否则你在挑道具，赛道还在跑。
      // 小游戏的 pause() 返回 false 表示"它当时不在游戏状态"（还没开始 / 已结算），
      // 那种情况下关面板也不该去 resume。
      onOpen: function () { pausedByPanel = pauseGame(); },
      onClose: function () {
        if (pausedByPanel) resumeGame();
        pausedByPanel = false;
      }
    });

    // 这里**不重复注册键盘**：M / Esc 的开关面板由 js/panel.js 自己在
    // document 的捕获阶段处理，而且它对打开期间的**所有**按键都
    // stopImmediatePropagation（这正是小游戏的 Esc/WASD 不会串味的原因）。
    // 早先这里又写了一份 M 处理器，是重复的——因为 panel.js 先注册、又抢先
    // stopImmediatePropagation，那份永远轮不到，纯属隐患。

    // 金币是节流落盘的（见 earnCoins 的注释）：页面隐藏或卸载前必须补一次，
    // 否则玩家直接关标签页 / 切走会丢掉还没写盘的那部分。
    window.addEventListener("pagehide", flushCoins);
    document.addEventListener("visibilitychange", function () { if (document.hidden) flushCoins(); });

    shell.enabled = true;
    shell.state = state;
    shell.save = save;
    var button = document.getElementById("systemPanelButton");
    if (button) {
      button.hidden = false;
      button.addEventListener("click", function () { window.MuseumPanel.open(); });
    }
    if (window.MuseumPanel.refresh) window.MuseumPanel.refresh();
  }

  window.MuseumDemoShell = shell;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
}());
