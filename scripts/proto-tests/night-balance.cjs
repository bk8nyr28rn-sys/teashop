// 快速模拟守夜：直接调 nightStep，按“人手速度”点（每秒几下），看不同门、机关、天数下守不守得住
const { chromium } = require('playwright');
const path = require('path');
const { OUT, wrap } = require('./lib.cjs');
const TMP = wrap('loop');
const fs = require('fs');
const OVR = JSON.parse(process.argv[2] || '{}');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + TMP);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  const res = await p.evaluate((OVR) => {
    closeSheet();
    Object.assign(NIGHT, OVR);
    const out = [];
    const run = (day, door, bows, rate, smart, age, runs = 6) => {
      let wins = 0, left = 0;
      for (let r = 0; r < runs; r++) {
        G = freshLife({ ...FIRST_FAMILY, door, crossbow: bows }, null);
        G.day = day; G.time = CFG.dusk; G.item = 'sword';
        if (age) G.day = age;
        startNight(false);
        cancelAnimationFrame(raf);
        N.d = day;
        let tapT = 0;
        for (let i = 0; i < 8000 && !N.over; i++) {
          if (N.picking) { choosePerk(N.offer[Math.floor(Math.random() * N.offer.length)]); continue; }
          nightStep(0.05);
          tapT += 0.05;
          if (N.over) break;
          while (tapT >= 1 / rate) {
            tapT -= 1 / rate;
            const g = N.ghosts.filter((x) => smart || x.type !== 'shade' || revealed(x)).sort((a, c) => c.y - a.y)[0];
            if (!g) break;
            if (smart && G.item !== ({ evil: 'sword', fly: 'bow', shade: 'lamp', armor: 'sword' })[g.type]) { setItem(({ evil: 'sword', fly: 'bow', shade: 'lamp', armor: 'sword' })[g.type]); tapT -= 0.3; continue; }
            { const c = ghostCenter(g); hitAt(c.x, c.y); }
          }
        }
        if (N.door > 0) { wins++; left += N.door / N.doorMax; }
      }
      out.push(`day ${day} door ${DOORS[door].name.padEnd(5, '　')} 弩${bows} ${rate}/s ${smart ? '会换' : '只用剑'}: 守住 ${wins}/${runs}${wins ? `，门剩 ${Math.round((left / wins) * 100)}%` : ''}`);
    };
    for (const [day, cells] of [[1, [[0, 0]]], [3, [[0, 0], [1, 1]]], [5, [[0, 0], [1, 1], [2, 2], [3, 3]]]]) for (const [door, bows] of cells) for (const rate of [3, 4]) run(day, door, bows, rate, true);
    run(1, 0, 0, 4, false);
    return out;
  }, OVR);
  console.log(res.join('\n'));
  await b.close();
})();
