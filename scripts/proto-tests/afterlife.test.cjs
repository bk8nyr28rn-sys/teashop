// 第六阶段：老死后「当一晚鬼」可以关掉，直接去下一世；家、投胎的规则走规则核心
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { ROOT } = require('./lib.cjs');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, offline: true });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(pathToFileURL(path.join(ROOT, 'docs/proto/loop/index.html')).href);
    await page.getByRole('button', { name: '开始', exact: true }).click();

    // 设置里打开「老死后直接下一世」，存档里记住（跨世保留）
    await page.locator('#menu').click();
    await page.getByLabel('老死后直接下一世，不当鬼（试玩用）').check();
    await page.getByRole('button', { name: '关上', exact: true }).click();
    await page.reload();
    assert.equal(await page.evaluate(() => G.skipAfterlife), true);

    // 有个徒弟，红线到倾心：老死以后直接到奈何桥选人家，没有护家神和厉鬼
    await page.evaluate(async () => {
      Object.assign(G, { day: CFG.lifeDays, guideOff: true, chest: 40, purse: 0, held: 2 });
      LoopCore.match(G, { name: '甲', look: randomLook() }); G.love = 50;
      const d = LoopCore.takeDisciple(G); Object.assign(d.kin, { name: '徒弟甲', look: randomLook() });
      await save(); die('old', '你老了。');
    });
    assert.equal(await page.locator('[data-a=guard],[data-a=haunt]').count(), 0);
    assert.match(await page.locator('#panel').innerText(), /去下一世/);
    await page.locator('[data-a=skip]').click();
    await page.waitForFunction(() => G.phase === 'reborn');
    const rows = await page.evaluate(() => Object.fromEntries(G.reborn.rows.map(r => [r[0], r[2]])));
    assert.equal(rows.红线, 15);
    assert.equal(rows.养育, 10);
    assert.equal(rows.当护家神, undefined);
    // 有后人：第一张是回自家，后面两户
    assert.equal(await page.locator('[data-fam]').count(), 3);
    assert.match(await page.locator('[data-fam="0"]').innerText(), /回自己家投胎/);
    await page.locator('[data-fam="0"]').click();
    await page.waitForFunction(() => G.lifeNo === 2);
    assert.equal(await page.evaluate(() => G.skipAfterlife), true, '试玩开关跨世保留');

    // 关掉开关：照旧能当护家神、当厉鬼
    await page.evaluate(async () => { G.skipAfterlife = false; G.day = CFG.lifeDays; await save(); die('old', '你老了。'); });
    assert.equal(await page.locator('[data-a=guard],[data-a=haunt]').count(), 2);
    await page.locator('[data-a=skip]').click();
    await page.waitForFunction(() => G.phase === 'reborn');
    // 没有后人：宅子不消失的说法
    assert.match(await page.locator('#panel').innerText(), /宅子还在/);
    assert.equal(await page.locator('[data-fam]').count(), 3);
    assert.deepEqual(errors, []);
    console.log('PASS 试玩开关跨世保留、关掉当鬼直接下一世、因果分和三户人家走规则核心、没有后人宅子还在');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
