/*
 * 012 §5 的商城价格表。
 *
 * **012 的所有数字只写在这一处**，商城 UI、限购判定、测试都从这里读。
 * 012 §7.1 特意留过一句话：旧版的正文总数和它自己的分项加起来对不上（旧版写 2550，
 * 分项相加是 2650）。所以这里不抄总数，`total()` 直接从表算——tests/system-panel.cjs
 * 会重算一遍并和 012 的 4280 对账。
 *
 * ready 的含义：
 *   true  = 效果已经接进本作，买了立刻有用
 *   false = 效果还没有落点，dep 写明卡在什么上面；商城会把这件标成「效果待接入」
 *           （玩家仍然可以买，012 本来就要求回滚、玩法类道具是**提前买**的）
 */
(function () {
  "use strict";

  var CATEGORIES = [
    {
      id: "battle",
      label: "战斗类",
      // 这一组作用于**第十一场的回合制交涉**（demos/battle），不是暗影地牢——
      // 012 §5.1 自己写的就是「系统助战……（第十一场「可选择使用系统提供的帮助」）」。
      // 之前这里的 hint 写成「只作用于暗影地牢」，与 012 矛盾，2026-09-20 更正。
      hint: "作用于第十一场的回合制交涉。买了这几件等于把判断交给系统（012 §5.1 的铁律）。",
      items: [
        { id: "supply", name: "基础补给", price: 30, limit: 5, note: "战斗内回复", ready: true, fight: true },
        { id: "weakness", name: "破绽分析", price: 50, limit: 3, note: "下一次攻击伤害 ×2", ready: true, fight: true },
        { id: "assist", name: "系统助战", price: 120, limit: 2, note: "一场必援：使用即由系统代打取胜", ready: true, fight: true },
        { id: "power", name: "高战力道具", price: 180, limit: 1, note: "开局敌方 −10 血、你每次攻击 +3", ready: true, fight: true }
      ]
    },
    {
      id: "intel",
      label: "情报类",
      hint: "012 引的是 CL-13 / CL-14 与 011 的玩法编号，这套编号本作还没有。",
      items: [
        { id: "hint", name: "单次提示", price: 25, limit: 6, note: "任意谜题解锁一步", ready: false, dep: "解谜系统" },
        { id: "wax-hint", name: "蜡像馆推理提示", price: 70, limit: 1, note: "直接给出一组连线（011 展台与人数）", ready: false, dep: "011 玩法" },
        { id: "peach-hint", name: "桃树源头提示", price: 100, limit: 1, note: "提前解锁 CL-14（军阀夫人桃树怪谈）", ready: false, dep: "线索编号对照表" },
        { id: "manual", name: "馆长手册解读", price: 90, limit: 1, note: "合规审查直接标出 2 处（011 馆长手册）", ready: false, dep: "011 玩法" },
        { id: "form", name: "入职申请表提前解锁", price: 80, limit: 1, note: "提前拿到 CL-13（009 第二十二场）", ready: false, dep: "线索编号对照表" }
      ]
    },
    {
      id: "rules",
      label: "规则类",
      hint: "违规扣罚现在是答错守则小游戏的 60 点。",
      items: [
        { id: "waiver", name: "规则豁免", price: 70, limit: 2, note: "免一次违规扣罚（答错时由你决定用不用）", ready: true },
        { id: "mask", name: "面具修补", price: 60, limit: 1, note: "免一次身份暴露", ready: false, dep: "身份暴露系统" }
      ]
    },
    {
      id: "humanity",
      label: "人性类",
      hint: "买下来存着，掉血了再点「使用」。013 §3.3：免费用人性化行为回血，花钱的这两件随时能用。",
      items: [
        // 013 §3.3 落地（2026-09-19）：这一类现在真的能回血了。effect.humanity 由 js/shop.js 的
        // use() 分发（这是商城第一件「效果由商品表自己声明」的商品——【锚点】没有对应的场景调用点，
        // 不像【规则豁免】那样能挂在 game.js 的守则小游戏上）。
        { id: "anchor-zhaoling", name: "【锚点 · 与赵灵的一次独处】", price: 60, limit: 4, note: "人性 +15", ready: true, effect: { humanity: 15 } },
        { id: "anchor-hairpin", name: "【锚点 · 那枚银色发卡】", price: 50, limit: 2, note: "人性 +10", ready: true, effect: { humanity: 10 } }
      ]
    },
    {
      id: "story",
      label: "剧情类",
      hint: "009 结局 E 本来就写好的东西，012 只是给它标了个价。",
      items: [
        // 013 §四落地（2026-09-19）：人性值归零时自动消耗一枚、回满 100（见 js/humanity.js
        // 的 spendRollback）。**不需要**点「使用」——所以这里只打标记、不写 effect.humanity。
        { id: "rollback", name: "【回滚 · 回到最近存档点】", price: 300, limit: 3, note: "一次免死，回满人性（归零时自动消耗）", ready: true, effect: { revive: true } }
      ]
    },
    {
      id: "minigame",
      label: "玩法类",
      hint: "只作用于两个小游戏，不改 009 任何一场。01—15 中间留空的是暂未采纳的号位。",
      items: [
        // 战斗向（012 §5.6 的 01 / 02 / 05）。2026-09-20 接入暗影地牢时落地。
        // 这三件是**叠加式**：买几份叠几层，所以传的是件数（dungeonParams），
        // 由 demos/pixel-dungeon-html/game.js 自己乘上去。
        { id: "mag", name: "【备用弹匣】", price: 40, limit: 6, stacked: true, note: "能量枪冷却 −15ms（250ms 起）", ready: true, dungeon: true },
        { id: "elbow", name: "【蜡像的肘】", price: 50, limit: 4, stacked: true, note: "移速 +20、受击半径 −1", ready: true, dungeon: true },
        { id: "stamp", name: "【馆长印章】", price: 120, limit: 4, stacked: true, note: "开局 +1 次充能大招，冷却 −2s", ready: true, dungeon: true },
        // 追逐向（012 §5.6 的 07 / 08 / 09 / 10）。2026-09-20 接入森林极速跑时落地。
        // `runner` 里的键就是跑酷 URL 参数名，进游戏时由 runnerParams() 折算过去。
        { id: "uniform", name: "【红制服】", price: 60, limit: 1, note: "磁铁持续 8s → 14s", ready: true, runner: { magnet: 14 } },
        { id: "whistle", name: "【保安哨】", price: 80, limit: 1, note: "本局免除一次撞墙眩晕（不计入 3 次上限）", ready: true, runner: { stunImmunity: 1 } },
        { id: "knee", name: "【蜡像的膝盖】", price: 90, limit: 1, note: "踉跄 5s → 2s，滑铲 0.7s → 0.9s", ready: true, runner: { stumble: 2, slide: 0.9 } },
        { id: "leg", name: "【纸人的腿】", price: 180, limit: 1, note: "冲刺 4s → 8s，撞碎障碍得分 180 → 360", ready: true, runner: { dash: 8, smash: 360 } },
        // 券机向（012 §5.6 的 12 / 15）。2026-09-20 落地：券机页直接读主存档的
        // shopOwned（它本来就通过 bridge 读余额），不必另传 URL 参数。
        { id: "claim", name: "【赔付申请单】", price: 50, limit: 1, note: "本券结算为 NONE 时返还票价的一半", ready: true },
        { id: "siren", name: "【闭馆广播】", price: 250, limit: 1, note: "券机全档票价 −20%（本局有效）", ready: true }
      ]
    }
  ];

  var index = {};
  CATEGORIES.forEach(function (category) {
    category.items.forEach(function (item) { item.category = category.id; index[item.id] = item; });
  });

  function all() {
    var list = [];
    CATEGORIES.forEach(function (category) { list = list.concat(category.items); });
    return list;
  }
  function find(id) { return index[id] || null; }
  // 012 §7.1：不抄总数，从表算。限购拉满合计应为 4280。
  function total() {
    return all().reduce(function (sum, item) { return sum + item.price * item.limit; }, 0);
  }
  function byCategory(id) { return CATEGORIES.filter(function (category) { return category.id === id; })[0] || null; }

  // 主线版跑酷的时长（秒）。012 写的是 180，评估文档建议主线版缩到 60–90，
  // 2026-09-20 拍板取 90。独立试玩不带参数，仍是 180。
  var RUNNER_SECONDS = 90;

  /*
   * 小游戏金币 → 生存点的汇率与上限（2026-09-20）。
   *
   * 三个地方要用同一个数：js/demo-shell.js（局内实时换算）、js/game.js 的 coinsToPoints
   * （结算兜底）、js/panel.js（面板上显示"已兑 N / 40"）。**数字写在这里，别处引用**，
   * 免得改一处漏一处——这个项目已经在"总数和分项对不上"上栽过一次（012 §7.1）。
   *
   * ⚠️ **上限是"全程累计"**，不是单次：跑酷与地牢共用一份额度，记在存档的
   *    `flags.liveCoinsEarned` 里。记内存的话，打输重试或刷新都能清零重来 → 刷钱。
   */
  var COIN_PER_POINT = 1;

  /*
   * **0 = 不设上限**（2026-09-20 按需求取消）。
   *
   * 原来封顶 40（全程累计）。取消的理由是它和"玩家可以去赚金币"直接矛盾：
   * 通关一次之后从面板复玩，如果额度已经用完，复玩就毫无意义了。
   *
   * ⚠️ **代价要写清楚**：上限一去，这条收入就没有界了——
   *    · 复玩可以无限次，金币无上限 → 商城限购拉满的 4280 迟早买得齐；
   *    · 012 §7.1 那张"收入 1050 / 可支配 1290 / 可买比例 30%"的表**不再是预算**，
   *      它现在只描述"主线走一遍能拿到多少"，不描述上限；
   *    · 012 反复强调的"货币不能超发、玩家必须放弃一半以上商品"这个**设计前提失效**。
   *    这不是 bug，是这次改动的既定后果——要恢复取舍感，把这里改回一个正数即可。
   */
  var COIN_POINT_CAP = 0;

  /*
   * 把已购的追逐向道具折算成跑酷的 URL 参数（demos/forest-speed-run/game.js
   * 会按这些参数覆盖 CONFIG）。没有已购项时只返回时长。
   *
   * ⚠️ **与 012 §5.6 的一处刻意偏离。**
   *    那一节写的是追逐向「买断，每局最多装备 2 件」，理由是「180 秒的跑酷全带上
   *    就没难度了，所以保留槽位」。本版**不做装备槽——买了全生效**（2026-09-20 拍板），
   *    实现简单但和设计文档不一致；而且主线版还从 180 秒缩到了 90 秒，槽位的平衡
   *    理由其实更强。以后要补装备槽，从这里改即可。
   *
   * 另外：012 §5.1 的铁律只管「5.1 战斗类」与「装上 §5.6 的**战斗向**道具（01/02/05）」，
   * 追逐向（07/08/09/10）不在其列——买这几件**不影响 A/C 结局判定**。
   */
  function runnerParams(owned) {
    var params = ["target=" + RUNNER_SECONDS];
    var ledger = owned || {};
    all().forEach(function (item) {
      if (!item.runner) return;
      var held = Math.max(0, Math.round(Number(ledger[item.id])) || 0);
      if (held <= 0) return;
      Object.keys(item.runner).forEach(function (key) { params.push(key + "=" + item.runner[key]); });
    });
    return params.join("&");
  }

  /*
   * 把已购的战斗向道具折算成暗影地牢的 URL 参数。
   *
   * 与 runnerParams 的区别：那三件是**叠加式**（012 §5.6 的战斗向「买一份加一层，
   * 买几份叠几份」），所以传的是**件数**，由 demos/pixel-dungeon-html/game.js
   * 自己乘上单份效果（−15ms / +20 / −2s）。
   */
  function dungeonParams(owned) {
    var params = [];
    var ledger = owned || {};
    all().forEach(function (item) {
      if (!item.dungeon) return;
      var held = Math.max(0, Math.round(Number(ledger[item.id])) || 0);
      if (held > 0) params.push(item.id + "=" + Math.min(held, item.limit));
    });
    return params.join("&");
  }

  /*
   * 把已购的战斗类道具折算成回合制交涉（js/battle.js）的 URL 参数。
   * 也是叠加式——买几份就是能用几次，所以同样传件数。
   */
  function battleParams(owned) {
    var params = [];
    var ledger = owned || {};
    all().forEach(function (item) {
      if (!item.fight) return;
      var held = Math.max(0, Math.round(Number(ledger[item.id])) || 0);
      if (held > 0) params.push(item.id + "=" + Math.min(held, item.limit));
    });
    return params.join("&");
  }

  window.MuseumShopData = { categories: CATEGORIES, all: all, find: find, total: total, byCategory: byCategory, runnerParams: runnerParams, dungeonParams: dungeonParams, battleParams: battleParams, RUNNER_SECONDS: RUNNER_SECONDS, COIN_PER_POINT: COIN_PER_POINT, COIN_POINT_CAP: COIN_POINT_CAP };
}());
