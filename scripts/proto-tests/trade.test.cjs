// 第四阶段：每天的行情、院里的灶、邻居托付。全部通过真实按钮操作。
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { OUT, ROOT } = require('./lib.cjs');

async function run(browser, width, height, entry) {
  const page = await browser.newPage({ viewport: { width, height }, offline: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const sheet = () => page.locator('#sheet:not([hidden]) .card');
  const button = name => page.locator('#sheet .sh-btns button', { hasText: name });
  async function noOverflow() {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'page overflow');
    for (const el of await page.locator('#hud, #sheet:not([hidden]) .card').all()) {
      assert.equal(await el.evaluate(n => n.scrollWidth <= n.clientWidth + 1), true, 'card overflow');
    }
  }
  async function sleepOneNight() {
    // 交给机关守一晚，再天亮：和玩家一样走「过完一晚」
    await page.evaluate(() => { G.time = CFG.dusk; G.bankedDays = 3; save(); render(); });
    await page.locator('[data-a=night]').click();
    await page.locator('#sheet [data-a=delegate]').click();
    await page.waitForFunction(() => G.phase === 'dawn');
    await button('天亮了').click();
    await page.waitForFunction(() => G.phase === 'home');
  }
  try {
    await page.goto(pathToFileURL(path.join(ROOT, entry)).href);
    await page.getByRole('button', { name: '开始', exact: true }).click();

    // 第 1 天：价钱固定，没有「今天贵 / 便宜」，也没有灶和托付
    await page.evaluate(async () => { Object.assign(G, { goods: { 柴: 7 } }); await save(); render(); });
    assert.equal(await page.locator('[data-a=stove]').count(), 0);
    await page.locator('[data-a=market]').click();
    assert.equal(await sheet().locator('.trend').count(), 0);
    assert.equal(await sheet().locator('[data-request]').count(), 0);
    assert.match(await sheet().locator('[data-owner=person]').innerText(), /每件 3 文/);
    await button('回去').click();

    // 第 3 天：灶台出现，念头提醒能生火
    await page.evaluate(async () => {
      Object.assign(G, { day: 3, door: 1, guideHall: true, guideSoldDay: 3, chest: 50, purse: 0, goods: { 柴: 7 }, store: { 草药: 2 }, stove: null });
      await save(); render();
    });
    assert.equal(await page.locator('#thought').getAttribute('data-thought'), 'kiln');
    await page.locator('[data-a=stove]').click();
    assert.equal(await sheet().locator('[data-cook=salve][data-owner-cook=person]').isDisabled(), true);
    await sheet().locator('[data-cook=charcoal][data-owner-cook=person]').click();
    assert.deepEqual(await page.evaluate(() => [G.goods.柴, G.stove.recipe, G.stove.owner]), [4, 'charcoal', 'person']);
    assert.match(await page.locator('[data-a=stove]').innerText(), /在烧木炭/);
    // 现实时间再久也不会好：刷新后还在烧
    await page.reload();
    assert.equal(await page.evaluate(() => LoopCore.stoveStatus(G.stove, G.lifeId, G.day)), 'cooking');
    await page.screenshot({ path: path.join(OUT, `trade-yard-${width}.png`), animations: 'disabled' });

    // 过完一晚：第 4 天早上灶上的木炭好了
    await sleepOneNight();
    assert.equal(await page.evaluate(() => G.day), 4);
    assert.equal(await page.locator('#thought').getAttribute('data-thought'), 'stove');
    assert.match(await page.locator('#thought-title').innerText(), /木炭烧好了/);
    await page.locator('[data-a=stove]').click();
    await button('取出来').click();
    assert.deepEqual(await page.evaluate(() => [G.goods.木炭, !!G.stove]), [1, false]);
    await page.reload();
    assert.deepEqual(await page.evaluate(() => [G.goods.木炭, !!G.stove]), [1, false]);

    // 第 4 天：集市里有行情标记和邻居托付；接下、凑够、交货
    await page.evaluate(async () => {
      // 托付要的货放在家里仓库；自己手上只放托付不会要的铁矿和古物，留给后面的卖货测试
      const offer = LoopCore.offerFor(G.lifeId, G.day, NEIGHBOR_IDS);
      G.goods = { 铁矿: 5, 古物: 1 };
      G.store = { [offer.kind]: offer.count };
      G.guideSoldDay = G.day; await save(); render();
    });
    assert.match(await page.locator('[data-a=market]').innerText(), /邻居托付 1 条/);
    await page.locator('[data-a=market]').click();
    const card = sheet().locator('[data-request=offer]');
    assert.match(await card.innerText(), /想要 \d+ (件|份)/);
    const offer = await page.evaluate(() => LoopCore.offerFor(G.lifeId, G.day, NEIGHBOR_IDS));
    await card.locator('[data-accept]').click();
    assert.equal(await page.evaluate(() => G.request.status), 'accepted');
    const before = await page.evaluate(id => [G.purse, G.chest, G.friends[id]], offer.neighbor);
    await noOverflow();
    await page.screenshot({ path: path.join(OUT, `trade-market-${width}.png`), animations: 'disabled' });
    await sheet().locator('[data-deliver]').click();
    const after = await page.evaluate(id => [G.purse, G.chest, G.friends[id], G.request.status], offer.neighbor);
    assert.deepEqual(after, [before[0], before[1] + offer.pay, Math.min(100, before[2] + 5), 'done']);
    assert.equal(await sheet().locator('[data-request=none]').count(), 1);

    // 一件件卖和全卖同价；当天的价和集市上写的一致
    const prices = await page.evaluate(() => todayPrices());
    assert.match(await sheet().locator('[data-owner=person] [data-good-kind=铁矿]').innerText(), new RegExp(`每件 ${prices.铁矿} 文`));
    const purse0 = await page.evaluate(() => G.purse);
    for (let i = 0; i < 2; i++) await sheet().locator('[data-owner=person] [data-good-kind=铁矿] [data-quantity=one]').click();
    await sheet().locator('[data-owner=person] [data-good-kind=铁矿] [data-quantity=all]').click();
    assert.equal(await page.evaluate(() => G.purse) - purse0, prices.铁矿 * 5);
    await button('回去').click();

    // 攒天用完时：灶和托付都只能看
    await page.evaluate(async () => {
      G.stove = { jobId: 'x', recipe: 'salve', owner: 'house', lifeId: G.lifeId, day: G.day };
      G.phase = 'dawn'; G.bankedDays = 0; G.lastGrantDate = localDateKey(); G.nightReceipt = null; await save(); render();
    });
    assert.equal(await page.locator('[data-a=stove][disabled]').count(), 1);
    assert.equal(await page.locator('[data-a=request][disabled]').count(), 1);
    await page.locator('[data-a=yard]').click();
    assert.match(await sheet().innerText(), /灶台：在烧金疮药/);
    await noOverflow();
    await page.screenshot({ path: path.join(OUT, `trade-waiting-${width}.png`), animations: 'disabled' });
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}×${height} 第 1 天固定价、第 3 天生火、过一夜取木炭、刷新不重复、第 4 天接托付交货、全卖同价、没有攒天只能看`);
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch();
  try {
    await run(browser, 390, 844, 'docs/proto/loop/index.html');
    await run(browser, 320, 640, 'prototype/loop.html');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
