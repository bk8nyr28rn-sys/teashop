const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const {wrap, OUT} = require('./lib.cjs');

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [day, guard, won, button, phase] of [
      [1, false, true, '天亮了', 'home'],
      [5, false, false, '天亮了……', 'death'],
      [5, true, false, '天亮了，去投胎', 'reborn'],
    ]) {
      const page = await browser.newPage({viewport:{width:390,height:844}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(wrap('loop')).href);
      await page.getByRole('button',{name:'开始',exact:true}).click();
      await page.evaluate(({day,guard,won}) => {
        G.day = day; G.money = 100; G.treasures = [{n:'古玉',v:90},{n:'夜明珠',v:140}];
        G.time = CFG.dusk; startNight(guard); N.kills = 6; N.coins = 12; N.lastHit = '吴家的大娘';
        endNight(won);
      },{day,guard,won});
      const read = () => page.evaluate(() => [G.money,G.treasures.length,G.held,G.broken,G.kills]);
      const next = page.getByRole('button',{name:button,exact:true});
      await next.waitFor();
      const text = await page.locator('#sheet').innerText(), expected = await read();
      assert.deepEqual(expected, won ? [112,2,1,0,6] : [70,1,0,guard ? 0 : 1,0]);
      await page.reload();
      await next.waitFor();
      assert.equal(await page.locator('[data-a=dawn]').count(),0);
      assert.equal(await page.locator('#sheet').innerText(),text);
      assert.deepEqual(await read(),expected);
      if (day === 5 && !guard) await page.screenshot({path:path.join(OUT,'night-result-reloaded.png')});
      await next.click();
      assert.equal(await page.evaluate(() => G.phase),phase);
      assert.deepEqual(await read(),expected);
      assert.deepEqual(errors,[]);
      await page.close();
    }
    const context = await browser.newContext();
    const left = await context.newPage();
    await left.goto(pathToFileURL(wrap('loop')).href);
    await left.getByRole('button', { name: '开始', exact: true }).click();
    await left.evaluate(() => {
      G.money = 100; G.treasures = [{n:'古玉',v:90}]; startNight(false); cancelAnimationFrame(raf);
    });
    const right = await context.newPage();
    await right.goto(left.url());
    await right.evaluate(() => cancelAnimationFrame(raf));
    await left.evaluate(() => endNight(false));
    const receipt = await left.evaluate(() => ({receipt:G.nightReceipt, money:G.money, broken:G.broken}));
    await Promise.all([
      right.waitForEvent('load'),
      right.evaluate(() => endNight(true)),
    ]);
    await right.getByRole('button',{name:'天亮了',exact:true}).waitFor();
    assert.deepEqual(await right.evaluate(() => ({receipt:G.nightReceipt, money:G.money, broken:G.broken})),receipt);
    assert.equal(receipt.money,70);
    assert.equal(receipt.broken,1);
    await context.close();
    console.log('PASS 普通夜、末夜、护家神结算重进保留同一战报与家产，下一步正常');
    console.log('PASS 同一晚旧标签页结束战斗时沿用已落盘的战报');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
