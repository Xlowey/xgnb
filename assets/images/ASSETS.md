# 素材用途分类与引用检查

> 以下是历史检查记录，包含过时的临时共用方案。当前归档规则以《素材分类指南.md》和你的手动分类为准。不得用蜡像馆背景替代大厅剧情背景，也不得因缺图而默认借用地图。

2026-09-11。按画面与用途分类。运行素材已移入对应目录，代码通过 `js/asset-paths.js` 解析；新收到但暂未接入的素材保留在 `_source/`、`_reference/` 和 UI 候选目录。机器可读清单见 `asset-catalog.json`。

部分代码入口已接入 `js/asset-paths.js`。归类后仍须核对嵌套目录、CSS 和其他直接引用，不能仅修改两个目录配置就认定全部接入。

## 地图

- `maps/world/museum-overview-map.png`
- `maps/rooms/dorm-map.png`
- `maps/rooms/hall-map.png`
- `maps/rooms/office-map.png`
- `maps/rooms/食堂走廊地图.png`
- `maps/rooms/蜡像馆地图.png`
- `maps/rooms/教室展厅背景.jpeg`
- `maps/rooms/走廊示意图1.png`

## 剧情背景

- `story-backgrounds/locations/hospital/病房展厅（电视机打开）.jpeg`
- `story-backgrounds/locations/hospital/病房展厅(电视机关闭）.jpeg`
- `story-backgrounds/locations/canteen/食堂走廊背景.png`
- `story-backgrounds/locations/canteen/食堂门口背景.png`
- `story-backgrounds/locations/canteen/食堂正常背景.jpeg`
- `story-backgrounds/locations/canteen/食堂背景（含彩带版）.jpeg`
- `story-backgrounds/locations/wax/蜡像馆背景（正常版）.jpeg`
- `story-backgrounds/locations/wax/蜡像馆背景（有人涌入版）.jpeg`
- `story-backgrounds/locations/silver/银色的恋人展厅.jpeg`

## 物品与CG

- `items/closeups/wardrobe-detail.png`
- `items/documents/note-front.png`
- `items/documents/note-back.png`
- `cg/peach-dream.png`
- `cg/rabbits-recording.png`

## 角色原稿

- `_source/characters/男主立绘（戴帽子）.png`
- `_source/characters/男主立绘（不带帽子）.png`
- `_source/characters/赵灵立绘最新版.png`
- `_source/characters/馆长 (1).png`

## 角色运行素材

- `characters/portraits/hero-portrait.png`
- `characters/portraits/zhaoling-portrait.png`
- `characters/portraits/director-portrait.png`
- `characters/walk/hero-walk-cycle.png`

## UI素材

- `ui/frames/dialogue-frame.png`
- `ui/frames/system-frame.png`
- `ui/menus/menu-panel.png`
- `ui/buttons/button-primary.png`
- `ui/buttons/button-normal.png`
- `ui/buttons/button-dark.png`
- `ui/frames/普通对话框.png`
- `ui/frames/系统对话框 (1).png`
- `ui/frames/系统对话框 (2).png`
- `_reference/屏幕截图 2026-09-10 200131.png`

## 设计参考

- `_reference/登录界面参考.png`

## 已纠正

- 主菜单、登录注册、公共介绍页面：移除总地图背景。
- 展示入口和战斗页面：移除无关的宿舍地图背景。
- 食堂剧情主题：将总地图替换为食堂正常背景。
- 旧衣柜调查引用：修正已删除的 wardrobe-open/closed 图片路径。

## 缺口与保留项

- 主界面纯背景缺失：Main Interface Background.jpeg 已删除。当前使用渐变底色；登录界面参考含固定按钮、标题和档案名称，只作设计参考。
- 宿舍、大厅、办公室、普通走廊缺少独立对话视角。现有剧情仍借用对应房间地图，属于明确的临时共用，不冒充专用背景。宿舍调查中保留地图与人物属于正常的调查上下文。
- 教室展厅背景.jpeg 画面是俯视地图，现有行走数据使用合理；剧情对白也共用它，后续可补独立对话视角。
- 走廊示意图1.png 是地图候选，未接入，不能直接替换现有地图而沿用旧碰撞坐标。
- 蜡像馆地图已有文件，但旧蜡像馆仍使用程序绘制；接入需要重新配置碰撞、入口与调查位置，本次不把换图冒充完整接入。
- 剧情背景状态图不等于剧情已经使用：后续场次仍需逐事件配置正常、异常状态，不能一张背景统一覆盖所有剧情。
- UI参考和角色原稿不作为场景背景；背包物品图片不作为地图。

## 走廊与透明素材修正

旧 corridor-map.png 已删除，第四场与走廊地图使用走廊示意图1.png；横向走廊重新限定可走地板，仅保留返回馆内入口。原先不存在于新图的房门入口取消。赵灵立绘清除发丝内白底；ui/ 下保存透明对话框，原稿保留。
