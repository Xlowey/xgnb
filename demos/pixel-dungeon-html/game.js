/* 暗影地牢 · 原生 HTML / CSS / JavaScript 离线版
 * 游戏规则、地图和 Canvas 绘制由原项目逐段迁移。
 * 不使用 React、npm、模块加载器、服务器或联网资源。
 */
'use strict';
const DungeonMap = (() => {
const WORLD_WIDTH = 5720;
const WORLD_HEIGHT = 2960;
const rooms = [
    {
        id: 0,
        wave: 0,
        label: '起点',
        theme: 'sanctum',
        x: 100,
        y: 690,
        w: 500,
        h: 420,
        gates: []
    },
    {
        id: 1,
        wave: 1,
        label: '冰封前厅',
        theme: 'frost',
        x: 1620,
        y: 560,
        w: 680,
        h: 680,
        gates: [
            {
                x: 1608,
                y: 820,
                w: 24,
                h: 160
            },
            {
                x: 2288,
                y: 820,
                w: 24,
                h: 160
            }
        ]
    },
    {
        id: 2,
        wave: 2,
        label: '深蓝宝库',
        theme: 'vault',
        x: 3380,
        y: 520,
        w: 700,
        h: 720,
        gates: [
            {
                x: 3368,
                y: 820,
                w: 24,
                h: 160
            },
            {
                x: 3640,
                y: 1228,
                w: 180,
                h: 24
            }
        ]
    },
    {
        id: 3,
        wave: 3,
        label: '机械铸廊',
        theme: 'foundry',
        x: 3380,
        y: 2200,
        w: 700,
        h: 700,
        gates: [
            {
                x: 3640,
                y: 2188,
                w: 180,
                h: 24
            },
            {
                x: 4068,
                y: 2330,
                w: 24,
                h: 160
            }
        ]
    },
    {
        id: 4,
        wave: 4,
        label: '核心王座',
        theme: 'core',
        x: 5160,
        y: 2120,
        w: 500,
        h: 500,
        gates: [
            {
                x: 5148,
                y: 2330,
                w: 24,
                h: 160
            }
        ]
    }
];
const corridors = [
    {
        x: 600,
        y: 820,
        w: 1020,
        h: 160
    },
    {
        x: 2300,
        y: 820,
        w: 1080,
        h: 160
    },
    {
        x: 3640,
        y: 1240,
        w: 180,
        h: 960
    },
    {
        x: 4080,
        y: 2330,
        w: 1080,
        h: 160
    }
];
const walkableAreas = [
    ...rooms,
    ...corridors
];
const obstacles = [
    {
        x: 1835,
        y: 735,
        w: 230,
        h: 42
    },
    {
        x: 1835,
        y: 735,
        w: 42,
        h: 150
    },
    {
        x: 2065,
        y: 945,
        w: 42,
        h: 160
    },
    {
        x: 1785,
        y: 1060,
        w: 190,
        h: 42
    },
    {
        x: 3490,
        y: 680,
        w: 42,
        h: 190
    },
    {
        x: 3490,
        y: 680,
        w: 180,
        h: 42
    },
    {
        x: 3790,
        y: 760,
        w: 190,
        h: 42
    },
    {
        x: 3938,
        y: 760,
        w: 42,
        h: 170
    },
    {
        x: 3580,
        y: 1025,
        w: 250,
        h: 42
    },
    {
        x: 3495,
        y: 2360,
        w: 150,
        h: 42
    },
    {
        x: 3750,
        y: 2360,
        w: 210,
        h: 42
    },
    {
        x: 3560,
        y: 2560,
        w: 42,
        h: 120
    },
    {
        x: 3900,
        y: 2560,
        w: 42,
        h: 120
    },
    {
        x: 3495,
        y: 2780,
        w: 150,
        h: 42
    },
    {
        x: 3750,
        y: 2780,
        w: 210,
        h: 42
    },
    {
        x: 5275,
        y: 2230,
        w: 55,
        h: 105
    },
    {
        x: 5490,
        y: 2230,
        w: 55,
        h: 105
    },
    {
        x: 5275,
        y: 2480,
        w: 55,
        h: 85
    },
    {
        x: 5490,
        y: 2480,
        w: 55,
        h: 85
    }
];
const roomSpawnPoints = {
    1: [
        {
            x: 1700,
            y: 640
        },
        {
            x: 1840,
            y: 640
        },
        {
            x: 2000,
            y: 640
        },
        {
            x: 2220,
            y: 640
        },
        {
            x: 1700,
            y: 930
        },
        {
            x: 1840,
            y: 930
        },
        {
            x: 2000,
            y: 930
        },
        {
            x: 2220,
            y: 930
        },
        {
            x: 1700,
            y: 1160
        },
        {
            x: 1840,
            y: 1160
        },
        {
            x: 2000,
            y: 1160
        },
        {
            x: 2220,
            y: 1160
        }
    ],
    2: [
        {
            x: 3450,
            y: 600
        },
        {
            x: 3600,
            y: 600
        },
        {
            x: 3750,
            y: 600
        },
        {
            x: 3900,
            y: 600
        },
        {
            x: 4020,
            y: 600
        },
        {
            x: 3450,
            y: 860
        },
        {
            x: 3600,
            y: 860
        },
        {
            x: 3750,
            y: 860
        },
        {
            x: 3900,
            y: 860
        },
        {
            x: 4020,
            y: 860
        },
        {
            x: 3450,
            y: 960
        },
        {
            x: 3600,
            y: 960
        },
        {
            x: 3750,
            y: 960
        },
        {
            x: 3900,
            y: 960
        },
        {
            x: 4020,
            y: 960
        },
        {
            x: 3450,
            y: 1160
        },
        {
            x: 3600,
            y: 1160
        },
        {
            x: 3750,
            y: 1160
        },
        {
            x: 3900,
            y: 1160
        },
        {
            x: 4020,
            y: 1160
        }
    ],
    3: [
        {
            x: 3440,
            y: 2280
        },
        {
            x: 3540,
            y: 2280
        },
        {
            x: 3640,
            y: 2280
        },
        {
            x: 3740,
            y: 2280
        },
        {
            x: 3840,
            y: 2280
        },
        {
            x: 3940,
            y: 2280
        },
        {
            x: 4040,
            y: 2280
        },
        {
            x: 3440,
            y: 2480
        },
        {
            x: 3540,
            y: 2480
        },
        {
            x: 3640,
            y: 2480
        },
        {
            x: 3740,
            y: 2480
        },
        {
            x: 3840,
            y: 2480
        },
        {
            x: 3940,
            y: 2480
        },
        {
            x: 4040,
            y: 2480
        },
        {
            x: 3440,
            y: 2720
        },
        {
            x: 3540,
            y: 2720
        },
        {
            x: 3640,
            y: 2720
        },
        {
            x: 3740,
            y: 2720
        },
        {
            x: 3840,
            y: 2720
        },
        {
            x: 3940,
            y: 2720
        },
        {
            x: 4040,
            y: 2720
        },
        {
            x: 3440,
            y: 2860
        },
        {
            x: 3540,
            y: 2860
        },
        {
            x: 3640,
            y: 2860
        },
        {
            x: 3740,
            y: 2860
        },
        {
            x: 3840,
            y: 2860
        },
        {
            x: 3940,
            y: 2860
        },
        {
            x: 4040,
            y: 2860
        }
    ],
    4: [
        {
            x: 5410,
            y: 2370
        }
    ]
};
const clamp = (n, min, max)=>Math.max(min, Math.min(max, n));
function circleRect(x, y, r, rect) {
    return Math.hypot(x - clamp(x, rect.x, rect.x + rect.w), y - clamp(y, rect.y, rect.y + rect.h)) < r;
}
function pointInRect(p, rect, inset = 0) {
    return p.x >= rect.x + inset && p.x <= rect.x + rect.w - inset && p.y >= rect.y + inset && p.y <= rect.y + rect.h - inset;
}
function roomInteriorContains(room, p) {
    return pointInRect(p, room, 34);
}
function activeGates(roomId) {
    return roomId == null ? [] : rooms.find((room)=>room.id === roomId)?.gates ?? [];
}
function walkablePoint(x, y) {
    return walkableAreas.some((area)=>x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h);
}
function mapBlocked(x, y, r, gates = []) {
    const samples = [
        [
            0,
            0
        ],
        [
            r,
            0
        ],
        [
            -r,
            0
        ],
        [
            0,
            r
        ],
        [
            0,
            -r
        ],
        [
            r * .7,
            r * .7
        ],
        [
            -r * .7,
            r * .7
        ],
        [
            r * .7,
            -r * .7
        ],
        [
            -r * .7,
            -r * .7
        ]
    ];
    if (samples.some(([dx, dy])=>!walkablePoint(x + dx, y + dy))) return true;
    return obstacles.some((o)=>circleRect(x, y, r, o)) || gates.some((g)=>circleRect(x, y, r, g));
}
function makeSpikes(random = Math.random) {
    const spikes = [];
    for (const room of rooms.slice(1)){
        for(let n = 0; n < 4; n++){
            for(let attempt = 0; attempt < 100; attempt++){
                const spike = {
                    id: spikes.length,
                    x: room.x + 70 + random() * (room.w - 140),
                    y: room.y + 70 + random() * (room.h - 140),
                    r: 17
                };
                const tooCloseToSpawn = roomSpawnPoints[room.id]?.some((point)=>Math.hypot(point.x - spike.x, point.y - spike.y) < 55);
                if (!mapBlocked(spike.x, spike.y, spike.r) && !tooCloseToSpawn && spikes.every((other)=>Math.hypot(other.x - spike.x, other.y - spike.y) >= 85)) {
                    spikes.push(spike);
                    break;
                }
            }
        }
    }
    return spikes;
}

return {WORLD_WIDTH, WORLD_HEIGHT, rooms, corridors, walkableAreas, obstacles, roomSpawnPoints, circleRect, pointInRect, roomInteriorContains, activeGates, mapBlocked, makeSpikes};
})();
const DungeonCombat = (() => {
const { WORLD_WIDTH : MAP_WIDTH, WORLD_HEIGHT : MAP_HEIGHT, obstacles : mapObstacles, roomSpawnPoints, mapBlocked, circleRect : mapCircleRect } = DungeonMap;
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;
const WORLD_WIDTH = MAP_WIDTH;
const WORLD_HEIGHT = MAP_HEIGHT;
const MOVE_SPEED = 240;
const ENEMY_SPEED = MOVE_SPEED * 0.8;
const MAX_ARMOR = 5;
const ARMOR_REGEN_DELAY = 5000;
const MAX_ENERGY = 200;
const ENERGY_ORB_VALUE = 8;
const PLAYER_MAX_HP = 7;
const PLAYER_ATTACK_DAMAGE = 4;
const PLAYER_CRIT_DAMAGE = 6;
const PLAYER_CRIT_CHANCE = 0.25;
const HAND_DAMAGE = 1;
const HAND_CRIT_DAMAGE = 2;
const HAND_CRIT_CHANCE = 0.125;
const GUN_COOLDOWN = 250;
// The hand knife may attack at most once every 0.15 seconds, even during the rapid-fire ultimate.
const MELEE_COOLDOWN = 150;
const GUNNER_HP = 10;
const ARCHER_HP = 12;
const FROG_HP = 5;
const MELEE_ENEMY_HP = 8;
const BOSS_HP = 360;
const ULTIMATE_COOLDOWN = 20000;
const ULTIMATE_DURATION = 5000;
const STUN_CHANCE = 0.2;
const GUN_INTERVAL = 4000;
const BOW_INTERVAL = 5000;
const BOW_CHARGE = 1000;
const GUN_SPEED = MOVE_SPEED * 3;
const ARROW_SPEED = MOVE_SPEED * 2;
const ATTACK_WARNING = 1000;
const ENEMY_VIEW_RANGE = 560;
const BOSS_SUMMON_INTERVAL = 10000;
const BOSS_RAGE_SUMMON_INTERVAL = 8000;
const METEOR_WARNING = 1500;
const METEOR_DAMAGE = 6;
const METEOR_RADIUS = 72;
const BOSS_SHOCKWAVE_DURATION = 1000;
const BOSS_SHOCKWAVE_RADIUS = 420;
const BOSS_SHOCKWAVE_DAMAGE = 3;
const FROG_LEAP_INTERVAL = 4000;
const FROG_LEAP_DURATION = 500;
const FROG_DEATH_FUSE = 1000;
const FROG_SHOCKWAVE_DAMAGE = 3;
const FROG_EXPLOSION_DAMAGE = 3;
const FROG_EFFECT_RADIUS = 80;
const FROG_PULSE_DURATION = 84;
const FROG_KNOCKBACK_DISTANCE = 80;
const SPIKE_UP_DURATION = 2000;
const SPIKE_DOWN_DURATION = 4000;
const MELEE_ENEMY_INTERVAL = 2000;
const MELEE_ENEMY_DAMAGE = 2;
const obstacles = mapObstacles;
const clamp = (n, min, max)=>Math.max(min, Math.min(max, n));
const dist = (a, b)=>Math.hypot(a.x - b.x, a.y - b.y);
const norm = (a)=>Math.atan2(Math.sin(a), Math.cos(a));
function circleRect(x, y, r, o) {
    return mapCircleRect(x, y, r, o);
}
function blocked(x, y, r, gates = []) {
    return mapBlocked(x, y, r, gates);
}
function lineOfSight(a, b, radius = 2, gates = []) {
    const steps = Math.max(1, Math.ceil(dist(a, b) / 8));
    for(let i = 1; i < steps; i++){
        if (blocked(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps, radius, gates)) return false;
    }
    return true;
}
function makeEnemy(id, wave, elite = false, forcedType, position) {
    const points = roomSpawnPoints[wave] ?? roomSpawnPoints[1];
    const spawn = position ?? (elite ? roomSpawnPoints[4][0] : points[id % points.length]);
    const { x, y } = spawn;
    const type = forcedType ?? (elite || id % 2 === 0 ? 'gunner' : 'archer');
    const hp = elite ? BOSS_HP : type === 'gunner' ? GUNNER_HP : type === 'archer' ? ARCHER_HP : type === 'frog' ? FROG_HP : MELEE_ENEMY_HP;
    const viewAngle = Math.random() * Math.PI * 2;
    return {
        id,
        x,
        y,
        r: elite ? 30 : 19,
        hp,
        maxHp: hp,
        speed: ENEMY_SPEED,
        type,
        elite,
        shot: 2000 + Math.random() * 2000,
        angle: viewAngle,
        chargeAngle: viewAngle,
        attacking: false,
        charging: false,
        hurt: 0,
        dead: false,
        viewAngle,
        seesPlayer: false,
        thinkTime: Math.random() * 900,
        moveTime: 0,
        moveAngle: viewAngle,
        moveSpeed: 0,
        enraged: false,
        leapTime: 0,
        leapVx: 0,
        leapVy: 0,
        dying: 0,
        deathTimer: 0,
        deathAngle: 0
    };
}
function makeWave(wave, firstId = 0, stage = 1) {
    const perType = wave === 1 ? 3 : wave === 2 ? 5 : stage === 1 ? 6 : 7;
    const points = roomSpawnPoints[wave];
    const types = [
        'gunner',
        'archer',
        'frog',
        'melee'
    ];
    return Array.from({
        length: perType * types.length
    }, (_, i)=>makeEnemy(firstId + i, wave, false, types[Math.floor(i / perType)], points[i]));
}
function bossSummonTypes(enraged) {
    return enraged ? [
        'gunner',
        'archer',
        'frog',
        'melee'
    ] : [
        'gunner',
        'gunner',
        'archer',
        'archer'
    ];
}
function rollChestReward(random = Math.random) {
    return {
        coins: 5 + Math.floor(random() * 6),
        energy: 16 + Math.floor(random() * 17)
    };
}
function enemyCanSee(enemy, target, gates = []) {
    if (!lineOfSight(enemy, target, 2, gates)) return false;
    return dist(enemy, target) <= ENEMY_VIEW_RANGE;
}
function advanceEnemyMovement(enemy, dt, target, canSee, random = Math.random) {
    enemy.thinkTime -= dt;
    enemy.moveTime = Math.max(0, enemy.moveTime - dt);
    const targetAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
    if (canSee && !enemy.attacking) enemy.viewAngle = targetAngle;
    if (enemy.attacking) return {
        dx: 0,
        dy: 0
    };
    if (enemy.thinkTime <= 0) {
        const distance = dist(enemy, target);
        const desiredRange = enemy.type === 'archer' ? 340 : 245;
        if (canSee) {
            const decision = random();
            if (decision < 0.28) {
                enemy.moveTime = 0;
            } else {
                enemy.moveAngle = distance > desiredRange + 75 ? targetAngle : distance < desiredRange - 65 ? targetAngle + Math.PI : targetAngle + (decision < 0.64 ? -Math.PI / 2 : Math.PI / 2);
                enemy.moveSpeed = enemy.speed * (0.45 + random() * 0.55);
                enemy.moveTime = 380 + random() * 620;
            }
            enemy.thinkTime = 650 + random() * 850;
        } else {
            if (random() < 0.62) {
                enemy.moveAngle = random() * Math.PI * 2;
                enemy.viewAngle = enemy.moveAngle;
                enemy.moveSpeed = enemy.speed * (0.3 + random() * 0.5);
                enemy.moveTime = 420 + random() * 760;
            } else {
                enemy.moveTime = 0;
            }
            enemy.thinkTime = 1200 + random() * 2100;
        }
    }
    if (enemy.moveTime <= 0) return {
        dx: 0,
        dy: 0
    };
    const distance = enemy.moveSpeed * dt / 1000;
    return {
        dx: Math.cos(enemy.moveAngle) * distance,
        dy: Math.sin(enemy.moveAngle) * distance
    };
}
function applyDamage(player, damage) {
    if (damage <= 0 || player.hp <= 0) return;
    if (player.armor > 0) player.armor = Math.max(0, player.armor - damage);
    else player.hp = Math.max(0, player.hp - damage);
    player.safeTime = 0;
    player.armorRegen = 0;
}
function regenerateArmor(player, dt) {
    const before = player.safeTime;
    player.safeTime += dt;
    if (player.armor >= MAX_ARMOR) {
        player.armorRegen = 0;
        return 0;
    }
    player.armorRegen += Math.max(0, player.safeTime - Math.max(ARMOR_REGEN_DELAY, before));
    const recovered = Math.min(MAX_ARMOR - player.armor, Math.floor(player.armorRegen / 1000));
    player.armor += recovered;
    player.armorRegen -= recovered * 1000;
    if (player.armor >= MAX_ARMOR) player.armorRegen = 0;
    return recovered;
}
function advanceEnemyAttack(enemy, dt, target, canAttack = true, intervalScale = 1) {
    if (enemy.dead || enemy.hp <= 0) return [];
    if (enemy.type !== 'gunner' && enemy.type !== 'archer') return [];
    if (!enemy.attacking) {
        if (!canAttack) return [];
        enemy.angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        enemy.shot -= dt;
        if (enemy.shot <= ATTACK_WARNING) {
            enemy.attacking = true;
            enemy.chargeAngle = enemy.angle;
            enemy.charging = enemy.type === 'archer';
        }
    } else {
        enemy.shot -= dt;
    }
    if (enemy.shot > 0) return [];
    const gun = enemy.type === 'gunner';
    const angle = enemy.chargeAngle;
    enemy.shot += (gun ? GUN_INTERVAL : BOW_INTERVAL) * intervalScale;
    enemy.angle = angle;
    enemy.attacking = false;
    enemy.charging = false;
    return (gun ? [
        -0.14,
        0,
        0.14
    ] : [
        0
    ]).map((offset)=>{
        const a = angle + offset;
        const speed = gun ? GUN_SPEED : ARROW_SPEED;
        return {
            x: enemy.x + Math.cos(a) * (enemy.r + 10),
            y: enemy.y + Math.sin(a) * (enemy.r + 10),
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            r: gun ? 5 : 4,
            damage: gun ? 2 : 3,
            enemy: true,
            life: 3600,
            color: gun ? '#ffb660' : '#b5f18c',
            kind: gun ? 'orb' : 'arrow',
            stunChance: enemy.elite ? 0 : STUN_CHANCE
        };
    });
}
function shouldStun(random = Math.random) {
    return random() < STUN_CHANCE;
}
function dropsEnergy(random = Math.random) {
    return random() < 0.5;
}
function rollPlayerDamage(random = Math.random) {
    return random() < PLAYER_CRIT_CHANCE ? PLAYER_CRIT_DAMAGE : PLAYER_ATTACK_DAMAGE;
}
function rollHandDamage(random = Math.random) {
    return random() < HAND_CRIT_CHANCE ? HAND_CRIT_DAMAGE : HAND_DAMAGE;
}
function advanceSpikeCycle(raised, timer, dt) {
    timer -= dt;
    while(timer <= 0){
        raised = !raised;
        timer += raised ? SPIKE_UP_DURATION : SPIKE_DOWN_DURATION;
    }
    return {
        raised,
        timer
    };
}
function advanceFrogAttack(enemy, dt, target, canAttack = true) {
    if (enemy.dead || enemy.hp <= 0 || enemy.dying) return {
        dx: 0,
        dy: 0,
        landed: false
    };
    if (enemy.leapTime > 0) {
        const step = Math.min(dt, enemy.leapTime);
        const result = {
            dx: enemy.leapVx * step / 1000,
            dy: enemy.leapVy * step / 1000,
            landed: step >= enemy.leapTime
        };
        enemy.leapTime -= step;
        return result;
    }
    if (!enemy.attacking) {
        if (!canAttack) return {
            dx: 0,
            dy: 0,
            landed: false
        };
        enemy.angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        enemy.shot -= dt;
        if (enemy.shot <= ATTACK_WARNING) {
            enemy.attacking = true;
            enemy.chargeAngle = enemy.angle;
        }
    } else enemy.shot -= dt;
    if (enemy.shot <= 0) {
        enemy.attacking = false;
        enemy.shot += FROG_LEAP_INTERVAL;
        enemy.leapTime = FROG_LEAP_DURATION;
        enemy.leapVx = Math.cos(enemy.chargeAngle) * 240;
        enemy.leapVy = Math.sin(enemy.chargeAngle) * 240;
    }
    return {
        dx: 0,
        dy: 0,
        landed: false
    };
}
function advanceMeleeAttack(enemy, dt, target, canAttack = true) {
    if (enemy.dead || enemy.hp <= 0 || enemy.dying) return false;
    const inRange = dist(enemy, target) < 40;
    if (!enemy.attacking) {
        if (!canAttack || !inRange) {
            enemy.shot = MELEE_ENEMY_INTERVAL;
            return false;
        }
        enemy.angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        enemy.shot -= dt;
        if (enemy.shot <= 500) {
            enemy.attacking = true;
            enemy.chargeAngle = enemy.angle;
        }
    } else enemy.shot -= dt;
    if (enemy.shot > 0) return false;
    enemy.shot += MELEE_ENEMY_INTERVAL;
    enemy.angle = enemy.chargeAngle;
    enemy.attacking = false;
    const targetAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
    return dist(enemy, target) < 45 && Math.abs(norm(targetAngle - enemy.angle)) < 0.9;
}
function advanceMeleeMovement(enemy, dt, target, canSee, random = Math.random) {
    if (!canSee) return advanceEnemyMovement(enemy, dt, target, false, random);
    const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
    enemy.viewAngle = angle;
    if (enemy.attacking || dist(enemy, target) < 36) return {
        dx: 0,
        dy: 0
    };
    const step = MOVE_SPEED * dt / 1000;
    return {
        dx: Math.cos(angle) * step,
        dy: Math.sin(angle) * step
    };
}
function advanceBullet(bullet, dt, onStep, gates = []) {
    const steps = Math.max(1, Math.ceil(Math.hypot(bullet.vx, bullet.vy) * dt / 1000 / 5));
    for(let i = 0; i < steps && bullet.life > 0; i++){
        bullet.x += bullet.vx * dt / 1000 / steps;
        bullet.y += bullet.vy * dt / 1000 / steps;
        bullet.life -= dt / steps;
        if (blocked(bullet.x, bullet.y, bullet.r, gates) || onStep(bullet)) bullet.life = 0;
    }
}

return {VIEW_WIDTH, VIEW_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, MOVE_SPEED, ENEMY_SPEED, MAX_ARMOR, ARMOR_REGEN_DELAY, MAX_ENERGY, ENERGY_ORB_VALUE, PLAYER_MAX_HP, PLAYER_ATTACK_DAMAGE, PLAYER_CRIT_DAMAGE, PLAYER_CRIT_CHANCE, HAND_DAMAGE, HAND_CRIT_DAMAGE, HAND_CRIT_CHANCE, GUN_COOLDOWN, MELEE_COOLDOWN, GUNNER_HP, ARCHER_HP, FROG_HP, MELEE_ENEMY_HP, BOSS_HP, ULTIMATE_COOLDOWN, ULTIMATE_DURATION, STUN_CHANCE, GUN_INTERVAL, BOW_INTERVAL, BOW_CHARGE, GUN_SPEED, ARROW_SPEED, ATTACK_WARNING, ENEMY_VIEW_RANGE, BOSS_SUMMON_INTERVAL, BOSS_RAGE_SUMMON_INTERVAL, METEOR_WARNING, METEOR_DAMAGE, METEOR_RADIUS, BOSS_SHOCKWAVE_DURATION, BOSS_SHOCKWAVE_RADIUS, BOSS_SHOCKWAVE_DAMAGE, FROG_LEAP_INTERVAL, FROG_LEAP_DURATION, FROG_DEATH_FUSE, FROG_SHOCKWAVE_DAMAGE, FROG_EXPLOSION_DAMAGE, FROG_EFFECT_RADIUS, FROG_PULSE_DURATION, FROG_KNOCKBACK_DISTANCE, SPIKE_UP_DURATION, SPIKE_DOWN_DURATION, MELEE_ENEMY_INTERVAL, MELEE_ENEMY_DAMAGE, obstacles, clamp, dist, norm, circleRect, blocked, lineOfSight, makeEnemy, makeWave, bossSummonTypes, rollChestReward, enemyCanSee, advanceEnemyMovement, applyDamage, regenerateArmor, advanceEnemyAttack, shouldStun, dropsEnergy, rollPlayerDamage, rollHandDamage, advanceSpikeCycle, advanceFrogAttack, advanceMeleeAttack, advanceMeleeMovement, advanceBullet};
})();

const { VIEW_WIDTH, VIEW_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, MOVE_SPEED, BOW_CHARGE, MAX_ARMOR,
  MAX_ENERGY, ENERGY_ORB_VALUE, PLAYER_MAX_HP, ULTIMATE_COOLDOWN, ULTIMATE_DURATION, GUN_COOLDOWN, MELEE_COOLDOWN,
  BOSS_SUMMON_INTERVAL, BOSS_RAGE_SUMMON_INTERVAL, METEOR_WARNING, METEOR_DAMAGE, METEOR_RADIUS,
  BOSS_SHOCKWAVE_DURATION, BOSS_SHOCKWAVE_RADIUS, BOSS_SHOCKWAVE_DAMAGE,
  FROG_LEAP_DURATION, FROG_DEATH_FUSE, FROG_SHOCKWAVE_DAMAGE, FROG_EXPLOSION_DAMAGE, FROG_EFFECT_RADIUS,
  FROG_PULSE_DURATION, FROG_KNOCKBACK_DISTANCE, SPIKE_UP_DURATION, MELEE_ENEMY_DAMAGE,
  obstacles, clamp, dist, norm, lineOfSight, blocked, makeEnemy, makeWave, applyDamage,
  regenerateArmor, shouldStun, dropsEnergy, rollPlayerDamage, rollHandDamage, rollChestReward, bossSummonTypes, enemyCanSee, advanceEnemyMovement, advanceEnemyAttack,
  advanceSpikeCycle, advanceFrogAttack, advanceMeleeAttack, advanceMeleeMovement, advanceBullet } = DungeonCombat;
const { rooms, corridors, activeGates, roomInteriorContains, pointInRect, makeSpikes } = DungeonMap;
const W = WORLD_WIDTH, H = WORLD_HEIGHT;
function initialState() {
    return {
        player: {
            x: 200,
            y: 900,
            r: 15,
            hp: PLAYER_MAX_HP,
            armor: MAX_ARMOR,
            energy: MAX_ENERGY,
            angle: 0,
            cooldown: 0,
            invincible: 0,
            slash: 0,
            skill: 0,
            rapidFire: 0,
            stunned: 0,
            safeTime: 0,
            armorRegen: 0,
            hurt: 0,
            contactCooldown: 0
        },
        enemies: [],
        bullets: [],
        drops: [],
        particles: [],
        meteors: [],
        shockwaves: [],
        pulses: [],
        spikes: makeSpikes(),
        chests: [],
        wave: 0,
        coins: 0,
        status: 'playing',
        nextWave: 0,
        shake: 0,
        bossSummon: BOSS_SUMMON_INTERVAL,
        bossMeteor: 9000,
        nextEnemyId: 500,
        activeRoom: null,
        currentRoom: 0,
        cleared: [
            true,
            false,
            false,
            false,
            false
        ],
        gateAnim: 0,
        roomBanner: 1700,
        roomStage: 0,
        spikeContact: null,
        spikeTick: 0,
        spikeRaised: false,
        spikeTimer: 0
    };
}
function startDungeon() {
    const canvasRef = {
        current: document.getElementById('game-canvas')
    };
    const miniRef = {
        current: document.getElementById('minimap')
    };
    const game = {
        current: initialState()
    };
    const keys = {
        current: new Set()
    }, raf = {
        current: 0
    }, last = {
        current: 0
    };
    const melee = {
        current: false
    }, attackHeld = {
        current: false
    };
    const camera = {
        current: {
            x: 0,
            y: 630
        }
    };
    const mouse = {
        current: null
    };
    const moveStick = {
        current: {
            active: false,
            id: -1,
            ox: 0,
            oy: 0,
            x: 0,
            y: 0
        }
    };
    const aimStick = {
        current: {
            active: false,
            id: -1,
            ox: 0,
            oy: 0,
            x: 0,
            y: 0
        }
    };
    const ui = Object.fromEntries([
        'hp-fill',
        'hp-value',
        'armor-fill',
        'armor-value',
        'energy-fill',
        'energy-value',
        'coin-value',
        'pause-button',
        'pause-icon',
        'play-icon',
        'weapon-button',
        'hand-icon',
        'swords-icon',
        'weapon-label',
        'skill-button',
        'skill-label',
        'result-card',
        'result-title',
        'result-message',
        'pause-card',
        'resume-button',
        'pause-restart',
        'result-restart'
    ].map((id)=>[
            id,
            document.getElementById(id)
        ]));
    function setHud(hud) {
        for (const [name, value, max] of [
            [
                'hp',
                hud.hp,
                PLAYER_MAX_HP
            ],
            [
                'armor',
                hud.armor,
                MAX_ARMOR
            ],
            [
                'energy',
                hud.energy,
                MAX_ENERGY
            ]
        ]){
            ui[name + '-fill'].style.width = `${value / max * 100}%`;
            ui[name + '-value'].textContent = `${value}/${max}`;
        }
        ui['coin-value'].textContent = String(hud.coins);
        const paused = hud.status === 'paused', finished = hud.status === 'win' || hud.status === 'lose';
        ui['pause-button'].setAttribute('aria-label', paused ? '继续' : '暂停');
        ui['play-icon'].hidden = !paused;
        ui['pause-icon'].hidden = paused;
        ui['skill-button'].disabled = hud.skill > 0;
        ui['skill-label'].textContent = hud.rapidFire > 0 ? '极速' : hud.skill > 0 ? `${Math.ceil(hud.skill / 1000)}s` : '大招';
        ui['result-card'].hidden = !finished;
        if (finished) {
            ui['result-title'].textContent = hud.status === 'win' ? '地牢肃清！' : '冒险结束';
            ui['result-message'].textContent = hud.status === 'win' ? `你肃清了全部房间并击败首领，收集 ${hud.coins} 枚金币。` : '调整走位，再试一次。';
        }
        ui['pause-card'].hidden = !paused;
    }
    function setMeleeUI(value) {
        ui['weapon-button'].className = value ? 'mode melee active' : 'mode';
        ui['hand-icon'].hidden = !value;
        ui['swords-icon'].hidden = value;
        ui['weapon-label'].textContent = value ? '手刀' : '能量枪';
    }
    const syncHud = ()=>{
        const g = game.current, p = g.player;
        setHud({
            hp: p.hp,
            armor: p.armor,
            energy: Math.floor(p.energy),
            skill: Math.max(0, p.skill),
            rapidFire: Math.max(0, p.rapidFire),
            stunned: Math.max(0, p.stunned),
            coins: g.coins,
            wave: g.wave,
            currentRoom: g.currentRoom,
            activeRoom: g.activeRoom,
            cleared: [
                ...g.cleared
            ],
            status: g.status
        });
    };
    const burst = (x, y, color, count = 8)=>{
        const g = game.current;
        for(let i = 0; i < count; i++){
            const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 95;
            g.particles.push({
                x,
                y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                life: 300 + Math.random() * 350,
                color,
                size: 2 + Math.random() * 3
            });
        }
    };
    const reset = ()=>{
        game.current = initialState();
        last.current = 0;
        keys.current.clear();
        attackHeld.current = false;
        moveStick.current.active = false;
        aimStick.current.active = false;
        mouse.current = null;
        camera.current = {
            x: 0,
            y: 630
        };
        syncHud();
    };
    const togglePause = ()=>{
        const g = game.current;
        if (g.status === 'playing') g.status = 'paused';
        else if (g.status === 'paused') g.status = 'playing';
        syncHud();
    };
    function setupAgentTool() {
        const context = document.modelContext;
        if (!context?.registerTool) return;
        const lifecycle = new AbortController();
        void Promise.resolve(context.registerTool({
            name: 'restart_dungeon_run',
            title: '重新开始地牢挑战',
            description: '结束当前局并立刻从起点房间重新开始。',
            inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false
            },
            annotations: {
                readOnlyHint: false,
                untrustedContentHint: false
            },
            execute: ()=>{
                reset();
                return {
                    status: 'playing',
                    wave: 0,
                    hp: PLAYER_MAX_HP,
                    armor: MAX_ARMOR,
                    energy: MAX_ENERGY
                };
            }
        }, {
            signal: lifecycle.signal
        })).catch(()=>undefined);
        return ()=>lifecycle.abort();
    }
    const shoot = ()=>{
        const g = game.current, p = g.player;
        if (g.status !== 'playing' || p.cooldown > 0) return;
        const speedScale = p.rapidFire > 0 ? 0.5 : 1;
        if (melee.current) {
            const damage = rollHandDamage();
            p.cooldown = MELEE_COOLDOWN;
            p.slash = 110;
            let hit = false;
            for (const e of g.enemies){
                if (e.dead || e.dying) continue;
                const d = dist(p, e), da = Math.abs(norm(Math.atan2(e.y - p.y, e.x - p.x) - p.angle));
                if (d < 74 + e.r && da < 1.05 && lineOfSight(p, e, 2, activeGates(g.activeRoom))) {
                    e.hp -= damage;
                    e.hurt = 100;
                    hit = true;
                    moveEntity(e, Math.cos(p.angle) * 14, Math.sin(p.angle) * 14);
                    burst(e.x, e.y, damage === 2 ? '#fff06a' : '#ffe092', damage === 2 ? 11 : 7);
                }
            }
            g.bullets = g.bullets.filter((b)=>!(b.enemy && dist(p, b) < 78));
            if (hit) g.shake = 4;
        } else {
            if (p.energy < 1) return;
            const damage = rollPlayerDamage();
            p.energy -= 1;
            p.cooldown = GUN_COOLDOWN * speedScale;
            const spread = (Math.random() - .5) * .05, a = p.angle + spread;
            g.bullets.push({
                x: p.x + Math.cos(a) * 23,
                y: p.y + Math.sin(a) * 23,
                vx: Math.cos(a) * 720,
                vy: Math.sin(a) * 720,
                r: damage === 6 ? 5 : 4,
                damage,
                enemy: false,
                life: 1300,
                color: damage === 6 ? '#fff06a' : '#83e9ff',
                kind: 'orb'
            });
            burst(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, damage === 6 ? '#fff3a0' : '#d8fbff', damage === 6 ? 7 : 3);
        }
    };
    const activateSkill = ()=>{
        const g = game.current, p = g.player;
        if (g.status !== 'playing' || p.skill > 0) return;
        p.skill = ULTIMATE_COOLDOWN;
        p.rapidFire = ULTIMATE_DURATION;
        burst(p.x, p.y, '#ffd45e', 28);
        g.shake = 7;
    };
    const moveEntity = (obj, dx, dy)=>{
        const gates = activeGates(game.current.activeRoom), nx = obj.x + dx;
        if (!blocked(nx, obj.y, obj.r, gates)) obj.x = nx;
        const ny = obj.y + dy;
        if (!blocked(obj.x, ny, obj.r, gates)) obj.y = ny;
    };
    const summonBossMinions = (boss)=>{
        const g = game.current, p = g.player, room = rooms[4], gates = activeGates(g.activeRoom);
        const types = bossSummonTypes(boss.enraged);
        for(let i = 0; i < 4; i++){
            const type = types[i];
            let spawn = null, best = null;
            for(let attempt = 0; attempt < 80; attempt++){
                const point = {
                    x: room.x + 58 + Math.random() * (room.w - 116),
                    y: room.y + 58 + Math.random() * (room.h - 116)
                };
                if (blocked(point.x, point.y, 19, gates) || g.enemies.some((e)=>!e.dead && dist(e, point) < 62)) continue;
                const score = dist(p, point);
                if (!best || score > best.score) best = {
                    ...point,
                    score
                };
                if (score >= 220) {
                    spawn = point;
                    break;
                }
            }
            spawn ??= best;
            if (!spawn) continue;
            const enemy = makeEnemy(g.nextEnemyId++, 4, false, type, spawn);
            enemy.shot = 2000 + Math.random() * 2000;
            g.enemies.push(enemy);
            burst(enemy.x, enemy.y, type === 'gunner' ? '#ff955f' : '#9dff8f', 14);
        }
    };
    const spawnRewardChest = (roomId)=>{
        const g = game.current, room = rooms[roomId], offset = 66;
        const corners = [
            {
                x: room.x + offset,
                y: room.y + offset
            },
            {
                x: room.x + room.w - offset,
                y: room.y + offset
            },
            {
                x: room.x + offset,
                y: room.y + room.h - offset
            },
            {
                x: room.x + room.w - offset,
                y: room.y + room.h - offset
            }
        ];
        const start = Math.floor(Math.random() * corners.length);
        let position = corners[start];
        for(let i = 0; i < corners.length; i++){
            const base = corners[(start + i) % corners.length], point = {
                x: base.x + (Math.random() - .5) * 28,
                y: base.y + (Math.random() - .5) * 28
            };
            if (!blocked(point.x, point.y, 20)) {
                position = point;
                break;
            }
        }
        const reward = rollChestReward();
        g.chests.push({
            x: position.x,
            y: position.y,
            roomId,
            ...reward,
            opened: false
        });
    };
    const summonMeteorVolley = (target)=>{
        const g = game.current, base = Math.random() * Math.PI * 2;
        for(let i = 0; i < 5; i++){
            const radius = i === 0 ? 0 : 55 + Math.random() * 75, angle = base + i * Math.PI / 2;
            const bossRoom = rooms[4];
            g.meteors.push({
                x: clamp(target.x + Math.cos(angle) * radius, bossRoom.x + 90, bossRoom.x + bossRoom.w - 90),
                y: clamp(target.y + Math.sin(angle) * radius, bossRoom.y + 90, bossRoom.y + bossRoom.h - 90),
                r: METEOR_RADIUS,
                life: METEOR_WARNING,
                hit: false
            });
        }
    };
    function setupKeyboard() {
        const down = (e)=>{
            keys.current.add(e.code);
            if (e.code === 'Space') e.preventDefault();
            if (e.repeat) return;
            if (e.code === 'KeyQ') {
                melee.current = !melee.current;
                setMeleeUI(melee.current);
            }
            if (e.code === 'Space') activateSkill();
            if (e.code === 'Escape') togglePause();
        };
        const up = (e)=>keys.current.delete(e.code);
        const blur = ()=>{
            keys.current.clear();
            attackHeld.current = false;
            moveStick.current.active = false;
            aimStick.current.active = false;
            if (game.current.status === 'playing') {
                game.current.status = 'paused';
                syncHud();
            }
        };
        addEventListener('keydown', down);
        addEventListener('keyup', up);
        addEventListener('blur', blur);
        return ()=>{
            removeEventListener('keydown', down);
            removeEventListener('keyup', up);
            removeEventListener('blur', blur);
        };
    }
    function setupPointer() {
        const c = canvasRef.current;
        if (!c) return;
        c.focus({
            preventScroll: true
        });
        const pos = (e)=>{
            const r = c.getBoundingClientRect();
            return {
                x: (e.clientX - r.left) * VIEW_WIDTH / r.width,
                y: (e.clientY - r.top) * VIEW_HEIGHT / r.height
            };
        };
        const pd = (e)=>{
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            c.focus({
                preventScroll: true
            });
            const p = pos(e);
            c.setPointerCapture(e.pointerId);
            if (e.pointerType === 'touch') {
                const s = p.x < VIEW_WIDTH / 2 ? moveStick.current : aimStick.current;
                if (s.active) return;
                s.active = true;
                s.id = e.pointerId;
                s.ox = s.x = p.x;
                s.oy = s.y = p.y;
                if (p.x >= VIEW_WIDTH / 2) attackHeld.current = true;
            } else {
                mouse.current = p;
                game.current.player.angle = Math.atan2(p.y + camera.current.y - game.current.player.y, p.x + camera.current.x - game.current.player.x);
                attackHeld.current = true;
                shoot();
            }
        };
        const pm = (e)=>{
            const p = pos(e);
            if (e.pointerType === 'touch') {
                for (const s of [
                    moveStick.current,
                    aimStick.current
                ])if (s.active && s.id === e.pointerId) {
                    s.x = p.x;
                    s.y = p.y;
                }
            } else mouse.current = p;
        };
        const pu = (e)=>{
            for (const s of [
                moveStick.current,
                aimStick.current
            ])if (s.id === e.pointerId) {
                s.active = false;
                if (s === aimStick.current) attackHeld.current = false;
            }
            if (e.pointerType !== 'touch') attackHeld.current = false;
        };
        c.addEventListener('pointerdown', pd);
        c.addEventListener('pointermove', pm);
        c.addEventListener('pointerup', pu);
        c.addEventListener('pointercancel', pu);
        return ()=>{
            c.removeEventListener('pointerdown', pd);
            c.removeEventListener('pointermove', pm);
            c.removeEventListener('pointerup', pu);
            c.removeEventListener('pointercancel', pu);
        };
    }
    function setupGameLoop() {
        const update = (dt)=>{
            const g = game.current, p = g.player;
            if (g.status !== 'playing') return;
            p.cooldown -= dt;
            p.invincible -= dt;
            p.hurt -= dt;
            p.contactCooldown -= dt;
            p.slash -= dt;
            p.skill -= dt;
            p.rapidFire -= dt;
            p.stunned -= dt;
            g.shake = Math.max(0, g.shake - dt * .025);
            g.gateAnim = Math.max(0, g.gateAnim - dt);
            g.roomBanner = Math.max(0, g.roomBanner - dt);
            if (regenerateArmor(p, dt) > 0) burst(p.x, p.y, '#cfe7ff', 5);
            let mx = (keys.current.has('KeyD') ? 1 : 0) - (keys.current.has('KeyA') ? 1 : 0), my = (keys.current.has('KeyS') ? 1 : 0) - (keys.current.has('KeyW') ? 1 : 0);
            const ms = moveStick.current;
            if (ms.active) {
                mx = clamp((ms.x - ms.ox) / 48, -1, 1);
                my = clamp((ms.y - ms.oy) / 48, -1, 1);
            }
            if (p.stunned > 0) {
                mx = 0;
                my = 0;
            }
            const ml = Math.max(1, Math.hypot(mx, my));
            moveEntity(p, mx / ml * MOVE_SPEED * dt / 1000, my / ml * MOVE_SPEED * dt / 1000);
            const located = rooms.find((room)=>pointInRect(p, room, 0));
            if (located) g.currentRoom = located.id;
            const firstUncleared = g.cleared.findIndex((done)=>!done);
            if (g.activeRoom === null && located && located.id === firstUncleared && roomInteriorContains(located, p)) {
                g.activeRoom = located.id;
                g.wave = located.wave;
                g.roomStage = 1;
                g.nextWave = 0;
                g.gateAnim = 420;
                g.roomBanner = 1750;
                g.bullets = [];
                g.meteors = [];
                g.shockwaves = [];
                g.pulses = [];
                g.spikeRaised = true;
                g.spikeTimer = SPIKE_UP_DURATION;
                g.spikeContact = null;
                g.spikeTick = 0;
                g.enemies = located.id === 4 ? [
                    makeEnemy(99, 4, true)
                ] : makeWave(located.wave, g.nextEnemyId, 1);
                g.nextEnemyId += g.enemies.length;
                g.bossSummon = BOSS_SUMMON_INTERVAL;
                g.bossMeteor = 9000;
                burst(p.x, p.y, '#6df0ff', 18);
            }
            camera.current = {
                x: Math.round(clamp(p.x - VIEW_WIDTH / 2, 0, W - VIEW_WIDTH)),
                y: Math.round(clamp(p.y - VIEW_HEIGHT / 2, 0, H - VIEW_HEIGHT))
            };
            if (mouse.current) p.angle = Math.atan2(mouse.current.y + camera.current.y - p.y, mouse.current.x + camera.current.x - p.x);
            const as = aimStick.current;
            if (as.active) {
                const dx = as.x - as.ox, dy = as.y - as.oy;
                if (Math.hypot(dx, dy) > 8) p.angle = Math.atan2(dy, dx);
            }
            if (attackHeld.current) shoot();
            const gates = activeGates(g.activeRoom);
            const hurtPlayer = (damage)=>{
                if (p.invincible > 0 || p.hp <= 0) return false;
                applyDamage(p, damage);
                p.hurt = 240;
                g.shake = 6;
                burst(p.x, p.y, '#ff6e72', 10);
                return true;
            };
            const knockPlayer = (origin, distance)=>{
                let angle = Math.atan2(p.y - origin.y, p.x - origin.x);
                if (dist(origin, p) < 1) angle = Math.random() * Math.PI * 2;
                for(let i = 0; i < 8; i++)moveEntity(p, Math.cos(angle) * distance / 8, Math.sin(angle) * distance / 8);
            };
            const finishEnemy = (e)=>{
                if (e.dead) return;
                e.dead = true;
                burst(e.x, e.y, e.type === 'gunner' ? '#ffb454' : e.type === 'archer' ? '#9cf09d' : e.type === 'frog' ? '#7df0d0' : '#e6d2b6', 22);
                g.drops.push({
                    x: e.x,
                    y: e.y,
                    type: dropsEnergy() ? 'energy' : 'coin',
                    bob: 0
                });
            };
            for (const e of g.enemies){
                if (e.dead) continue;
                if (e.dying) {
                    const step = Math.min(dt, e.deathTimer);
                    e.deathTimer -= step;
                    if (e.dying === 1) {
                        moveEntity(e, Math.cos(e.deathAngle) * 120 * step / 500, Math.sin(e.deathAngle) * 120 * step / 500);
                        if (e.deathTimer <= 0) {
                            e.dying = 2;
                            e.deathTimer = FROG_DEATH_FUSE;
                        }
                    } else if (e.deathTimer <= 0) {
                        g.pulses.push({
                            x: e.x,
                            y: e.y,
                            life: FROG_PULSE_DURATION,
                            duration: FROG_PULSE_DURATION,
                            radius: FROG_EFFECT_RADIUS,
                            damage: FROG_EXPLOSION_DAMAGE,
                            hit: false,
                            kind: 'explosion'
                        });
                        finishEnemy(e);
                    }
                    continue;
                }
                if (e.hp <= 0) continue;
                e.hurt -= dt;
                e.seesPlayer = enemyCanSee(e, p, gates);
                if (e.elite && e.hp < e.maxHp * .5 && !e.enraged) {
                    e.enraged = true;
                    e.shot = Math.min(e.shot, 1000);
                    g.bossSummon = Math.min(g.bossSummon, 6800);
                    g.bossMeteor = 7000 + Math.random() * 3000;
                    g.shockwaves.push({
                        x: e.x,
                        y: e.y,
                        life: BOSS_SHOCKWAVE_DURATION,
                        hit: false
                    });
                    burst(e.x, e.y, '#ff3f35', 42);
                    g.shake = 12;
                }
                if (e.elite) {
                    g.bossSummon -= dt;
                    if (g.bossSummon <= 0) {
                        summonBossMinions(e);
                        g.bossSummon = e.enraged ? BOSS_RAGE_SUMMON_INTERVAL : BOSS_SUMMON_INTERVAL;
                    }
                    if (e.enraged) {
                        g.bossMeteor -= dt;
                        if (g.bossMeteor <= 0) {
                            summonMeteorVolley({
                                x: p.x,
                                y: p.y
                            });
                            g.bossMeteor = 7000 + Math.random() * 3000;
                        }
                    }
                }
                let movement = {
                    dx: 0,
                    dy: 0
                }, frogLanded = false;
                if (e.type === 'frog') {
                    const wasLeaping = e.leapTime > 0, frogStep = advanceFrogAttack(e, dt, p, e.seesPlayer);
                    frogLanded = frogStep.landed;
                    movement = wasLeaping || e.leapTime > 0 || frogStep.landed ? frogStep : advanceEnemyMovement(e, dt, p, e.seesPlayer);
                } else if (e.type === 'melee') {
                    if (advanceMeleeAttack(e, dt, p, e.seesPlayer)) {
                        if (hurtPlayer(MELEE_ENEMY_DAMAGE) && shouldStun()) p.stunned = Math.max(p.stunned, 1000);
                    }
                    movement = advanceMeleeMovement(e, dt, p, e.seesPlayer);
                } else {
                    const shots = advanceEnemyAttack(e, dt, p, e.seesPlayer, e.elite && e.enraged ? 0.58 : 1);
                    g.bullets.push(...shots);
                    if (shots.length) burst(shots[0].x, shots[0].y, shots[0].color, 7);
                    movement = advanceEnemyMovement(e, dt, p, e.seesPlayer);
                }
                if (movement.dx || movement.dy) {
                    const ox = e.x, oy = e.y, step = Math.hypot(movement.dx, movement.dy);
                    moveEntity(e, movement.dx, movement.dy);
                    if (Math.hypot(e.x - ox, e.y - oy) < step * .25) {
                        e.moveAngle += e.id % 2 ? Math.PI / 2 : -Math.PI / 2;
                        moveEntity(e, Math.cos(e.moveAngle) * step, Math.sin(e.moveAngle) * step);
                    }
                }
                if (frogLanded) g.pulses.push({
                    x: e.x,
                    y: e.y,
                    life: FROG_PULSE_DURATION,
                    duration: FROG_PULSE_DURATION,
                    radius: FROG_EFFECT_RADIUS,
                    damage: FROG_SHOCKWAVE_DAMAGE,
                    hit: false,
                    kind: 'frog'
                });
                if ((e.type === 'gunner' || e.type === 'archer') && dist(e, p) < e.r + p.r + 4 && p.contactCooldown <= 0) {
                    if (hurtPlayer(1) && !e.elite && shouldStun()) p.stunned = 1000;
                    p.contactCooldown = 850;
                }
            }
            for (const wave of g.shockwaves){
                wave.life -= dt;
                const radius = (1 - clamp(wave.life / BOSS_SHOCKWAVE_DURATION, 0, 1)) * BOSS_SHOCKWAVE_RADIUS;
                if (!wave.hit && dist(wave, p) <= radius + p.r) {
                    wave.hit = true;
                    hurtPlayer(BOSS_SHOCKWAVE_DAMAGE);
                }
            }
            g.shockwaves = g.shockwaves.filter((w)=>w.life > 0);
            for (const pulse of g.pulses){
                pulse.life -= dt;
                const radius = (1 - clamp(pulse.life / pulse.duration, 0, 1)) * pulse.radius;
                if (!pulse.hit && dist(pulse, p) <= radius + p.r) {
                    pulse.hit = true;
                    if (hurtPlayer(pulse.damage)) {
                        if (pulse.kind === 'frog') p.stunned = Math.max(p.stunned, 500);
                        knockPlayer(pulse, FROG_KNOCKBACK_DISTANCE);
                    }
                }
            }
            g.pulses = g.pulses.filter((pulse)=>pulse.life > 0);
            if (g.activeRoom !== null) {
                const cycle = advanceSpikeCycle(g.spikeRaised, g.spikeTimer, dt);
                g.spikeRaised = cycle.raised;
                g.spikeTimer = cycle.timer;
            } else {
                g.spikeRaised = false;
                g.spikeTimer = 0;
            }
            const touchingSpike = g.activeRoom !== null && g.spikeRaised ? g.spikes.find((spike)=>pointInRect(spike, rooms[g.activeRoom]) && dist(spike, p) < spike.r + p.r) : undefined;
            if (!touchingSpike) {
                g.spikeContact = null;
                g.spikeTick = 0;
            } else if (g.spikeContact !== touchingSpike.id) {
                g.spikeContact = touchingSpike.id;
                g.spikeTick = 1000;
                hurtPlayer(1);
            } else {
                g.spikeTick -= dt;
                while(g.spikeTick <= 0){
                    hurtPlayer(1);
                    g.spikeTick += 1000;
                }
            }
            for (const meteor of g.meteors){
                meteor.life -= dt;
                if (meteor.life <= 0 && !meteor.hit) {
                    meteor.hit = true;
                    g.shake = 10;
                    burst(meteor.x, meteor.y, '#ff6b3d', 30);
                    if (dist(meteor, p) <= meteor.r + p.r) hurtPlayer(METEOR_DAMAGE);
                }
            }
            g.meteors = g.meteors.filter((m)=>m.life > -260);
            for (const b of g.bullets)advanceBullet(b, dt, (bullet)=>{
                if (bullet.enemy) {
                    if (dist(bullet, p) < bullet.r + p.r) {
                        if (hurtPlayer(bullet.damage) && bullet.stunChance && shouldStun()) p.stunned = 1000;
                        return true;
                    }
                } else for (const e of g.enemies){
                    if (!e.dead && e.hp > 0 && dist(bullet, e) < bullet.r + e.r) {
                        e.hp -= bullet.damage;
                        e.hurt = 90;
                        burst(bullet.x, bullet.y, bullet.damage === 6 ? '#fff06a' : '#83e9ff', bullet.damage === 6 ? 10 : 5);
                        return true;
                    }
                }
                return false;
            }, gates);
            g.bullets = g.bullets.filter((b)=>b.life > 0);
            for (const e of g.enemies)if (!e.dead && !e.dying && e.hp <= 0) {
                if (e.type === 'frog') {
                    e.dying = 1;
                    e.deathTimer = 500;
                    e.deathAngle = Math.random() * Math.PI * 2;
                    e.attacking = false;
                    e.charging = false;
                    e.leapTime = 0;
                    burst(e.x, e.y, '#b8fff0', 12);
                } else finishEnemy(e);
            }
            for (const d of g.drops){
                d.bob += dt;
                const dd = dist(d, p);
                if (dd < 70) {
                    d.x += (p.x - d.x) * dt * .008;
                    d.y += (p.y - d.y) * dt * .008;
                }
                if (dd < 20) {
                    if (d.type === 'coin') g.coins += 3;
                    else p.energy = Math.min(MAX_ENERGY, p.energy + ENERGY_ORB_VALUE);
                    d.x = -999;
                    burst(p.x, p.y, d.type === 'coin' ? '#ffd45e' : '#55c7ff', 6);
                }
            }
            g.drops = g.drops.filter((d)=>d.x > -100);
            for (const chest of g.chests)if (!chest.opened && dist(chest, p) < 40) {
                chest.opened = true;
                g.coins += chest.coins;
                p.energy = Math.min(MAX_ENERGY, p.energy + chest.energy);
                burst(chest.x, chest.y, '#ffd65e', 24);
                g.roomBanner = 1500;
                if (chest.roomId === 4) {
                    g.status = 'win';
                    syncHud();
                }
            }
            for (const q of g.particles){
                q.x += q.vx * dt / 1000;
                q.y += q.vy * dt / 1000;
                q.vx *= .96;
                q.vy *= .96;
                q.life -= dt;
            }
            g.particles = g.particles.filter((q)=>q.life > 0);
            if (p.hp <= 0) {
                g.status = 'lose';
                syncHud();
                return;
            }
            const alive = g.enemies.some((e)=>!e.dead);
            if (g.activeRoom !== null && !alive && g.nextWave === 0) g.nextWave = 900;
            if (g.activeRoom !== null && g.nextWave > 0) {
                g.nextWave -= dt;
                if (g.nextWave <= 0) {
                    const clearedRoom = g.activeRoom;
                    if (clearedRoom === 3 && g.roomStage === 1) {
                        g.roomStage = 2;
                        g.enemies = makeWave(3, g.nextEnemyId, 2);
                        g.nextEnemyId += g.enemies.length;
                        g.nextWave = 0;
                        g.roomBanner = 1500;
                        burst(p.x, p.y, '#72dfff', 20);
                    } else {
                        g.cleared[clearedRoom] = true;
                        g.activeRoom = null;
                        g.spikeRaised = false;
                        g.spikeTimer = 0;
                        g.spikeContact = null;
                        g.spikeTick = 0;
                        g.enemies = [];
                        g.bullets = [];
                        g.meteors = [];
                        g.shockwaves = [];
                        g.pulses = [];
                        g.roomBanner = 1500;
                        spawnRewardChest(clearedRoom);
                        burst(p.x, p.y, '#80ff9c', 26);
                    }
                }
            }
        };
        const drawPixel = (ctx, x, y, w, h, color)=>{
            ctx.fillStyle = color;
            ctx.fillRect(Math.round(x), Math.round(y), w, h);
        };
        const render = ()=>{
            const c = canvasRef.current, m = miniRef.current;
            if (!c) return;
            const ctx = c.getContext('2d');
            const g = game.current, p = g.player;
            ctx.imageSmoothingEnabled = false;
            ctx.fillStyle = '#100d18';
            ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
            ctx.save();
            const sh = g.shake ? Math.sin(performance.now()) * g.shake : 0;
            ctx.translate(-camera.current.x + sh, -camera.current.y + sh * .5);
            ctx.fillStyle = '#070c15';
            ctx.fillRect(0, 0, W, H);
            const palette = {
                sanctum: [
                    '#27323d',
                    '#2d3a47',
                    '#60717c',
                    '#80d8d5'
                ],
                frost: [
                    '#324d5a',
                    '#3a5866',
                    '#99b7c3',
                    '#63e6ee'
                ],
                vault: [
                    '#273c4c',
                    '#2f4858',
                    '#728d9b',
                    '#44dbe8'
                ],
                foundry: [
                    '#242f34',
                    '#2a383d',
                    '#63777b',
                    '#a4d847'
                ],
                core: [
                    '#34283f',
                    '#3e304a',
                    '#846184',
                    '#ff6d55'
                ]
            };
            const floorArea = (area, colors)=>{
                ctx.fillStyle = colors[0];
                ctx.fillRect(area.x, area.y, area.w, area.h);
                ctx.save();
                ctx.beginPath();
                ctx.rect(area.x, area.y, area.w, area.h);
                ctx.clip();
                for(let y = area.y; y < area.y + area.h; y += 40)for(let x = area.x; x < area.x + area.w; x += 40){
                    ctx.fillStyle = (x + y) / 40 % 2 === 0 ? colors[1] : colors[0];
                    ctx.fillRect(x + 1, y + 1, 38, 38);
                    ctx.strokeStyle = '#d7ffff12';
                    ctx.strokeRect(x + .5, y + .5, 39, 39);
                }
                ctx.restore();
            };
            for (const room of rooms)floorArea(room, palette[room.theme]);
            for (const hall of corridors)floorArea(hall, [
                '#253943',
                '#2c4651',
                '#65818a',
                '#55e4e4'
            ]);
            for (const room of rooms){
                const colors = palette[room.theme];
                ctx.strokeStyle = '#0e1720';
                ctx.lineWidth = 24;
                ctx.strokeRect(room.x, room.y, room.w, room.h);
                ctx.strokeStyle = colors[2];
                ctx.lineWidth = 10;
                ctx.strokeRect(room.x + 7, room.y + 7, room.w - 14, room.h - 14);
                ctx.strokeStyle = colors[3] + 'aa';
                ctx.lineWidth = 3;
                ctx.strokeRect(room.x + 15, room.y + 15, room.w - 30, room.h - 30);
            }
            for (const hall of corridors){
                ctx.strokeStyle = '#101a22';
                ctx.lineWidth = 18;
                ctx.strokeRect(hall.x, hall.y, hall.w, hall.h);
                floorArea({
                    x: hall.x + 8,
                    y: hall.y + 8,
                    w: hall.w - 16,
                    h: hall.h - 16
                }, [
                    '#253943',
                    '#2c4651',
                    '#65818a',
                    '#55e4e4'
                ]);
            }
            for (const room of rooms)for (const gate of room.gates){
                ctx.fillStyle = '#16363d';
                ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
                ctx.fillStyle = '#68e4e8';
                if (gate.w > gate.h) {
                    for(let x = gate.x + 8; x < gate.x + gate.w - 4; x += 26)ctx.fillRect(x, gate.y + gate.h / 2 - 2, 17, 4);
                } else {
                    for(let y = gate.y + 8; y < gate.y + gate.h - 4; y += 26)ctx.fillRect(gate.x + gate.w / 2 - 2, y, 4, 17);
                }
            }
            for (const o of obstacles){
                const center = {
                    x: o.x + o.w / 2,
                    y: o.y + o.h / 2
                }, foundry = pointInRect(center, rooms[3]), core = pointInRect(center, rooms[4]);
                ctx.fillStyle = core ? '#332033' : foundry ? '#18272a' : '#4b3c35';
                ctx.fillRect(o.x, o.y, o.w, o.h);
                ctx.fillStyle = core ? '#805064' : foundry ? '#596f69' : '#826847';
                ctx.fillRect(o.x + 5, o.y + 5, o.w - 10, o.h - 10);
                for(let x = o.x + 9; x < o.x + o.w - 8; x += 28){
                    ctx.fillStyle = foundry ? '#9bc054' : '#b6955e';
                    ctx.fillRect(x, o.y + 8, 5, o.h - 16);
                }
            }
            const torches = [
                [
                    955,
                    610
                ],
                [
                    1605,
                    610
                ],
                [
                    1995,
                    570
                ],
                [
                    2665,
                    570
                ],
                [
                    1995,
                    2205
                ],
                [
                    2665,
                    2205
                ],
                [
                    3055,
                    1535
                ],
                [
                    3525,
                    1535
                ]
            ];
            for (const [x, y] of torches){
                const glow = ctx.createRadialGradient(x, y, 2, x, y, 58);
                glow.addColorStop(0, '#ffcf6190');
                glow.addColorStop(1, '#ff8a0000');
                ctx.fillStyle = glow;
                ctx.fillRect(x - 60, y - 60, 120, 120);
                drawPixel(ctx, x - 7, y - 8, 14, 22, '#8a674a');
                drawPixel(ctx, x - 4, y - 20, 8, 14, '#ffcf53');
                drawPixel(ctx, x - 2, y - 24, 4, 10, '#fff1a5');
            }
            if (g.activeRoom !== null) {
                const room = rooms[g.activeRoom], rise = 1 - clamp(g.gateAnim / 420, 0, 1);
                for (const gate of room.gates){
                    ctx.fillStyle = '#2a1b17';
                    ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
                    ctx.fillStyle = '#d69a36';
                    if (gate.w > gate.h) {
                        const h = gate.h * rise;
                        for(let x = gate.x + 4; x < gate.x + gate.w - 3; x += 22){
                            ctx.fillRect(x, gate.y + gate.h - h, 13, h);
                            ctx.fillStyle = '#ffd66b';
                            ctx.fillRect(x + 3, gate.y + gate.h - h, 7, Math.min(8, h));
                            ctx.fillStyle = '#d69a36';
                        }
                    } else {
                        const w = gate.w * rise;
                        for(let y = gate.y + 4; y < gate.y + gate.h - 3; y += 22){
                            ctx.fillRect(gate.x, y, w, 13);
                            ctx.fillStyle = '#ffd66b';
                            ctx.fillRect(gate.x, y + 3, Math.min(8, w), 7);
                            ctx.fillStyle = '#d69a36';
                        }
                    }
                }
            }
            for (const wave of g.shockwaves){
                const radius = (1 - clamp(wave.life / BOSS_SHOCKWAVE_DURATION, 0, 1)) * BOSS_SHOCKWAVE_RADIUS;
                ctx.strokeStyle = '#ff5a4dcc';
                ctx.lineWidth = 12 - wave.life / BOSS_SHOCKWAVE_DURATION * 7;
                ctx.shadowColor = '#ff3328';
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
            for (const pulse of g.pulses){
                const progress = 1 - clamp(pulse.life / pulse.duration, 0, 1);
                ctx.strokeStyle = pulse.kind === 'frog' ? '#f7ffffdd' : '#ffcf88dd';
                ctx.fillStyle = pulse.kind === 'frog' ? '#ffffff16' : '#ff7a351f';
                ctx.lineWidth = 5 - progress * 3;
                ctx.beginPath();
                ctx.arc(pulse.x, pulse.y, pulse.radius * progress, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            for (const meteor of g.meteors){
                const progress = clamp((METEOR_WARNING - meteor.life) / METEOR_WARNING, 0, 1), radius = meteor.r * (.75 + progress * .25);
                ctx.fillStyle = meteor.hit ? '#ff6a384f' : '#ff4e4030';
                ctx.strokeStyle = meteor.hit ? '#ffc16e' : '#ff786a';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(meteor.x, meteor.y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ffb55d';
                ctx.shadowColor = '#ff4b32';
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(meteor.x, meteor.y - Math.max(0, meteor.life / METEOR_WARNING) * 190, 9 + progress * 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            if (g.activeRoom !== null) for (const spike of g.spikes.filter((spike)=>pointInRect(spike, rooms[g.activeRoom]))){
                ctx.save();
                ctx.translate(spike.x, spike.y);
                ctx.fillStyle = '#171b22';
                ctx.fillRect(-18, -8, 36, 18);
                if (g.spikeRaised) {
                    ctx.fillStyle = '#aab5bc';
                    for(let x = -14; x <= 10; x += 8){
                        ctx.beginPath();
                        ctx.moveTo(x, 5);
                        ctx.lineTo(x + 4, -13);
                        ctx.lineTo(x + 8, 5);
                        ctx.closePath();
                        ctx.fill();
                    }
                } else {
                    ctx.fillStyle = '#58646c';
                    for(let x = -13; x <= 11; x += 8)ctx.fillRect(x, -3, 5, 3);
                }
                ctx.restore();
            }
            for (const chest of g.chests){
                ctx.save();
                ctx.translate(chest.x, chest.y);
                ctx.fillStyle = '#17101770';
                ctx.beginPath();
                ctx.ellipse(0, 14, 21, 7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = chest.opened ? '#5b4330' : '#9a6b32';
                ctx.fillRect(-20, -5, 40, 20);
                ctx.fillStyle = chest.opened ? '#3f3028' : '#d9a849';
                ctx.fillRect(-20, -11, 40, 9);
                ctx.fillStyle = '#ffe078';
                ctx.fillRect(-3, -6, 6, 12);
                if (chest.opened) {
                    ctx.save();
                    ctx.translate(0, -13);
                    ctx.rotate(-.35);
                    ctx.fillStyle = '#74502d';
                    ctx.fillRect(-20, -5, 40, 8);
                    ctx.restore();
                }
                ctx.restore();
            }
            for (const d of g.drops){
                const y = d.y + Math.sin(d.bob * .008) * 4;
                if (d.type === 'coin') {
                    ctx.fillStyle = '#ffd84d';
                    ctx.beginPath();
                    ctx.arc(d.x, y, 7, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#fff3a0';
                    ctx.fillRect(d.x - 2, y - 5, 3, 9);
                } else {
                    ctx.fillStyle = '#51c8ff';
                    ctx.fillRect(d.x - 6, y - 6, 12, 12);
                }
            }
            for (const e of [
                ...g.enemies
            ].filter((e)=>!e.dead).sort((a, b)=>a.y - b.y)){
                ctx.save();
                ctx.translate(Math.round(e.x), Math.round(e.y));
                const gun = e.type === 'gunner', archer = e.type === 'archer', frog = e.type === 'frog', close = e.type === 'melee', size = e.elite ? 1.5 : 1, charge = e.charging ? clamp(1 - e.shot / BOW_CHARGE, 0, 1) : 0;
                const frogLift = frog && e.leapTime > 0 ? Math.sin((1 - e.leapTime / FROG_LEAP_DURATION) * Math.PI) * 34 : 0;
                const fuseFlash = frog && e.dying === 2 ? Math.floor(e.deathTimer / 80) % 2 ? '#ffffff' : '#ff453f' : null;
                if (e.charging) {
                    ctx.save();
                    ctx.rotate(e.chargeAngle);
                    ctx.strokeStyle = `rgba(181,241,140,${.2 + charge * .5})`;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([
                        6,
                        8
                    ]);
                    ctx.beginPath();
                    ctx.moveTo(28, 0);
                    ctx.lineTo(480, 0);
                    ctx.stroke();
                    ctx.restore();
                    ctx.strokeStyle = '#b5f18c';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2);
                    ctx.stroke();
                    for(let i = 0; i < 6; i++){
                        const a = i * Math.PI / 3 + performance.now() * .002, r = 42 - charge * 15;
                        drawPixel(ctx, Math.cos(a) * r, Math.sin(a) * r, 3, 3, '#e0ffb4');
                    }
                }
                ctx.fillStyle = '#09090a70';
                ctx.beginPath();
                ctx.ellipse(0, 19, 20 * size, 7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.translate(0, -frogLift);
                ctx.save();
                ctx.scale(size, size);
                if (e.hurt > 0) ctx.globalAlpha = .55;
                drawPixel(ctx, -12, 13, 8, 8, '#171c22');
                drawPixel(ctx, 4, 13, 8, 8, '#171c22');
                drawPixel(ctx, -16, -6, 32, 22, fuseFlash ?? (gun ? '#8d5151' : archer ? '#517b52' : frog ? '#2d8f79' : '#8d765c'));
                ctx.save();
                ctx.translate(Math.cos(e.viewAngle) * 3, Math.sin(e.viewAngle) * 3);
                drawPixel(ctx, -15, -22, 30, 19, fuseFlash ?? (e.elite && e.enraged ? '#8d242d' : gun ? '#59333d' : archer ? '#36543c' : frog ? '#46c9a5' : '#59483c'));
                drawPixel(ctx, -11, -24, 22, 8, fuseFlash ? fuseFlash === '#ffffff' ? '#ff453f' : '#ffffff' : e.elite && e.enraged ? '#ff6748' : gun ? '#e2ac67' : archer ? '#89bb71' : frog ? '#8affcf' : '#c3a777');
                drawPixel(ctx, -10, -11, 20, 11, '#2a2328');
                drawPixel(ctx, -7 + Math.cos(e.viewAngle) * 2, -8 + Math.sin(e.viewAngle) * 2, 4, 4, gun ? '#ffe08a' : archer ? '#ceffa3' : frog ? '#10292b' : '#fff2c5');
                drawPixel(ctx, 4 + Math.cos(e.viewAngle) * 2, -8 + Math.sin(e.viewAngle) * 2, 4, 4, gun ? '#ffe08a' : archer ? '#ceffa3' : frog ? '#10292b' : '#fff2c5');
                drawPixel(ctx, -9, 4, 18, 4, gun ? '#cda273' : archer ? '#8db78c' : frog ? '#ff7f9b' : '#b99d78');
                ctx.restore();
                ctx.save();
                ctx.rotate(e.charging ? e.chargeAngle : e.angle);
                if (gun) {
                    drawPixel(ctx, 11, -4, 26, 8, '#151923');
                    drawPixel(ctx, 17, -5, 19, 4, '#abb0ae');
                    drawPixel(ctx, 18, 3, 6, 10, '#4c5260');
                    drawPixel(ctx, 33, -3, 5, 6, '#ffbe66');
                } else if (archer) {
                    ctx.strokeStyle = '#bb8c53';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(16, -19);
                    ctx.lineTo(28, -11);
                    ctx.lineTo(31, 0);
                    ctx.lineTo(28, 11);
                    ctx.lineTo(16, 19);
                    ctx.stroke();
                    ctx.strokeStyle = e.charging ? '#efffbb' : '#c6d4b7';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(16, -19);
                    ctx.lineTo(16 - charge * 12, 0);
                    ctx.lineTo(16, 19);
                    ctx.stroke();
                    if (e.charging) {
                        drawPixel(ctx, 4 - charge * 5, -1, 29, 2, '#f5edbe');
                        drawPixel(ctx, 31 - charge * 5, -3, 5, 6, '#ddffb5');
                    }
                } else if (close) {
                    drawPixel(ctx, 8, -3, 30, 6, '#d9dde0');
                    drawPixel(ctx, 29, -6, 9, 12, '#f5f8fa');
                    drawPixel(ctx, 12, 3, 7, 9, '#76502f');
                }
                ctx.restore();
                ctx.restore();
                if (frog && e.dying === 2) {
                    ctx.strokeStyle = Math.floor(e.deathTimer / 120) % 2 ? '#ffffff' : '#ff805f';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(0, 0, 25 + (1 - e.deathTimer / FROG_DEATH_FUSE) * 8, 0, Math.PI * 2);
                    ctx.stroke();
                }
                const bw = e.elite ? 58 : 38;
                ctx.fillStyle = '#201725';
                ctx.fillRect(-bw / 2, e.r + 6, bw, 5);
                ctx.fillStyle = e.elite && e.hp <= e.maxHp / 2 ? '#ff3f48' : gun ? '#ffbd6d' : archer ? '#9fd88b' : frog ? '#68d9bd' : '#d9bd8d';
                ctx.fillRect(-bw / 2, e.r + 6, bw * clamp(e.hp / e.maxHp, 0, 1), 5);
                if (e.elite) {
                    ctx.fillStyle = '#f7e5d0';
                    ctx.fillRect(-1, e.r + 3, 2, 11);
                }
                if (e.charging) {
                    ctx.fillStyle = '#efffb1';
                    ctx.font = '14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('蓄力', 0, -43);
                }
                if (e.elite) {
                    ctx.fillStyle = e.enraged ? '#ff584f' : '#ffce7b';
                    ctx.font = '14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(e.enraged ? '首领 · 愤怒' : '枪手首领', 0, -43);
                }
                if (e.attacking) {
                    const ix = e.elite ? 34 : 22, iy = e.elite ? -37 : -31;
                    ctx.font = '22px "Dungeon Pixel", monospace';
                    ctx.textAlign = 'center';
                    ctx.strokeStyle = '#2a0710';
                    ctx.lineWidth = 5;
                    ctx.strokeText('!', ix, iy);
                    ctx.fillStyle = '#ff354d';
                    ctx.fillText('!', ix, iy);
                }
                ctx.restore();
            }
            for (const b of g.bullets){
                ctx.save();
                ctx.translate(b.x, b.y);
                ctx.fillStyle = b.color;
                ctx.shadowColor = b.color;
                ctx.shadowBlur = 8;
                if (b.kind === 'arrow') {
                    ctx.rotate(Math.atan2(b.vy, b.vx));
                    ctx.fillRect(-18, -1.5, 23, 3);
                    ctx.beginPath();
                    ctx.moveTo(9, 0);
                    ctx.lineTo(1, -5);
                    ctx.lineTo(1, 5);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = '#648754';
                    ctx.fillRect(-19, -5, 5, 4);
                    ctx.fillRect(-19, 1, 5, 4);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
            if (p.rapidFire > 0) {
                ctx.strokeStyle = '#ffd85caa';
                ctx.lineWidth = 3;
                ctx.setLineDash([
                    5,
                    5
                ]);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 27 + Math.sin(performance.now() * .012) * 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.save();
            ctx.translate(Math.round(p.x), Math.round(p.y));
            if ((p.invincible > 0 || p.hurt > 0) && Math.floor((p.invincible > 0 ? p.invincible : p.hurt) / 60) % 2) ctx.globalAlpha = .4;
            ctx.fillStyle = '#20283d';
            ctx.fillRect(-14, -16, 28, 31);
            ctx.fillStyle = '#304365';
            ctx.fillRect(-11, -21, 22, 12);
            ctx.fillStyle = '#77e3ff';
            ctx.fillRect(-7, -12, 5, 5);
            ctx.fillRect(3, -12, 5, 5);
            ctx.fillStyle = '#e4d8c4';
            ctx.fillRect(-6, 6, 13, 12);
            ctx.rotate(p.angle);
            if (!melee.current) {
                ctx.fillStyle = '#8ee9ef';
                ctx.fillRect(8, -3, 27, 7);
                ctx.fillStyle = '#41566a';
                ctx.fillRect(14, 4, 8, 8);
            }
            ctx.restore();
            if (p.stunned > 0) {
                ctx.fillStyle = '#ffe05c';
                ctx.font = '18px "Dungeon Pixel", monospace';
                ctx.textAlign = 'center';
                ctx.fillText('✦ 眩晕 ✦', p.x, p.y - 38);
            }
            if (p.slash > 0) {
                ctx.strokeStyle = '#fff0ad';
                ctx.lineWidth = 9;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 56, p.angle - 1, p.angle + 1);
                ctx.stroke();
            }
            for (const q of g.particles){
                ctx.globalAlpha = clamp(q.life / 350, 0, 1);
                ctx.fillStyle = q.color;
                ctx.fillRect(q.x, q.y, q.size, q.size);
            }
            ctx.globalAlpha = 1;
            ctx.restore();
            if (g.roomBanner > 0) {
                const active = g.activeRoom !== null, done = g.wave > 0 && g.cleared[g.wave], stage = active && g.activeRoom === 3 ? ` · 第 ${g.roomStage}/2 波` : '';
                const title = active ? `${rooms[g.activeRoom].label}${stage} · 门槛封锁` : done ? `${rooms[g.wave].label} · 已肃清，寻找宝箱` : '起点 · 沿通道前进';
                const by = VIEW_HEIGHT / 2 - 21;
                ctx.globalAlpha = clamp(g.roomBanner / 350, 0, 1);
                ctx.fillStyle = '#101722dd';
                ctx.fillRect(VIEW_WIDTH / 2 - 170, by, 340, 42);
                ctx.strokeStyle = active ? '#ffbd58' : '#64e3e8';
                ctx.lineWidth = 2;
                ctx.strokeRect(VIEW_WIDTH / 2 - 170, by, 340, 42);
                ctx.fillStyle = '#f6eed5';
                ctx.font = '12px "Dungeon Pixel", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(title, VIEW_WIDTH / 2, by + 26);
                ctx.globalAlpha = 1;
            }
            if (moveStick.current.active || aimStick.current.active) {
                for (const [s, color] of [
                    [
                        moveStick.current,
                        '#b6c1d8'
                    ],
                    [
                        aimStick.current,
                        '#75e5ff'
                    ]
                ])if (s.active) {
                    ctx.fillStyle = '#ffffff24';
                    ctx.beginPath();
                    ctx.arc(s.ox, s.oy, 46, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    ctx.fillStyle = '#ffffff55';
                    ctx.beginPath();
                    ctx.arc(s.ox + clamp(s.x - s.ox, -30, 30), s.oy + clamp(s.y - s.oy, -30, 30), 18, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            if (m) {
                const mc = m.getContext('2d'), size = 16, spots = [
                    [
                        8,
                        34
                    ],
                    [
                        38,
                        34
                    ],
                    [
                        68,
                        34
                    ],
                    [
                        68,
                        68
                    ],
                    [
                        108,
                        68
                    ]
                ];
                mc.clearRect(0, 0, 150, 96);
                mc.fillStyle = '#081019';
                mc.fillRect(0, 0, 150, 96);
                mc.fillStyle = '#29323b';
                mc.fillRect(24, 39, 14, 6);
                mc.fillRect(54, 39, 14, 6);
                mc.fillRect(73, 50, 6, 18);
                mc.fillRect(84, 73, 24, 6);
                for (const room of rooms){
                    const [x, y] = spots[room.id];
                    mc.fillStyle = room.id === g.currentRoom ? '#f6f4ef' : room.id === 0 ? '#48c878' : room.id === 4 ? '#9b62d0' : '#68717b';
                    mc.fillRect(x, y, size, size);
                    mc.strokeStyle = '#111820';
                    mc.lineWidth = 2;
                    mc.strokeRect(x, y, size, size);
                }
            }
        };
        const loop = (t)=>{
            const dt = Math.min(33, last.current ? t - last.current : 16);
            last.current = t;
            update(dt);
            render();
            if (Math.floor(t / 150) !== Math.floor((t - dt) / 150)) syncHud();
            raf.current = requestAnimationFrame(loop);
        };
        raf.current = requestAnimationFrame(loop);
        return ()=>cancelAnimationFrame(raf.current);
    }
    const toggleMelee = ()=>{
        melee.current = !melee.current;
        setMeleeUI(melee.current);
    };
    ui['pause-button'].addEventListener('click', togglePause);
    ui['resume-button'].addEventListener('click', togglePause);
    ui['pause-restart'].addEventListener('click', reset);
    ui['result-restart'].addEventListener('click', reset);
    ui['weapon-button'].addEventListener('click', toggleMelee);
    ui['skill-button'].addEventListener('pointerdown', (event)=>{
        event.stopPropagation();
        activateSkill();
    });
    syncHud();
    setMeleeUI(false);
    const cleanups = [
        setupAgentTool(),
        setupKeyboard(),
        setupPointer(),
        setupGameLoop()
    ];
    addEventListener('pagehide', (event)=>{
        if (!event.persisted) for (const cleanup of cleanups)cleanup?.();
    });
}
startDungeon();

/* ===========================================================================
 * 接入怪谈博物馆：作为剧情最后的 boss 战
 *
 * 这段只在 URL 带 returnScene 时生效（怪谈博物馆就是这么打开它的），单独双击
 * index.html 玩的时候完全不受影响。
 *
 * 与主游戏的约定（和 demos/battle 一致）：
 *   进入：  demos/pixel-dungeon-html/index.html?from=novel&user=<id>&returnScene=<场景 id>
 *   胜负：  写 localStorage["museum_pending_battle_v1"] = { status, remainingHp,
 *           rewards, flags, userId }，然后回到 index.html?fromBattle=1
 *   主游戏：js/game.js 的 consumeBattleResult() 读走它并 applyBattleResult()：
 *             win  -> hp 采用 remainingHp，进入 returnScene，奖励发到线索与旗标
 *             lose -> hp 归零，走 ending-d（死亡）
 *
 * 这里**不重复实现一套判定**，只把地牢自己的 hud.status（'win' / 'lose'）翻译成那个约定。
 * =========================================================================== */
(function () {
  'use strict';

  var RESULT_KEY = 'museum_pending_battle_v1';
  var query = new URLSearchParams(location.search);
  var returnScene = query.get('returnScene');
  // 没有 returnScene 就是独立游玩（老师直接双击打开），保持原样。
  if (!returnScene) return;

  var preview = query.get('preview') === '1';
  var userId = query.get('user') || null;
  var storage = preview ? sessionStorage : localStorage;

  // 主游戏里的生存点是 0-25 左右，地牢是 7 点血；直接搬过去会让玩家一进最终结局
  // 就剩 1 点生存点。所以按比例折算，并且至少留 1 点——输了才走 ending-d。
  var DUNGEON_MAX_HP = 7;
  var MUSEUM_MAX_HP = 25;

  function museumHpFrom(dungeonHp) {
    var ratio = Math.max(0, Math.min(1, Number(dungeonHp) / DUNGEON_MAX_HP));
    return Math.max(1, Math.round(ratio * MUSEUM_MAX_HP));
  }

  var reported = false;
  function report(status, hp) {
    if (reported) return;
    reported = true;
    var result = {
      status: status,
      remainingHp: status === 'win' ? museumHpFrom(hp) : 0,
      rewards: status === 'win' ? ['boss_defeated'] : [],
      flags: status === 'win' ? ['boss_defeated'] : [],
      userId: userId,
      source: 'pixel-dungeon'
    };
    try { storage.setItem(RESULT_KEY, JSON.stringify(result)); } catch (error) { /* 存储不可用也不能卡住玩家 */ }
    window.location.href = '../../index.html?fromBattle=1';
  }

  var title = document.getElementById('result-title');
  var message = document.getElementById('result-message');
  var continueButton = document.getElementById('result-continue');
  var restartButton = document.getElementById('result-restart');

  // 结算并回剧情。挂到 window 上是为了让自动化测试能直接驱动它：地牢的绘制循环每一帧
  // 都会按它自己的 hud.status 把结算卡收起来，所以测试没法靠改 DOM 假装"已经打完了"。
  // 触发流程：setItem(RESULT_KEY) -> 回 index.html?fromBattle=1 -> 主游戏结算。
  window.__dungeonFinish = function (status, hpOrRatio) {
    var hp = Number(hpOrRatio);
    if (!Number.isFinite(hp)) hp = status === 'win' ? DUNGEON_MAX_HP : 0;
    report(status === 'win' ? 'win' : 'lose', hp);
    return true;
  };

  if (continueButton) {
    continueButton.hidden = false;
    continueButton.addEventListener('click', function () {
      window.__dungeonFinish(window.__dungeonStatus === 'win' ? 'win' : 'lose', window.__dungeonHp);
    });
  }
  // 最终 boss 战里"重开一局"没有意义（剧情已经走到结局前），改成回剧情重打。
  if (restartButton) {
    restartButton.hidden = true;
  }

  // 地牢的绘制循环每帧调用 setHud，这里用 MutationObserver 监听结算卡的出现。
  //
  // 注意：回调里**绝对不能再改这个卡片的属性**。第一版就是在这里同时改文案并调用
  // focus()，结果 observer 被自己的改动再次触发，形成无限循环，把整个页面主线程锁死
  // （现象是页面卡住、连 Playwright 的 evaluate 都不返回）。所以：
  //   - 只改 message 的文本（文本变化不触发 attributeFilter:['hidden'] 的回调）
  //   - 真的需要改属性时用 requestAnimationFrame 推到本次通知之后
  //   - 触发过一次就 disconnect，不再观察
  var card = document.getElementById('result-card');
  if (!card) return;
  var handled = false;
  var observer = new MutationObserver(function () {
    if (handled || card.hidden) return;
    handled = true;
    observer.disconnect();
    var text = (title && title.textContent) || '';
    var won = /肃清|胜利/.test(text);
    window.__dungeonStatus = won ? 'win' : 'lose';
    if (message) {
      message.textContent = won
        ? '梦魇被击溃了。契约就在它身上——出口还在等你。'
        : '你倒在了地牢深处。眼前只剩下那条熟悉的走廊。';
    }
    // 地牢自己的 HUD 血条就是玩家的剩余生命，直接读界面上的数字，避免猜内部变量名。
    var hpText = (document.getElementById('hp-value') || {}).textContent || '';
    var m = /(\d+)\s*\/\s*\d+/.exec(hpText);
    window.__dungeonHp = m ? Number(m[1]) : 0;
    if (continueButton) window.requestAnimationFrame(function () { continueButton.focus(); });
  });
  observer.observe(card, { attributes: true, attributeFilter: ['hidden'] });
}());
