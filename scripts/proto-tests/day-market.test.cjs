const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { OUT, wrap } = require('./lib.cjs');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(wrap('loop')).href);
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.click('#menu');
    await page.getByLabel('不限天数（试玩用）').check();
    await page.getByLabel('全部开放（试玩用）').check();
    await page.getByRole('button', { name: '关上' }).click();
    await page.evaluate(() => {
      G.store = { 柴: 3, 草药: 1, 兽皮: 2 };
      G.goods = { 草药: 3, 柴: 2 };
      G.treasures = [{ n: '古玉', v: 90 }];
      G.personalTreasures = [{ n: '夜明珠', v: 140 }, { n: '旧银环', v: 60 }];
      G.chest = 50; G.purse = 2; G.earned = 0;
      save(); render();
    });
    const balances = () => page.evaluate(() => [G.chest, G.purse, G.earned]);
    const inventory = () => page.evaluate(() => [G.store, G.goods, G.treasures.map(t => t.n), G.personalTreasures.map(t => t.n)]);
    const market = () => page.click('[data-a="market"]');
    const back = () => page.getByRole('button', { name: '回去', exact: true }).click();
    const mine = page.locator('[data-owner="person"]'), home = page.locator('[data-owner="house"]');
    const transfer = () => page.locator('.market-transfer summary').click();
    await market();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, 'day-market.png') });
    await mine.getByRole('button', { name: '卖 1 件草药' }).click();
    assert.deepEqual(await balances(), [50, 8, 6]);
    await page.reload(); await market();
    assert.match(await mine.locator('[data-good-kind="草药"]').innerText(), /草药 ×2/);
    await mine.getByRole('button', { name: '全卖草药' }).click();
    assert.deepEqual(await balances(), [50, 20, 18]);
    await home.getByRole('button', { name: '全卖柴' }).click();
    assert.deepEqual(await balances(), [59, 20, 27]);
    assert.match(await home.locator('[data-sell-all]').innerText(), /34 文/);
    await home.locator('[data-sell-all]').click();
    assert.deepEqual(await balances(), [93, 20, 61]);
    await home.locator('li', { hasText: '古玉' }).getByRole('button', { name: '卖掉' }).click();
    await mine.locator('li', { hasText: '旧银环' }).getByRole('button', { name: '卖掉' }).click();
    assert.deepEqual(await balances(), [183, 80, 211]);
    await mine.getByRole('button', { name: '上架' }).click();
    assert.deepEqual(await inventory(), [{}, { 柴: 2 }, ['夜明珠'], []]);
    await transfer();
    await page.locator('#deposit-amount').fill('11');
    await page.locator('[data-deposit]').click();
    assert.deepEqual(await balances(), [194, 69, 211]);
    await transfer(); await page.locator('[data-store-all]').click();
    await page.reload();
    assert.deepEqual(await inventory(), [{ 柴: 2 }, {}, ['夜明珠'], []]);

    await page.click('[data-a="friends"]');
    // 有邻居上门时先说话，点「看看交情」才是交情页
    if (await page.locator('#sheet [data-npc]').count()) await page.locator('#sheet .sh-btns button', { hasText: '看看交情' }).click();
    assert.ok(await page.locator('[data-good="wang"]').isDisabled(), '仓里的柴不能送人');
    await page.locator('[data-coin="wang"]').click();
    assert.deepEqual(await balances(), [194, 59, 211]);
    await back();
    await page.evaluate(() => { G.goods = { 草药: 2 }; G.store.草药 = 1; G.hp = 1; save(); render(); });
    await page.click('[data-a="friends"]');
    if (await page.locator('#sheet [data-npc]').count()) await page.locator('#sheet .sh-btns button', { hasText: '看看交情' }).click();
    await page.locator('[data-good="wang"]').click();
    await back();
    await page.click('[data-a="heal"]');
    assert.deepEqual(await page.evaluate(() => [G.hp, G.goods.草药 || 0, G.store.草药]), [2, 0, 1]);
    await page.click('[data-a="heal"]');
    assert.deepEqual(await page.evaluate(() => [G.hp, G.store.草药 || 0]), [3, 0]);

    await page.evaluate(() => { G.chest = 24; G.purse = 55; save(); render(); });
    await page.click('[data-a="family"]');
    const apprentice = page.getByRole('button', { name: /收个徒弟/ });
    assert.match(await apprentice.innerText(), /钱箱 24 文 \+ 钱袋 6 文/);
    await apprentice.click();
    assert.deepEqual(await balances(), [0, 49, 211]);
    assert.match(await page.locator('#toast').innerText(), /钱箱 24 文 \+ 钱袋 6 文/);
    await page.click('[data-a="build"]');
    await page.locator('[data-buy="crossbow"]').click();
    assert.deepEqual(await balances(), [0, 4, 211]);
    assert.match(await page.locator('#toast').innerText(), /钱箱 0 文 \+ 钱袋 45 文/);
    await back();
    console.log('PASS 货物和宝物按归属售卖、存放，赠礼、疗伤、收徒与安装机关走指定口袋');

    await page.click('[data-a="out"]');
    const columns = await page.locator('.buddy-compare section').evaluateAll(sections =>
      sections.map(section => ({ left: section.offsetLeft, top: section.offsetTop, width: section.offsetWidth, text: section.innerText })));
    assert.equal(columns.length, 2);
    assert.equal(columns[0].top, columns[1].top);
    assert.ok(columns[0].left + columns[0].width <= columns[1].left);
    assert.match(columns[0].text, /少花两成时间/);
    assert.match(columns[0].text, /全归自己/);
    assert.match(columns[1].text, /每找满 3 件/);
    await page.screenshot({ path: path.join(OUT, 'day-buddy.png') });

    const capacityAndMinutes = () => page.evaluate(() => ({ slots: bagCap(), minutes: walkMin('home', 0) }));
    await page.getByRole('button', { name: '和王大哥一起去' }).click();
  await page.locator('[data-r-target="far"]').click();
  await page.locator('#mapsvg').waitFor();
    const party = await capacityAndMinutes();
    await page.click('[data-spot="0"]');
    assert.ok((await page.locator('.plan').innerText()).includes(await page.evaluate(() => dur(walkMin('home', 0)))));
    await page.click('[data-a="home"]');
    await page.click('[data-a="out"]');
    await page.getByRole('button', { name: '一个人去' }).click();
    const solo = await capacityAndMinutes();
    assert.equal(party.slots - solo.slots, 3);
    assert.ok(Math.abs(solo.minutes - party.minutes * 0.8) < 1);
    await page.click('[data-spot="0"]');
    assert.ok((await page.locator('.plan').innerText()).includes(await page.evaluate(() => dur(walkMin('home', 0)))));
    const start = await page.evaluate(() => G.time);
    await page.click('[data-a="go"]');
    await page.waitForFunction(() => G.at === 0);
    assert.equal(await page.evaluate(() => G.time), start + solo.minutes);
    assert.deepEqual(errors, []);
    console.log(`PASS side-by-side buddy choice, three extra slots, solo route ${solo.minutes} vs ${party.minutes} minutes`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
