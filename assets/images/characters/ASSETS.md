# 角色素材

用户提供原图，使用内置 imagegen 工具去除背景后导入；原始文件保留。

- hero-walk-sheet.png：透明四向图集。上走使用背面，下走使用正面。每方向只有一帧，移动添加轻微起伏，不是完整逐帧步行动画。
- hero-portrait.png：主角立绘。
- zhaoling-portrait.png：赵灵立绘。

所有地图共用 js/player-avatar.js，坐标以脚底为准。js/novel-portraits.js 按剧本原始说话人切换立绘；新角色在此扩展，不改变剧情文本。

## 处理提示词

### walk

Use case: background-extraction. Edit target: the attached four-direction pixel security guard sprite sheet. Remove ONLY the black/gray background, glow, floor shadows, captions and caption boxes; return true transparent RGBA PNG. Preserve all four original guard poses, facial details, black uniform, badge, pixel edges and colors as exactly as possible. Keep the original 3:2 canvas and positions: front-facing top-left, rear-facing top-right, left-facing bottom-left, right-facing bottom-right. Four complete separate figures, unchanged scale, no feet or hats clipped, no new poses or details, no labels, no checkerboard drawn into pixels. This is extraction of the supplied art for a game, not a redesign.

### hero

Use case: background-extraction. Edit target: supplied square pixel-art portrait of male protagonist in black security uniform and cap. Remove ONLY the white background to actual transparent alpha. Preserve the entire original portrait, face, expression, cap, Chinese uniform lettering, pose, colors, pixel edges, framing, bottom crop and size. Do not redraw, beautify, recolor or add anything. Remove white edge halos; retain pale skin, eyes and badges as opaque. Return a transparent RGBA PNG, not a rendered checkerboard.

### zhaoling

Use case: background-extraction. Edit target: supplied square pixel-art portrait of Zhao Ling, brown ponytail, red security uniform. Remove ONLY the white background including white gaps around the ponytail to actual transparent alpha. Preserve the original face, expression, hair strands, uniform Chinese lettering, pose, colors, pixel art style, exact framing and bottom crop. No redesign or new elements. Remove white edge halos, retain skin/eyes/badges. Return transparent RGBA PNG, no painted checkerboard.

