// 快速模拟“当厉鬼”：人手速度砸门；看到红光后过一会儿（反应时间）才躲
const { chromium } = require('playwright');
const path = require('path');
const { OUT, wrap } = require('./lib.cjs');
const TMP = wrap('loop');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + TMP);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  const res = await p.evaluate(() => {
    closeSheet();
    const out = [];
    for (const tier of [1, 2, 3]) for (const rate of [3, 4]) {
      const tally = { win: 0, caught: 0, timeout: 0 };
      for (let r = 0; r < 12; r++) {
        startHaunt();
        cancelAnimationFrame(raf);
        H.tier = tier; H.max = H.door = HAUNT.door + tier * HAUNT.doorPerTier;
        let tapT = 0, result = null;
        const orig = endHaunt;
        endHaunt = (x) => { result = x; H.over = true; };
        const react = {};
        for (let i = 0; i < 2000 && !H.over; i++) {
          // 看到红光后 0.25–0.55 秒才按躲
          H.bows.forEach((bw, j) => { if (bw.s === 'charge') { if (react[j] == null) react[j] = 0.25 + Math.random() * 0.45; react[j] -= 0.05; if (react[j] <= 0 && H.dodge <= 0) { dodge(); react[j] = 99; } } else react[j] = null; });
          hauntStep(0.05);
          tapT += 0.05;
          while (tapT >= 1 / rate && !H.over) { tapT -= 1 / rate; if (H.dodge <= 0) bash(); }
        }
        endHaunt = orig;
        tally[result || 'timeout']++;
      }
      out.push(`门档 ${tier}（门血 ${HAUNT.door + tier * HAUNT.doorPerTier}） ${rate}/s：得手 ${tally.win} · 被捉 ${tally.caught} · 没砸开 ${tally.timeout}（共 12）`);
    }
    return out;
  });
  console.log(res.join('\n'));
  await b.close();
})();
