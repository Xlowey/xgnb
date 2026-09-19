/*
 * 一次性发钱的里程碑（012 §4.2 的收入）。
 *
 * 一条 = 「某个条件成立 → 发一笔，且只发一次」。幂等靠 `state.flags["milestone:<id>"]`，
 * 复用现成的旗标袋，**不加新变量、不改存档结构**。
 *
 * 锚点有三种，由 js/milestones.js 的 settle() 分派：
 *   - `flag`            某个场次 / 事件旗标
 *   - `check(state)`    要按存档内容算的条件（比如「线索够不够几条」）
 *   - `count/per/cap`   增量条目：按**次数**发钱并封顶，已发多少记在同一个旗标袋里（存数字）
 *
 * ★ 下面每一条的场次都是**对着 009 docx 原文核过的**，不是照抄 012 的转述。
 */
(function () {
  "use strict";

  window.MuseumMilestoneDefinitions = [
    // ---------- 每日存活（012 §4.2：三夜结束各 +20，共 60）----------
    // 三个节点都对着 009 原文核过：
    //   第十二场「△ 回宿舍睡觉，梦里（CG）桃树的梦」          → 第一夜结束
    //   第二十三场「请现在返回宿舍等待第三天的到来」（MOSS）  → 第二夜结束
    //   第二十五场「△ 急促的拍门声」赵灵拍门喊「明诚！明诚！  → 第三夜
    //             快开门！快走！这是我们唯一离开这里的机会！」   她上一场还认不出主角，
    //                                                            这一场恢复记忆，正是天亮前
    //
    // ⚠️ 012 早先写的第三个节点「第十三场（第二天开始）」**在 009 里不存在**——第十三场整场
    // 是蜡像馆（张明诚的展台），没有任何天数内容。012 自己后来又把第二十五场判成
    // 「不是一夜的边界」，那条也已作废（2026-09-19 按 docx 原文更正）。
    { id: "survive-night-1", flag: "scene12Seen", points: 20, source: "存活过第一夜" },
    { id: "survive-night-2", flag: "scene23Seen", points: 20, source: "存活过第二夜" },
    { id: "survive-night-3", flag: "scene25Seen", points: 20, source: "存活过第三夜" },

    // ---------- 幕结算（012 §4.1：每完成一幕 +25 × 10 幕 = 250）----------
    // 幕→场映射是对着 009 docx 原文抽的（013 §2.1 与 js/humanity-data.js 有同一张表）：
    //   一 1–5 │ 二 6–9 │ 三 10–11 │ 四 12–14 │ 五 15
    //   六 16–18 │ 七 19–21 │ 八 22–24 │ 九 25–26 │ 十 27–29
    // 结算点取**该幕最后一场完成时**，不是「下一幕第一场开始时」：玩家看完这一幕就该拿到钱，
    // 而且「下一幕第一场」在某些分支下根本走不到（比如从第九幕直接进结局）。
    { id: "act-1", flag: "scene05Seen", points: 25, source: "第一幕结算" },
    { id: "act-2", flag: "scene09Seen", points: 25, source: "第二幕结算" },
    { id: "act-3", flag: "scene11Seen", points: 25, source: "第三幕结算" },
    { id: "act-4", flag: "scene14Seen", points: 25, source: "第四幕结算" },
    { id: "act-5", flag: "scene15Seen", points: 25, source: "第五幕结算" },
    { id: "act-6", flag: "scene18Seen", points: 25, source: "第六幕结算" },
    { id: "act-7", flag: "scene21Seen", points: 25, source: "第七幕结算" },
    { id: "act-8", flag: "scene24Seen", points: 25, source: "第八幕结算" },
    { id: "act-9", flag: "scene26Seen", points: 25, source: "第九幕结算" },
    { id: "act-10", flag: "scene29Seen", points: 25, source: "第十幕结算" },

    // ---------- 线索（012 §4.1：12 普通 × 10 + 8 核心 × 20 = 280）----------
    //
    // ⚠️ **口径出入（2026-09-19 核实）**：012 这 280 是按 008《线索总表》的 CL-01～CL-20
    //    **二十条**算的，但**代码目前只追踪 6 条线索**——`state.clues` 里装的全是硬编码的
    //    剧情事件 id，而且剧情数据里根本没有声明式的线索字段（选项连 `effect` 都是手写的）。
    //
    //    所以下面只列了这 6 条，**现在最多发得出去 90 点，不是 280**。这不是接线问题，
    //    是游戏内容里只做了 6 条线索——要在代码里真的凑出 20 条，得先让那些线索有落点。
    //    加一条线索就加一行，分段（普通 +10 / 核心 +20）照着 008 的语义定。
    { id: "clue-blood-note", check: function (s) { return s.clues.indexOf("blood-note") !== -1; }, points: 10, source: "线索 · 血字纸条" },
    { id: "clue-rule-red", check: function (s) { return s.clues.indexOf("rule-red") !== -1; }, points: 10, source: "线索 · 红制服的规则" },
    { id: "clue-wardrobe-key", check: function (s) { return s.clues.indexOf("wardrobe-key") !== -1; }, points: 10, source: "线索 · 更衣柜" },
    { id: "clue-peach-dream", check: function (s) { return s.clues.indexOf("peach-dream") !== -1; }, points: 20, source: "线索 · 桃树梦" },
    { id: "clue-contract", check: function (s) { return s.clues.indexOf("contract") !== -1; }, points: 20, source: "线索 · 第二份契约" },
    { id: "clue-director-account", check: function (s) { return s.clues.indexOf("director-account") !== -1; }, points: 20, source: "线索 · 馆长的口供" },

    // ---------- 玩法通关（012 §4.1：10 个固定项 × 10 + 2 个小游戏 × 40 = 180）----------
    //
    // 固定项取 011 现行编号（G①—G⑲）里**带解谜含量**的那些——筛掉纯战斗、追逐、潜行之后
    // 正好 10 条。锚点用 011 每条自己标的「所在幕 / 场」的那一场。
    // ⚠️ 锚点用的是**场次完成**，不是「玩家真的把那个谜解开了」——因为那些玩法大多还没实装
    //    （011 里 G⑪—G⑲ 是建议新增，多数没有代码落点）。等它们真的做出来，这里要改成各自的
    //    完成旗标，否则玩家只是走完剧情就能拿钱。
    { id: "g02", flag: "scene03Seen", points: 10, source: "玩法通关 · G② 两张纸条 · 规则连线" },
    { id: "g11", flag: "scene05Seen", points: 10, source: "玩法通关 · G⑪ 病房录像 · 定格找异常" },
    { id: "g12", flag: "scene06Seen", points: 10, source: "玩法通关 · G⑫ 大厅训话 · 规则应答" },
    { id: "g13", flag: "scene09Seen", points: 10, source: "玩法通关 · G⑬ 阴暗角落 · 贴耳窃听" },
    { id: "g05", flag: "scene14Seen", points: 10, source: "玩法通关 · G⑤ 展台与人数 · 解密 + 连线" },
    { id: "g14", flag: "scene15Seen", points: 10, source: "玩法通关 · G⑭ 馆长手册 · 合规审查" },
    { id: "g07", flag: "scene16Seen", points: 10, source: "玩法通关 · G⑦ 开门密码" },
    { id: "g15", flag: "scene17Seen", points: 10, source: "玩法通关 · G⑮ 展厅外 · 证词比对" },
    { id: "g17", flag: "scene21Seen", points: 10, source: "玩法通关 · G⑰ 彩带世界 · 对质梦魇" },
    { id: "g18", flag: "scene29Seen", points: 10, source: "玩法通关 · G⑱ 契约拼合" },

    // 两个小游戏：012 §4.1 的「首通 +10；之后按评级发放，每个游戏复玩累计封顶再 +30」。
    // 首通是旗标（一次性），复玩是增量条目（count/per/cap，见 js/milestones.js）。
    //
    // 「森林极速跑」= 011 的 G③ 跑酷 / G⑨ 纸人追击。**这个游戏还没实装**，所以首通暂挂在
    //   第二十六场（纸人追击那场）上，复玩次数没人加（`state.minigamePlays.forest` 恒为 0）。
    // 「暗影地牢」= 011 的 G④ 战斗（第十一场）/ G⑩ BOSS 战（第二十八~二十九场）——两场战斗
    //   算同一个游戏，所以**首通挂在「第一次打赢任何一场战斗」上**（`battleDemoCompleted`
    //   是馆长战置的），复玩次数则是每打赢一场加一次。
    //   顺带把一处断链接上了：地牢一直在回传 `flags: ['boss_defeated']`，而主游戏
    //   `applyBattleResult` 的 `if (!finalBoss)` 把整块旗标跳过了，**从来没被消费过**。
    //   现在最终战也会把它写进 state.flags（见 js/game.js）。
    { id: "minigame-forest-first", flag: "scene26Seen", points: 10, source: "森林极速跑 · 首通" },
    { id: "minigame-dungeon-first", flag: "battleDemoCompleted", points: 10, source: "暗影地牢 · 首通" },
    // 复玩：玩了几次就发几次的钱，封顶 30。首通那一次不算「复玩」，所以减 1。
    { id: "minigame-forest-replay", per: 10, cap: 30, source: "森林极速跑 · 复玩",
      count: function (s) { return Math.max(0, ((s.minigamePlays && s.minigamePlays.forest) || 0) - 1); } },
    { id: "minigame-dungeon-replay", per: 10, cap: 30, source: "暗影地牢 · 复玩",
      count: function (s) { return Math.max(0, ((s.minigamePlays && s.minigamePlays.dungeon) || 0) - 1); } }
  ];
}());
