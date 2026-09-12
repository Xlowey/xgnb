/*
 * 实现层完整性审查：场景引用的素材是否真的存在、有没有场景缺背景、有没有够不着的物件。
 *
 * 这一项很直观：缺一张背景图，玩家和评委会立刻看到。
 */
process.chdir(require('path').resolve(__dirname, '..'));
const fs = require('fs'), vm = require('vm'), path = require('path');
const c = { window: { MuseumItems: {} }, Image: function () {}, console };
vm.createContext(c);
for (const n of ['state', 'map-data', 'map-art', 'chapter-maps', 'novel-data', 'novel-overrides',
  'novel-presentation', 'novel-prologue', 'chapter-story', 'chapter-finalize', 'chapter-progress']) {
  vm.runInContext(fs.readFileSync('js/' + n + '.js', 'utf8'), c);
}
const W = c.window, S = W.MuseumStory.scenes;

// Build the set of files that actually exist under assets/.
const have = new Set();
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else have.add(e.name);
  }
})('assets');

let fails = 0;
const check = (l, ok, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + l + (ok || d === undefined ? '' : '  <- ' + JSON.stringify(d))); if (!ok) fails += 1; };

// 1. every scene background exists
const missingBg = [];
for (const [id, sc] of Object.entries(S)) {
  if (sc.background && !have.has(sc.background)) missingBg.push({ id, background: sc.background });
}
check('每个场景的背景图都存在', missingBg.length === 0, missingBg.slice(0, 8));

// 2. every image/video referenced by events and hotspots exists
const missingMedia = [];
const collect = (id, obj) => {
  for (const key of ['background', 'video', 'cg', 'portrait', 'image']) {
    const v = obj && obj[key];
    if (typeof v === 'string' && v && /\.(png|jpe?g|gif|webp|svg)$/i.test(v) && !have.has(v)) {
      missingMedia.push({ id, key, file: v });
    }
  }
};
for (const [id, sc] of Object.entries(S)) {
  collect(id, sc);
  for (const e of (sc.events || [])) {
    collect(id, e);
    for (const h of (e.hotspots || [])) collect(id, h);
  }
}
check('事件/调查点引用的图片与录像都存在', missingMedia.length === 0, missingMedia.slice(0, 8));

// 3. every map room art exists
const rooms = W.MuseumMapData.create(); W.MuseumMapArt(rooms); W.MuseumChapterMaps(rooms);
const missingRoomArt = Object.values(rooms).filter(r => r.art && r.art.name && !have.has(r.art.name)).map(r => ({ room: r.id, file: r.art.name }));
check('每个房间的地图素材都存在', missingRoomArt.length === 0, missingRoomArt);

// 4. every scene the story can open exists in the graph (no dangling ids)
const dangling = [];
for (const [id, sc] of Object.entries(S)) {
  for (const ch of (sc.choices || [])) {
    if (ch.nextScene && !S[ch.nextScene]) dangling.push({ from: id, to: ch.nextScene });
    if (ch.afterBattle && !S[ch.afterBattle]) dangling.push({ from: id, to: ch.afterBattle });
  }
  if (sc.nextScene && !S[sc.nextScene]) dangling.push({ from: id, to: sc.nextScene });
}
check('没有指向不存在场次的跳转', dangling.length === 0, dangling);

// 5. every map object that opens a scene names an existing scene
const danglingObjects = [];
for (const room of Object.values(rooms)) {
  for (const o of room.objects) if (o.scene && !S[o.scene]) danglingObjects.push({ room: room.id, object: o.id, scene: o.scene });
}
check('地图物件打开的场次都存在', danglingObjects.length === 0, danglingObjects);

// 6. every scene has either content to show or is an inspection/alias handled by the UI
const blank = [];
for (const [id, sc] of Object.entries(S)) {
  const pages = (sc.lines || []).length || (sc.events || []).length;
  const hasChoices = (sc.choices || []).length;
  if (!pages && !hasChoices) blank.push(id);
}
check('没有既无内容又无选项的场次', blank.length === 0, blank);

// 7. every room's objects are reachable (walkable-audit covers geometry; here check the count)
console.log('\n=== 各房间的物件数 / 地图素材 ===');
Object.values(rooms).forEach(r => {
  console.log('  ' + r.id.padEnd(16) + String(r.objects.length).padStart(3) + ' 物件   ' + (r.art && r.art.name ? r.art.name : '(无素材)'));
});

console.log('\n=== 统计 ===');
console.log('  场景 ' + Object.keys(S).length + '   房间 ' + Object.keys(rooms).length +
  '   场景引用素材 ' + [...new Set(Object.values(S).flatMap(sc => [sc.background].filter(Boolean)))].length + ' 张背景' +
  '   assets 文件 ' + have.size + ' 个');
console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
process.exitCode = fails ? 1 : 0;
