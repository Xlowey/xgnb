/* Suspended battle saves and reward transactions must preserve the same state. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const storage = new Map();
const runtime = vm.createContext({
  window: {}, console,
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  document: { addEventListener() {}, querySelectorAll() { return []; } }
});
for (const name of ['state', 'achievements-data', 'achievements', 'points']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8'), runtime);
}
const { MuseumState: S, MuseumPoints: P, MuseumAchievements: A } = runtime.window;

const fighting = S.create({ id: 'battle-restore' });
fighting.mode = 'battle'; fighting.narrativeNode = 'scene-28';
fighting.battleContext = 'final-boss'; fighting.returnScene = 'scene-28';
fighting.battleAttempt = { id: 'attempt-1', source: 'pixel-dungeon', retryScene: 'scene-27', retryIndex: 3, returnScene: 'scene-28' };
fighting.lastBattleResultId = 'attempt-0';
S.saveSlot(fighting, fighting.userId, 0);
for (const loaded of [S.load(fighting.userId), S.loadSlot(fighting.userId, 0)]) {
  assert.equal(loaded.mode, 'battle');
  assert.equal(loaded.battleAttempt.id, 'attempt-1');
  assert.equal(loaded.battleAttempt.retryIndex, 3);
  assert.equal(loaded.returnScene, 'scene-28');
  assert.equal(loaded.lastBattleResultId, 'attempt-0');
}
fighting.battleAttempt = null;
S.save(fighting, fighting.userId);
assert.equal(S.load(fighting.userId).mode, 'battle');
fighting.returnScene = null;
S.save(fighting, fighting.userId);
assert.equal(S.load(fighting.userId).mode, 'explore');
console.log('PASS battle saves retain retry/return contracts; unusable legacy snapshots recover safely');

// Preview return settlement occurs before Points.bind. It must not lose rewards.
const preview = S.create({ id: 'class-preview' });
assert(A.unlock(preview, 'first-battle', { save() {}, notify: false }));
assert.equal(preview.points, 260);
assert.equal(preview.pointsLog[0].delta, 20);
console.log('PASS rewards issued before UI binding are retained on the intended state');

const active = S.create({ id: 'active' });
let pointsSaves = 0, achievementSaves = 0;
P.bind({ getState: () => active, save: () => pointsSaves++ });
A.bind({ getState: () => active, save: () => achievementSaves++ });
const other = S.create({ id: 'other' });
assert(A.unlock(other, 'rules-reader', { save() {}, notify: false }));
assert.equal(active.points, 240);
assert.equal(other.points, 260);
assert.equal(pointsSaves + achievementSaves, 0);
console.log('PASS another snapshot cannot credit money to the currently bound account');

assert(A.unlock(active, 'mask-off', { save() {}, notify: false }));
assert.equal(active.points, 260);
assert.equal(pointsSaves + achievementSaves, 0);
assert(A.unlock(active, 'rules-reader', { notify: false }));
assert.equal(pointsSaves, 0);
assert.equal(achievementSaves, 1);
assert.equal(active.points, 280);
assert.equal(A.unlock(active, 'rules-reader', { notify: false }), false);
assert.equal(active.points, 280);
console.log('PASS batch rewards defer saving; ordinary unlock saves once and cannot pay twice');
