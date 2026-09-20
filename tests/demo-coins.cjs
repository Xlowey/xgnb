/*
 * 小游戏金币 → 生存点的**实时换算**（js/demo-shell.js 的 earnCoins）。
 *
 * 这是纯逻辑测试，不需要浏览器：把 demo-shell.js 放进 vm，用打桩的主游戏模块驱动它。
 *
 * 踏过的坑都在这里守着：
 *   1. 节流：`lastFlushAt` 初值 0 而 Date.now() 是个巨大的数，直接比大小会**恒真**，
 *      于是第一枚金币就落一次盘，节流形同虚设（2026-09-20 踩过）。
 *   2. 额度：**0 = 不设上限**（2026-09-20 按需求取消封顶）。但封顶的逻辑没有删掉，
 *      只是被关掉了 —— 所以两档都要测，改回一个正数就该生效。
 *   3. 额度记在**存档**里（flags.liveCoinsEarned），不是内存里：记内存的话，
 *      打输重试或刷新页面都能清零重来 → 无限刷。
 *   4. 独立游玩 / 课堂预览必须**完全不动存档**。
 */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/demo-shell.js'), 'utf8');

let fails = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : '  <- ' + JSON.stringify(detail)));
  if (!ok) fails += 1;
};

// 起一个沙箱：stub 掉主游戏的模块，记录每一次 MuseumPoints.add。
// sharedState 传同一个对象就模拟"同一份存档、重新打开页面"。
// cap 模拟 js/shop-data.js 的 COIN_POINT_CAP：0 = 不设上限（当前的生产配置），正数 = 封顶。
function boot(search, sharedState, cap) {
  const added = [];
  const state = sharedState || { points: 0, shopOwned: {}, flags: {} };
  const coinCap = cap === undefined ? 0 : cap;
  const doc = {
    currentScript: { src: 'file:///x/js/demo-shell.js' }, addEventListener() {}, hidden: false,
    getElementById: () => null, querySelectorAll: () => [], body: { appendChild() {} },
  };
  const win = {
    addEventListener() {}, document: doc, location: { search },
    URLSearchParams, URL,
    console, Math, Object, Array, Number, String, JSON, Boolean, isFinite, NaN, undefined, Date,
    MuseumState: { load: () => state, save: () => 'ok' },
    MuseumPoints: { bind() {}, add: (n, s) => { added.push({ n, s }); }, balance: () => 100, spend: () => true, notice() {}, penalize() {}, refresh() {} },
    MuseumHumanity: { bind() {}, heal() {}, damage() {}, value: () => 100, MAX: 100, settle() {}, notice() {} },
    MuseumShop: { bind() {}, unmount() {}, mount() {}, count: () => 0 },
    MuseumShopData: { runnerParams: () => '', COIN_PER_POINT: 1, COIN_POINT_CAP: coinCap },
    MuseumPanel: { bind() {}, open() {}, close() {}, isOpen: () => false, refresh() {} },
  };
  win.window = win; win.parent = win; win.document = doc;
  vm.createContext(win);
  vm.runInContext(source, win);
  return { win, added, state };
}

// ---- 从主线进来：实时换算 + 节流 ----
const main = boot('?from=novel&user=u1');
const shell = main.win.MuseumDemoShell;
check('从主线进来时 shell 生效', shell && shell.enabled === true);

let granted = 0;
for (let i = 0; i < 4; i += 1) granted += shell.earnCoins(1, '地牢金币');
check('前 4 枚只换算、不落盘（节流生效）', granted === 4 && main.added.length === 0, { granted, writes: main.added.length });

shell.earnCoins(1, '地牢金币');
check('第 5 枚攒够阈值，一次性落盘 5 点', main.added.length === 1 && main.added[0].n === 5, main.added);

// ---- 当前生产配置：不设上限 ----
for (let i = 0; i < 100; i += 1) shell.earnCoins(1, '地牢金币');
shell.flushCoins();
const uncappedSum = main.added.reduce((s, a) => s + a.n, 0);
check('不设上限（当前配置）时金币全额到账', uncappedSum === 105, { uncappedSum });
check('换算过就立标记，结算端不会再换一次', main.win.__liveCoinsGranted === true);

// ---- 封顶逻辑本身仍可用：把上限配成 40 就该生效 ----
const cappedState = { points: 0, shopOwned: {}, flags: {} };
const capped = boot('?from=novel&user=u1', cappedState, 40);
for (let i = 0; i < 100; i += 1) capped.win.MuseumDemoShell.earnCoins(1, '地牢金币');
capped.win.MuseumDemoShell.flushCoins();
const cappedSum = capped.added.reduce((s, a) => s + a.n, 0);
check('把上限配成 40 时照旧封顶（逻辑没删，只是关了）', cappedSum === 40, { cappedSum });

// ---- 额度必须跟着存档走，不能是内存计数器 ----
// 洞：打输了重试一次就重新发一份；刷新页面也能清零重来。两者都能无限刷钱。
const retry = boot('?from=novel&user=u1', cappedState, 40);
const retryGranted = retry.win.MuseumDemoShell.earnCoins(50, '地牢金币');
check('打输重试（新页面、同一份存档）不会再发额度', retryGranted === 0, { granted: retryGranted });
check('额度确实写进了存档的 flags', cappedState.flags && cappedState.flags.liveCoinsEarned === 40, cappedState.flags);

// ---- 不接面板的三种情况必须完全不动存档 ----
for (const [label, search] of [
  ['独立游玩', ''],
  ['课堂预览（class-preview）', '?from=novel&user=class-preview'],
  ['预览参数 preview=1', '?from=novel&user=u1&preview=1'],
]) {
  const box = boot(search);
  check(label + '：不接面板、不写存档',
    box.win.MuseumDemoShell === undefined && box.added.length === 0,
    { shell: box.win.MuseumDemoShell === undefined ? 'undefined' : '存在', writes: box.added.length });
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
process.exitCode = fails ? 1 : 0;
