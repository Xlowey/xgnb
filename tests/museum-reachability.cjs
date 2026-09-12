/*
 * Museum overview reachability, computed with the SHIPPING collision rule.
 *
 * Asserts what the player actually needs:
 *   1. the spawn is free;
 *   2. every marker can be walked to (some reachable point lies inside its radius);
 *   3. the free space is ONE connected region (no islands);
 *   4. no marker is left in a pocket narrower than the collision disc, which is what made
 *      the old geometry feel like "the roads are not walkable";
 *   5. no marker sits under a collider.
 *
 * Also prints the passage width at every marker so a regression that pinches a corridor is
 * visible as a number, not just a failure.
 */
process.chdir(require('path').resolve(__dirname, '..'));
const fs = require('fs'), vm = require('vm');
const c = { window: { MuseumItems: {} }, Image: function () {}, console };
vm.createContext(c);
for (const n of ['map-data', 'map-art', 'chapter-maps']) vm.runInContext(fs.readFileSync('js/' + n + '.js', 'utf8'), c);
const rooms = c.window.MuseumMapData.create();
c.window.MuseumMapArt(rooms); c.window.MuseumChapterMaps(rooms);
const m = rooms.museum;
const R = 10;                       // game.js uses 10 in the museum
const DISC = 2 * R;

const inside = (x, y) => m.walkable.some(a => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h);
const blocked = (x, y) => {
  if (x < R || y < R || x > m.width - R || y > m.height - R) return true;
  if (![[x - R, y], [x + R, y], [x, y - R], [x, y + R]].every(p => inside(p[0], p[1]))) return true;
  return (m.colliders || []).some(r => x + R > r.x && x - R < r.x + r.w && y + R > r.y && y - R < r.y + r.h);
};

let fails = 0;
const check = (l, ok, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + l + (ok || d === undefined ? '' : '  <- ' + JSON.stringify(d))); if (!ok) fails += 1; };

// 1. spawn
check('出生点可以站立', !blocked(m.spawn.x, m.spawn.y), { spawn: [m.spawn.x, m.spawn.y] });

// Flood fill the free space on an INTEGER grid, so the reachable set and the free set are
// built by the same iteration and can be compared directly.
const STEP = 4;
const key = (x, y) => x + ',' + y;
const startX = Math.round(m.spawn.x / STEP) * STEP;
const startY = Math.round(m.spawn.y / STEP) * STEP;
const seen = new Set([key(startX, startY)]);
const q = [[startX, startY]];
let freeCells = 0;
const grid = [];
for (let x = 0; x <= m.width; x += STEP) {
  for (let y = 0; y <= m.height; y += STEP) {
    if (blocked(x, y)) continue;
    freeCells += 1;
    grid.push([x, y]);
  }
}
while (q.length) {
  const [x, y] = q.pop();
  for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx > m.width || ny > m.height) continue;
    const k = key(nx, ny);
    if (seen.has(k) || blocked(nx, ny)) continue;
    seen.add(k); q.push([nx, ny]);
  }
}
console.log('\n可走格：' + seen.size + ' / ' + freeCells + '（采样步长 ' + STEP + 'px）');

// 2 + 4. every marker reachable and not pinched
console.log('\n标记                    最近可达点      距离    需要    通道宽(横/纵)');
let unreachable = 0, pinched = 0;
for (const o of m.objects) {
  let best = null;
  for (const k of seen) {
    const [x, y] = k.split(',').map(Number);
    const d = Math.hypot(x - o.x, y - o.y);
    if (!best || d < best.d) best = { x, y, d };
  }
  const ok = best && best.d < o.r;
  if (!ok) unreachable += 1;
  // The prompt only appears when the player can STAND near the marker (the museum also
  // requires the disc to reach the marker without crossing a wall), so record the best
  // STANDING spot inside the radius, not merely the nearest reachable sample.
  let stand = null;
  for (const k of seen) {
    const [x, y] = k.split(',').map(Number);
    const d = Math.hypot(x - o.x, y - o.y);
    if (d < o.r && (!stand || d < stand.d)) stand = { x, y, d };
  }
  if (!stand) unreachable += 1;
  // Passage width: the full extent of the free corridor through the marker, walking out
  // until a wall (or the walkable region's own edge) stops the disc. Stepping outward from
  // the centre and counting is NOT the width — the disc is centred anywhere in the band, so
  // the real width is where the band ends on each side.
  const extent = (dx, dy) => {
    let n = 0;
    while (n < 400) {
      const nx = o.x + dx * (n + 2), ny = o.y + dy * (n + 2);
      if (nx < 0 || ny < 0 || nx > m.width || ny > m.height) break;
      // Count the band's own edge as the limit, not the disc's inability to centre there.
      if (!inside(nx, ny)) break;
      n += 2;
    }
    return n;
  };
  const hw = extent(-1, 0) + extent(1, 0);
  const vw = extent(0, -1) + extent(0, 1);
  const wide = Math.max(hw, vw);
  const isPinched = wide < DISC + 8;
  if (isPinched) pinched += 1;
  console.log('  ' + (stand ? 'ok   ' : 'BLOCKED') + ' ' + (isPinched ? '窄 ' : '   ') + o.id.padEnd(22) +
    (stand ? '(' + stand.x + ',' + stand.y + ')' : 'none').padEnd(15) + (stand ? stand.d.toFixed(1) : '-').padStart(7) + '   <' + String(o.r).padEnd(5) +
    hw + '/' + vw + 'px');
}
check('所有标记都能走到', unreachable === 0, { unreachable, total: m.objects.length });
check('没有标记被夹在放不下碰撞圆的窄缝里', pinched === 0, { pinched });

// 3. one connected region: no free cell may sit outside the reachable set.
let islands = 0;
for (const [x, y] of grid) if (!seen.has(key(x, y))) islands += 1;
check('可走区域是一个连通整体（没有孤岛）', islands === 0, { islands, freeCells, reachable: seen.size });

// 5. no marker under a collider
const under = m.objects.filter(o => (m.colliders || []).some(r => o.x > r.x && o.x < r.x + r.w && o.y > r.y && o.y < r.y + r.h));
check('没有标记被压在碰撞体下面', under.length === 0, under.map(o => o.id));

console.log('\n可走区占全图：' + (100 * seen.size * STEP * STEP / (m.width * m.height)).toFixed(1) + '%');
console.log('碰撞圆直径 ' + DISC + 'px；上下通道至少需要 ' + (DISC + 8) + 'px 才能通过。');
console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
process.exitCode = fails ? 1 : 0;
