/*
 * 券机数值复算（012 §6.3 / §6.4）。这不是 UI 测试，是**账目测试**。
 *
 * 012 §6.3 说得很直白：「RTP 不是填出来的，是推出来的」——票面是一堆固定枚数的图案，
 * 洗匀后逐格翻开，哪一种图案的第三枚先出现就按哪一种结算。所以这里不认文档里的
 * 82.4% / 82.8% / 82.6%，而是拿着券机**自己的** getConfig() 重新推一遍，再和 012 对账。
 *
 * 更要紧的是 §6.4 那个漏洞：修之前「抽天赋（3选1取最优）+ 买券」在 60 点档的 RTP 是
 * 140.6%，玩家只要一直玩最贵的券就是在印钞，整个生存点经济会在那一瞬间失效。
 * 这个脚本把两个风险天赋的增量期望算出来，并且分别按**旧值（50%/100%）**和
 * **新值（250%/360%）**算一遍：
 *   - 旧值必须算出大幅为正（012 写 +106.57）—— 证明漏洞是真的
 *   - 新值必须算出微负（012 写 −5.4 / −1.8）—— 证明漏洞确实被修掉了
 *
 * 跑法：node tests/scratch-economy.cjs
 */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/25102/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': body.length });
  res.end(body);
});
let fails = 0;
const check = (label, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || detail === undefined ? '' : '  <- ' + JSON.stringify(detail))); if (!ok) fails += 1; };
const r2 = (n) => Math.round(n * 100) / 100;

// 012 §6.3 公布的实测值（状态空间 DP + 40 万次蒙特卡洛交叉验证）。
const EXPECTED = {
  basic: { price: 10, rtp: 82.6, ev: 8.26, none: 55.0 },
  night: { price: 30, rtp: 82.8, ev: 24.84, none: 60.3 },
  curator: { price: 60, rtp: 82.4, ev: 49.42, none: 69.5 }
};

// 逐格翻开、谁先凑满三枚就结算在谁身上。012 管这叫「赛跑」问题，没有闭式解，
// 只能按状态空间逐格递推 —— 所以这里用**精确 DP**，不是模拟。
//
// 用模拟的话误差会顺着公式放大：增量期望里有 `3 × 期望回收` 这一项，回收的估计差 0.3，
// 增量就跟着差 0.9，一个本来 −1.8 的数会算成 −0.5，看着像坏了其实只是噪声。
// 状态是"每种图案已翻开几枚（上限 2）"，馆长珍藏券 7 种图案 → 3^7 = 2187 个状态。
function settleDistribution(tier) {
  const symbols = Object.keys(tier.symbolCounts);
  const total = symbols.reduce((sum, id) => sum + tier.symbolCounts[id], 0);
  const memo = new Map();
  function rec(counts, remaining) {
    const key = counts.join(',') + '|' + remaining;
    const cached = memo.get(key);
    if (cached) return cached;
    const out = symbols.map(() => 0);
    for (let i = 0; i < symbols.length; i += 1) {
      const left = tier.symbolCounts[symbols[i]] - counts[i];
      if (left <= 0) continue;
      const p = left / remaining;
      if (counts[i] + 1 === 3) { out[i] += p; continue; } // 这一枚就是第三枚 → 结算在这个图案上
      const next = counts.slice();
      next[i] += 1;
      const sub = rec(next, remaining - 1);
      for (let k = 0; k < symbols.length; k += 1) out[k] += p * sub[k];
    }
    memo.set(key, out);
    return out;
  }
  const dist = {};
  const result = rec(symbols.map(() => 0), total);
  symbols.forEach((id, i) => { dist[id] = result[i]; });
  return dist;
}

function tierStats(tier, symbols) {
  const dist = settleDistribution(tier);
  let ev = 0, none = 0;
  Object.keys(dist).forEach((id) => {
    ev += dist[id] * (tier.rewards[id] || 0);
    // NONE 就是配置里标了 none 的那两种图案（空白工牌 / 断裂灯泡），不靠猜。
    if (symbols[id] && symbols[id].none) none += dist[id];
  });
  return { dist, ev, none, rtp: ev / tier.price };
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const PORT = server.address().port;
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });

  try {
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.goto('http://127.0.0.1:' + PORT + '/demos/scratch/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(700);
    const config = await p.evaluate(() => window.MuseumScratchGame.getConfig());

    // ---------- 1. 基础 RTP：拿券机自己的配置重推（精确 DP，口径与 012 相同）----------
    const stats = {};
    ['basic', 'night', 'curator'].forEach((id) => { stats[id] = tierStats(config.tiers[id], config.symbols); });

    ['basic', 'night', 'curator'].forEach((id) => {
      const want = EXPECTED[id], got = stats[id];
      check(`${config.tiers[id].name} 的期望回收 ≈ ${want.ev}（012 §6.3）`, Math.abs(got.ev - want.ev) < 0.02, { got: r2(got.ev), want: want.ev });
      check(`${config.tiers[id].name} 的 RTP ≈ ${want.rtp}%`, Math.abs(got.rtp * 100 - want.rtp) < 0.06, { got: r2(got.rtp * 100), want: want.rtp });
      check(`${config.tiers[id].name} 的 NONE 率 ≈ ${want.none}%`, Math.abs(got.none * 100 - want.none) < 0.06, { got: r2(got.none * 100), want: want.none });
    });

    // 三档 RTP 高度一致是 012 §6.3 特意指出的好性质：档位差异是方差和时长，不是赔率。
    const rtps = ['basic', 'night', 'curator'].map((id) => stats[id].rtp * 100);
    check('三档 RTP 落在同一条水平线上（极差 < 1.5 个点）', Math.max.apply(Math, rtps) - Math.min.apply(Math, rtps) < 1.5, { rtps: rtps.map(r2) });

    // ---------- 2. §6.4：两个风险天赋的增量期望 ----------
    // 增量期望 = E[中奖时多拿的部分] − E[NONE 时被罚的部分]，不含票价与天赋代价。
    // 012 §6.4 给的就是这个口径（它的旧值 +106.57 正是这么算出来的）。
    function incrementFor(tierId, multiplier, penaltyPercent) {
      const tier = config.tiers[tierId], s = stats[tierId];
      const bonus = (multiplier - 1) * s.ev;            // 中奖时多拿的部分
      const penalty = s.none * (tier.price * penaltyPercent / 100); // NONE 时被罚的部分
      return bonus - penalty;
    }

    const curatorNow = { triple: 250, quad: 360 };
    const curatorOld = { triple: 50, quad: 100 };

    // 先确认漏洞是真的：按旧值算，四倍异常在 60 点档应该算出 012 写的 +106.57
    const oldQuad = incrementFor('curator', 4, curatorOld.quad);
    check('旧值下「四倍异常」的增量期望 ≈ +106.57（012 §6.4 原文，证明漏洞是真的）', Math.abs(oldQuad - 106.57) < 0.15, { got: r2(oldQuad), want: 106.57 });
    const oldTriple = incrementFor('curator', 3, curatorOld.triple);
    check('旧值下「孤注一掷」的增量期望是大额正数', oldTriple > 50, { got: r2(oldTriple) });

    // 再确认修好了：按 250% / 360% 算，两个都必须是微负
    const newTriple = incrementFor('curator', 3, curatorNow.triple);
    const newQuad = incrementFor('curator', 4, curatorNow.quad);
    check('新值下「孤注一掷」的增量期望 ≈ −5.4（012 §6.4）', Math.abs(newTriple + 5.4) < 0.15, { got: r2(newTriple), want: -5.4 });
    check('新值下「四倍异常」的增量期望 ≈ −1.8（012 §6.4）', Math.abs(newQuad + 1.8) < 0.15, { got: r2(newQuad), want: -1.8 });
    check('两个风险天赋都从"印钞机"翻成了微负', newTriple < 0 && newQuad < 0 && oldTriple > 0 && oldQuad > 0, { oldTriple: r2(oldTriple), oldQuad: r2(oldQuad), newTriple: r2(newTriple), newQuad: r2(newQuad) });

    // ---------- 3. 配置里读到的必须是修完的值，不能只在文档里改了 ----------
    check('配置里孤注一掷的 NONE 减益写的是 250%', /250%/.test(config.talents.tripleRisk.description), { description: config.talents.tripleRisk.description });
    check('配置里四倍异常的 NONE 减益写的是 360%', /360%/.test(config.talents.quadrupleRisk.description), { description: config.talents.quadrupleRisk.description });
    check('抽取本身不再收费（代价挪到购券时按档位收）', config.talentDrawCost === 0, { cost: config.talentDrawCost });
    check('天赋代价的比例写进了配置（票价的一半）', config.talentTicketCostPercent === 50, { percent: config.talentTicketCostPercent });

    // ---------- 4. 带天赋买券的整体 RTP 必须低于不加天赋，而且要低于 100% ----------
    // 60 点档：实付 = 票价 + 票价/2 = 90。把"3 选 1 取最优"近似成"两个风险天赋里较好的那个"，
    // 已经是玩家能拿到的最好情况，此时整体 RTP 仍然必须低于 100%。
    const bestRisk = Math.max(newTriple, newQuad);
    const totalCost = config.tiers.curator.price * 1.5;
    const overallRtp = (stats.curator.ev + bestRisk) / totalCost;
    check('60 点档「抽天赋 + 买券」的 RTP 明显低于 100%（012 修正后写 77.1%）', overallRtp < 0.9, { got: r2(overallRtp * 100), want: 77.1 });
    check('而且比不加天赋的 82.4% 更低（天赋是一层额外消耗，不是提款机）', overallRtp * 100 < EXPECTED.curator.rtp, { got: r2(overallRtp * 100), plain: EXPECTED.curator.rtp });

    check('全程没有页面报错', errors.length === 0, errors.slice(0, 3));
  } finally {
    await b.close().catch(() => null);
    server.close();
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nOK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
