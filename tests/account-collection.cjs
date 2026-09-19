const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const storage = new Map();
let rejectCollection = false;
function runtime() {
  const context = vm.createContext({ window: {}, console, localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => { if (rejectCollection && key.startsWith('museum_collection_')) throw Error('quota'); storage.set(key, value); },
    removeItem: key => storage.delete(key)
  }});
  vm.runInContext(fs.readFileSync(path.join(root, 'js/state.js'), 'utf8'), context);
  return context.window.MuseumState;
}
const user = { id: 'collector', username: '测试' };
let api = runtime();
const initial = api.create(user);
api.saveSlot(initial, user.id, 0);
api.saveCheckpoint(initial, user.id, {});
const earned = api.loadSlot(user.id, 0);
earned.achievements.push('first-step');
earned.achievementRecords['first-step'] = { progress: 1, unlockedAt: '2026-09-18T00:00:00Z' };
earned.endingHistory.push('ending-a');
earned.points = 999;
earned.inventory.push('test-item');
api.save(earned, user.id);
for (const loaded of [api.loadSlot(user.id, 0), api.loadCheckpoint(user.id), api.create(user)]) {
  assert(loaded.achievements.includes('first-step'));
  assert(loaded.endingHistory.includes('ending-a'));
  assert.equal(loaded.points, 240);
  assert(!loaded.inventory.includes('test-item'));
  assert.equal(loaded.ending, null);
}
console.log('PASS old slots/checkpoints/new games preserve collection without changing gameplay state');
for (const ending of ['b', 'c', 'd', 'e']) {
  const branch = api.loadSlot(user.id, 0);
  branch.endingHistory.push('ending-' + ending);
  api.save(branch, user.id);
}
api = runtime();
const complete = api.loadSlot(user.id, 0);
assert.equal(complete.endingHistory.length, 5);
assert(complete.achievements.includes('ending-collector'));
assert.equal(complete.achievementRecords['ending-collector'].progress, 4);
assert.equal(api.create({ id: 'other' }).endingHistory.length, 0);
assert.equal(api.create({ id: 'class-preview' }).endingHistory.length, 0);
console.log('PASS legacy endings remain recorded; four playable endings count across reloads');
const legacyE = api.create({ id: 'legacy-e' });
legacyE.endingHistory = ['ending-a', 'ending-b', 'ending-c', 'ending-e'];
legacyE.achievementRecords['ending-collector'] = { progress: 4 };
api.save(legacyE, 'legacy-e');
assert.equal(api.collectedEndingCount(legacyE), 3);
assert.equal(legacyE.achievementRecords['ending-collector'].progress, 3);
assert(!legacyE.achievements.includes('ending-collector'));
assert(legacyE.endingHistory.includes('ending-e'));
legacyE.endingHistory.push('ending-d');
api.save(legacyE, 'legacy-e');
assert(legacyE.achievements.includes('ending-collector'));
console.log('PASS old E does not substitute for missing D or block the collectible achievement');
// Pre-feature saves: recover from slots even when auto-save is an earlier branch.
storage.set('museum_save_v5_slots_legacy', JSON.stringify([{ state: {
  achievements: ['rules-reader'], endingHistory: ['ending-c'],
  flags: { 'completed:scene-08-b': true, 'completed:scene-15-diary': true }
}}]));
api = runtime();
const migrated = api.create({ id: 'legacy' });
for (const id of ['rules-reader', 'director-talk', 'diary-reader']) assert(migrated.achievements.includes(id));
assert(migrated.endingHistory.includes('ending-c'));
assert.equal(migrated.points, 240);
api.clear('legacy');
assert(api.create({ id: 'legacy' }).achievements.includes('rules-reader'));
console.log('PASS legacy slot migration repairs missed achievements without re-awarding money');
const failure = api.create({ id: 'failure' });
failure.achievements.push('first-step');
rejectCollection = true;
assert(api.save(failure, 'failure'));
assert(storage.has('museum_save_v5_auto_failure'));
rejectCollection = false;
api = runtime();
assert(api.load('failure').achievements.includes('first-step'));
console.log('PASS successful primary save recovers collection after an auxiliary write failure');
