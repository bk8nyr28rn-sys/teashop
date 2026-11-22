const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { OUT, ROOT } = require('./lib.cjs');

async function exercise(browser, width, height, entry) {
  const page = await browser.newPage({ viewport: { width, height }, offline: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  async function checkLayout() {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const section of await page.locator('#hud, #sheet:not([hidden]) .card').all()) {
      assert.equal(await section.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    }
  }
  try {
    await page.goto(pathToFileURL(path.join(ROOT, entry)).href);
    await page.getByRole('button', { name: '开始', exact: true }).click();
    // 构造有两种所有者的中期库存，随后全部通过实际界面操作。
    await page.evaluate(async () => {
      Object.assign(G, { day: 3, guideOff: true, chest: 20, purse: 21,
        goods: { 柴: 7 }, store: { 草药: 2 }, personalTreasures: [{ n: '古玉', v: 90 }] });
      Guidance.silence(); await save(); render();
    });
    await checkLayout();
    await page.screenshot({ path: path.join(OUT, 'pockets-home-' + width + '.png'), animations: 'disabled' });
    await page.locator('[data-a=market]').click();
    for (const [owner, text] of [['person', '钱袋'], ['house', '钱箱']]) {
      assert.match(await page.locator('[data-owner=' + owner + ']').innerText(), new RegExp(text));
    }
    await checkLayout();
    await page.screenshot({ path: path.join(OUT, 'pockets-market-' + width + '.png'), animations: 'disabled' });
    await page.getByRole('button', { name: '回去', exact: true }).click();
    await page.locator('[data-a=build]').click();
    if (width === 320) {
      // 占住锁直到页面刷新，保证这次换门一定经过被中断的待提交记录。
      await page.evaluate(() => {
        navigator.locks.request('wulin-loop', () => { window.holdingTestLock = true; return new Promise(() => {}); });
      });
      await page.waitForFunction(() => window.holdingTestLock);
    }
    await page.locator('#up-door').click();
    await page.reload();
    assert.deepEqual(await page.evaluate(() => [G.chest, G.purse, G.door]), [0, 1, 1]);
    assert.deepEqual(errors, []);
    console.log('PASS ' + width + '×' + height + ' 离线入口、两种归属、混付木门、刷新留存、HUD 和集市宽度');
  } finally { await page.close(); }
}
(async () => {
  const browser = await chromium.launch();
  try {
    await exercise(browser, 390, 844, 'docs/proto/loop/index.html');
    await exercise(browser, 320, 640, 'prototype/loop.html');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
