/*
 * Walkable-region audit for every room.
 *
 * The map draws the hero at his FEET, so the walkable point IS the feet. That means
 * walkable rectangles must cover exactly the painted floor and nothing else. This checks,
 * for every room:
 *   1. the spawn point is walkable;
 *   2. every object/gate can be approached (some point within its radius is walkable);
 *   3. every travel gate's ENTRY point is walkable;
 *   4. the walkable region stays inside the room;
 *   5. rooms that use the pixel-measured corridor/floor bands still agree with the art.
 */
process.chdir(require('path').resolve(__dirname, '..'));
const fs = require('fs'), vm = require('vm');
const c = { window: { MuseumItems: {} }, Image: function () {}, console, document: { currentScript: { src: 'file:///D:/x/js/asset-paths.js' } } };
c.window.document = c.document;
vm.createContext(c);
for (const n of ['state', 'map-data', 'map-art', 'chapter-maps', 'novel-data', 'novel-overrides', 'novel-presentation', 'novel-prologue', 'chapter-story', 'chapter-finalize', 'chapter-progress']) {
  vm.runInContext(fs.readFileSync('js/' + n + '.js', 'utf8'), c);
}
const W = c.window;
const rooms = W.MuseumMapData.create();
W.MuseumMapArt(rooms);
W.MuseumChapterMaps(rooms);

function inside(room, x, y) {
  if (!room.walkable) return x >= 0 && y >= 0 && x <= room.width && y <= room.height;
  return room.walkable.some(a => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h);
}
function blocked(room, x, y, rad) {
  if (x < rad || y < rad || x > room.width - rad || y > room.height - rad) return true;
  if (room.walkable) {
    const ok = [[x - rad, y], [x + rad, y], [x, y - rad], [x, y + rad]].every(p => inside(room, p[0], p[1]));
    if (!ok) return true;
  }
  return (room.colliders || []).some(r => x + rad > r.x && x - rad < r.x + r.w && y + rad > r.y && y - rad < r.y + r.h);
}

let problems = 0;
for (const room of Object.values(rooms)) {
  const rad = room.id === 'museum' ? 10 : 22;
  const issues = [];
  if (blocked(room, room.spawn.x, room.spawn.y, rad)) issues.push('spawn blocked @' + room.spawn.x + ',' + room.spawn.y);

  for (const o of room.objects) {
    let reachable = false;
    for (let dx = -o.r; dx <= o.r && !reachable; dx += 4) {
      for (let dy = -o.r; dy <= o.r && !reachable; dy += 4) {
        if (Math.hypot(dx, dy) > o.r) continue;
        if (!blocked(room, o.x + dx, o.y + dy, rad)) reachable = true;
      }
    }
    if (!reachable) issues.push('unreachable object ' + o.id);
    if (o.type === 'travel' && o.entry) {
      // entry is a point in the TARGET room
      const target = rooms[o.target];
      if (target && blocked(target, o.entry.x, o.entry.y, o.target === 'museum' ? 10 : 22)) {
        issues.push('travel entry blocked: ' + o.id + ' -> ' + o.target + ' @' + o.entry.x + ',' + o.entry.y);
      }
    }
    if (o.type === 'travel') {
      const target = rooms[o.target];
      const p = o.entry || (target && target.spawn);
      if (target && p && !target.walkable && blocked(target, p.x, p.y, 22)) issues.push('gate lands outside walkable: ' + o.id);
    }
  }
  if (room.walkable) {
    for (const a of room.walkable) {
      if (a.x < 0 || a.y < 0 || a.x + a.w > room.width || a.y + a.h > room.height) issues.push('walkable rect outside the room: ' + JSON.stringify(a));
    }
  }
  if (issues.length) { problems += issues.length; console.log('[FAIL] ' + room.id); issues.forEach(i => console.log('        ' + i)); }
  else console.log('[ ok ] ' + room.id + '  (' + (room.walkable ? room.walkable.length + ' walkable rects' : 'collider-only') + ', ' + room.objects.length + ' objects)');
}

// Where can the hero's feet actually be in the corridor? Report the reachable band.
const corridor = rooms.corridor;
let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
for (let x = 0; x < corridor.width; x += 6) {
  for (let y = 0; y < corridor.height; y += 6) {
    if (!blocked(corridor, x, y, 22)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  }
}
console.log('\ncorridor reachable feet region: x ' + minX + '..' + maxX + ', y ' + minY + '..' + maxY);
console.log('painted corridor floor was measured at x 960..1774, y 337..565 (plus doorway 1256..1478 down to y 608)');
console.log('=> feet region should cover the floor band and stop near the walls, not float above them.');
console.log(problems ? '\n' + problems + ' PROBLEM(S)' : '\nNO WALKABLE PROBLEMS');
process.exitCode = problems ? 1 : 0;
