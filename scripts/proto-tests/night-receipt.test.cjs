const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { wrap, OUT } = require('./lib.cjs');

const url = pathToFileURL(wrap('loop')).href;
const shelf = [{ n: '古玉', v: 90 }, { n: '夜明珠', v: 140 }];
const balances = page => page.evaluate(() => ({
  purse: G.purse, chest: G.chest, shelf: G.treasures, personal: G.personalTreasures,
  held: G.held, broken: G.broken, kills: G.kills,
}));
const receiptState = page => page.evaluate(() => ({
  id: G.nightId, pending: G.nightReceipt, ledger: G.receipts, day: G.day, phase: G.phase, days: G.bankedDays,
}));

async function firstNight(page, day, guard) {
  await page.goto(url);
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.evaluate(async ({ day, guard, shelf }) => {
    G.day = day; G.time = CFG.dusk; G.chest = 103; G.purse = 79;
    G.personalTreasures = [{ n: '私人的簪子', v: 50 }]; G.treasures = shelf;
    if (guard) die('old', '走完了一世。');
    else await save();
    await startNight(guard);
    cancelAnimationFrame(raf);
  }, { day, guard, shelf });
  return page.evaluate(() => G.nightPlan);
}
async function reopenNight(page) {
  await page.waitForFunction(() => N && !N.over);
  await page.evaluate(() => cancelAnimationFrame(raf));
  return page.evaluate(() => G.nightPlan);
}
async function finish(page, won) {
  await page.evaluate(won => {
    N.kills = 6; N.coins = 12; N.lastHit = '吴家的大娘';
    return endNight(won);
  }, won);
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [day, guard, won, button, phase] of [
      [1, false, false, '天亮了', 'home'],
      [5, false, false, '天亮了……', 'death'],
      [5, true, false, '天亮了，去投胎', 'reborn'],
      [1, false, true, '天亮了', 'home'],
      [5, true, true, '天亮了，去投胎', 'reborn'],
    ]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const plan = await firstNight(page, day, guard);
      const before = await balances(page);
      await page.reload();
      assert.deepEqual(await reopenNight(page), plan, '打到一半刷新沿用开打预抽结果');
      await finish(page, won);
      const next = page.getByRole('button', { name: button, exact: true });
      await next.waitFor();
      const state = await receiptState(page), after = await balances(page);
      assert.deepEqual(state.ledger, { [plan.nightId]: state.pending });
      assert.equal(state.pending.houseId, plan.houseId);
      assert.equal(state.pending.lifeId, plan.lifeId);
      const chestLost = won ? 0 : Math.floor(before.chest * plan.chestTenths / 10);
      const purseLost = won ? 0 : Math.floor(before.purse * plan.purseTenths / 10);
      assert.deepEqual(after, { purse: before.purse - purseLost + (won ? 12 : 0), chest: before.chest - chestLost,
        shelf: before.shelf.filter((_, i) => won || i !== plan.treasureIndex), personal: before.personal,
        held: +(!guard && won), broken: +(!guard && !won), kills: won ? 6 : 0 });
      const text = await page.locator('#sheet').innerText();
      if (!won) {
        assert.ok(text.includes('钱袋，抢走了 ' + purseLost + ' 文'));
        assert.ok(text.includes('钱箱，抢走了 ' + chestLost + ' 文'));
        assert.ok(text.includes(plan.treasure.n + '没了'));
      } else assert.ok(text.includes('12 文，收进钱袋'));
      await page.reload();
      await next.waitFor();
      assert.equal(await page.locator('[data-a=dawn]').count(), 0);
      assert.equal(await page.locator('#sheet').innerText(), text);
      assert.deepEqual(await balances(page), after);
      assert.deepEqual(await receiptState(page), state);
      if (day === 5 && !guard) await page.screenshot({ path: path.join(OUT, 'night-result-reloaded.png') });
      await next.click();
      await page.waitForFunction(phase => G.phase === phase, phase);
      assert.deepEqual((await receiptState(page)).ledger, state.ledger);
      if (phase === 'death') assert.deepEqual(await page.evaluate(() => [G.purse, G.chest]), [0, after.purse + after.chest]);
      if (guard && won) {
        await page.locator('[data-fam]').first().click();
        await page.waitForFunction(() => G.lifeNo === 2);
        assert.equal(await page.evaluate(() => G.purse), 0);
        const previous = await page.evaluate(id => JSON.parse(localStorage.getItem('wulin-loop')).houses[id].chest, plan.houseId);
        assert.equal(previous, after.chest + 12, '护家神捡的钱留给原家');
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS 普通夜、末夜、护家神：开打预抽、破门扣两袋与架上宝物、刷新同一回执、纸钱归属');

    // 先占住真实存档锁，再等浏览器确认有两个提交在排队，最后同时放行。
    const context = await browser.newContext();
    const left = await context.newPage(), right = await context.newPage(), late = await context.newPage();
    const plan = await firstNight(left, 1, false);
    const before = await balances(left);
    for (const page of [right, late]) {
      await page.goto(url);
      assert.deepEqual(await reopenNight(page), plan);
    }
    const gate = async () => {
      await late.evaluate(() => {
        window.releaseTestLock = null;
        navigator.locks.request('wulin-loop', () => new Promise(resolve => { window.releaseTestLock = resolve; }));
      });
      await late.waitForFunction(() => typeof window.releaseTestLock === 'function');
    };
    const releaseBoth = async () => {
      await late.waitForFunction(async () => (await navigator.locks.query()).pending.filter(q => q.name === 'wulin-loop').length >= 2);
      await late.evaluate(() => window.releaseTestLock());
    };
    await gate();
    const finishing = Promise.all([finish(left, false), finish(right, true)]);
    await releaseBoth();
    await finishing;
    const morning = page => page.getByRole('button', { name: '天亮了', exact: true });
    await Promise.all([morning(left).waitFor(), morning(right).waitFor()]);
    const first = await receiptState(left), after = await balances(left);
    assert.deepEqual(await receiptState(right), first);
    assert.deepEqual(await balances(right), after);
    assert.deepEqual(Object.keys(first.ledger), [String(plan.nightId)]);
    assert.equal(after.held + after.broken, 1);
    assert.equal(after.purse, before.purse - first.pending.purseLost + first.pending.earnedMoney);
    assert.equal(after.chest, before.chest - first.pending.chestLost);
    await gate();
    const reading = Promise.all([morning(left).click(), morning(right).click()]);
    await releaseBoth();
    await reading;
    for (const page of [left, right]) await page.waitForFunction(() => G.phase === 'home' && G.day === 2);
    // 第三个标签停留在战斗中，天亮后才报另一个输赢。
    const loaded = late.waitForEvent('load');
    await finish(late, !first.pending.won);
    await loaded;
    const advanced = await receiptState(late);
    assert.equal(advanced.day, 2);
    assert.equal(advanced.days, first.days - 1);
    assert.equal(advanced.pending, null);
    assert.deepEqual(advanced.ledger, first.ledger);
    assert.deepEqual(await balances(late), after);
    await context.close();
    console.log('PASS 两个标签实际同时竞争结算和天亮；第三个标签迟到不能覆盖战报或扣第二天');

    // 不提供 Web Locks 的浏览器走 IndexedDB 的 readwrite 事务。
    const fallback = await browser.newContext();
    await fallback.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
    const active = await fallback.newPage(), stale = await fallback.newPage();
    await active.goto(url);
    await active.getByRole('button', { name: '开始', exact: true }).click();
    await active.evaluate(async () => { G.day = 5; G.time = CFG.dusk; G.chest = 112; await save(); });
    await stale.goto(url);
    await Promise.all([active, stale].map(page => page.evaluate(() => startNight(false))));
    const lastPlan = await reopenNight(active);
    assert.deepEqual(await reopenNight(stale), lastPlan, '两页同时开打领同一个夜号、同一张预抽签');
    await finish(active, false);
    await active.getByRole('button', { name: '天亮了……', exact: true }).click();
    await active.locator('[data-a=guard]').click();
    const guardPlan = await reopenNight(active);
    assert.equal(guardPlan.day, lastPlan.day);
    assert.equal(guardPlan.nightId, lastPlan.nightId + 1);
    const oldLedger = (await receiptState(active)).ledger;
    const guardLoaded = stale.waitForEvent('load');
    await finish(stale, true);
    await guardLoaded;
    assert.deepEqual(await reopenNight(stale), guardPlan, '同日同人生换成护家神，旧标签回到新一夜');
    assert.deepEqual((await receiptState(stale)).ledger, oldLedger);
    await Promise.all([finish(active, true), finish(stale, false)]);
    await Promise.all([active, stale].map(page => page.getByRole('button', { name: '天亮了，去投胎', exact: true }).waitFor()));
    const bothNights = await receiptState(stale);
    assert.deepEqual(await receiptState(active), bothNights);
    assert.equal(Object.keys(bothNights.ledger).length, 2);
    await fallback.close();
    console.log('PASS IndexedDB 后备锁并发开打与结算：最后一晚与同日护家神夜分别只记一笔');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
