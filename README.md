# 怪谈博物馆 · 交互故事

这是小游戏原型：玩家在二维房间里移动和调查，重要事件切入独立的视觉小说页面；剧情分支、战斗或小游戏结束后回到原来的地图位置，出口选择会进入独立结局剧情。项目只使用 HTML、CSS 和原生 JavaScript。

## 当前目录

```text
xgnb/
├─ index.html             游戏入口：主菜单、地图探索、剧情层
├─ pages/                 公共说明页面
│  ├─ login.html          独立登录页面
│  ├─ register.html       独立注册页面
│  ├─ game.html           游戏流程说明与试玩入口
│  ├─ saves.html          独立存档管理页面
│  ├─ help.html           操作与玩法说明页面
│  ├─ story.html          世界观与当前故事页面
│  ├─ novel.html          独立视觉小说播放页面
│  └─ team.html           小组介绍与成员页面入口
├─ team/                  小组成员个人介绍页与成员素材
├─ css/                    CSS 样式文件
│  ├─ style.css            公共样式与响应式布局
│  ├─ novel.css            视觉小说页面布局与可读性样式
│  └─ battle.css           战斗页面样式
├─ js/                    JavaScript 功能模块
│  ├─ auth.js             本地注册、登录、退出（localStorage）
│  ├─ login.js            独立登录页面逻辑
│  ├─ register.js         独立注册页面逻辑
│  ├─ saves.js            独立存档页面逻辑
│  ├─ state.js            按用户隔离的自动存档和 20 个手动存档位
│  ├─ game.js             房间地图、移动碰撞、调查和状态流转
│  ├─ novel-data.js        从文学剧本整理出的可播放场景与对白数据
│  ├─ novel-overrides.js   分支切片、选项和地图回流规则
│  ├─ novel.js             剧情播放、选项、回顾、结局和剧情存档
│  └─ battle.js            战斗逻辑与结果回传
├─ demos/battle/           独立回合战斗页面
│  └─ index.html           战斗页面入口，结束后把结果交回主游戏
└─ assets/images/         地图、剧情背景、角色、物品、界面及待接入素材（见素材分类指南）
```

## 运行和操作

课堂展示可直接打开 `pages/showcase.html`，选择“连续体验前三场”。流程为桃树梦境、蓝色系统提示、宿舍物件调查、衣柜特写、员工守则、血字纸条正反面、电视录像，随后进入第四场。展示无需登录，使用临时状态，不覆盖正式账号存档；每次从展示目录进入会重新开始。

剧情数据按 `novel-data.js → novel-overrides.js → novel-presentation.js → novel-prologue.js → chapter-story.js → chapter-finalize.js` 加载。三角形说明保留在 `MuseumStory.productionNotes`；前三场由 `novel-prologue.js` 转成镜头、系统、调查和物品事件，`novel-stage.js` 负责呈现，不作为角色对白。原始剧本保留供对照。旧版剧情进度首次进入时回到当前场次开头，以免索引错位，物品和地图进度保留。

当前结局以最新确认规则为准：第十六场的系统回顾选项可进入 B；最终保留三个选择，进入出口为 B，救援/真相路线由梦魇小游戏决定 A/C。

**2026-09-20 起：玩家必须进地牢打最终战**（原来那个「不进入小游戏，前往出口」的出口已取消），A/C 在地牢**内部**的两条通关路线里分——地牢地图在肃清第三个房间后有岔路：

- **向右打首领**（`victoryRoom 4`）→ 打倒梦魇 → **C 完美结局**；
- **向上走撤离试炼三波**（`victoryRoom 5`）→ 放弃打梦魇 → **A 回头结局**。

两条都算胜利、都发战斗奖励，但**只有打倒首领才记 `boss_defeated`**。打输不判结局，扣 300 生存点并退回「迎战梦魇」重打。最终选择超时或人性归零且无回滚道具进入 D；E 暂未开放。跑酷不参与 A/C 判定。

前三场以《详细剧情线第一部分（待更新）》为准，取消额外的命名中断、钥匙与规则信任选项。对白框右下方提供上一句、回顾、保存、读取、自动、快进已读、物品和返回。自动播放在调查、物品及选择处停止；快进只通过已读对白；Esc 优先关闭浮层，没有浮层时打开暂停菜单。保存是独立快照，不会被自动进度覆盖。

当前使用分类后的像素地图、对白背景、立绘、行走帧、物品、UI 与 CG。地图与对白背景分别管理。独立探索共有 8 个房间，部分展厅通过入口进入剧情或调查画面。后续演出和家具遮挡仍需逐场完善。

直接双击根目录 index.html 进入标题页，也可通过本地静态服务运行。登录后开始新游戏；从标题继续或读取存档恢复进度。账号与进度只保存在当前浏览器，file 与 HTTP、不同浏览器的存储不共享。

进入地图后：

- 使用 WASD 或方向键移动。
- 靠近房间物品时按 `E` 调查；点击物品只作为辅助入口，仍需先走到交互范围内。
- 新游戏连续播放前三场。宿舍调查可用 WASD / 方向键移动，或点击地面自动绕开家具；点击小菱形会走近对应物品，再按 E 或点击人物旁提示调查。四处调查完成后打开更衣柜。前三场之后接第四场巡逻，并进入新大厅地图。
- 宿舍、走廊、大厅和办公室通过门相连。再次调查守则或纸条后回到原位置，不需要钥匙。
- “保存”打开 20 个手动存档位；自动存档会持续更新，“读档”可以随时读取任意手动档。

新地图配置在 `js/map-art.js` 中；背景保留原始比例，碰撞与交互单独配置。地图、剧情背景和物品按用途归档在 `assets/images/maps/`、`assets/images/story-backgrounds/`、`assets/images/items/`，路径由 `js/asset-paths.js` 统一解析。更衣柜特写使用 `items/closeups/wardrobe-detail.png`，纸条正反面使用 `items/documents/note-front.png`、`items/documents/note-back.png`。

第二场宿舍探索由 `js/dorm-exploration.js` 管理，背景、人物和调查点共用原图 1670 × 942 坐标，按可用窗口等比缩放。探索时隐藏重复背景与空对白框，仅显示底部操作栏。查看物品和回顾时暂停移动；人物位置随存档保存。四件物品的局部特写直接取自原场景图。

公共页面不再借用地图作为背景；前三场不依赖网络，图文内容随项目一同交付。完整分类见 `assets/images/素材分类指南.md`。

背包在地图右下角、对白框右下角均有入口，也可按 B 打开或收起，Esc 收起。阅读员工守则时收录规则记录，从黑色制服口袋取出血字纸条时获得物品；重复查看不会重复获得。背包可选物品、查看清晰原文、翻面和放大，关闭后继续原位置与剧情。物品随当前账号的自动档和手动档保存，旧档中已获得的纸条与守则会自动恢复；课堂预览仍使用独立的临时状态。`js/items.js` 是剧情与背包共用的物品定义，`js/inventory.js` 管理收录与界面；新物品通过定义和 `MuseumInventory.acquire(state, id, {save: persist})` 接入。

成就入口在地图右下角和剧情操作栏，也可按 J 开关。成就与结局收藏按账号累计，读取旧档不撤销已解锁收藏；钱包和物品仍按存档恢复，不重复发奖。课堂预览与正式账号隔离。当前全结局收藏要求 A—D，保留旧 E 记录但不要求收集 E。

一次性成就调用 `MuseumAchievements.unlock(state, id, {save: persist})`；累计成就调用 `increment(state, id, 1, {save: persist})` 或 `setProgress(state, id, progress, {save: persist})`。未知 ID 不会解锁，重复解锁不再提示；解锁时间和进度保存在 `achievements` 与 `achievementRecords`。隐藏成就解锁前不显示名称、条件或进度。框架校验可运行 `node tests/account-collection.cjs`，实际接入回归可运行 `node tests/achievements.cjs`。

## 测试

全部为自包含脚本，自己起静态服务、用隔离的浏览器账号，不需要预先启动服务器。

```bash
node tests/world-data.cjs          # 路线、碰撞、场次引用、隐藏规则（纯 Node，无依赖）
node tests/world-flow-browser.cjs  # 地图↔剧情往返、存读档、课堂预览隔离（真浏览器）
node tests/story-endings.cjs       # 多结局：A/C 分流、最终三选一、超时、空白页
node tests/story-logic-fixes.cjs   # 镜子指错、战斗提前记通关、上一句抹进度
node tests/save-multi-tab.cjs      # 双开标签页不得覆盖更新的进度
node tests/humanity.cjs            # 人性值（013）：0–100 量纲、老档迁移、每日流失、战斗损耗、回滚复活、失败重打
node tests/layout-responsive.cjs   # 6 种视口下的 16:9 映射、点击命中、触屏方向键
node tests/layout-text-fit.cjs     # 对白框不溢出视口、剧情页不可横向拖动
node tests/a11y-focus.cjs          # 6 个浮层的焦点移入、Tab 不逃逸、关闭归还焦点
node tests/characters-portraits.cjs # 新角色立绘的映射、加载与手机端不重叠
node tests/characters-npc.cjs      # 赵灵 NPC 贴图在地图上出现且带脚底锚点
node tests/deploy-clone.cjs        # 导出暂存区并验证 clone 后可直接游玩、无缺失素材
node tests/walkable-audit.cjs      # 每个房间的出生点/物件/入口可达性与可走区域越界
node tests/reported-bugs.cjs       # 地图铺满视口、导览面板开关、调查录像、走廊边界
node tests/perf-lazy-maps.cjs      # 只加载当前房间的地图，且不会重复请求
node tests/perf-lazy-wardrobe.cjs  # 衣柜特写不在地图页下载，交互提示照旧
```

## 地图绘制约定

`js/game.js` 的 `syncCanvasToBox()` 是画布几何的唯一来源：它把绘制缓冲区设成 **CSS 盒子 × devicePixelRatio**，所以地址栏窗口什么比例都行，地图永远铺满。

**不要在 CSS 里给 `#explore-canvas` 加 `aspect-ratio` 或 `object-fit:contain`。** 那会让画出来的位图小于它所在的盒子，于是地图看起来缩小（2560×1380 这类非 16:9 窗口最明显），并且点击坐标整体偏移。渲染器自己会把每个**房间**按比例放进缓冲区，所以窗口比例不需要被约束。

可走区域按画面像素实测，不靠估：房间地图的地板是偏蓝的灰（`b >= r`），墙是棕/墨绿。走廊那组数字（`js/map-art.js` 的 `rooms.corridor.walkable`）就是从 `走廊示意图1.png` 量出来的——地板 x 960..1774、y 337..565，下墙门口凹口 x 1256..1478 直到 y 608。旧的估算值上边缘高出地板约 60px，人物头部会插进上方的墙（看起来像穿模），下边缘又够不到门口（看起来像卡住）。

## 素材按需加载

`js/lazy-image.js` 提供 `create(name, category, onReady)`：返回的 `Image` 形状与原来一致，只是 `src` 推迟到绘制时才设置，加载完成后回调 `MuseumGameRedraw()` 重绘一次。使用方式是在画之前 `art.load()`（见 `js/game.js` 的 `drawRoom`）。

原来 `js/map-art.js` 与 `js/chapter-maps.js` 在脚本求值阶段就给**全部 9 张地图**设 src，开局（还在主菜单）就要下 14.5 MB，而实际只会画 1 张。现在只有当前房间那张会请求：

| | 地图页首屏下载 |
|---|---|
| 改前 | 14,551 KB（全部地图，外加 1,924 KB 的衣柜特写） |
| 改后 | 1,864 KB（只有当前房间地图；衣柜特写 0） |

衣柜特写之所以能完全不下：`js/game.js` 里调用 `drawWardrobe` 的 `room.objects` 渲染分支**不可达**（`drawRoom` 在 `if (room.art)` 分支里就 return 了，而每个房间都有美术）。用 `drawImage` 包装实测，站在衣柜旁边画出次数为 **0**。衣柜的交互本身完好（提示与剧情照旧），放大图由剧情页的物品预览显示。

浏览器类测试需要 Playwright 与 Chrome。脚本按 `PLAYWRIGHT_MODULE`、codex 运行时缓存、`playwright` 的顺序查找；找不到时用环境变量指定：

```bash
PLAYWRIGHT_MODULE=<playwright 路径> CHROME_PATH=<chrome.exe> node tests/story-endings.cjs
```

## 剧情数据的加载顺序

```text
novel-data → novel-overrides → novel-presentation → novel-prologue
           → chapter-story → chapter-finalize
```

**`chapter-finalize.js` 必须最后加载**，它负责两件前面无法完成的事：把别名副本（`guard-intro`/`contract`/`ending-choice`/`note-repeat` 等）指向已经补齐 `events` 与 `background` 的正式场次；以及给被 △ 过滤清空的场次补开场页。在这之前克隆会丢掉 `chapter-story.js` 后加的演出，而在这之前补的页面会被 `novel-presentation.js` 的 △ 过滤删掉。


## 和剧情、美术、小游戏同学的协作方式

剧情同学主要维护 `js/novel-data.js` 中的剧本文字；需要调整选项或分支时，集中修改 `js/novel-overrides.js`，不要把大段对白重新写进渲染逻辑。美术同学以房间设计稿提供物品的大致坐标、碰撞区域和交互名称，技术组再录入 `rooms` 配置。新小游戏必须定义自己的结果类型与尝试 ID，按当前事务保存、跨标签页保护和重复结算防护接入；不要套用旧战斗奖励。

## 课堂原型边界

`localStorage` 只适合课堂演示，不是真正的服务器账号系统；清理浏览器站点数据会同时删除账号和存档。所有核心流程不依赖网络，资源缺失时仍可运行 Canvas 版本。


## 新增独立试玩：森林极速跑

入口：`demos/forest-speed-run/index.html`。已收录全部文件，暂未接入主线。旧接入补丁仅供参考，不可直接应用；候选为纸人追逐段（内部 `scene-26`），详见 [接入评估](demos/forest-speed-run/INTEGRATION-STATUS.md)。
