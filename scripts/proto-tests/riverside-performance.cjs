const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const { wrap } = require('./lib.cjs');

// 隔离浏览器负载，用真实触屏点击走一圈，采样移动、重绘和交互间的动画帧。
(async () => {
  const browser = await chromium.launch();
  try {
    for (const rate of [1, 4]) {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        offline: true,
      });
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate });
      await page.goto(pathToFileURL(wrap('loop')).href);
      await page.getByRole('button', { name: '开始', exact: true }).tap();
      await page.locator('[data-a="out"]').tap();
      await page.locator('#rb-map').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        window.frameTimes = [];
        let last;
        function sample(now) {
          if (last !== undefined) window.frameTimes.push(now - last);
          last = now;
          window.frameSample = requestAnimationFrame(sample);
        }
        window.frameSample = requestAnimationFrame(sample);
      });
      for (const id of [
        'herb',
        'rope',
        'wood0',
        'porter',
        'market',
        'stone',
        'home',
        'herb',
        'porter',
        'stone',
        'rope',
        'wood1',
        'ditch',
        'herb',
      ]) {
        await page.locator('[data-r-target="' + id + '"] > rect:last-child').tap();
        await page.waitForFunction((id) => G.river.focus === id, id);
        if (id === 'herb' || id === 'porter') await page.locator('[data-r-act="hail"]').tap();
      }
      const result = await page.evaluate(() => {
        cancelAnimationFrame(window.frameSample);
        const frames = window.frameTimes.sort((a, b) => a - b),
          ms = frames.reduce((sum, v) => sum + v, 0);
        return {
          frames: frames.length,
          seconds: +(ms / 1000).toFixed(2),
          fps: +((frames.length * 1000) / ms).toFixed(1),
          p95ms: +frames[Math.ceil(frames.length * 0.95) - 1].toFixed(1),
          over50ms: frames.filter((v) => v > 50).length,
        };
      });
      console.log('390 × 844 · DPR 3 · CPU ×' + rate, JSON.stringify(result));
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
