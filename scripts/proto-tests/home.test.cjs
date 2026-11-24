// 第五阶段：把钱花回家里。扩院子、装饰、摆设、匾额、几口灶、给伴侣买礼物，全部通过真实按钮操作
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { OUT, ROOT } = require('./lib.cjs');

async function run(browser, width, height, entry) {
  const page = await browser.newPage({ viewport: { width, height }, offline: true });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const sheet = () => page.locator('#sheet:not([hidden]) .card');
  const sheetButton = name => page.locator('#sheet .sh-btns button', { hasText: name }).first();
  const state = () => page.evaluate(() => ({ chest: G.chest, purse: G.purse, level: LoopCore.yardLevel(G), decor: LoopCore.decorSlots(G), plaque: !!G.plaque, love: G.love }));
  async function noOverflow() {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'page overflow');
    for (const el of await page.locator('#hud, #sheet:not([hidden]) .card').all()) {
      assert.equal(await el.evaluate(n => n.scrollWidth <= n.clientWidth + 1), true, 'card overflow');
    }
  }
  try {
    await page.goto(pathToFileURL(path.join(ROOT, entry)).href);
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.evaluate(async () => {
      Object.assign(G, { day: 3, door: 1, guideOff: true, guideHall: true, guideSoldDay: 3, chest: 200, purse: 100, goods: { 柴: 6, 草药: 2 } });
      await save(); render();
    });

    // 顶上只写一共多少钱，点开才分钱箱、钱袋
    assert.equal(await page.locator('#money').innerText(), '钱 300 文');
    await page.locator('#money').click();
    assert.match(await sheet().innerText(), /钱箱 200 文[\s\S]*只能花在家上[\s\S]*钱袋 100 文/);
    await noOverflow();
    await sheetButton('知道了').click();

    // 修院子：买一盆盆栽、一棵桂花树（钱箱先付）
    await page.locator('[data-a=build]').click();
    // 修院子是鲁师傅在说话；头一回认识，第二回同一天只说「还要添点啥？」
    assert.match(await sheet().locator('[data-npc=carpenter]').innerText(), /我姓鲁/);
    assert.match(await sheet().innerText(), /扩院子[\s\S]*装饰[\s\S]*位置 0 \/ 3/);
    await noOverflow();
    await sheet().locator('[data-decor=pot]').click();
    await sheet().locator('[data-decor=tree]').click();
    assert.deepEqual(await state(), { chest: 150, purse: 100, level: 0, decor: ['pot', 'tree', null], plaque: false, love: 0 });

    // 扩成中院：两口灶、五个位置
    await sheet().locator('#up-yard').click();
    let s = await state();
    assert.equal(s.level, 1); assert.equal(s.chest, 30); assert.equal(s.decor.length, 5);
    await sheet().locator('#buy-plaque').click();
    s = await state();
    assert.deepEqual([s.chest, s.purse, s.plaque], [0, 70, true]);
    await sheetButton('回去').click();

    // 摆设：把盆栽挪到位置 4，刷新还在
    assert.match(await page.locator('[data-a=place]').innerText(), /摆设[\s\S]*2 件/);
    await page.locator('[data-a=place]').click();
    await sheet().locator('[data-move="0"]').click();
    await sheetButton('位置 4（空）').click();
    assert.deepEqual((await state()).decor, [null, 'tree', null, 'pot', null]);
    await sheetButton('回去').click();
    await page.reload();
    assert.deepEqual((await state()).decor, [null, 'tree', null, 'pot', null]);
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator('#scene').screenshot({ path: path.join(OUT, `home-yard-${width}.png`) });

    // 中院两口灶：一锅木炭、一锅金疮药，同时烧
    await page.locator('[data-a=stove]').click();
    await sheet().locator('[data-cook=charcoal][data-owner-cook=person]').click();
    await sheet().locator('[data-cook=salve][data-owner-cook=person]').click();
    assert.deepEqual(await page.evaluate(() => LoopCore.stoveJobs(G).map(j => j && j.recipe)), ['charcoal', 'salve']);
    assert.match(await sheet().innerText(), /灶都在烧/);
    await sheetButton('回去').click();

    // 给伴侣买礼物：只用钱袋，一天一次
    await page.evaluate(async () => { LoopCore.match(G, { name: '甲', look: randomLook() }); G.love = 30; await save(); render(); });
    await page.locator('[data-a=family]').click();
    // 家和祠堂：有伴侣就是伴侣开口
    assert.equal(await sheet().locator('[data-npc=spouse]').count(), 1);
    await sheetButton('送礼物').click();
    s = await state();
    assert.deepEqual([s.love, s.purse, s.chest], [38, 50, 0]);
    assert.equal(await sheetButton('送礼物').isDisabled(), true);
    await noOverflow();
    await sheetButton('回去').click();

    // 过一夜：两锅都好了，一起取
    await page.evaluate(() => { G.time = CFG.dusk; G.bankedDays = 3; save(); render(); });
    await page.locator('[data-a=night]').click();
    await page.locator('#sheet [data-a=delegate]').click();
    await page.waitForFunction(() => G.phase === 'dawn');
    await sheetButton('天亮了').click();
    await page.waitForFunction(() => G.phase === 'home');
    // 红线够了，天亮时可能生孩子：先把喜讯关掉
    if (await page.locator('#sheet:not([hidden]) h2', { hasText: '孩子出生了' }).count()) await sheetButton('好').click();
    await page.locator('[data-a=stove]').click();
    await sheetButton('取出来').click();
    assert.deepEqual(await page.evaluate(() => [G.goods.木炭, G.goods.金疮药, LoopCore.stoveJobs(G).some(Boolean)]), [1, 1, false]);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}×${height} 买装饰、扩中院、匾额、摆设挪位置刷新还在、两口灶同时烧、礼物只用钱袋一天一次`);
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch();
  try {
    await run(browser, 390, 844, 'docs/proto/loop/index.html');
    await run(browser, 320, 640, 'prototype/loop.html');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
