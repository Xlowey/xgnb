# 四向步行差分

使用内置 imagegen，依据原四向保安小人生成。三列分别为迈步 A、站立、迈步 B；四行分别为正面、背面、向左、向右。游戏循环 A→站立→B→站立，停下使用站立帧。固定比例、脚底对齐，不进行网格拉伸或身体旋转。

## 生成提示词

Create a NEW pixel-art animation sheet using the attached character ONLY as the identity/design reference, not as a pose template. Black-uniform security guard, black cap, same youthful face. 3 columns x 4 rows = exactly 12 sprites on plain WHITE background (no checkerboard). Row1 front; row2 back; row3 facing left; row4 facing right. In each row: column1 LEFT LEG extended forward and RIGHT ARM swinging forward; column2 NEUTRAL STANDING upright with TWO boots side by side, legs straight; column3 RIGHT LEG extended forward and LEFT ARM swinging forward. Draw the legs independently, do not copy the reference pose into every cell. Critical front view: first pose boot on screen-right hangs LOW, screen-left boot lifted; third pose boot on screen-left hangs LOW, screen-right boot lifted. Both feet clearly visible and separated, not crossing over the centerline. Back view reverse that foot pattern. Profile first pose NEAR leg forward, third pose NEAR leg trailing back (near thigh must visibly angle backward, far thigh forward). Corresponding near arm reverses its swing, never repeat same forearm placement. Think actual human anatomical walk contact poses alternating sides. Same head/body size each cell, full-body with feet/cap fully inside each cell and ample padding, evenly aligned fixed 3x4 grid. Keep costumes and cap detail consistent. No labels, no scenery, no shadows. Distinct leg/arm poses matter more than copying the supplied pose.

## 侧面肢体修正

Use case: background-extraction and precise-object-edit. Edit this exact 3-column 4-row security guard sprite sheet. KEEP columns 1 and 2 completely unchanged. KEEP the entire front and back rows unchanged. In column 3 of the LEFT-FACING row, change ONLY limbs: the near leg (the leg with the visible thigh cargo pocket) must point backward toward SCREEN RIGHT, its boot trailing to the right, while the FAR leg extends to SCREEN LEFT. The near arm with visible shoulder patch swings FORWARD toward SCREEN LEFT, the far arm trails right. In column 3 of the RIGHT-FACING row, near leg cargo-pocket leg trails toward SCREEN LEFT, far leg steps forward SCREEN RIGHT; near arm/shoulder patch swings forward SCREEN RIGHT. These two poses must have opposite limb overlaps to column1, not be copies. Then remove the white background to actual transparent alpha, including between boots and arms. Preserve EXACT canvas size, positions, scale, all heads/caps/faces, uniform details, torso shapes, pixel style. No labels, no shadow, no drawn checkerboard. Return true transparent RGBA PNG.


## 导入与验证

生成工具未正确输出透明通道，经用户明确同意，使用 Python/Pillow 做背景连通域去除，并保留每格人物的主要连通部分。最终素材：hero-walk-cycle.png。旧图集和动画预览已清理。地图按实际移动距离切帧，不旋转、挤压或拉伸身体。已验证四向帧切换、循环、静止姿势、五张地图及第二场探索。
