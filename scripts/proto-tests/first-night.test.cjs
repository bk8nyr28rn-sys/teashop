const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { wrap } = require('./lib.cjs');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(pathToFileURL(wrap('loop')).href);
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.locator('[data-a=night]').click();
    assert.equal(await page.locator('[data-item]').count(), 1);

    // 只加速等待和出剑，实际出怪、页面挑本事和第五波结算均走游戏入口。
    for (const [wave, count] of [3, 4, 6, 7, 9].entries()) {
      const spawned = await page.evaluate(() => {
        cancelAnimationFrame(raf);
        const seen = new Map(N.ghosts.map(g => [g.id, g.type]));
        for (let i = 0; i < 1500 && !N.picking && !N.over; i++) {
          nightStep(.05);
          for (const g of N.ghosts) seen.set(g.id, g.type);
          if (N.ghosts.length) autoHit();
        }
        return [...seen.values()];
      });
      assert.deepEqual(spawned, Array(count).fill('evil'), '第 ' + (wave + 1) + ' 波的实际敌阵');
      if (wave < 4) await page.locator('#sheet .perk').first().click();
    }
    await page.getByRole('button', { name: '天亮了', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => [G.day, G.kills, G.held]), [2, 29, 1]);
    console.log('PASS 带路首夜五波实际出生 3、4、6、7、9 只普通鬼，挑完四次本事后自然天亮');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
