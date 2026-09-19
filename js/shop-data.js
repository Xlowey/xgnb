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
      hint: "只作用于暗影地牢。",
      items: [
        { id: "supply", name: "基础补给", price: 30, limit: 5, note: "战斗内回复", ready: false, dep: "暗影地牢" },
        { id: "weakness", name: "破绽分析", price: 50, limit: 3, note: "下回合伤害 ×2", ready: false, dep: "暗影地牢" },
        { id: "assist", name: "系统助战", price: 120, limit: 2, note: "一场必援", ready: false, dep: "暗影地牢" },
        { id: "power", name: "高战力道具", price: 180, limit: 1, note: "大幅提升胜率", ready: false, dep: "暗影地牢" }
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
        { id: "mag", name: "【备用弹匣】", price: 40, limit: 6, stacked: true, note: "能量枪冷却 −15ms（250ms 起）", ready: false, dep: "暗影地牢" },
        { id: "elbow", name: "【蜡像的肘】", price: 50, limit: 4, stacked: true, note: "移速 +20、受击半径 −1", ready: false, dep: "暗影地牢" },
        { id: "stamp", name: "【馆长印章】", price: 120, limit: 4, stacked: true, note: "开局 +1 次充能大招，冷却 −2s", ready: false, dep: "暗影地牢" },
        { id: "uniform", name: "【红制服】", price: 60, limit: 1, note: "磁铁持续 8s → 14s", ready: false, dep: "森林极速跑" },
        { id: "whistle", name: "【保安哨】", price: 80, limit: 1, note: "本局免除一次撞墙眩晕", ready: false, dep: "森林极速跑" },
        { id: "knee", name: "【蜡像的膝盖】", price: 90, limit: 1, note: "踉跄 5s → 2s，滑铲 0.7s → 0.9s", ready: false, dep: "森林极速跑" },
        { id: "leg", name: "【纸人的腿】", price: 180, limit: 1, note: "冲刺 4s → 8s，撞碎障碍得分 180 → 360", ready: false, dep: "森林极速跑" },
        { id: "claim", name: "【赔付申请单】", price: 50, limit: 1, note: "本券结算为 NONE 时返还票价的一半", ready: false, dep: "福利券机" },
        { id: "siren", name: "【闭馆广播】", price: 250, limit: 1, note: "券机全档票价 −20%（本局有效）", ready: false, dep: "福利券机" }
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

  window.MuseumShopData = { categories: CATEGORIES, all: all, find: find, total: total, byCategory: byCategory };
}());
