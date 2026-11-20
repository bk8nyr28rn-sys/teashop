// 用真实的守夜循环比较不同手速。相同局号的敌人、波次和本事抽签使用相同种子。
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const { wrap } = require('./lib.cjs');
const overrides = JSON.parse(process.argv[2] || '{}');

function simulateBatch({ day, door, bows, rate, strategy, first, count, overrides }) {
  const originalRandom = Math.random;
  const originalWave = startWave, originalSpawn = spawnGhost, originalOffer = offerPerks;
  const results = [];
  let trial, spawnIndex;
  function stream(seed) {
    let state = seed >>> 0;
    return () => {
      // Mulberry32 的混合步骤使相邻事件的第一抽也充分分散。
      state = (state + 0x6d2b79f5) >>> 0;
      let bits = Math.imul(state ^ (state >>> 15), state | 1);
      bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61);
      return ((bits ^ (bits >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seed(wave, event) { return Math.imul(trial + 1, 2654435761) + (wave + 1) * 65537 + event * 257; }
  function withSeed(value, fn) {
    const previous = Math.random;
    Math.random = stream(value);
    try { return fn(); } finally { Math.random = previous; }
  }
  startWave = w => { spawnIndex = 0; return withSeed(seed(w, 0), () => originalWave(w)); };
  spawnGhost = sp => withSeed(seed(sp.wave, ++spawnIndex), () => originalSpawn(sp));
  offerPerks = () => withSeed(seed(N.wave, 200), originalOffer);
  try {
    Object.assign(NIGHT, overrides);
    const items = { evil: 'sword', fly: 'bow', shade: 'lamp', armor: 'sword' };
    for (trial = first; trial < first + count; trial++) {
      Math.random = stream(seed(-1, 0));
      G = freshLife({ ...FIRST_FAMILY, door, crossbow: bows }, null);
      G.guideOff = true; G.allFeatures = strategy !== 'firstNight';
      G.day = day; G.time = CFG.dusk; G.item = 'sword';
      startNight(false); cancelAnimationFrame(raf);
      let tapT = 0, switches = 0, wasted = 0, pending = null, taps = 0, misses = 0;
      for (let step = 0; step < 8000 && !N.over; step++) {
        if (N.picking) {
          const pick = Math.floor(stream(seed(N.wave, 201))() * N.offer.length);
          choosePerk(N.offer[pick]); continue;
        }
        nightStep(0.05);
        tapT += 0.05;
        while (!N.over && tapT >= 1 / rate) {
          tapT -= 1 / rate;
          const nearest = N.ghosts.filter(g => !['sword', 'firstNight'].includes(strategy) || revealed(g)).sort((a, b) => b.y - a.y)[0];
          const target = strategy === 'commit' && pending?.hp > 0 ? pending : nearest;
          if (!target) break;
          if (!['sword', 'firstNight'].includes(strategy) && G.item !== items[target.type]) {
            if (pending) wasted++;
            pending = target; switches++;
            setItem(items[target.type]); tapT -= 0.3; continue;
          }
          const center = ghostCenter(target), hp = target.hp;
          hitAt(center.x, center.y); taps++;
          if (target.hp === hp) misses++;
          pending = null;
        }
      }
      if (!N.over) throw new Error('模拟超出步数上限');
      results.push({ win: N.door > 0, hp: Math.max(0, N.door) / N.doorMax, switches, wasted, taps, misses });
    }
  } finally {
    Math.random = originalRandom; startWave = originalWave; spawnGhost = originalSpawn; offerPerks = originalOffer;
  }
  return results;
}

(async () => {
  const b = await chromium.launch();
  try {
    const page = await b.newPage();
    const url = pathToFileURL(wrap('loop')).href;
    await page.addInitScript(() => localStorage.clear());
    async function run(day, door, bows, rate, strategy = 'smart', runs = 40) {
      const results = [];
      for (let first = 0; first < runs; first += 10) {
        // 重建页面，隔离上一批结算回调、动画和页面全局状态。
        await page.goto(url);
        results.push(...await page.evaluate(simulateBatch, { day, door, bows, rate, strategy, first, count: Math.min(10, runs - first), overrides }));
      }
      const doorName = await page.evaluate(id => DOORS[id].name, door);
      const wins = results.filter(r => r.win).length;
      const sum = key => results.reduce((n, r) => n + r[key], 0);
      const label = { smart: '会换', sword: '只用剑', firstNight: '分天开放首夜只用剑', commit: '换后先打原目标' }[strategy];
      console.log(`day ${day} door ${doorName} 弩${bows} ${rate}/s ${label}: 守住 ${wins}/${runs}，胜时门剩 ${wins ? (100 * sum('hp') / wins).toFixed(1) + '%' : '—'}，每局换手 ${(sum('switches') / runs).toFixed(1)}，连换未打 ${sum('wasted')}/${sum('switches')}，未伤及目标 ${sum('misses')}/${sum('taps')}`);
      return results;
    }
    function paired(slow, fast, label) {
      const counts = [0, 0, 0, 0];
      slow.forEach((r, i) => counts[Number(r.win) + 2 * Number(fast[i].win)]++);
      console.log(`第 3 天柴门 1.5/s 与 2/s 配对（${label}）：同败 ${counts[0]}，仅慢档胜 ${counts[1]}，仅快档胜 ${counts[2]}，同胜 ${counts[3]}`);
    }
    for (const [day, cells] of [[1, [[0, 0]]], [3, [[0, 0], [1, 1]]], [5, [[0, 0], [1, 1], [2, 2], [3, 3]]]]) {
      for (const [door, bows] of cells) {
        const focus = day === 3 && door === 0;
        const slow = await run(day, door, bows, 1.5, 'smart', focus ? 160 : 40);
        const fast = await run(day, door, bows, 2, 'smart', focus ? 160 : 40);
        if (focus) {
          paired(slow, fast, '会换');
          const committedSlow = await run(day, door, bows, 1.5, 'commit', 160);
          const committedFast = await run(day, door, bows, 2, 'commit', 160);
          paired(committedSlow, committedFast, '换后先打原目标');
        }
        for (const rate of [3, 4]) await run(day, door, bows, rate);
      }
    }
    await run(1, 0, 0, 4, 'sword');
    for (const rate of [2, 4]) await run(1, 0, 0, rate, 'firstNight');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
