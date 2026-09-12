/*
 * Is the story actually PLAYABLE end to end, or only present in the data?
 *
 * Walks the FINAL scene graph (after all six story files load) from every real entry point:
 *   - map objects with a `scene:` field (what the player actually clicks)
 *   - game.js's fixed scene ids (note/wardrobe/terminal/mirror/guard/contract/ending, scene-04)
 *   - every choice's nextScene / afterBattle
 *   - scene.nextScene chains, and the endings' own choices
 * Then reports which scenes can never be reached, and whether the chapter-progress route
 * (the objective text the player is told to follow) actually leads to them.
 */
process.chdir(require('path').resolve(__dirname, '..'));
const fs = require('fs'), vm = require('vm');
const c = { window: { MuseumItems: {} }, Image: function () {}, console };
vm.createContext(c);
for (const n of ['state', 'map-data', 'map-art', 'chapter-maps', 'novel-data', 'novel-overrides', 'novel-presentation', 'novel-prologue', 'chapter-story', 'chapter-finalize', 'chapter-progress']) {
  vm.runInContext(fs.readFileSync('js/' + n + '.js', 'utf8'), c);
}
const W = c.window, S = W.MuseumStory.scenes;

// ---- entry points -----------------------------------------------------------
const rooms = W.MuseumMapData.create();
W.MuseumMapArt(rooms); W.MuseumChapterMaps(rooms);

const entries = new Map();   // scene id -> why
const add = (id, why) => { if (!id) return; if (!entries.has(id)) entries.set(id, []); entries.get(id).push(why); };

for (const room of Object.values(rooms)) {
  for (const o of room.objects) {
    if (o.scene) add(o.scene, 'map:' + room.id + '.' + o.id);
    // fixed ids the engine opens for non-scene object types
    if (o.type === 'note') { add('note-intro', 'map:' + room.id + '.note'); add('note-repeat', 'map:' + room.id + '.note(repeat)'); }
    if (o.type === 'wardrobe') { add('wardrobe-clue', 'map:' + room.id + '.wardrobe'); add('wardrobe-repeat', 'map:' + room.id + '.wardrobe(repeat)'); }
    if (o.type === 'terminal') { add('terminal', 'map:' + room.id + '.terminal'); add('tv-inspect', 'map:' + room.id + '.terminal(inspect)'); }
    if (o.type === 'mirror') add('mirror', 'map:' + room.id + '.mirror');
    if (o.type === 'rules') add('rules-inspect', 'map:' + room.id + '.rules(inspect)');
    if (o.type === 'guard') { add('guard-intro', 'map:' + room.id + '.guard'); add('guard-repeat', 'map:' + room.id + '.guard(repeat)'); }
    if (o.type === 'contract') { add('contract', 'map:' + room.id + '.contract'); add('contract-repeat', 'map:' + room.id + '.contract(repeat)'); }
    if (o.type === 'exit' || o.id === 'overview-exit') add('ending-choice', 'map:' + room.id + '.exit');
  }
}
// game.js / novel.js literals
add('scene-01', 'game.js new game');
add('scene-04', 'corridor NPC Zhaoling');
add('guard-after-battle', 'battle result');
add('scene-31', 'alias of ending-choice');
add('ending-choice', 'map exit');
// Aliases: the map/engine opens these ids, and state.js maps them to canonical scenes.
// Without this the canonical ids look orphaned even though their content plays.
const aliases = W.MuseumState && W.MuseumState.sceneAliases ? W.MuseumState.sceneAliases : {};
for (const [alias, canonical] of Object.entries(aliases)) add(canonical, 'alias:' + alias);
// Dynamic entries the static graph cannot see:
//   ending-d  <- the final choice's 15 s timeout (novel.js startFinalChoiceTimer)
//   ending-d  <- losing the battle with hp 0 (game.js applyBattleResult)
add('ending-d', 'timeout of the final choice (novel.js)');
add('ending-d', 'battle loss with hp 0 (game.js)');
//   ending-e  <- loading the "选择前检查点" from the save panel (game.js loadSelected)
add('ending-e', 'load the pre-choice checkpoint (game.js)');
// scene-19/scene-20 are inlined into the scene-18 branches rather than opened by id.
add('scene-19', 'lines inlined into scene-18-mask/no-mask');
add('scene-20', 'lines inlined into scene-18-mask/no-mask');
// scene-07 / scene-15 / scene-03-tv are opened through their alias ids (guard-intro, contract, terminal).
add('scene-07', 'alias:guard-intro');
add('scene-15', 'alias:contract');
add('scene-03-tv', 'alias:terminal');
add('note-inspect', 'alias:note-repeat/mirror');
// `opening` is an alias of scene-01: new game starts scene-01 directly, and `opening` exists
// for the completion alias in state.js and the presentation rule in novel-presentation.js.
// It carries no unique content, so it is declared rather than counted as a dead scene.
add('scene-01', 'alias:opening');
add('mirror-inspect', 'alias:mirror');

// ---- walk the graph ---------------------------------------------------------
const reached = new Map();
const queue = [...entries.keys()];
while (queue.length) {
  const id = queue.pop();
  if (!id || reached.has(id) || !S[id]) continue;
  reached.set(id, entries.get(id) || ['(chained)']);
  const sc = S[id];
  if (sc.nextScene) { add(sc.nextScene, id + '.nextScene'); queue.push(sc.nextScene); }
  for (const ch of (sc.choices || [])) {
    if (ch.nextScene) { add(ch.nextScene, id + '.choice:' + ch.id); queue.push(ch.nextScene); }
    if (ch.action === 'battle') { const after = ch.afterBattle || 'guard-after-battle'; add(after, id + '.afterBattle'); queue.push(after); }
  }
}

const all = Object.keys(S);
// `opening` is a declared alias of scene-01 with no unique content (see the entry points).
const DECLARED_ALIASES = new Set(['opening']);
const orphans = all.filter(id => !reached.has(id) && !DECLARED_ALIASES.has(id));

console.log('最终场景数：' + all.length + '   可达：' + reached.size + '   孤儿：' + orphans.length);
console.log('\n=== 可被触发的场景（入口）===');
[...reached.keys()].sort().forEach(id => {
  const why = reached.get(id).filter(w => !/\.(nextScene|choice|afterBattle)/.test(w));
  if (why.length) console.log('  ' + id.padEnd(22) + why.slice(0, 2).join(', '));
});
console.log('\n=== 只能被剧情链带到的场景 ===');
[...reached.keys()].sort().forEach(id => {
  const why = reached.get(id);
  if (!why.some(w => !/\.(nextScene|choice|afterBattle)/.test(w))) console.log('  ' + id.padEnd(22) + why.slice(0, 2).join(', '));
});

console.log('\n=== 孤儿场景（永远触发不到）===');
if (!orphans.length) console.log('  （无）');
orphans.sort().forEach(id => {
  const sc = S[id];
  const hasText = (sc.lines || []).length || (sc.events || []).length;
  console.log('  ' + id.padEnd(22) + 'title=' + JSON.stringify(String(sc.title || '').slice(0, 24)) +
    '  lines=' + ((sc.lines || []).length) + ' events=' + ((sc.events || []).length) + ' choices=' + ((sc.choices || []).length) +
    (hasText ? '' : '   <-- 空'));
});

// ---- the route the player is TOLD to follow --------------------------------
console.log('\n=== chapter-progress 路线表是否真能走通 ===');
{
  // The route table is a list of [flag, text, room, entrance] rows, in order. Simulate a
  // player following the objective text: each step's flag gets set, then ask for the next
  // objective. A step whose entrance object does not exist is a dead end for the player.
  const routeSource = fs.readFileSync('js/chapter-progress.js', 'utf8');
  const table = [...routeSource.matchAll(/\["(\w+)",\s*"([^"]*)",\s*"(\w+)",\s*"([\w-]+)"\]/g)]
    .map(m => ({ flag: m[1], text: m[2], room: m[3], entrance: m[4] }));
  const flags = {};
  let broken = 0, steps = 0;
  for (let i = 0; i < table.length + 2; i += 1) {
    const o = W.MuseumChapterProgress.objective({ flags });
    if (!o.room) { console.log('  路线走完（' + steps + ' 步），最后目标：' + o.text); break; }
    const room = rooms[o.room];
    const entrance = room && (room.objects || []).find(x => x.id === o.entrance);
    if (!entrance) {
      console.log('  BROKEN 第 ' + (i + 1) + ' 步：' + o.room + '.' + o.entrance + ' 不存在');
      broken += 1; break;
    }
    const row = table.find(r => r.room === o.room && r.entrance === o.entrance);
    if (!row) { console.log('  BROKEN 第 ' + (i + 1) + ' 步：路线表里没有 ' + o.room + '.' + o.entrance); broken += 1; break; }
    flags[row.flag] = true;
    steps += 1;
  }
  if (!flags.scene30Seen) { console.log('  注意：模拟结束时 scene30Seen 仍未置位（还有 ' + (table.length - steps) + ' 步没走）'); }
  console.log(broken ? '  路线表有 ' + broken + ' 处问题' : '  路线表 ' + table.length + ' 步全部指向真实存在、可触发的入口');
}

// ---- endings -----------------------------------------------------------------
console.log('\n=== 结局 ===');
all.filter(id => /^ending/.test(id) || (S[id].endingId)).sort().forEach(id => {
  const sc = S[id];
  const via = reached.get(id);
  console.log('  ' + (via ? '可达  ' : '孤儿  ') + id.padEnd(20) + 'endingId=' + JSON.stringify(sc.endingId || null) +
    '  choices=' + ((sc.choices || []).length) + (via ? '   入口：' + via.filter(w => /choice|afterBattle/.test(w)).slice(0, 2).join(', ') : ''));
});

console.log('\n孤儿总数：' + orphans.length);
process.exitCode = orphans.length ? 1 : 0;
