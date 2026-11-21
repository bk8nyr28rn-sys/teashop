// 用真实的守夜循环比较不同手速。相同局号的敌人、波次和本事抽签使用相同种子。
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const { wrap } = require('./lib.cjs');
const compareCore = process.argv.includes('--compare-core');
const overrides = JSON.parse(process.argv.slice(2).find(arg => arg !== '--compare-core') || '{}');

function simulateBatch({ day, door, bows, rate, strategy, first, count, overrides, compareCore }) {
  const originalRandom = Math.random;
  const originalWave = startWave, originalSpawn = spawnGhost, originalOffer = offerPerks;
  const results = [];
  let trial, spawnIndex, combatRoll;
  const originalHit = hitAt;
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
  // 只在逐局对账中启用。有效命中时第一抽是会心，之后的浮字偏移仍用样机的外观随机。
  if (compareCore) hitAt = (x, y) => {
    const previous = Math.random;
    let firstRoll = true;
    Math.random = () => {
      if (!firstRoll) return previous();
      firstRoll = false;
      return combatRoll();
    };
    try { return originalHit(x, y); } finally { Math.random = previous; }
  };
  try {
    Object.assign(NIGHT, overrides);
    const items = { evil: 'sword', fly: 'bow', shade: 'lamp', armor: 'sword' };
    for (trial = first; trial < first + count; trial++) {
      Math.random = stream(seed(-1, 0));
      if (compareCore) combatRoll = stream(seed(-1, 0));
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
      results.push({ win: N.door > 0, hp: Math.max(0, N.door) / N.doorMax, kills: N.kills, coins: N.coins, switches, wasted, taps, misses });
    }
  } finally {
    Math.random = originalRandom; hitAt = originalHit; startWave = originalWave; spawnGhost = originalSpawn; offerPerks = originalOffer;
  }
  return results;
}

(async () => {
  const b = await chromium.launch();
  try {
    const page = await b.newPage();
    const url = pathToFileURL(wrap('loop')).href;
    const bot = compareCore ? await require('tsx/esm/api').tsImport('../loop-night-bot.ts', pathToFileURL(__filename).href) : null;
    // 对账时只替换样机的两处抽签。保留独立的刷怪数量、本事候选、输入和伤害判定；
    // 默认基线始终运行磁盘里的原页，继续测浏览器原生随机排序产生的实际难度。
    if (compareCore) {
      const fs = require('node:fs');
      const { orderNightDeck } = await require('tsx/esm/api').tsImport('../../src/core/loop/night.ts', pathToFileURL(__filename).href);
      const html = fs.readFileSync(wrap('loop'), 'utf8');
      const shuffle = '.sort(() => Math.random() - 0.5)';
      const waveDeck = 'Object.entries(c).flatMap(([t, n]) => Array(n).fill(t))';
      const perkDeck = 'Object.keys(PERKS).filter(perkAvailable)';
      if (![waveDeck, perkDeck].every(deck => html.includes(deck + shuffle))) throw new Error('样机抽签入口已变化');
      const paired = html.replace(waveDeck + shuffle, 'testOrderNightDeck(' + waveDeck + ', Math.random)')
        .replace(perkDeck + shuffle, 'testOrderNightDeck(' + perkDeck + ', Math.random)');
      await page.addInitScript({content: 'globalThis.testOrderNightDeck = ' + orderNightDeck.toString()});
      await page.route(url, route => route.fulfill({contentType:'text/html; charset=utf-8', body:paired}));
    }
    await page.addInitScript(() => localStorage.clear());
    async function run(day, door, bows, rate, strategy = 'smart', runs = 40) {
      const results = [];
      for (let first = 0; first < runs; first += 10) {
        // 重建页面，隔离上一批结算回调、动画和页面全局状态。
        await page.goto(url);
        results.push(...await page.evaluate(simulateBatch, { day, door, bows, rate, strategy, first, count: Math.min(10, runs - first), overrides, compareCore }));
      }
      const doorName = await page.evaluate(id => DOORS[id].name, door);
      const wins = results.filter(r => r.win).length;
      const sum = key => results.reduce((n, r) => n + r[key], 0);
      const label = { smart: '会换', sword: '只用剑', firstNight: '分天开放首夜只用剑', commit: '换后先打原目标' }[strategy];
      if (bot) {
        const assert = require('node:assert/strict');
        for (const [trial, actual] of results.entries()) {
          const game = bot.fight(bot.newTrial({day, door, bows, trial}, strategy !== 'firstNight'), trial, rate, strategy);
          const r = game.result;
          const expected = { win: r.won, hp: r.door / r.doorMax, kills: r.kills, coins: r.coins,
            switches: game.switches, wasted: game.wasted, taps: game.taps, misses: game.misses };
          assert.deepEqual(actual, expected, JSON.stringify({day, door, bows, rate, strategy, trial, actual, expected}));
        }
      }
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
    if (bot) console.log('逐局核对通过：胜负、门血、击杀、纸钱、换手和命中记录完全相同。');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
