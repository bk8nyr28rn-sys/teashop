const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { OUT, wrap } = require('./lib.cjs');

const url = pathToFileURL(wrap('loop')).href;
const viewport = { width: 390, height: 844 };
const balance = page => page.evaluate(() => G.bankedDays);
const state = page => page.evaluate(() => [G.day, G.phase, G.bankedDays, G.lastGrantDate]);
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('wulin-loop')));
const sheet = page => page.locator('#sheet');
async function toggleUnlimited(page, checked) {
  await page.click('#menu');
  await page.getByLabel('不限天数（试玩用）').setChecked(checked);
  await page.getByRole('button', { name: '关上', exact: true }).click();
}
async function endLivingNight(page, takeDawn = true) {
  await page.getByRole('button', { name: /在家歇到天黑/ }).click();
  await page.locator('[data-a=manual]').click();
  await page.waitForFunction(() => N && !N.over && G.phase === 'night');
  const before = await balance(page);
  // 仅缩短战斗，结算、天亮按钮和扣天都沿用正式入口。
  await page.evaluate(() => endNight(true));
  const dawn = sheet(page).getByRole('button', { name: '天亮了', exact: true });
  await dawn.waitFor();
  assert.equal(await balance(page), before, '守夜与结算不再花天');
  if (takeDawn) {
    await dawn.click();
    await page.waitForFunction(() => !G.nightReceipt);
  }
}
async function checkCalendar(browser) {
  const context = await browser.newContext({ viewport, timezoneId: 'Asia/Shanghai' });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-19T23:58:10+08:00') });
    await page.goto(url);
    assert.equal(await balance(page), 3);
    assert.equal(await page.evaluate(() => G.unlimitedDays), false);
    await page.getByRole('button', { name: '开始', exact: true }).click();
    assert.deepEqual(await state(page), [1, 'home', 2, '2026-11-19']);
    await page.locator('.day-bank', { hasText: '攒着的天：2 / 3' }).waitFor();
    await page.screenshot({ path: path.join(OUT, 'bank-hud.png'), animations: 'disabled' });
    await page.reload();
    assert.equal(await balance(page), 2, '重进同一白天不扣天');
    await endLivingNight(page, false);
    await page.reload();
    assert.equal(await page.evaluate(() => G.held), 1);
    const secondTab = await context.newPage();
    await secondTab.clock.install({ time: new Date('2026-11-19T23:58:20+08:00') });
    await secondTab.goto(url);
    await sheet(secondTab).getByRole('button', { name: '天亮了', exact:true }).click();
    await page.locator('.day-bank', { hasText: '1 / 3' }).waitFor();
    await Promise.all([page.waitForEvent('load'), sheet(page).getByRole('button', { name: '天亮了', exact:true }).click()]);
    await secondTab.close();
    assert.deepEqual(await state(page), [2, 'home', 1, '2026-11-19']);
    await endLivingNight(page);
    assert.deepEqual(await state(page), [3, 'home', 0, '2026-11-19']);
    await endLivingNight(page);
    assert.deepEqual(await state(page), [3, 'dawn', 0, '2026-11-19']);
    await page.reload();
    await page.getByText('今天的日子过完了', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '开始下一天' }).isDisabled(), true);
    assert.match(await page.locator('#panel').innerText(), /还有 0 小时 [12] 分/);
    assert.equal(await page.evaluate(() => G.held), 3);
    await page.screenshot({ path: path.join(OUT, 'bank-wait.png'), animations: 'disabled' });

    // 两个标签页跨过同一个本地零点；轮流前台、刷新也只能领一次。
    const other = await context.newPage();
    await other.clock.install({ time: new Date('2026-11-19T23:58:40+08:00') });
    await other.goto(url);
    await page.clock.fastForward(120000);
    await other.clock.fastForward(120000);
    await page.getByRole('button', { name: '开始下一天', disabled: false }).waitFor();
    await other.getByRole('button', { name: '开始下一天', disabled: false }).waitFor();
    assert.deepEqual(await state(page), [3, 'dawn', 1, '2026-11-20']);
    await other.reload();
    assert.equal(await balance(other), 1);
    await other.getByRole('button', { name: '开始下一天' }).click();
    await page.locator('.day-bank', { hasText: '0 / 3' }).waitFor();
    await page.clock.fastForward(60000);
    assert.equal((await saved(page)).person.day, 4, '后台刷新余额保留前台的游戏进度');
    await other.close();
    await page.reload();
    assert.deepEqual(await state(page), [4, 'home', 0, '2026-11-20']);
    await page.clock.setSystemTime(new Date('2026-11-19T12:00:00+08:00'));
    await page.reload();
    assert.deepEqual(await state(page), [4, 'home', 0, '2026-11-20'], '时钟回拨不重复发天');
    await page.clock.setSystemTime(new Date('2026-11-27T08:00:00+08:00'));
    await page.reload();
    await page.getByRole('heading', {name:'你不在的这段日子'}).waitFor();
    assert.deepEqual(await state(page), [4, 'dawn', 3, '2026-11-27']);
    assert.equal((await saved(page)).account.bankedDays, 3);
    // 满额那天也记录日期，花一天下次打开不会立即再领。
    await page.getByRole('button', {name:'知道了',exact:true}).click();
    await page.getByRole('button', {name:'天亮了',exact:true}).click();
    await page.waitForFunction(() => G.day === 5);
    await page.reload();
    assert.deepEqual(await state(page), [5, 'home', 2, '2026-11-27']);
    await page.evaluate(() => die('old', '本世走完了。'));
    await page.click('[data-a="skip"]');
    await page.click('[data-fam="0"]');
    assert.deepEqual(await state(page), [1, 'home', 1, '2026-11-27']);
    assert.equal(await page.evaluate(() => G.lifeNo), 2);
    await page.evaluate(() => { G.bankedDays = 0; die('early', '本世走完了。'); });
    await page.click('[data-a="skip"]');
    await page.click('[data-fam="0"]');
    assert.deepEqual(await state(page), [1, 'birth', 0, '2026-11-27']);
    await page.reload();
    assert.equal(await page.getByRole('button', { name: '开始新一世的第一天' }).isDisabled(), true);
    await toggleUnlimited(page, true);
    await page.reload();
    await page.getByRole('button', { name: '开始新一世的第一天' }).click();
    assert.deepEqual(await state(page), [1, 'home', 0, '2026-11-27']);
    await endLivingNight(page);
    assert.deepEqual(await state(page), [2, 'home', 0, '2026-11-27']);
    await toggleUnlimited(page, false);
    await endLivingNight(page);
    assert.deepEqual(await state(page), [2, 'dawn', 0, '2026-11-27']);
    assert.deepEqual(errors, []);
    console.log('PASS 初始三天、每次天亮扣天、守夜及刷新、跨午夜与多标签、回拨、连续离线封顶、转世和试玩开关');
  } finally { await context.close(); }
}
async function checkMigrationAndDst(browser) {
  const context = await browser.newContext({ viewport, timezoneId: 'America/New_York' });
  try {
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-03-07T23:55:00-05:00') });
    await page.goto(url);
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.evaluate(() => {
      const old = { ...G, v: 2, day: 3, phase: 'map', at: 1, money: 73 };
      delete old.lastActiveDate;
      delete old.bankedDays; delete old.lastGrantDate; delete old.unlimitedDays;
      localStorage.setItem('wulin-loop', JSON.stringify(old));
    });
    await page.reload();
    assert.deepEqual(await state(page), [3, 'map', 3, '2026-03-07']);
    const migrated = await saved(page);
    assert.equal(migrated.v, 4);
    assert.equal(migrated.houses[migrated.person.houseId].chest, 73);
    assert.equal(migrated.person.purse, 0);
    assert.equal(migrated.person.at, 1);
    assert.equal(migrated.account.unlimitedDays, false);
    await page.evaluate(() => { G.bankedDays = 0; save(); });
    await page.clock.setSystemTime(new Date('2026-03-09T00:02:00-04:00'));
    await page.reload();
    await page.getByRole('heading', {name:'你不在的这段日子'}).waitFor();
    assert.deepEqual(await state(page), [3, 'dawn', 2, '2026-03-09']);
    console.log('PASS v2 正在游玩的存档原地迁移、赠三天、跨夏令时按本地日期发放');
  } finally { await context.close(); }
}
(async () => {
  const browser = await chromium.launch();
  try { await checkCalendar(browser); await checkMigrationAndDst(browser); }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
