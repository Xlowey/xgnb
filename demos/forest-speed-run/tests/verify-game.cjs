const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, fs.existsSync(path.resolve(__dirname, '../game.js')) ? '..' : '../outputs/forest-speed-run');
const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const sandbox = { window: { addEventListener() {} } };
vm.runInNewContext(source + '\n;globalThis.exports = {CONFIG, Player, Coin, PowerUp, Obstacle, Spawner, Renderer, Game};', sandbox);
const {CONFIG, Player, Coin, PowerUp, Obstacle, Spawner, Renderer, Game} = sandbox.exports;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const duration = CONFIG.ACTION_DURATION;
close(duration, .7); close(CONFIG.SLIDE_DURATION, .7); close(CONFIG.ACTION_SWITCH_MIN, .25); close(CONFIG.LANE_SWITCH_MIN, .1); close(CONFIG.BASE_SPEED, 75);

// Exact vertical action duration and its minimum input interval.
for (const fps of [30, 60, 120]) {
  const p = new Player();
  assert.equal(p.jump(), true);
  for (let i = 0; i < fps * duration - 1; i++) p.update(1 / fps);
  assert.equal(p.jumpActive, true);
  p.update(1 / fps);
  assert.equal(p.jumpActive, false);
  close(p.height, 0);
  assert.equal(p.slide(), true);
  for (let i = 0; i < fps * CONFIG.SLIDE_DURATION - 1; i++) p.update(1 / fps);
  assert.equal(p.sliding, true);
  p.update(1 / fps);
  assert.equal(p.sliding, false);
  assert.equal(p.jump(), true);
}
// Vertical actions can interrupt each other after 0.25s, but not before.
for (const first of ['jump', 'slide']) {
  const p = new Player(); const second = first === 'jump' ? 'slide' : 'jump';
  assert.equal(p[first](), true);
  p.update(CONFIG.ACTION_SWITCH_MIN - .001); assert.equal(p[second](), false);
  p.update(.001); assert.equal(p[second](), true);
  assert.equal(p.jumpActive, second === 'jump'); assert.equal(p.sliding, second === 'slide');
  assert.equal(p[first](), false, 'Switching must restart the 0.25s cooldown');
  p.update(CONFIG.ACTION_SWITCH_MIN); assert.equal(p[first](), true);
}
// The independent lane cooldown is 0.1s; motion remains 0.25s and vertical actions last 0.7s.
for (const fps of [30, 60, 120]) {
  const p = new Player();
  assert.equal(p.jump(), true);
  assert.equal(p.move(1), true, 'Jump cooldown must not block lane changes');
  p.update(CONFIG.LANE_SWITCH_MIN - .001);
  assert.ok(p.laneProgress < 1);
  assert.equal(p.move(-1), false);
  p.update(.001);
  assert.ok(p.lane > 0 && p.lane < 1); assert.ok(p.laneProgress < 1);
  assert.equal(p.move(-1), true, 'Lane change becomes available at exactly 0.1s, even during motion');
  assert.equal(p.slide(), false, 'Lane inputs must not shorten vertical action cooldown');
  for (let i = 0; i < fps * CONFIG.LANE_CHANGE_TIME; i++) p.update(1 / fps);
  close(p.lane, 0); assert.equal(p.laneProgress, 1);
  assert.equal(p.jumpActive, true); close(p.jumpElapsed, CONFIG.LANE_SWITCH_MIN + Math.ceil(fps * CONFIG.LANE_CHANGE_TIME) / fps);
  p.update(duration - p.jumpElapsed); assert.equal(p.jumpActive, false);
  p.reset(); assert.equal(p.laneCooldown, 0);
  assert.equal(p.move(1), true);
  assert.equal(p.slide(), true, 'Lane cooldown must not block vertical actions');
  p.update(CONFIG.LANE_SWITCH_MIN); assert.equal(p.move(-1), true);
  close(p.slideTimer, .6); assert.equal(p.jump(), false);
  p.update(CONFIG.LANE_SWITCH_MIN); assert.equal(p.sliding, true); close(p.slideTimer, .5);
  p.update(.5); assert.equal(p.sliding, false);
}
close(CONFIG.LANE_CHANGE_TIME, .25);
const peak = new Player();
peak.jump(); peak.update(duration / 2); close(peak.height, 65);

// At each speed tier, a centered action covers the entire obstacle collision band.
const slowestSpeed = CONFIG.BASE_SPEED * .88;
for (const speed of [slowestSpeed, ...Array.from({length: 6}, (_, i) => CONFIG.BASE_SPEED * 1.25 ** i)]) {
  const entry = duration / 2 - CONFIG.PLAYER_COLLISION_Z / speed;
  const exit = duration / 2 + CONFIG.PLAYER_COLLISION_Z / speed;
  assert.ok(entry > 0 && exit < duration);
  for (const t of [entry, exit]) {
    const progress = t / duration;
    const height = 4 * CONFIG.JUMP_HEIGHT * progress * (1 - progress);
    assert.ok(height > 12, 'Jump must clear rock/river/fence throughout the collision band');
  }
}

function collisionGame(player, obstacle) {
  const game = Object.create(Game.prototype);
  Object.assign(game, {player, obstacles: [obstacle], coins: [], powerUps: [], bonusScore: 0,
    burstAtPlayer() {}, crash() {player.crashed = true;}, trip() {player.stumbleTimer = 5;}});
  return game;
}
const airborne = new Player(); airborne.jump(); airborne.update(duration / 2);
collisionGame(airborne, new Obstacle(0, CONFIG.PLAYER_WORLD_Z, 'bulldozer')).handleCollisions(1/60);
assert.equal(airborne.crashed, true, 'Truck must not be jumpable');
const sliding = new Player(); sliding.slide(); sliding.update(.1);
collisionGame(sliding, new Obstacle(0, CONFIG.PLAYER_WORLD_Z, 'fence', {variant: 'high'})).handleCollisions(1/60);
assert.equal(sliding.crashed, false);
const stumbled = new Player(); stumbled.stumbleTimer = 3;
const animal = new Obstacle(0, CONFIG.PLAYER_WORLD_Z, 'animal');
collisionGame(stumbled, animal).handleCollisions(1/60);
assert.equal(stumbled.crashed, true); assert.equal(animal.dead, true);
const swept = new Obstacle(0, 35, 'bulldozer', {direction: -1});
swept.update(30);
assert.ok(swept.crossesDepth(CONFIG.PLAYER_WORLD_Z, CONFIG.PLAYER_COLLISION_Z), 'High-speed collision must not tunnel');

// Coin groups remain single, straight routes ending before their obstacle.
for (const speed of [75, 229]) {
  const spawner = new Spawner();
  const scene = {speed, distance: 2500, obstacles: [], coins: [], powerUps: []};
  spawner.spawnApproachCoins(scene, -1, 220);
  assert.equal(scene.coins.length, 5);
  assert.ok(scene.coins.every(c => c.lane === -1 && c.height === 18));
  const last = scene.coins.at(-1);
  const clearance = Math.min(144, Math.max(28, speed * (CONFIG.ACTION_SWITCH_MIN + .08)));
  close(220 - last.z, clearance);
  assert.ok(scene.coins[0].z >= CONFIG.PLAYER_WORLD_Z + 12);
  for (let i = 1; i < scene.coins.length; i++) close(scene.coins[i].z - scene.coins[i-1].z, 11);
  scene.coins = [];
  spawner.spawnRiverCoins(scene, 0, 220);
  assert.ok(scene.coins.every(c => c.lane === 0 && c.z < 220 - CONFIG.PLAYER_COLLISION_Z));
}
const spacingSpawner = new Spawner();
const spacingScene = {speed: 200, distance: 0, obstacles: [], coins: [], powerUps: []};
spacingSpawner.update(149, spacingScene);
assert.equal(spacingScene.obstacles.length, 0);
spacingSpawner.update(1, spacingScene);
assert.equal(spacingScene.obstacles.length, 1);
assert.ok(spacingSpawner.nextRow >= 150);

// Both walls share a cumulative three-hit limit; cooldown does not count rejected inputs.
for (const direction of [-1, 1]) {
  const p = new Player();
  const game = Object.create(Game.prototype);
  Object.assign(game, {player: p, state: 'PLAYING', crashTimer: 0, shake: 0,
    burstAtPlayer() {}, updateHUD() {}});
  const action = direction < 0 ? 'left' : 'right';
  game.handleAction(action); p.update(CONFIG.LANE_SWITCH_MIN - .001);
  game.handleAction(action); assert.equal(p.wallHits, 0, 'Do not hit a wall while changing lanes or before cooldown');
  p.update(.001);
  game.handleAction(action); assert.equal(p.wallHits, 0, 'Cooldown expiry must not count a wall hit before arriving');
  p.update(CONFIG.LANE_CHANGE_TIME - CONFIG.LANE_SWITCH_MIN);
  close(p.lane, direction); assert.equal(p.wallHits, 0);
  game.handleAction(action);
  assert.equal(p.wallHits, 1); assert.equal(p.crashed, false); close(p.wallStunTimer, 5);
  p.update(CONFIG.LANE_SWITCH_MIN - .001); game.handleAction(action); assert.equal(p.wallHits, 1);
  p.update(.001); game.handleAction(action);
  assert.equal(p.wallHits, 2); assert.equal(p.crashed, false); close(p.wallStunTimer, 5);
  p.update(6); assert.equal(p.wallStunTimer, 0); assert.equal(p.wallHits, 2);
  game.handleAction(action);
  assert.equal(p.wallHits, 3); assert.equal(p.crashed, true); assert.ok(game.crashTimer > 0);
  p.reset(); assert.equal(p.wallHits, 0); assert.equal(p.wallStunTimer, 0); assert.equal(p.crashed, false);
}
// A wall stun alone must not become the animal's second-hit instant-death state.
const wallStunned = new Player(); wallStunned.wallHits = 1; wallStunned.wallStunTimer = 4;
const firstAnimal = new Obstacle(0, CONFIG.PLAYER_WORLD_Z, 'animal');
collisionGame(wallStunned, firstAnimal).handleCollisions(1/60);
assert.equal(wallStunned.crashed, false); assert.equal(firstAnimal.dead, true); close(wallStunned.stumbleTimer, 5);

// Validate copied PNG files and nominal rendered sizes without stretching.
const textures = {};
for (const [type, filename] of Object.entries({magnet: 'magnet.png', double: 'double-score.png', shield: 'helmet.png'})) {
  const buffer = fs.readFileSync(path.join(root, 'assets', filename));
  assert.equal(buffer.subarray(1, 4).toString(), 'PNG');
  textures[type] = {complete: true, naturalWidth: buffer.readUInt32BE(16), naturalHeight: buffer.readUInt32BE(20)};
}
let coinDiameter = 0, powerUpDiameter = 0, imageDraw = null;
const ctx = new Proxy({}, {get(target, key) {
  if (key === 'ellipse') return (x, y, rx, ry) => {coinDiameter = ry * 2;};
  if (key === 'arc') return (x, y, radius) => {powerUpDiameter = radius * 2;};
  if (key === 'drawImage') return (...args) => {imageDraw = args;};
  return target[key] ?? (() => {});
}, set(target, key, value) {target[key] = value; return true;}});
const renderer = Object.create(Renderer.prototype);
Object.assign(renderer, {ctx, powerUpImages: textures, project() {return {x: 0, y: 0, scale: 1};}});
const coin = new Coin(0, 20); coin.phase = 0;
renderer.drawCoin(coin, 0);
close(coinDiameter, 28 * .84 * 1.5);
for (const type of ['magnet', 'double', 'shield']) {
  renderer.drawPowerUp(new PowerUp(0, 20, type), 0);
  const [, , , w, h] = imageDraw;
  close(Math.max(w, h) / coinDiameter, 2.5);
  close(Math.max(w, h) / (coinDiameter * 1.25), 2);
  close(w / h, textures[type].naturalWidth / textures[type].naturalHeight);
}
renderer.drawPowerUp(new PowerUp(0, 20, 'dash'), 0);
close(powerUpDiameter / coinDiameter, 2.5);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const menu = html.match(/<section id="menuScreen"[\s\S]*?<\/section>/)[0];
assert.ok(menu.includes('<h1>森林极速跑</h1>'));
assert.ok(!/原创森林跑酷|menu-copy|换道、腾跃、滑铲/.test(menu), 'Menu title area should contain only the title');
const hudElements = {};
sandbox.document = {getElementById(id) {return hudElements[id] ??= {};}};
const hudGame = Object.create(Game.prototype);
Object.assign(hudGame, {player: new Player(), distance: 123, score: 456, coinCount: 7});
for (const [time, text] of [[0, '0 s/180s'], [.9, '0 s/180s'], [179.99, '179 s/180s'], [180, '180 s/180s'], [181, '180 s/180s']]) {
  hudGame.survivalTime = time; hudGame.updateHUD(); assert.equal(hudElements.timeValue.textContent, text);
}
assert.equal(hudElements.powerStatus.innerHTML, '', 'Time is a metric row, not a duplicate countdown pill');
assert.equal((html.match(/<strong id="(?:distance|score|coin|time)Value"/g) || []).length, 4);
assert.ok(!/AudioManager|AudioContext|this\.audio|STORAGE_SOUND/.test(source));
assert.ok(!/soundButton|音效/.test(html));
for (const match of source.matchAll(/getElementById\("([^\"]+)"\)/g)) assert.ok(html.includes(`id="${match[1]}"`), `Missing DOM id ${match[1]}`);
console.log('PASS: silence, unchanged forward speed, 0.7s jump/slide durations, 0.25s vertical interval, independent 0.1s lane cooldown / unchanged 0.25s lane motion, both walls three-hit limit/reset, independent stun, four-row HUD timer, obstacle clearance, collisions, coin route, assets and size ratios.');
console.log('Initial speed:', CONFIG.BASE_SPEED, 'Action:', CONFIG.ACTION_DURATION, 'Vertical interval:', CONFIG.ACTION_SWITCH_MIN, 'Lane interval:', CONFIG.LANE_SWITCH_MIN);
console.log('Textures:', textures);
