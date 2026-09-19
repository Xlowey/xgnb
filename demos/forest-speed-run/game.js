"use strict";

const CONFIG = Object.freeze({
  VIEW_DISTANCE: 220,
  BASE_SPEED: 75,
  SPEED_STEP_SECONDS: 30,
  SPEED_STEP_MULTIPLIER: 1.25,
  SURVIVAL_TARGET: 180,
  DASH_SPEED_BONUS: 15,
  PLAYER_WORLD_Z: 20,
  SCENE_HORIZON: 0.43,
  ACTION_DURATION: 0.7,
  ACTION_SWITCH_MIN: 0.25,
  LANE_SWITCH_MIN: 0.1,
  LANE_CHANGE_TIME: 0.25,
  SLIDE_DURATION: 0.7,
  JUMP_HEIGHT: 65,
  MIN_ROW_SECONDS: 0.75,
  COIN_RENDER_SCALE: 1.5,
  POWERUP_TO_COIN_SCALE: 2.5,
  PLAYER_COLLISION_Z: 5.2,
  COIN_VALUE: 100,
  MAGNET_DURATION: 8,
  DOUBLE_DURATION: 10,
  DASH_DURATION: 4,
  STUMBLE_DURATION: 5,
  WALL_STUN_DURATION: 5,
  WALL_HIT_LIMIT: 3,
  MAX_PARTICLES: 130,
  STORAGE_SCORE: "forestRushBestScore",
  STORAGE_DISTANCE: "forestRushBestDistance",
});

const GameState = Object.freeze({ MENU: "MENU", PLAYING: "PLAYING", PAUSED: "PAUSED", GAME_OVER: "GAME_OVER", SUCCESS: "SUCCESS" });
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, n) => { const t = clamp((n - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rand = (min, max) => min + Math.random() * (max - min);
const choose = list => list[(Math.random() * list.length) | 0];

function safeStoreGet(key, fallback) {
  try { const value = localStorage.getItem(key); return value === null ? fallback : value; }
  catch { return fallback; }
}

function safeStoreSet(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* 隐私模式下允许继续游戏 */ }
}

class InputManager {
  constructor(canvas, callback) {
    this.callback = callback;
    this.startX = 0;
    this.startY = 0;
    this.pointerActive = false;

    window.addEventListener("keydown", event => {
      const map = {
        ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
        ArrowUp: "jump", KeyW: "jump", Space: "jump", ArrowDown: "slide", KeyS: "slide",
        Escape: "pause", KeyP: "pause",
      };
      const action = map[event.code];
      if (!action) return;
      event.preventDefault();
      if (!event.repeat) this.callback(action);
    }, { passive: false });

    canvas.addEventListener("pointerdown", event => {
      this.pointerActive = true;
      this.startX = event.clientX;
      this.startY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener("pointerup", event => {
      if (!this.pointerActive) return;
      this.pointerActive = false;
      const dx = event.clientX - this.startX;
      const dy = event.clientY - this.startY;
      const distance = Math.hypot(dx, dy);
      if (distance < 24) return;
      this.callback(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "jump" : "slide"));
    });
    canvas.addEventListener("pointercancel", () => { this.pointerActive = false; });
    canvas.addEventListener("contextmenu", event => event.preventDefault());

    document.querySelectorAll("[data-action]").forEach(button => {
      button.addEventListener("pointerdown", event => {
        event.preventDefault();
        event.stopPropagation();
        this.callback(button.dataset.action);
      });
    });
  }
}

class Player {
  constructor() { this.reset(); }

  reset() {
    this.lane = 0;
    this.targetLane = 0;
    this.fromLane = 0;
    this.laneProgress = 1;
    this.previousLane = 0;
    this.height = 0;
    this.verticalVelocity = 0;
    this.jumpElapsed = 0;
    this.jumpActive = false;
    this.actionCooldown = 0;
    this.laneCooldown = 0;
    this.slideTimer = 0;
    this.runTime = 0;
    this.lean = 0;
    this.crashed = false;
    this.shield = false;
    this.magnetTimer = 0;
    this.doubleTimer = 0;
    this.dashTimer = 0;
    this.stumbleTimer = 0;
    this.wallHits = 0;
    this.wallStunTimer = 0;
    this.wallBumpTimer = 0;
    this.wallBumpDirection = 0;
    this.landingPulse = 0;
  }

  move(direction) {
    if (this.crashed || this.laneCooldown > 1e-8) return false;
    const base = this.targetLane;
    const next = clamp(base + direction, -1, 1);
    if (next === base) {
      // 尚未抵达边界时不算撞墙，避免连续换道输入提前触发撞墙。
      if (this.laneProgress < 1) return false;
      this.laneCooldown = CONFIG.LANE_SWITCH_MIN;
      return "wall";
    }
    this.fromLane = this.lane;
    this.targetLane = next;
    this.laneProgress = 0;
    this.laneCooldown = CONFIG.LANE_SWITCH_MIN;
    return true;
  }

  jump() {
    if (this.crashed || this.jumpActive || this.actionCooldown > 1e-8) return false;
    this.slideTimer = 0;
    this.landingPulse = 0;
    this.jumpElapsed = 0;
    this.jumpActive = true;
    this.verticalVelocity = 4 * CONFIG.JUMP_HEIGHT / CONFIG.ACTION_DURATION;
    this.actionCooldown = CONFIG.ACTION_SWITCH_MIN;
    return true;
  }

  slide() {
    if (this.crashed || this.actionCooldown > 1e-8) return false;
    if (this.jumpActive || this.height > 0) {
      this.height = 0;
      this.verticalVelocity = 0;
      this.jumpActive = false;
      this.jumpElapsed = 0;
      this.landingPulse = 1;
    }
    this.slideTimer = CONFIG.SLIDE_DURATION;
    this.actionCooldown = CONFIG.ACTION_SWITCH_MIN;
    return true;
  }

  update(dt) {
    this.runTime += dt;
    this.actionCooldown = Math.max(0, this.actionCooldown - dt);
    this.laneCooldown = Math.max(0, this.laneCooldown - dt);
    this.previousLane = this.lane;
    if (this.laneProgress < 1) {
      this.laneProgress = Math.min(1, this.laneProgress + dt / CONFIG.LANE_CHANGE_TIME);
      if (this.laneProgress >= 1 - 1e-8) this.laneProgress = 1;
      const t = 1 - Math.pow(1 - this.laneProgress, 3);
      this.lane = lerp(this.fromLane, this.targetLane, t);
    } else this.lane = this.targetLane;
    this.lean = lerp(this.lean, clamp((this.targetLane - this.lane) * 1.7, -0.28, 0.28), Math.min(1, dt * 14));

    if (this.jumpActive) {
      // 解析抛物线固定动作时长，避免帧率改变跳跃的高度或落地时间。
      this.jumpElapsed = Math.min(CONFIG.ACTION_DURATION, this.jumpElapsed + dt);
      const t = this.jumpElapsed / CONFIG.ACTION_DURATION;
      this.height = 4 * CONFIG.JUMP_HEIGHT * t * (1 - t);
      this.verticalVelocity = 4 * CONFIG.JUMP_HEIGHT / CONFIG.ACTION_DURATION * (1 - 2 * t);
      if (this.jumpElapsed >= CONFIG.ACTION_DURATION - 1e-8) {
        this.landingPulse = 1;
        this.height = 0;
        this.verticalVelocity = 0;
        this.jumpActive = false;
      }
    }
    this.landingPulse = Math.max(0, this.landingPulse - dt * 4.6);
    if (this.slideTimer > 0) this.slideTimer = Math.max(0, this.slideTimer - dt);
    this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    this.doubleTimer = Math.max(0, this.doubleTimer - dt);
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.stumbleTimer = Math.max(0, this.stumbleTimer - dt);
    this.wallStunTimer = Math.max(0, this.wallStunTimer - dt);
    this.wallBumpTimer = Math.max(0, this.wallBumpTimer - dt);
  }

  get sliding() { return this.slideTimer > 1e-8; }
  get airborne() { return this.height > 1; }
  get stumbled() { return this.stumbleTimer > 0 || this.wallStunTimer > 0; }
}

class WorldObject {
  constructor(lane, z) {
    this.lane = lane;
    this.z = z;
    this.previousZ = z;
    this.dead = false;
    this.resolved = false;
    this.phase = Math.random() * Math.PI * 2;
  }
  update(travel) { this.previousZ = this.z; this.z -= travel; }
  crossesDepth(center, radius) {
    return Math.min(this.previousZ, this.z) <= center + radius && Math.max(this.previousZ, this.z) >= center - radius;
  }
}

class Obstacle extends WorldObject {
  constructor(lane, z, type, options = {}) {
    super(lane, z);
    this.type = type;
    this.variant = options.variant || null;
    this.direction = options.direction || 1;
    this.isGlobal = type === "river";
    const definitions = {
      fence: { height: 42, label: "栅栏" },
      river: { height: 5, label: "小河" },
      bulldozer: { height: 68, label: "推土机" },
      rock: { height: 46, label: "大石头" },
      animal: { height: 18, label: "小动物" },
    };
    Object.assign(this, definitions[type]);
  }

  update(travel) {
    // 推土机以玩家速度的 25% 顺向或逆向行驶，因此相对接近速度分别为 75% 或 125%。
    if (this.type === "bulldozer") { this.previousZ = this.z; this.z -= travel * (1 - .25 * this.direction); }
    else super.update(travel);
  }
}

class Coin extends WorldObject {
  constructor(lane, z, height = 18) { super(lane, z); this.height = Math.max(18, height); this.pull = 0; }
}

class PowerUp extends WorldObject {
  constructor(lane, z, type) { super(lane, z); this.type = type; this.height = 28; }
}

class Particle {
  constructor(x, y, color, kind = "spark") {
    this.x = x; this.y = y; this.color = color; this.kind = kind;
    this.vx = rand(-95, 95); this.vy = rand(-120, -25);
    this.life = rand(.28, .62); this.maxLife = this.life; this.size = rand(2, 6);
    if (kind === "dust") { this.vy = rand(-42, -10); this.vx = rand(-72, 72); this.size = rand(5, 12); }
  }
  update(dt) { this.life -= dt; this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 190 * dt; }
}

class Spawner {
  constructor() { this.reset(); }

  reset() {
    this.rowTravel = 0;
    this.powerTravel = 0;
    this.nextRow = 72;
    this.nextPower = rand(350, 500);
    this.guideLane = 0;
    this.tutorialIndex = 0;
  }

  update(travel, game) {
    this.rowTravel += travel;
    this.powerTravel += travel;
    const difficulty = clamp(game.distance / 2300, 0, 1);

    if (this.rowTravel >= Math.max(this.nextRow, game.speed * CONFIG.MIN_ROW_SECONDS)) {
      this.rowTravel = 0;
      const spacingBonus = this.spawnObstacleRow(game, difficulty);
      this.nextRow = Math.max(lerp(76, 50, difficulty) + rand(-4, 8), game.speed * CONFIG.MIN_ROW_SECONDS) + spacingBonus;
    }
    if (this.powerTravel >= this.nextPower) {
      this.powerTravel = 0;
      game.powerUps.push(new PowerUp(this.guideLane, CONFIG.VIEW_DISTANCE + 6, choose(["magnet", "shield", "double", "dash"])));
      this.nextPower = rand(430, 650) + difficulty * 90;
    }
  }

  spawnObstacleRow(game, difficulty) {
    const tutorial = [
      { type:"fence", lane:-1, variant:"low" },
      { type:"fence", lane:0, variant:"high" },
      { type:"rock", lane:1 },
      { type:"animal", lane:-1 },
      { type:"river", lane:0 },
      { type:"bulldozer", lane:1, direction:1 },
    ];
    if(this.tutorialIndex<tutorial.length)return this.spawnTutorialRow(game,tutorial[this.tutorialIndex++]);

    // 小河横跨三轨，但以跳跃即可通过，并获得额外排距，避免与下一排组成无解连招。
    if (Math.random() < lerp(.08, .16, difficulty)) {
      game.obstacles.push(new Obstacle(0, CONFIG.VIEW_DISTANCE, "river"));
      this.spawnRiverCoins(game, this.guideLane, CONFIG.VIEW_DISTANCE);
      return 30;
    }

    // 其他障碍每排最多占两条轨道，至少保留一条无需承担风险的安全路线。
    const lanes = [-1, 0, 1].sort(() => Math.random() - .5);
    const count = Math.random() < lerp(.18, .64, difficulty) ? 2 : 1;
    const availableTypes = difficulty < .18 ? ["fence", "rock", "animal"] : ["fence", "rock", "animal", "bulldozer"];
    const blockedLanes = lanes.slice(0, count);
    const safeLanes = lanes.slice(count);
    let spacingBonus = 0;
    // 安全出口优先选择障碍旁边的跑道，确保吃完最后一枚金币后只需横移一次。
    const safeLane = safeLanes.reduce((best, lane) => Math.abs(lane - blockedLanes[0]) < Math.abs(best - blockedLanes[0]) ? lane : best, safeLanes[0]);
    for (let i = 0; i < count; i++) {
      let type = choose(availableTypes);
      if (count === 2 && i === 1 && type === "bulldozer" && game.obstacles.at(-1)?.type === "bulldozer") type = "rock";
      const options = type === "fence"
        ? { variant: Math.random() < .45 ? "high" : "low" }
        : type === "bulldozer" ? { direction: Math.random() < .5 ? 1 : -1 } : {};
      if(type==="bulldozer"&&options.direction===1)spacingBonus=55;
      game.obstacles.push(new Obstacle(blockedLanes[i], CONFIG.VIEW_DISTANCE + i * 1.2, type, options));
    }
    // 金币优先排在障碍所在一侧；双障碍时选靠近安全出口的那条，仍然只形成一条路线。
    const coinLane = blockedLanes.reduce((best,lane)=>Math.abs(lane-safeLane)<Math.abs(best-safeLane)?lane:best,blockedLanes[0]);
    this.spawnApproachCoins(game, coinLane, CONFIG.VIEW_DISTANCE);
    this.guideLane = safeLane;
    return spacingBonus;
  }

  spawnTutorialRow(game, spec) {
    if(spec.type==="river"){
      game.obstacles.push(new Obstacle(0,CONFIG.VIEW_DISTANCE,"river"));
      this.spawnRiverCoins(game,this.guideLane,CONFIG.VIEW_DISTANCE);
      return 30;
    }
    const safeLanes=[-1,0,1].filter(lane=>lane!==spec.lane);
    const safeLane=safeLanes.reduce((best,lane)=>Math.abs(lane-spec.lane)<Math.abs(best-spec.lane)?lane:best,safeLanes[0]);
    const options=spec.type==="fence"?{variant:spec.variant}:spec.type==="bulldozer"?{direction:spec.direction}:{};
    game.obstacles.push(new Obstacle(spec.lane,CONFIG.VIEW_DISTANCE,spec.type,options));
    this.spawnApproachCoins(game,spec.lane,CONFIG.VIEW_DISTANCE);
    this.guideLane=safeLane;
    return spec.type==="bulldozer"&&spec.direction===1?55:0;
  }

  spawnRiverCoins(game, lane, obstacleZ) {
    const count = 5;
    const clearance = Math.max(16, game.speed * .11);
    for (let i = 0; i < count; i++) {
      game.coins.push(new Coin(lane, obstacleZ - clearance - 40 + i * 10, 24));
    }
  }

  spawnApproachCoins(game, obstacleLane, obstacleZ) {
    // 反应距离随前进速度增长，最后一枚金币之后留出动作间隔与换道余量。
    const count = 5;
    // 不让后期较长的反应距离把金币生成到人物身后。
    const maxClearance = CONFIG.VIEW_DISTANCE - CONFIG.PLAYER_WORLD_Z - 44 - 12;
    const clearance = Math.min(maxClearance, Math.max(28, game.speed * (CONFIG.ACTION_SWITCH_MIN + .08)));
    for (let i = 0; i < count; i++) {
      game.coins.push(new Coin(obstacleLane, obstacleZ - clearance - 44 + i * 11, 11));
    }
  }

}

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.width = 0; this.height = 0; this.dpr = 1;
    this.powerUpImages = {};
    for (const [type, path] of Object.entries({magnet:"assets/magnet.png",double:"assets/double-score.png",shield:"assets/helmet.png"})) {
      const texture = new Image();
      texture.src = path;
      this.powerUpImages[type] = texture;
    }
    this.museumBackground = new Image();
    this.museumBackground.src = "assets/museum/corridor.webp";
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(480, rect.width);
    this.height = Math.max(270, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  project(lane, z, worldHeight = 0) {
    // 恢复博物馆初版的镜头与比例，只在离开画面时继续平滑投影，不做夸张的近景放大。
    const cameraDepth = 70;
    const safeZ = Math.max(-25, z);
    const rawScale = cameraDepth / (safeZ + cameraDepth);
    const farScale = cameraDepth / (CONFIG.VIEW_DISTANCE + cameraDepth);
    const p = Math.max(0,(rawScale-farScale)/(1-farScale));
    const horizon = this.height * CONFIG.SCENE_HORIZON;
    const bottom = this.height * .96;
    const roadHalf = lerp(this.width*.035,this.width*.38,p);
    const scale = clamp(rawScale*1.05,.18,1.4);
    return {
      x: this.width * .5 + lane * roadHalf * .62,
      y: horizon + (bottom - horizon) * p - worldHeight * scale,
      scale, p, roadHalf,
    };
  }

  face(points, color, outline = null) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();ctx.moveTo(points[0].x, points[0].y);
    for (let i=1;i<points.length;i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();ctx.fill();
    if (outline) {ctx.strokeStyle=outline;ctx.lineWidth=.7;ctx.stroke();}
  }

  box(lane, z, halfLane, depth, bottom, top, colors) {
    const point = (x,d,y) => this.project(lane+x,z+d,y);
    const a=point(-halfLane,-depth/2,bottom), b=point(halfLane,-depth/2,bottom);
    const c=point(halfLane,depth/2,bottom), d=point(-halfLane,depth/2,bottom);
    const A=point(-halfLane,-depth/2,top), B=point(halfLane,-depth/2,top);
    const C=point(halfLane,depth/2,top), D=point(-halfLane,depth/2,top);
    // 只画相机可见的侧面，中央物体不凭空出现左右两张侧脸。
    if (lane-halfLane>0) this.face([d,a,A,D],colors.side);
    if (lane+halfLane<0) this.face([b,c,C,B],colors.side);
    this.face([A,B,C,D],colors.top);
    this.face([a,b,B,A],colors.front);
    return {a,b,A,B,C,D};
  }

  groundShadow(lane,z,halfLane,depth,opacity=.34) {
    const points=[];
    for(let i=0;i<24;i++) {
      const angle=i*Math.PI/12;
      points.push(this.project(lane+Math.cos(angle)*halfLane,z+Math.sin(angle)*depth,.2));
    }
    this.face(points,`rgba(3,7,13,${opacity})`);
  }

  palette(distance) {
    // 博物馆始终是夜景，不改变静止远景或制造闪烁。
    return {
      road: "#242b38", roadNear: "#424553", edge: "#6c5942",
      night: 1, dusk: 0,
    };
  }

  render(game) {
    const ctx = this.ctx;
    const w = this.width, h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (game.shake > 0) ctx.translate(rand(-game.shake, game.shake), rand(-game.shake, game.shake));
    const palette = this.palette(game.distance);
    this.drawBackground(game, palette);
    this.drawRoad(game, palette);
    this.drawRoadside(game, palette);
    this.drawWorldObjects(game);
    this.drawParticles(game.particles);
    this.drawAtmosphere();
    ctx.restore();
  }

  drawBackground(game, colors) {
    const ctx = this.ctx, w = this.width, h = this.height;
    ctx.fillStyle = "#111722"; ctx.fillRect(0, 0, w, h);
    const art = this.museumBackground;
    if (art?.complete && art.naturalWidth > 0) {
      const scale = Math.max(w / art.naturalWidth, h / art.naturalHeight);
      const aw = art.naturalWidth * scale, ah = art.naturalHeight * scale;
      // 原画等比裁切；灭点与赛道相接。远景不随 worldTravel / ambientTime 移动。
      ctx.drawImage(art, (w-aw)/2, h*CONFIG.SCENE_HORIZON-ah*.56, aw, ah);
    } else {
      // 图片不可用时仍能离线游玩：程序绘制馆内墙面和稳定的拱门。
      const horizon = h*CONFIG.SCENE_HORIZON;
      for (const side of [-1, 1]) {
        ctx.fillStyle = "#293241"; ctx.beginPath();
        ctx.moveTo(w/2+side*w*.035,horizon);ctx.lineTo(w/2+side*w*.5,0);
        ctx.lineTo(w/2+side*w*.5,h);ctx.closePath();ctx.fill();
        for (let i=1;i<6;i++) {
          const t=i/6,x=w/2+side*w*.48*t,y=horizon*(1-t);
          ctx.strokeStyle="#645641";ctx.lineWidth=1+t*4;
          ctx.strokeRect(x-side*w*.05*t,y+h*.09*t,side*w*.06*t,h*.5*t);
        }
      }
    }
    const shade=ctx.createLinearGradient(0,0,0,h);
    shade.addColorStop(0,"rgba(5,8,15,.16)");shade.addColorStop(.5,"rgba(5,8,15,.02)");
    shade.addColorStop(1,"rgba(5,8,15,.28)");ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
  }

  drawRoad(game, colors) {
    const ctx = this.ctx, w = this.width, h = this.height;
    const horizon = h * CONFIG.SCENE_HORIZON;
    const edge = 1/.62;
    const topHalf=w*.035;
    // 只把原地面向画面下方延续，避免底部留出一条“悬空”接缝；不改变镜头或人物位置。
    const nearLeft=this.project(-edge,-6),nearRight=this.project(edge,-6);
    this.face([{x:w/2-topHalf-5,y:horizon},{x:w/2+topHalf+5,y:horizon},
      {x:nearRight.x+15,y:nearRight.y},{x:nearLeft.x-15,y:nearLeft.y}],colors.edge);
    const roadGradient = ctx.createLinearGradient(0, horizon, 0, nearLeft.y);
    roadGradient.addColorStop(0,colors.road);roadGradient.addColorStop(1,colors.roadNear);
    this.face([this.project(-edge,CONFIG.VIEW_DISTANCE),this.project(edge,CONFIG.VIEW_DISTANCE),
      nearRight,nearLeft],roadGradient);

    // 两条车道分隔改为低对比度双犁沟：连续、固定，不再像道路标线一样向前滚动。
    for (const divider of [-.5, .5]) {
      for (const groove of [-.027, .027]) {
        const lane = divider + groove;
        const farLeft = this.project(lane-.003,CONFIG.VIEW_DISTANCE);
        const farRight = this.project(lane+.003,CONFIG.VIEW_DISTANCE);
        const nearLeft = this.project(lane - .003, -6);
        const nearRight = this.project(lane + .003, -6);
        ctx.fillStyle = "rgba(8,13,21,.25)";
        ctx.beginPath();
        ctx.moveTo(farLeft.x, farLeft.y);ctx.lineTo(farRight.x, farRight.y);
        ctx.lineTo(nearRight.x, nearRight.y);ctx.lineTo(nearLeft.x, nearLeft.y);
        ctx.closePath();ctx.fill();

        const farHighlight = this.project(lane+.010,CONFIG.VIEW_DISTANCE);
        const nearHighlight = this.project(lane + .010, -6);
        ctx.strokeStyle = "rgba(185,163,122,.18)";ctx.lineWidth = 1;
        ctx.beginPath();ctx.moveTo(farHighlight.x, farHighlight.y);ctx.lineTo(nearHighlight.x, nearHighlight.y);ctx.stroke();
      }
    }

    // 稳定分布的短车辙会朝镜头拉长，强化前后（Z 轴）速度感，但不会带动远景。
    const cueGap = 13;
    const cueOffset = game.worldTravel % cueGap;
    const cueBase = Math.floor(game.worldTravel / cueGap);
    for (let i = 0; i < 19; i++) {
      const z = i * cueGap - cueOffset + 5;
      if (z <= 0 || z >= CONFIG.VIEW_DISTANCE) continue;
      const segment = cueBase + i;
      const seed = ((segment * 37) % 101 + 101) % 101;
      const lane = (seed / 100 - .5) * 1.55;
      const near = this.project(lane, z);
      const far = this.project(lane, z + 4.5);
      if (near.p <= 0) continue;
      ctx.strokeStyle = `rgba(163,177,195,${.025 + near.p * .07})`;
      ctx.lineWidth = Math.max(.7, near.scale * 2.3);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(far.x, far.y); ctx.lineTo(near.x, near.y); ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  drawRoadside(game, colors) {
    const ctx = this.ctx;
    const offset = game.worldTravel % 18;
    for (let i = 14; i >= -1; i--) {
      const z = i * 18 - offset + 8;
      if (z < -20 || z > CONFIG.VIEW_DISTANCE) continue;
      // 固定世界路段编号；跨过循环边界时，同一件展厅装饰不会改变身份。
      const segment = Math.floor(game.worldTravel / 18) + i;
      const side = (segment & 1) ? -1 : 1;
      const lane = side * (1.72 + ((segment % 3 + 3) % 3) * .16);
      const p = this.project(lane, z);
      const size = 27 * p.scale;
      const kind=(segment%3+3)%3;
      ctx.save(); ctx.translate(p.x, p.y);
      if (kind === 0) {
        // 黄铜引导灯，光亮固定，无随机闪动。
        ctx.fillStyle="#64513a";ctx.fillRect(-size*.06,-size*2,size*.12,size*2);
        ctx.fillRect(-size*.25,-size*.06,size*.5,size*.06);
        ctx.fillStyle="#171a23";ctx.fillRect(-size*.23,-size*2.15,size*.46,size*.45);
        ctx.fillStyle="#dfba77";ctx.fillRect(-size*.13,-size*2.04,size*.26,size*.24);
        ctx.fillStyle="rgba(230,181,99,.09)";ctx.beginPath();ctx.ellipse(0,0,size*.6,size*.13,0,0,Math.PI*2);ctx.fill();
      } else if (kind === 1) {
        // 保留初版的小展柜剪影，仅补一条很薄的顶沿和侧沿。
        const q=(x,y)=>({x:x*size,y:y*size});
        this.face([q(-.36,-1.95),q(.36,-1.95),q(.42,-2.01),q(-.3,-2.01)],"#827053");
        this.face([q(.36,-1.95),q(.42,-2.01),q(.42,-.24),q(.36,-.24)],"#161e28");
        ctx.fillStyle="#292726";ctx.fillRect(-size*.43,-size*.24,size*.86,size*.24);
        ctx.fillStyle="rgba(18,25,35,.85)";ctx.fillRect(-size*.36,-size*1.95,size*.72,size*1.71);
        ctx.strokeStyle="#79654a";ctx.lineWidth=Math.max(.8,size*.04);ctx.strokeRect(-size*.36,-size*1.95,size*.72,size*1.71);
        ctx.fillStyle="#55504b";ctx.beginPath();ctx.arc(0,-size*1.53,size*.14,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.moveTo(-size*.2,-size*.46);ctx.lineTo(-size*.14,-size*1.3);
        ctx.lineTo(size*.14,-size*1.3);ctx.lineTo(size*.2,-size*.46);ctx.closePath();ctx.fill();
      } else {
        ctx.strokeStyle="#714139";ctx.lineWidth=Math.max(1,size*.09);
        ctx.beginPath();ctx.moveTo(-size*.45,-size*.66);ctx.quadraticCurveTo(0,-size*.38,size*.45,-size*.66);ctx.stroke();
        for(const x of [-size*.45,size*.45]){
          ctx.fillStyle="#947850";ctx.fillRect(x-size*.04,-size*.85,size*.08,size*.85);
          ctx.beginPath();ctx.arc(x,-size*.86,size*.07,0,Math.PI*2);ctx.fill();
        }
      }
      ctx.restore();
    }

  }

  drawAtmosphere() {
    const ctx=this.ctx,w=this.width,h=this.height;
    const vignette=ctx.createRadialGradient(w*.5,h*.6,h*.17,w*.5,h*.53,w*.65);
    vignette.addColorStop(0,"rgba(3,5,10,0)");vignette.addColorStop(1,"rgba(3,5,10,.53)");
    ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  }

  drawWorldObjects(game) {
    // 角色也进入同一张深度队列：身后的物体不能盖在角色前面，已越过的物体则画在前景。
    const playerLayer={z:CONFIG.PLAYER_WORLD_Z,player:true};
    const visible = [playerLayer];
    for (const item of game.obstacles) if (!item.dead && item.z > -12 && item.z < CONFIG.VIEW_DISTANCE + 35) visible.push(item);
    for (const item of game.coins) if (!item.dead && item.z > -12 && item.z < CONFIG.VIEW_DISTANCE + 70) visible.push(item);
    for (const item of game.powerUps) if (!item.dead && item.z > -12 && item.z < CONFIG.VIEW_DISTANCE + 25) visible.push(item);
    visible.sort((a, b) => b.z - a.z);
    for (const item of visible) {
      if (item.player) this.drawPlayer(game);
      else if (item instanceof Obstacle) this.drawObstacle(item);
      else if (item instanceof Coin) this.drawCoin(item, game.ambientTime);
      else this.drawPowerUp(item, game.ambientTime);
    }
  }

  drawObstacle(item) {
    const ctx = this.ctx, p = this.project(item.lane, item.z);
    const s = p.scale, laneWidth = p.roadHalf * .56;
    const alpha = clamp((CONFIG.VIEW_DISTANCE + 18 - item.z) / 30, 0, 1);

    if (item.type === "river") {
      const far = this.project(0, item.z + 5), near = this.project(0, item.z - 5);
      ctx.save(); ctx.globalAlpha = alpha;
      const waterLane=1.95;
      const farLeft=this.project(-waterLane,item.z+5,-3),farRight=this.project(waterLane,item.z+5,-3);
      const nearLeft=this.project(-waterLane,item.z-5,-3),nearRight=this.project(waterLane,item.z-5,-3);
      const water=ctx.createLinearGradient(0,far.y,0,near.y);
      water.addColorStop(0,"#142e48");water.addColorStop(1,"#326786");
      this.face([farLeft,farRight,nearRight,nearLeft],water);
      this.face([this.project(-waterLane,item.z+5),this.project(waterLane,item.z+5),farRight,farLeft],"#111b28");
      this.face([this.project(-waterLane,item.z-5),this.project(waterLane,item.z-5),nearRight,nearLeft],"#537184");
      ctx.strokeStyle = "rgba(170,235,255,.78)"; ctx.lineWidth = Math.max(1, s * 2);
      for (const t of [-.55, 0, .55]) {
        const y = lerp(farLeft.y, nearLeft.y, (t + 1) * .5);
        const half = lerp(far.roadHalf, near.roadHalf, (t + 1) * .5)*waterLane*.62;
        ctx.beginPath();
        for (let x = -half; x <= half; x += Math.max(12, 24 * s)) {
          const px = near.x + x;
          if (x === -half) ctx.moveTo(px, y); else ctx.lineTo(px, y + Math.sin(x * .045 + item.phase) * 2.2 * s);
        }
        ctx.stroke();
      }
      ctx.restore(); return;
    }

    ctx.save();ctx.globalAlpha = alpha;
    this.groundShadow(item.lane,item.z,.42,item.type==="bulldozer"?2.2:1.4,.28);

    if (item.type === "fence") {
      const high=item.variant==="high", top=high?62:40;
      const wood={front:"#b0753b",side:"#805332",top:"#c9975d"};
      this.box(item.lane,item.z,.44,1.5,top-15,top,wood);
      if(!high) this.box(item.lane,item.z,.44,1.5,7,19,wood);
      for (const side of [-1,1]) this.box(item.lane+side*.41,item.z,.025,1.8,0,top+1,{front:"#70452a",side:"#5d402c",top:"#9c774e"});
      for(let x=-.36;x<.4;x+=.17) {
        this.face([this.project(item.lane+x,item.z-.8,top-12),this.project(item.lane+x+.075,item.z-.8,top-12),
          this.project(item.lane+x+.075,item.z-.8,top-3),this.project(item.lane+x,item.z-.8,top-3)],"#ead499");
      }
    } else if (item.type === "rock") {
      const at=(x,z,y)=>this.project(item.lane+x,item.z+z,y);
      const a=at(-.4,-1.5,0),b=at(.4,-1.5,0),c=at(.4,1.5,3),d=at(-.34,1.5,2);
      const A=at(-.27,-.8,41),B=at(.26,-.5,37),C=at(.18,.8,56),D=at(-.16,1.2,51);
      this.face([d,a,A,D],"#5b6b70");this.face([b,c,C,B],"#53646a");
      this.face([A,B,C,D],"#96a29e");this.face([a,b,B,A],"#637174");
      this.face([a,A,at(-.04,-1.2,24)],"#83918e");this.face([B,b,at(.04,-1.2,21)],"#5e7076");
    } else if (item.type === "bulldozer") {
      const metal={front:"#c59438",side:"#a17a32",top:"#d6b15e"};
      for(const side of [-1,1]) this.box(item.lane+side*.35,item.z,.06,4,0,24,{front:"#263139",side:"#202b32",top:"#414c52"});
      this.box(item.lane,item.z,.34,3.5,13,37,metal);
      this.box(item.lane,item.z+.3,.27,3,35,62,metal);
      const windZ=item.z-1.25;
      this.face([this.project(item.lane-.19,windZ,40),this.project(item.lane+.19,windZ,40),
        this.project(item.lane+.19,windZ,58),this.project(item.lane-.19,windZ,58)],item.direction<0?"#42636a":"#374e58");
      this.face([this.project(item.lane-.17,windZ-.05,54),this.project(item.lane+.08,windZ-.05,58),
        this.project(item.lane-.17,windZ-.05,58)],"rgba(198,228,228,.14)");
      this.box(item.lane,item.z+.3,.28,3.2,62,64,{front:"#c59f51",side:"#a18546",top:"#dbc07a"});
      if(item.direction<0){
        this.box(item.lane,item.z-3,.44,1,0,12,{front:"#bfc5ba",side:"#8c9c9e",top:"#d1d5c9"});
      }else{
        this.box(item.lane+.19,item.z+.8,.025,.7,62,73,{front:"#503c27",side:"#403a2c",top:"#71644c"});
      }
      for(const side of [-1,1]) {
        const lamp=this.project(item.lane+side*.26,item.z-1.8,item.direction<0?32:24);
        ctx.fillStyle=item.direction<0?"#ffe3a2":"#b14c45";ctx.beginPath();ctx.arc(lamp.x,lamp.y,3.5*s,0,Math.PI*2);ctx.fill();
      }
    } else if (item.type === "animal") {
      ctx.translate(p.x,p.y);
      const size=clamp(laneWidth*.13,3,25);
      for(const offset of [-.31,0,.31]){
        const x=laneWidth*offset;
        ctx.fillStyle="#bd7545";ctx.beginPath();ctx.ellipse(x,-size*.66,size*.62,size*.72,0,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x,-size*1.44,size*.48,0,Math.PI*2);ctx.fill();
        ctx.fillStyle="#dba06b";ctx.beginPath();ctx.moveTo(x-size*.36,-size*1.7);ctx.lineTo(x-size*.18,-size*2.18);ctx.lineTo(x,-size*1.7);ctx.moveTo(x+size*.08,-size*1.7);ctx.lineTo(x+size*.28,-size*2.18);ctx.lineTo(x+size*.43,-size*1.68);ctx.fill();
        ctx.fillStyle="#272c29";ctx.beginPath();ctx.arc(x-size*.16,-size*1.48,Math.max(1,size*.06),0,Math.PI*2);ctx.arc(x+size*.16,-size*1.48,Math.max(1,size*.06),0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
  }

  drawCoin(item, time) {
    const ctx=this.ctx,p=this.project(item.lane,item.z,item.height),s=p.scale*.84*CONFIG.COIN_RENDER_SCALE*(1+Math.sin(time*7+item.phase)*.05);
    ctx.save();ctx.globalAlpha=clamp((CONFIG.VIEW_DISTANCE-item.z)/20,0,1);
    this.groundShadow(item.lane,item.z,.065,1.5,.24);ctx.restore();
    ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=clamp((CONFIG.VIEW_DISTANCE-item.z)/20,0,1);
    // 金币有固定厚度，侧沿与正面分层；不改变整条金币路线的中心位置。
    ctx.fillStyle="#b38028";ctx.beginPath();ctx.ellipse(1.5*s,.5*s,11*s,14*s,0,0,Math.PI*2);ctx.fill();
    ctx.shadowColor="#ffd84f";ctx.shadowBlur=10*s;ctx.fillStyle="#ffc83d";ctx.beginPath();ctx.ellipse(0,0,11*s,14*s,0,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle="#fff2a0";ctx.lineWidth=Math.max(1,2*s);ctx.stroke();ctx.fillStyle="#fff0a0";ctx.font=`${Math.max(7,11*s)}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("✦",0,1*s);ctx.restore();
  }

  drawPowerUp(item,time) {
    const ctx=this.ctx,p=this.project(item.lane,item.z,item.height+Math.sin(time*3+item.phase)*3),s=p.scale*.84;
    // 道具在原尺寸基础上放大 2 倍（金币直径的 2.5 倍）；保留用户贴图原始比例。
    const size=28*s*CONFIG.COIN_RENDER_SCALE*CONFIG.POWERUP_TO_COIN_SCALE;
    const colors={magnet:"#eb5b57",shield:"#ffc83d",double:"#ffd35b",dash:"#ffb72f"};
    const labels={magnet:"🧲",shield:"⛑",double:"×2",dash:"⚡"};
    ctx.save();ctx.globalAlpha=clamp((CONFIG.VIEW_DISTANCE-item.z)/20,0,1);
    this.groundShadow(item.lane,item.z,.15,3,.3);ctx.restore();
    ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=clamp((CONFIG.VIEW_DISTANCE-item.z)/20,0,1);
    ctx.shadowColor=colors[item.type];ctx.shadowBlur=10*s;
    const texture=this.powerUpImages[item.type];
    if(texture?.complete&&texture.naturalWidth>0){
      const longest=Math.max(texture.naturalWidth,texture.naturalHeight);
      const w=size*texture.naturalWidth/longest,h=size*texture.naturalHeight/longest;
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
      ctx.drawImage(texture,-w/2,-h/2,w,h);
    }else{
      // 冲刺保留原图标，资源尚未加载时也提供同尺寸占位。
      ctx.fillStyle=colors[item.type];ctx.beginPath();ctx.arc(0,0,size/2,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;ctx.strokeStyle="rgba(255,255,255,.85)";ctx.lineWidth=Math.max(1,2*s);ctx.stroke();
      ctx.fillStyle="#fff";ctx.font=`900 ${Math.max(8,size*.4)}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(labels[item.type],0,1*s);
    }
    ctx.restore();
  }

  drawBackSlide(game,x,groundY,unit,p) {
    const ctx=this.ctx;
    const rock=Math.sin(p.runTime*18)*.025;
    ctx.save();ctx.translate(x,groundY-3*unit);ctx.rotate(p.lean*.32+rock);

    // 滑铲专用姿势：头部靠近镜头、双脚伸向远方，肩背和腰部贴地，避免看成俯卧爬行。
    if(p.dashTimer>0){
      ctx.strokeStyle="rgba(255,220,88,.72)";ctx.lineWidth=3*unit;
      for(let i=0;i<5;i++){const sx=(i-2)*15*unit;ctx.beginPath();ctx.moveTo(sx,14*unit);ctx.lineTo(sx,30*unit+rand(4,18));ctx.stroke();}
    }

    // 贴地扬尘集中在肩背两侧，进一步标出接触面。
    ctx.fillStyle="rgba(213,180,127,.34)";
    for(const side of [-1,1]){
      ctx.beginPath();ctx.arc(side*(27+Math.sin(game.ambientTime*17)*2)*unit,2*unit,4.5*unit,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(side*35*unit,5*unit,2.5*unit,0,Math.PI*2);ctx.fill();
    }

    // 环纹尾巴沿地面拖在身体侧面。
    ctx.strokeStyle="#5a3a28";ctx.lineWidth=12*unit;ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(18*unit,-20*unit);ctx.quadraticCurveTo(48*unit,-12*unit,43*unit,8*unit);ctx.stroke();
    ctx.strokeStyle="#d4a36f";ctx.lineWidth=4.5*unit;
    ctx.beginPath();ctx.moveTo(29*unit,-12*unit);ctx.lineTo(43*unit,-7*unit);ctx.moveTo(32*unit,0);ctx.lineTo(42*unit,4*unit);ctx.stroke();

    // 双腿朝前并抬膝，脚掌位于画面上方，形成仰面、脚先行的姿态。
    ctx.strokeStyle="#493122";ctx.lineWidth=9*unit;
    for(const side of [-1,1]){
      ctx.beginPath();ctx.moveTo(side*10*unit,-30*unit);ctx.lineTo(side*20*unit,-48*unit);ctx.lineTo(side*14*unit,-66*unit);ctx.stroke();
      ctx.fillStyle="#33251d";ctx.beginPath();ctx.ellipse(side*14*unit,-69*unit,9*unit,5.5*unit,side*.12,0,Math.PI*2);ctx.fill();
    }

    // 手臂张开支撑平衡，但胸腹朝上。
    ctx.strokeStyle="#493122";ctx.lineWidth=8*unit;
    ctx.beginPath();ctx.moveTo(-17*unit,-28*unit);ctx.lineTo(-33*unit,-15*unit);ctx.lineTo(-36*unit,-2*unit);
    ctx.moveTo(17*unit,-28*unit);ctx.lineTo(33*unit,-15*unit);ctx.lineTo(36*unit,-2*unit);ctx.stroke();

    ctx.fillStyle="#88583b";ctx.beginPath();ctx.ellipse(0,-27*unit,24*unit,28*unit,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#c18a5c";ctx.beginPath();ctx.ellipse(0,-25*unit,14*unit,20*unit,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#f0bd42";ctx.beginPath();ctx.roundRect(-19*unit,-45*unit,38*unit,8*unit,4*unit);ctx.fill();

    // 镜头看到的是后脑与耳朵，脸部朝向天空；背部则明确压在道路上。
    ctx.fillStyle="#6b4431";ctx.beginPath();ctx.arc(-17*unit,0,9*unit,0,Math.PI*2);ctx.arc(17*unit,0,9*unit,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#b17c52";ctx.beginPath();ctx.arc(-17*unit,0,4.5*unit,0,Math.PI*2);ctx.arc(17*unit,0,4.5*unit,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#845438";ctx.beginPath();ctx.ellipse(0,3*unit,24*unit,21*unit,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#684431";ctx.beginPath();ctx.ellipse(0,1*unit,16*unit,13*unit,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#5a3828";ctx.beginPath();ctx.moveTo(-5*unit,-13*unit);ctx.lineTo(0,-20*unit);ctx.lineTo(5*unit,-13*unit);ctx.closePath();ctx.fill();

    if(p.shield){
      ctx.strokeStyle="rgba(91,222,255,.82)";ctx.lineWidth=4*unit;ctx.shadowColor="#58dfff";ctx.shadowBlur=14;
      ctx.beginPath();ctx.ellipse(0,-28*unit,46*unit,58*unit,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    }
    if(p.magnetTimer>0){
      ctx.strokeStyle="rgba(255,86,80,.62)";ctx.lineWidth=2*unit;ctx.setLineDash([5*unit,5*unit]);
      ctx.beginPath();ctx.ellipse(0,-27*unit,51*unit,62*unit,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    }
    if(p.stumbled){
      ctx.fillStyle="#ffe35b";
      for(let i=0;i<3;i++){const angle=game.ambientTime*4+i*Math.PI*2/3;ctx.beginPath();ctx.arc(Math.cos(angle)*31*unit,(-48+Math.sin(angle)*7)*unit,3.5*unit,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  }

  drawPlayer(game) {
    const ctx=this.ctx,p=game.player;
    const laneP=this.project(p.lane,CONFIG.PLAYER_WORLD_Z);
    const unit=clamp(this.height/650,.68,1.02);
    const x=laneP.x-p.wallBumpDirection*Math.sin(Math.PI*p.wallBumpTimer/.25)*8*unit;
    const jumpRatio=clamp(p.height/65,0,1);
    const airbornePose=smoothstep(3,22,p.height);
    // 恢复初版的跳跃幅度与角色尺寸，仅将贴地阴影对齐到脚底。
    const jumpLift=p.height*laneP.scale*(1.28+jumpRatio*.22);
    const baseY=laneP.y-jumpLift;
    const groundY=laneP.y+23*unit;
    const bob=p.airborne||p.sliding||p.crashed?0:Math.sin(p.runTime*13)*2.2*unit;
    const run=Math.sin(p.runTime*15);
    const stumbleLean=p.stumbled?Math.sin(p.runTime*24)*.13:0;

    // 阴影始终贴着道路；升得越高，阴影越小、越淡，落地时扩散一圈冲击波。
    ctx.save();ctx.translate(x,groundY+2*unit);
    ctx.fillStyle=`rgba(2,7,13,${.3-jumpRatio*.13})`;
    ctx.beginPath();ctx.ellipse(0,0,(31-jumpRatio*10)*unit,(7-jumpRatio*2.4)*unit,0,0,Math.PI*2);ctx.fill();
    if(p.landingPulse>0){
      const pulse=1-p.landingPulse;
      ctx.strokeStyle=`rgba(238,213,163,${p.landingPulse*.55})`;ctx.lineWidth=Math.max(1,2.2*unit*p.landingPulse);
      ctx.beginPath();ctx.ellipse(0,0,(27+pulse*28)*unit,(6+pulse*8)*unit,0,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();

    if(p.sliding&&!p.crashed){
      this.drawBackSlide(game,x,groundY,unit,p);
      return;
    }

    if(jumpRatio>.08){
      ctx.save();ctx.strokeStyle=`rgba(255,244,205,${jumpRatio*.34})`;ctx.lineWidth=Math.max(1,1.6*unit);ctx.lineCap="round";
      for(const side of [-1,1]){
        const sx=x+side*34*unit;
        ctx.beginPath();ctx.moveTo(sx,baseY+20*unit);ctx.lineTo(sx+side*5*unit,baseY+(34+17*jumpRatio)*unit);ctx.stroke();
      }
      ctx.restore();
    }

    const jumpScale=1+jumpRatio*.055;
    ctx.save();ctx.translate(x,baseY+bob);ctx.rotate(p.crashed?1.05:p.lean+stumbleLean);ctx.scale(jumpScale,jumpScale);

    if (p.dashTimer>0) {
      ctx.strokeStyle="rgba(255,220,88,.72)";ctx.lineWidth=3*unit;
      for(let i=0;i<8;i++){const y=(i-4)*12*unit+Math.sin(game.ambientTime*10+i)*5;ctx.beginPath();ctx.moveTo(-32*unit-rand(15,48),y);ctx.lineTo(-16*unit,y);ctx.stroke();}
    }
    if (p.shield) {
      ctx.strokeStyle="rgba(91,222,255,.82)";ctx.lineWidth=4*unit;ctx.shadowColor="#58dfff";ctx.shadowBlur=15;ctx.beginPath();ctx.ellipse(0,-42*unit,45*unit,61*unit,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    }
    if (p.magnetTimer>0) {
      ctx.strokeStyle="rgba(255,86,80,.62)";ctx.lineWidth=2*unit;ctx.setLineDash([5*unit,5*unit]);ctx.beginPath();ctx.arc(0,-42*unit,52*unit+Math.sin(game.ambientTime*7)*4,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    }
    if (p.stumbled) {
      ctx.fillStyle="#ffe35b";
      for(let i=0;i<3;i++){
        const angle=game.ambientTime*4+i*Math.PI*2/3;
        const sx=Math.cos(angle)*28*unit, sy=-92*unit+Math.sin(angle)*8*unit;
        ctx.beginPath();ctx.arc(sx,sy,3.5*unit,0,Math.PI*2);ctx.fill();
      }
    }

    // 原创小浣熊“栗栗”的背面：后脑、肩背、围巾结与环纹尾巴朝向赛道远方。
    ctx.strokeStyle="#493122";ctx.lineWidth=8*unit;ctx.lineCap="round";
    ctx.beginPath();
    const armSwing=run*7*(1-airbornePose), armX=26+airbornePose*10, armY=lerp(-9,-25,airbornePose);
    ctx.moveTo(-15*unit,-37*unit);ctx.lineTo((-armX-armSwing)*unit,(armY+Math.abs(run)*(1-airbornePose)*4)*unit);
    ctx.moveTo(15*unit,-37*unit);ctx.lineTo((armX+armSwing)*unit,(armY+Math.abs(run)*(1-airbornePose)*4)*unit);
    ctx.stroke();
    ctx.beginPath();
    const legSwing=run*9*(1-airbornePose), legX=lerp(12,20,airbornePose), footY=lerp(23,8,airbornePose);
    ctx.moveTo(-10*unit,-7*unit);ctx.lineTo((-legX+legSwing)*unit,footY*unit);
    ctx.moveTo(10*unit,-7*unit);ctx.lineTo((legX-legSwing)*unit,footY*unit);
    ctx.stroke();

    ctx.strokeStyle="#5a3a28";ctx.lineWidth=12*unit;ctx.beginPath();ctx.moveTo(18*unit,-31*unit);ctx.quadraticCurveTo(48*unit,-29*unit,38*unit,-4*unit);ctx.stroke();
    ctx.strokeStyle="#d4a36f";ctx.lineWidth=5*unit;ctx.beginPath();ctx.moveTo(28*unit,-27*unit);ctx.lineTo(40*unit,-22*unit);ctx.moveTo(32*unit,-14*unit);ctx.lineTo(41*unit,-9*unit);ctx.stroke();

    const fur=ctx.createRadialGradient(-9*unit,-48*unit,2*unit,0,-30*unit,36*unit);
    fur.addColorStop(0,"#966845");fur.addColorStop(.6,"#88583b");fur.addColorStop(1,"#764e36");
    ctx.fillStyle=fur;ctx.beginPath();ctx.ellipse(0,-32*unit,23*unit,34*unit,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#6b4431";ctx.beginPath();ctx.ellipse(0,-49*unit,18*unit,13*unit,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#a8734f";ctx.beginPath();ctx.ellipse(0,-28*unit,12*unit,22*unit,0,0,Math.PI*2);ctx.fill();

    ctx.fillStyle="#f0bd42";ctx.beginPath();ctx.arc(-6*unit,-55*unit,5*unit,0,Math.PI*2);ctx.arc(6*unit,-55*unit,5*unit,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.moveTo(0,-53*unit);ctx.lineTo(-8*unit,-36*unit);ctx.lineTo(8*unit,-37*unit);ctx.closePath();ctx.fill();

    ctx.fillStyle="#845438";ctx.beginPath();ctx.arc(0,-72*unit,24*unit,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#6b4431";ctx.beginPath();ctx.arc(-17*unit,-88*unit,9*unit,0,Math.PI*2);ctx.arc(17*unit,-88*unit,9*unit,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#b17c52";ctx.beginPath();ctx.arc(-17*unit,-88*unit,4.5*unit,0,Math.PI*2);ctx.arc(17*unit,-88*unit,4.5*unit,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#684431";ctx.beginPath();ctx.ellipse(0,-76*unit,17*unit,18*unit,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#9b6744";ctx.beginPath();ctx.ellipse(0,-71*unit,7*unit,15*unit,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#5a3828";ctx.beginPath();ctx.moveTo(-5*unit,-96*unit);ctx.lineTo(0,-103*unit);ctx.lineTo(5*unit,-96*unit);ctx.closePath();ctx.fill();
    ctx.restore();
  }

  drawParticles(particles) {
    const ctx=this.ctx;
    for(const p of particles){const alpha=clamp(p.life/p.maxLife,0,1);ctx.globalAlpha=alpha;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(p.kind==="dust"?(1.2-alpha*.2):1),0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
  }
}

class Game {
  constructor() {
    this.canvas=document.getElementById("gameCanvas");
    this.renderer=new Renderer(this.canvas);
    this.player=new Player();
    this.spawner=new Spawner();
    this.bridge=window.MuseumRunnerBridge;
    this.state=GameState.MENU;
    this.lastTime=performance.now();
    this.ambientTime=0;
    this.worldTravel=0;
    this.bestScore=Number(safeStoreGet(CONFIG.STORAGE_SCORE,0))||0;
    this.bestDistance=Number(safeStoreGet(CONFIG.STORAGE_DISTANCE,0))||0;
    this.hudAccumulator=0;
    this.bindUI();
    this.input=new InputManager(this.canvas,action=>this.handleAction(action));
    this.resetWorld();
    this.updateMenuStats();
    window.addEventListener("resize",()=>this.renderer.resize());
    document.addEventListener("visibilitychange",()=>{if(document.hidden&&this.state===GameState.PLAYING)this.pause();});
    requestAnimationFrame(time=>this.loop(time));
  }

  resetWorld() {
    this.player.reset();this.spawner.reset();
    this.obstacles=[];this.coins=[];this.powerUps=[];this.particles=[];
    this.distance=0;this.score=0;this.coinCount=0;this.coinScore=0;this.bonusScore=0;
    this.survivalTime=0;this.speed=CONFIG.BASE_SPEED;this.worldTravel=0;
    this.shake=0;this.crashTimer=0;
  }

  bindUI() {
    const on=(id,fn)=>document.getElementById(id).addEventListener("click",fn);
    on("startButton",()=>this.start());
    on("helpButton",()=>this.showOnly("helpScreen"));
    on("helpBackButton",()=>this.showOnly("menuScreen"));
    on("pauseButton",()=>this.pause());
    on("resumeButton",()=>this.resume());
    on("restartPauseButton",()=>this.start());
    on("homePauseButton",()=>this.home());
    on("againButton",()=>this.start());
    on("homeOverButton",()=>this.home());
    on("againSuccessButton",()=>this.start());
    on("homeSuccessButton",()=>this.home());
    for(const id of ["exitMenuButton","exitPauseButton","exitOverButton","exitSuccessButton"])on(id,()=>this.bridge?.returnToStory());
  }

  showOnly(id=null) {
    for(const overlay of ["menuScreen","helpScreen","pauseScreen","gameOverScreen","successScreen"]) document.getElementById(overlay).classList.toggle("hidden",overlay!==id);
  }

  start() {
    this.resetWorld();
    this.bridge?.reset();
    this.state=GameState.PLAYING;
    this.showOnly();
    document.getElementById("hud").classList.remove("hidden");
    document.getElementById("touchControls").classList.remove("hidden");
    this.lastTime=performance.now();
    this.updateHUD(true);
  }

  home() {
    // 首页也会继续绘制演示场景，因此必须先清除死亡姿势、残留障碍、粒子和镜头震动。
    this.resetWorld();
    this.bridge?.reset();
    this.state=GameState.MENU;
    this.showOnly("menuScreen");
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("touchControls").classList.add("hidden");
    this.updateMenuStats();
  }

  pause() {
    if(this.state!==GameState.PLAYING)return;
    this.state=GameState.PAUSED;this.showOnly("pauseScreen");
    document.getElementById("touchControls").classList.add("hidden");
  }

  resume() {
    if(this.state!==GameState.PAUSED)return;
    this.state=GameState.PLAYING;this.showOnly();
    document.getElementById("touchControls").classList.remove("hidden");
    this.lastTime=performance.now();
  }

  handleAction(action) {
    if(action==="pause") { if(this.state===GameState.PLAYING)this.pause();else if(this.state===GameState.PAUSED)this.resume();return; }
    if(this.state!==GameState.PLAYING||this.crashTimer>0)return;
    if(action==="left"||action==="right"){
      const direction=action==="left"?-1:1;
      if(this.player.move(direction)==="wall")this.hitWall(direction);
    }
    else if(action==="jump")this.player.jump();
    else if(action==="slide")this.player.slide();
  }

  loop(time) {
    // requestAnimationFrame 提供真实帧间隔；限制最大 deltaTime，避免切回标签页时物体瞬移。
    const dt=Math.min(.034,(time-this.lastTime)/1000||0);
    this.lastTime=time;this.ambientTime+=dt;
    if(this.state===GameState.PLAYING)this.update(dt);
    else if(this.state===GameState.MENU){this.worldTravel+=dt*7;this.player.runTime+=dt;}
    this.renderer.render(this);
    requestAnimationFrame(next=>this.loop(next));
  }

  update(dt) {
    if(this.crashTimer>0){
      const slowDt=dt*.18;this.crashTimer-=dt;this.player.update(slowDt);this.updateParticles(dt);this.shake=Math.max(0,this.shake-dt*24);
      if(this.crashTimer<=0)this.gameOver();
      return;
    }
    this.survivalTime+=dt;
    const speedTier=Math.floor(this.survivalTime/CONFIG.SPEED_STEP_SECONDS);
    const normalSpeed=CONFIG.BASE_SPEED*Math.pow(CONFIG.SPEED_STEP_MULTIPLIER,speedTier)+(this.player.dashTimer>0?CONFIG.DASH_SPEED_BONUS:0);
    this.speed=normalSpeed*(this.player.stumbled?.88:1);
    const travel=this.speed*dt;
    this.worldTravel+=travel;this.distance+=travel*.12;
    this.player.update(dt);this.spawner.update(travel,this);
    for(const list of [this.obstacles,this.coins,this.powerUps])for(const item of list)item.update(travel);
    this.handleCollisions(dt);
    this.updateParticles(dt);
    this.obstacles=this.obstacles.filter(item=>!item.dead&&item.z>-14);
    this.coins=this.coins.filter(item=>!item.dead&&item.z>-14);
    this.powerUps=this.powerUps.filter(item=>!item.dead&&item.z>-14);
    this.score=Math.floor(this.distance*10+this.coinScore+this.bonusScore+this.survivalTime*5);
    this.shake=Math.max(0,this.shake-dt*22);
    this.hudAccumulator+=dt;if(this.hudAccumulator>.09){this.hudAccumulator=0;this.updateHUD();}
    if(this.survivalTime>=CONFIG.SURVIVAL_TARGET&&!this.player.crashed)this.win();
  }

  handleCollisions(dt) {
    const p=this.player;
    for(const coin of this.coins){
      if(coin.dead)continue;
      if(p.magnetTimer>0&&Math.abs(coin.z-CONFIG.PLAYER_WORLD_Z)<58){
        // 磁铁同时牵引纵深、横向和高度，让金币明显飞向角色，而不是原地等待判定。
        coin.pull=1;
        const lateralPull=1-Math.exp(-13*dt);
        const depthPull=1-Math.exp(-10*dt);
        coin.lane=lerp(coin.lane,p.lane,lateralPull);
        coin.height=lerp(coin.height,p.height+24,lateralPull);
        coin.z=lerp(coin.z,CONFIG.PLAYER_WORLD_Z,depthPull);
        if(Math.abs(coin.z-CONFIG.PLAYER_WORLD_Z)<5&&Math.abs(coin.lane-p.lane)<.2){this.collectCoin(coin);continue;}
      }
      // 换道时按完整横向轨迹拾取金币，避免高帧位移从金币两侧直接跨过去。
      const laneStart=p.laneProgress<1?p.fromLane:p.previousLane;
      const laneEnd=p.laneProgress<1?p.targetLane:p.lane;
      const laneMargin=coin.pull?.75:.42;
      const laneHit=coin.lane>=Math.min(laneStart,laneEnd)-laneMargin&&coin.lane<=Math.max(laneStart,laneEnd)+laneMargin;
      const heightHit=Math.abs(coin.height-(p.height+18))<38;
      if(coin.crossesDepth(CONFIG.PLAYER_WORLD_Z,CONFIG.PLAYER_COLLISION_Z)&&laneHit&&heightHit)this.collectCoin(coin);
    }
    for(const item of this.powerUps){
      if(!item.dead&&item.crossesDepth(CONFIG.PLAYER_WORLD_Z,CONFIG.PLAYER_COLLISION_Z)&&Math.abs(item.lane-p.lane)<.43){item.dead=true;this.activatePower(item.type);}
    }
    for(const obstacle of this.obstacles){
      if(obstacle.dead||obstacle.resolved)continue;
      if(Math.max(obstacle.previousZ,obstacle.z)<CONFIG.PLAYER_WORLD_Z-CONFIG.PLAYER_COLLISION_Z){obstacle.resolved=true;continue;}
      const sameLane=obstacle.isGlobal||Math.abs(obstacle.lane-p.lane)<.43;
      if(!obstacle.crossesDepth(CONFIG.PLAYER_WORLD_Z,CONFIG.PLAYER_COLLISION_Z)||!sameLane)continue;
      // 碰撞同时检查跑道、纵深和动作状态；视觉模型比判定箱略大，降低擦边误伤。
      let avoided=false;
      if(obstacle.type==="fence")avoided=obstacle.variant==="high"?(p.sliding||p.height>8):p.height>8;
      else if(obstacle.type==="river")avoided=p.height>9;
      else if(obstacle.type==="rock")avoided=p.height>12;
      else if(obstacle.type==="animal")avoided=p.height>4;
      else if(obstacle.type==="bulldozer")avoided=false; // 推土机无论跳多高都不能越过。
      if(avoided){obstacle.resolved=true;this.bonusScore+=25;continue;}
      if(p.dashTimer>0){obstacle.dead=true;this.bonusScore+=180;this.burstAtPlayer("#ffd94f","dust",9);continue;}
      // 绊倒后的 5 秒危险窗口内，任何再次碰撞都会直接结束游戏。
      if(p.stumbleTimer>0){
        // 第二次撞到小动物时先将其移除，再进入失败慢动作，避免小动物留在画面中。
        if(obstacle.type==="animal")obstacle.dead=true;
        this.crash();break;
      }
      if(p.shield){p.shield=false;obstacle.dead=true;this.shake=5;this.burstAtPlayer("#6ce5ff","spark",14);continue;}
      if(obstacle.type==="animal"){obstacle.dead=true;this.trip();continue;}
      this.crash();break;
    }
  }

  collectCoin(coin) {
    coin.dead=true;
    const value=this.player.doubleTimer>0?2:1;
    this.coinCount+=value;this.coinScore+=CONFIG.COIN_VALUE*value;
    const pt=this.renderer.project(coin.lane,CONFIG.PLAYER_WORLD_Z,25);this.spawnParticles(pt.x,pt.y,"#ffd344","spark",7);
  }

  activatePower(type) {
    if(type==="magnet")this.player.magnetTimer=CONFIG.MAGNET_DURATION;
    else if(type==="shield")this.player.shield=true;
    else if(type==="double")this.player.doubleTimer=CONFIG.DOUBLE_DURATION;
    else if(type==="dash")this.player.dashTimer=CONFIG.DASH_DURATION;
    this.bonusScore+=250;this.burstAtPlayer("#fff08a","spark",16);this.updateHUD(true);
  }

  crash() {
    this.player.crashed=true;this.crashTimer=.22;this.shake=10;
    this.burstAtPlayer("#b99069","dust",17);
  }

  trip() {
    this.player.stumbleTimer=CONFIG.STUMBLE_DURATION;
    this.shake=5;
    this.burstAtPlayer("#c6a071","dust",12);
    this.updateHUD(true);
  }

  hitWall(direction) {
    const p=this.player;
    p.wallHits+=1;
    p.wallBumpDirection=direction;
    p.wallBumpTimer=.25;
    if(p.wallHits>=CONFIG.WALL_HIT_LIMIT){
      this.crash();
    }else{
      // 撞墙采用独立计数：眩晕结束不会清零，第二次撞墙也不会走小动物的二次致死分支。
      p.wallStunTimer=CONFIG.WALL_STUN_DURATION;
      this.shake=5;
      this.burstAtPlayer("#d5b47f","dust",10);
    }
    this.updateHUD(true);
  }

  gameOver() {
    this.state=GameState.GAME_OVER;
    this.bridge?.complete("lose",this);
    this.bestScore=Math.max(this.bestScore,this.score);this.bestDistance=Math.max(this.bestDistance,this.distance);
    safeStoreSet(CONFIG.STORAGE_SCORE,this.bestScore);safeStoreSet(CONFIG.STORAGE_DISTANCE,this.bestDistance.toFixed(1));
    document.getElementById("finalScore").textContent=this.score.toLocaleString();
    document.getElementById("finalDistance").textContent=`${Math.floor(this.distance)} m`;
    document.getElementById("finalCoins").textContent=this.coinCount;
    document.getElementById("finalBest").textContent=this.bestScore.toLocaleString();
    document.getElementById("hud").classList.add("hidden");document.getElementById("touchControls").classList.add("hidden");
    this.showOnly("gameOverScreen");
  }

  win() {
    this.state=GameState.SUCCESS;
    this.survivalTime=CONFIG.SURVIVAL_TARGET;
    this.bridge?.complete("win",this);
    this.bestScore=Math.max(this.bestScore,this.score);this.bestDistance=Math.max(this.bestDistance,this.distance);
    safeStoreSet(CONFIG.STORAGE_SCORE,this.bestScore);safeStoreSet(CONFIG.STORAGE_DISTANCE,this.bestDistance.toFixed(1));
    document.getElementById("successScore").textContent=this.score.toLocaleString();
    document.getElementById("successDistance").textContent=`${Math.floor(this.distance)} m`;
    document.getElementById("successCoins").textContent=this.coinCount;
    document.getElementById("hud").classList.add("hidden");document.getElementById("touchControls").classList.add("hidden");
    this.showOnly("successScreen");
  }

  spawnParticles(x,y,color,kind,count) {
    const available=Math.max(0,CONFIG.MAX_PARTICLES-this.particles.length);
    for(let i=0;i<Math.min(count,available);i++)this.particles.push(new Particle(x,y,color,kind));
  }
  burstAtPlayer(color,kind,count){const p=this.renderer.project(this.player.lane,CONFIG.PLAYER_WORLD_Z,35+this.player.height);this.spawnParticles(p.x,p.y,color,kind,count);}
  updateParticles(dt){for(const p of this.particles)p.update(dt);this.particles=this.particles.filter(p=>p.life>0);}

  updateHUD(force=false) {
    document.getElementById("distanceValue").textContent=`${Math.floor(this.distance)} m`;
    document.getElementById("scoreValue").textContent=this.score.toLocaleString();
    document.getElementById("coinValue").textContent=this.coinCount;
    document.getElementById("timeValue").textContent=`${Math.floor(clamp(this.survivalTime,0,CONFIG.SURVIVAL_TARGET))} s/${CONFIG.SURVIVAL_TARGET}s`;
    const pills=[];
    if(this.player.magnetTimer>0)pills.push(`🧲 ${this.player.magnetTimer.toFixed(1)}s`);
    if(this.player.shield)pills.push("⛑️ 安全帽 1次");
    if(this.player.doubleTimer>0)pills.push(`×2 ${this.player.doubleTimer.toFixed(1)}s`);
    if(this.player.dashTimer>0)pills.push(`⚡ ${this.player.dashTimer.toFixed(1)}s`);
    if(this.player.stumbleTimer>0)pills.push(`💫 踉跄 ${this.player.stumbleTimer.toFixed(1)}s`);
    if(this.player.wallHits>0)pills.push(`🧱 撞墙 ${this.player.wallHits}/${CONFIG.WALL_HIT_LIMIT}`);
    if(this.player.wallStunTimer>0)pills.push(`💫 眩晕 ${this.player.wallStunTimer.toFixed(1)}s`);
    document.getElementById("powerStatus").innerHTML=pills.map(text=>`<span class="power-pill">${text}</span>`).join("");
  }

  updateMenuStats() {
    document.getElementById("menuBestScore").textContent=this.bestScore.toLocaleString();
    document.getElementById("menuBestDistance").textContent=`${Math.floor(this.bestDistance)} m`;
  }
}

window.addEventListener("DOMContentLoaded",()=>new Game());
