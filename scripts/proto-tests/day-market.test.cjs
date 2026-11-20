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
      G.store = { 柴: 3, 草药: 3, 兽皮: 2 };
      G.treasures = [{ n: '古玉', v: 90, tre: true }, { n: '夜明珠', v: 140, tre: true }];
      G.money = 50; G.earned = 0;
      save(); render();
    });
    const inventory = () => page.evaluate(() => ({
      money: G.money, earned: G.earned, store: G.store, treasures: G.treasures.map(item => item.n),
    }));
    const bothTreasures = ['古玉', '夜明珠'];
    await page.click('[data-a="market"]');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, 'day-market.png') });
    await page.getByRole('button', { name: '卖 1 件草药' }).click();
    assert.deepEqual(await inventory(), { money: 56, earned: 6, store: { 柴: 3, 草药: 2, 兽皮: 2 }, treasures: bothTreasures });
    await page.reload();
    await page.click('[data-a="market"]');
    assert.match(await page.locator('[data-good-kind="草药"]').innerText(), /草药 ×2/);
    await page.getByRole('button', { name: '全卖草药' }).click();
    assert.deepEqual(await inventory(), { money: 68, earned: 18, store: { 柴: 3, 兽皮: 2 }, treasures: bothTreasures });
    const bulk = page.getByRole('button', { name: /货全卖了/ });
    assert.match(await bulk.innerText(), /37 文/);
    await bulk.click();
    await page.reload();
    assert.deepEqual(await inventory(), { money: 105, earned: 55, store: {}, treasures: bothTreasures });
    await page.click('[data-a="market"]');
    assert.equal(await bulk.isEnabled(), false);
    await page.locator('li', { hasText: '古玉' }).getByRole('button', { name: '卖掉' }).click();
    await page.reload();
    assert.deepEqual(await inventory(), { money: 195, earned: 145, store: {}, treasures: ['夜明珠'] });
    console.log('PASS market sells one item, one kind, all ordinary goods, and one treasure at their listed prices across reloads');

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
