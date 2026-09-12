/*
 * 存档写入保护（多标签页）—— 直接测契约，不靠浏览器标签页调度的巧合。
 *
 * 背景：地图页只在加载时读一次 state，之后每 6 秒和 pagehide 都会把那份快照写回去，
 * 所以停着不动的标签页会覆盖别人更新的进度。js/state.js 用「单调递增的修订号」防这件事。
 *
 * 之前的 tests/save-multi-tab.cjs 依赖后台标签页是否还在跑 rAF、以及 visibilitychange 是否
 * 触发；这两点在无头环境里都不确定（实测后台页每秒仍跑 2161 帧、且不触发 visibilitychange），
 * 于是那个测试会因为写入时序而偶然通过或在别的机器上失败。这里改成直接驱动 API：
 *
 *   1. 空存档时允许写入；
 *   2. 本页的连续写入一直允许（不能把自己锁死）；
 *   3. 存档里有**别处写的、更新的**修订号时，拒绝写入并且不改动存档；
 *   4. 一旦本页看过了那个版本，就又能写了（拒绝不会永久卡住）；
 *   5. 手动档位、检查点不受影响。
 */
process.chdir(require('path').resolve(__dirname, '..'));
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');

function freshStateModule() {
  const store = new Map();
  const sandbox = {
    window: {}, console, Date, Math, JSON, Number, Object, Array, String, Boolean,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: k => { store.delete(k); }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('js/state.js', 'utf8'), sandbox);
  return { S: sandbox.window.MuseumState, store };
}
const autoKey = id => 'museum_save_v5_auto_' + encodeURIComponent(id);
const revKey = id => 'museum_save_rev_v1_' + encodeURIComponent(id);
const guardKey = id => 'museum_save_guard_v1_' + encodeURIComponent(id);
let fails = 0;
const check = (l, ok, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + l + (ok || d === undefined ? '' : '  <- ' + JSON.stringify(d))); if (!ok) fails += 1; };

// The module is a singleton per script load, so simulate "another page" by editing the
// store directly: bump the revision and the guard stamp the way another page's save would.
function otherPageWrites(store, id, snapshot) {
  store.set(autoKey(id), JSON.stringify(snapshot));
  store.set(revKey(id), String(Number(store.get(revKey(id)) || 0) + 1));
  store.set(guardKey(id), JSON.stringify({ writerId: 'w_other_page', revision: Number(store.get(revKey(id))), at: Date.now() }));
}

{
  const { S, store } = freshStateModule();
  const id = 'u1';
  const u = S.create({ id, username: 'a' });

  // 1. empty store -> allowed
  const first = S.saveGuarded(u, id);
  check('空存档时允许写入', Boolean(first), { first: String(first) });
  check('写入后自动档存在', store.has(autoKey(id)), [...store.keys()]);
  check('写入后修订号 >= 1', Number(store.get(revKey(id)) || 0) >= 1, store.get(revKey(id)));

  // 2. this page keeps writing -> never locks itself out
  u.playerX = 500;
  const a = S.saveGuarded(u, id);
  u.playerX = 700;
  const b = S.saveGuarded(u, id);
  u.playerX = 900;
  const c = S.saveGuarded(u, id);
  check('本页连续写入不会被自己锁死', [a, b, c].every(Boolean), { a: String(a), b: String(b), c: String(c) });

  // 3. another page writes newer progress -> this page must refuse and not touch the store
  const before = store.get(autoKey(id));
  const otherSnapshot = JSON.parse(before);
  otherSnapshot.playerX = 1417.6; otherSnapshot.mode = 'novel'; otherSnapshot.narrativeNode = 'scene-04';
  otherPageWrites(store, id, otherSnapshot);
  const otherStore = store.get(autoKey(id));
  u.mode = 'explore'; u.playerX = 835;
  const refused = S.saveGuarded(u, id);
  // "stale" is the deliberate refusal (another page owns a newer save) and is distinct from
  // `false`, which means the write genuinely failed (quota etc.). game.js relies on that
  // difference so it does not tell the player "storage full" when nothing is wrong.
  check('别人写了更新的存档时拒绝覆盖', refused === 'stale', { refused: String(refused) });
  check('被拒绝时没有改动存档', store.get(autoKey(id)) === otherStore, { same: store.get(autoKey(id)) === otherStore });

  // 4. after seeing that version the page can write again (no permanent mute).
  //    This is what game.js does on visibilitychange -> visible: accept the current
  //    revision, then adopt the stored snapshot.
  const adopted = S.load(id);
  check('能读取到别人写的进度', adopted && adopted.mode === 'novel', adopted && adopted.mode);
  S.adoptRevision(id);
  adopted.playerX = 900;
  const afterAdopt = S.saveGuarded(adopted, id);
  check('看过该版本之后可以继续写入（不会永久卡住）', Boolean(afterAdopt), { afterAdopt: String(afterAdopt) });
  check('写入生效', JSON.parse(store.get(autoKey(id))).playerX === 900, JSON.parse(store.get(autoKey(id))).playerX);

  // 5. slots and checkpoint are unaffected
  const slot = S.saveSlot(u, id, 0);
  check('手动档位仍可写入', Boolean(slot), { slot: Boolean(slot) });
  check('手动档位读得回来', Boolean(S.loadSlot(id, 0)), true);
  const cp = S.saveCheckpoint(u, id, { label: '测试' });
  check('检查点仍可写入', Boolean(cp), { cp: Boolean(cp) });
  check('检查点读得回来', Boolean(S.loadCheckpoint(id)), true);

  // 6. clear() removes the guard and revision keys too
  S.clear(id);
  check('clear() 清掉 guard 与修订号', !store.has(guardKey(id)) && !store.has(revKey(id)), [...store.keys()]);
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
process.exitCode = fails ? 1 : 0;
