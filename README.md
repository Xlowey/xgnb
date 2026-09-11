# 怪谈博物馆 · 交互故事

这是小游戏原型：玩家在二维房间里移动和调查，重要事件切入独立的视觉小说页面；剧情分支、战斗或小游戏结束后回到原来的地图位置，出口选择会进入三套独立结局剧情。项目只使用 HTML、CSS 和原生 JavaScript。

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

新剧本（`docs/009-文学剧本最新版.docx`）的场号尚未迁移，当前程序沿用既有场次 id。多结局已按新剧本第七、三十场接线：馆长办公室新增「提交调查记录」选项，提交后 `flags.submitted = true`，`ending-c`（完美结局）在最终抉择中永久消失，只剩回头与进入出口两条路；不作选择则 15 秒后结算为死亡结局。

前三场以《详细剧情线第一部分（待更新）》为准，取消额外的命名中断、钥匙与规则信任选项。对白框右下方提供上一句、回顾、保存、读取、自动、快进已读、物品和返回。自动播放在调查、物品及选择处停止；快进只通过已读对白；Esc 关闭浮层或停止自动，不打开回顾菜单。保存是独立快照，不会被自动进度覆盖。

已接入用户提供的七张像素素材，纸条与守则可放大并查看剧本原文；宿舍、走廊、大厅、办公室地图使用完整背景加碰撞与热区。角色仍是程序绘制的临时形象，未实现所有家具前后遮挡。第九场分支、第二十九场对峙仍可从展示目录检查；后续完整故事可达性、追逐游戏、BOSS 演出尚未完成。电视当前是 AI 生成插画加扫描线、镜头移动的短动态展示，不是完整视频；桃树使用之前提供的素材加梦境转场。

直接在资源管理器中双击项目根目录的 `index.html`。浏览器会打开主菜单。点击“登录”进入独立登录页；没有档案时可从登录页进入独立注册页。登录后点击“开始游戏”，按“故事介绍 → 玩法说明 → 正式游戏”的顺序进入地图。档案和进度只保存在当前浏览器。其它公共页面可直接打开 `pages/` 下对应的 HTML 文件。

进入地图后：

- 使用 WASD 或方向键移动。
- 靠近房间物品时按 `E` 调查；点击物品只作为辅助入口，仍需先走到交互范围内。
- 新游戏连续播放前三场。宿舍调查可用 WASD / 方向键移动，或点击地面自动绕开家具；点击小菱形会走近对应物品，再按 E 或点击人物旁提示调查。四处调查完成后打开更衣柜。前三场之后接第四场巡逻，并进入新大厅地图。
- 宿舍、走廊、大厅和办公室通过门相连。再次调查守则或纸条后回到原位置，不需要钥匙。
- “保存”打开 20 个手动存档位；自动存档会持续更新，“读档”可以随时读取任意手动档。

新地图配置在 `js/map-art.js` 中；背景保留原始比例，碰撞与交互单独配置。地图、剧情背景和物品按用途归档在 `assets/images/maps/`、`assets/images/story-backgrounds/`、`assets/images/items/`，路径由 `js/asset-paths.js` 统一解析。更衣柜特写使用 `items/closeups/wardrobe-detail.png`，纸条正反面使用 `items/documents/note-front.png`、`items/documents/note-back.png`。

第二场宿舍探索由 `js/dorm-exploration.js` 管理，背景、人物和调查点共用原图 1670 × 942 坐标，按可用窗口等比缩放。探索时隐藏重复背景与空对白框，仅显示底部操作栏。查看物品和回顾时暂停移动；人物位置随存档保存。四件物品的局部特写直接取自原场景图。

公共页面不再借用地图作为背景；前三场不依赖网络，图文内容随项目一同交付。完整分类见 `assets/images/素材分类指南.md`。

背包在地图右上角、对白框右下角均有入口，也可按 B 打开或收起，Esc 收起。阅读员工守则时收录规则记录，从黑色制服口袋取出血字纸条时获得物品；重复查看不会重复获得。背包可选物品、查看清晰原文、翻面和放大，关闭后继续原位置与剧情。物品随当前账号的自动档和手动档保存，旧档中已获得的纸条与守则会自动恢复；课堂预览仍使用独立的临时状态。`js/items.js` 是剧情与背包共用的物品定义，`js/inventory.js` 管理收录与界面；新物品通过定义和 `MuseumInventory.acquire(state, id, {save: persist})` 接入。

成就入口在地图右上角和对白框右下角，也可按 J 打开或关闭，Esc 关闭。正式列表在 `js/achievements-data.js`，目前为空；旧测试成就的展示与触发已移除，旧档记录保留但不计入当前列表。面板支持全部、已解锁、未解锁筛选，打开时暂停移动和自动播放。成就随本账号当前存档保存，读取较早存档会恢复当时的成就进度；课堂预览与正式账号分开。

后续在配置中添加 `{id, name, description, target: 1, hidden: false}`。一次性成就调用 `MuseumAchievements.unlock(state, id, {save: persist})`；累计成就调用 `increment(state, id, 1, {save: persist})` 或 `setProgress(state, id, progress, {save: persist})`。未知 ID 不会解锁，重复解锁不再提示；解锁时间和进度保存在 `achievements` 与 `achievementRecords`。隐藏成就解锁前不显示名称、条件或进度。框架校验可运行 `node docs/tests/achievements.test.cjs`，测试定义仅在测试进程中注册。

## 测试

全部为自包含脚本，自己起静态服务、用隔离的浏览器账号，不需要预先启动服务器。

```bash
node tests/world-data.cjs          # 路线、碰撞、场次引用、隐藏规则（纯 Node，无依赖）
node tests/world-flow-browser.cjs  # 地图↔剧情往返、存读档、课堂预览隔离（真浏览器）
node tests/story-endings.cjs       # 多结局：提交关闸、最终三选一、超时、空白页
node tests/story-logic-fixes.cjs   # 镜子指错、战斗提前记通关、上一句抹进度
node tests/save-multi-tab.cjs      # 双开标签页不得覆盖更新的进度
node tests/layout-responsive.cjs   # 6 种视口下的 16:9 映射、点击命中、触屏方向键
node tests/layout-text-fit.cjs     # 对白框不溢出视口、剧情页不可横向拖动
node tests/a11y-focus.cjs          # 6 个浮层的焦点移入、Tab 不逃逸、关闭归还焦点
node tests/characters-portraits.cjs # 新角色立绘的映射、加载与手机端不重叠
node tests/characters-npc.cjs      # 赵灵 NPC 贴图在地图上出现且带脚底锚点
node tests/deploy-clone.cjs        # 导出暂存区并验证 clone 后可直接游玩、无缺失素材
```

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

剧情同学主要维护 `js/novel-data.js` 中的剧本文字；需要调整选项或分支时，集中修改 `js/novel-overrides.js`，不要把大段对白重新写进渲染逻辑。美术同学以房间设计稿提供物品的大致坐标、碰撞区域和交互名称，技术组再录入 `rooms` 配置。小游戏同学可以沿用战斗 Demo 的结果格式，结束时写入 `museum_pending_battle_v1`，主页面会在返回时自动接收结果并切入 `state.returnScene` 指定的后续剧情。

## 课堂原型边界

`localStorage` 只适合课堂演示，不是真正的服务器账号系统；清理浏览器站点数据会同时删除账号和存档。所有核心流程不依赖网络，资源缺失时仍可运行 Canvas 版本。
