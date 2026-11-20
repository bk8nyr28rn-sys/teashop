// 在实际守夜画面测十个带手绘的鬼：node scripts/proto-tests/creator-performance.cjs [捏人码文件]
// 默认读取本次分层手绘浏览器用例生成的角色。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { OUT, wrap } = require('./lib.cjs');

(async () => {
  const code = fs.readFileSync(process.argv[2] || path.join(OUT, 'draw-look.txt'), 'utf8').trim();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await page.goto(pathToFileURL(wrap('loop')).href);
    await page.evaluate(() => document.fonts.ready);
    const session = await page.context().newCDPSession(page);
    const measurements = [];
    for (const slowdown of [1, 4]) {
      await session.send('Emulation.setCPUThrottlingRate', {rate: slowdown});
      for (let trial = 0; trial < 3; trial++) {
        const result = await page.evaluate(async code => {
          const sample = validatedLook(decode(code));
          const start = performance.now();
          G = freshLife(FIRST_FAMILY, null);
          G.allFeatures = true; G.item = 'lamp'; startNight(false); N.spawns = [];
          for (let i = 0; i < 10; i++) {
            spawnGhost({type: 'armor', wave: 0});
            const g = N.ghosts.at(-1);
            g.lane = ((i % 5) - 2) * 0.42; g.y = 155 + Math.floor(i / 5) * 90;
            const age = ['child','adult','elder'][i % 3];
            const variant = { ...sample, build: (i + 1) / 11, height: (10 - i) / 11 };
            g.gb.lastElementChild.outerHTML = ghostSvg(variant, 'h8', age, 0, 0, 0.2);
          }
          const setupMs = performance.now() - start;
          const times = [];
          await new Promise(resolve => {
            let warmup, previous;
            function sampleFrame(now) {
              warmup ??= now;
              if (now - warmup >= 500) {
                if (previous !== undefined) times.push(now - previous);
                previous = now;
              }
              if (now - warmup < 6500) requestAnimationFrame(sampleFrame);
              else resolve();
            }
            requestAnimationFrame(sampleFrame);
          });
          const count = N.ghosts.filter(g => g.gb.querySelector('[data-draw-layer="hairFront"]') && g.gb.querySelector('[data-draw-layer="top"]')).length;
          const moved = N.ghosts.every((g, i) => g.y > 155 + Math.floor(i / 5) * 90);
          if (N.picking || N.over || !moved) throw Error('测量期间守夜人物没有正常移动');
          cancelAnimationFrame(raf);
          N.over = true;
          const elapsed = times.reduce((sum, t) => sum+t,0);
          times.sort((a,b) => a-b);
          return { count, frames: times.length, elapsedMs: elapsed, fps: 1000 * times.length / elapsed, p95Ms: times[Math.ceil(times.length*.95)-1], maxMs: times.at(-1), setupMs };
        }, code);
        assert.equal(result.count, 10);
        if (slowdown === 1 && trial === 0) await page.screenshot({path:path.join(OUT, 'draw-ten.png'),scale:'css'});
        measurements.push({ slowdown, trial: trial+1, ...result });
        console.log(JSON.stringify(measurements.at(-1)));
      }
    }
    fs.writeFileSync(path.join(OUT,'draw-fps.json'), JSON.stringify({ browser: browser.version(), viewport: '390x844', deviceScaleFactor: 3, measurements }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
