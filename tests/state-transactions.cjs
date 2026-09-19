/* Account rewards must not commit when their corresponding save fails. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function runtime() {
  const storage = new Map();
  let blockedPrefix = '';
  const context = vm.createContext({ window: {}, console: { warn() {} }, localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => { if (blockedPrefix && key.startsWith(blockedPrefix)) throw Error('quota'); storage.set(key, value); },
    removeItem: key => storage.delete(key)
  }});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/state.js'), 'utf8'), context);
  return { api: context.window.MuseumState, storage, block: prefix => { blockedPrefix = prefix; } };
}
for (const [name, prefix, save] of [
  ['auto', 'museum_save_v5_auto_', (api, state) => api.save(state, state.userId)],
  ['slot', 'museum_save_v5_slots_', (api, state) => api.saveSlot(state, state.userId, 0)],
  ['checkpoint', 'museum_save_v5_checkpoint_', (api, state) => api.saveCheckpoint(state, state.userId, {})]
]) {
  const { api, storage, block } = runtime();
  const state = api.create({ id: name });
  api.save(state, name);
  const key = 'museum_collection_v1_' + name;
  const previous = storage.get(key);
  state.achievements.push('first-battle');
  state.achievementRecords['first-battle'] = { progress: 1, unlockedAt: '2026-09-19T00:00:00Z' };
  state.points += 20;
  state.endingHistory.push('ending-a');
  block(prefix);
  assert(!save(api, state));
  assert.equal(storage.get(key), previous, `${name}: failed save must not pre-commit account rewards`);
  const recovered = api.load(name);
  assert.equal(recovered.points, 240);
  assert(!recovered.achievements.includes('first-battle'));
  console.log(`PASS failed ${name} save leaves account collection unchanged`);
}

{
  const { api, block } = runtime();
  const state = api.create({ id: 'index-recovery' });
  api.saveSlot(state, state.userId, 0);
  state.achievements.push('first-battle'); state.points += 20;
  state.endingHistory.push('ending-a');
  block('museum_collection_');
  assert(api.save(state, state.userId));
  const earlier = api.loadSlot(state.userId, 0);
  assert(earlier.achievements.includes('first-battle'));
  assert(earlier.endingHistory.includes('ending-a'));
  assert.equal(earlier.points, 240);
  console.log('PASS auxiliary write failure preserves collection when loading an old slot immediately');
}
