/*
 * Fast static equivalent of the rendered-text residue scan.
 *
 * Loads the story stack in a vm exactly like pages/novel.html does, then reproduces
 * novel.js's buildPages() to check the text a player would actually see. This is the
 * authoritative check for "authoring notes reaching the player" because the visible text
 * comes from `events` (dialogue/system/incident) plus whatever survives in `lines`.
 */
process.chdir(require('path').resolve(__dirname, '..'));
const fs = require('fs'), vm = require('vm');
const c = { window: { MuseumItems: {} }, Image: function () {}, console, document: { currentScript: { src: 'file:///D:/x/js/asset-paths.js' } } };
c.window.document = c.document;
vm.createContext(c);
for (const n of ['state', 'map-data', 'map-art', 'chapter-maps', 'novel-data', 'novel-overrides', 'novel-presentation', 'novel-prologue', 'chapter-story', 'chapter-finalize', 'chapter-progress']) {
  vm.runInContext(fs.readFileSync('js/' + n + '.js', 'utf8'), c);
}
const S = c.window.MuseumStory.scenes;

// novel.js: visible text is `events` entries' text, else `lines` (with △ lines dropped).
const RESIDUE = /（设计分支）|（配一个CG|A摘下|B没摘|玩家可选择|分支选择|若不拿下|待更新|待定|TODO|FIXME|△|（.*？）/;
const SPECIFIC = /（设计分支）|（配一个CG|A摘下|B没摘|玩家可选择|分支选择|若不拿下|待更新|待定|TODO|FIXME/;

const offenders = [];
const empty = [];
for (const [id, scene] of Object.entries(S)) {
  const pages = [];
  if (scene.events && scene.events.length) {
    for (const ev of scene.events) {
      const t = String(ev.text || '').trim();
      if (t) pages.push({ kind: ev.type, text: t });
    }
  } else {
    for (const line of (scene.lines || [])) {
      const t = String(line.text || '').trim();
      if (!t || /^[△▲▼▽]/.test(t)) continue;           // novel-presentation deletes these
      pages.push({ kind: 'dialogue', text: t, speaker: line.speaker });
    }
  }
  // A scene whose events produce no TEXT is not empty: item/document/cg/television events
  // render panels and images through the stage, which this static check cannot see. Only a
  // scene with no events at all AND no lines AND no choices is genuinely blank.
  var hasAnyEvent = (scene.events || []).length > 0;
  if (!pages.length && !hasAnyEvent && !(scene.choices || []).length) empty.push(id);
  const bad = pages.filter(p => SPECIFIC.test(p.text) || SPECIFIC.test(p.speaker || ''));
  if (bad.length) offenders.push({ id, pages: pages.length, samples: bad.slice(0, 3) });
}

console.log('scenes in the final graph: ' + Object.keys(S).length);
console.log('\n=== authoring residue that would reach the player ===');
if (!offenders.length) console.log('  (none)');
for (const o of offenders) {
  console.log('  ' + o.id + '  (' + o.pages + ' visible pages)');
  o.samples.forEach(s => console.log('      [' + s.kind + '] ' + JSON.stringify((s.speaker ? s.speaker + '：' : '') + s.text.slice(0, 120))));
}

console.log('\n=== scenes with no visible page and no choice (would render an empty box) ===');
if (!empty.length) console.log('  (none)');
else empty.forEach(id => console.log('  ' + id + '  title=' + JSON.stringify((S[id].title || '').slice(0, 40))));

console.log('\ntotal residue scenes: ' + offenders.length + '   empty scenes: ' + empty.length);
process.exitCode = (offenders.length || empty.length) ? 1 : 0;
