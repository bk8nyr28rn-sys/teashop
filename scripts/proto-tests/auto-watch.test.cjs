const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { OUT, ROOT, wrap } = require('./lib.cjs');

const errors = [];
function observe(page) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
}
const act = (p, name) => p.locator('[data-a="' + name + '"]').click();
const button = (p, name) => p.getByRole('button', { name, exact: true });
const heading = (p, name) => p.getByRole('heading', { name, exact: true }).waitFor();
const clock = day => new Date('2026-11-' + day + 'T12:00:00+08:00');
async function shot(p, name) {
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const dialog = p.locator('#sheet:not([hidden]) .card');
  if (await dialog.count()) assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
  await p.screenshot({ path: path.join(OUT, name + '.png'), animations: 'disabled' });
}
async function open(p, entry = wrap('loop')) {
  observe(p);
  await p.clock.install({ time: clock(22) });
  await p.goto(pathToFileURL(entry).href);
  await button(p, '开始').click();
}
const ledger = p => p.evaluate(() => ({ day: G.day, chest: G.chest, purse: G.purse, hp: G.hp,
  treasures: G.treasures, nightId: G.nightId, held: G.held, broken: G.broken,
  autoBroken: G.autoBroken || 0, ids: Object.keys(G.receipts), receipt: G.nightReceipt }));

async function choice(browser, seed, firstLife) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  try {
    await open(p);
    await p.evaluate(async ({seed, firstLife}) => {
      watchSeed = () => seed;
      if (!firstLife) G.lifeNo = 2;
      Object.assign(G, { chest: 250, purse: 12, treasures: [{n:'古玉',v:90}] });
      await save(); render();
    }, {seed, firstLife});
    await act(p, 'build');
    assert.match(await p.locator('#up-door').innerText(), /三成.*→.*四成/);
    if (firstLife && seed === 4) await shot(p, 'stage3-upgrade');
    await button(p, '回去').click();
    await act(p, 'night');
    assert.deepEqual(await p.locator('.night-choice').evaluateAll(els => els.map(el => el.dataset.a)), ['manual','delegate']);
    const label = await p.locator('[data-a=delegate]').innerText();
    assert.match(label, /三成/);
    assert.ok(label.includes(firstLife ? '0 文' : '20 文'));
    if (firstLife && seed === 4) await shot(p, 'stage3-choice');
    await act(p, 'delegate');
    await heading(p, seed === 7 ? '机关守住了' : '机关没守住');
    const before = await ledger(p);
    assert.equal(before.chest, firstLife || seed === 7 ? 250 : 230);
    assert.equal(before.purse, seed === 7 ? 41 : 12);
    assert.deepEqual(before.treasures, [{n:'古玉',v:90}]);
    assert.equal(before.held, seed === 7 ? 1 : 0);
    assert.equal(await p.locator('#nsvg,.perk').count(), 0);
    await p.reload();
    await heading(p, seed === 7 ? '机关守住了' : '机关没守住');
    assert.deepEqual(await ledger(p), before);
    await button(p, '天亮了').click(); await p.waitForFunction(() => G.day === 2);
    assert.equal(await p.evaluate(() => G.bankedDays), 1);
  } finally { await p.close(); }
}

async function away(browser) {
  const ctx = await browser.newContext({viewport:{width:320,height:640}, timezoneId:'Asia/Shanghai', offline:true});
  const p = await ctx.newPage(), q = await ctx.newPage();
  const url = pathToFileURL(path.join(ROOT, 'prototype/loop.html')).href;
  try {
    await open(p, path.join(ROOT, 'prototype/loop.html'));
    await p.evaluate(async () => {
      Object.assign(G, {lifeNo:2, chest:120, purse:9, bankedDays:0, treasures:[{n:'古玉',v:90}]});
      await save();
    });
    observe(q); await q.clock.install({time:clock(25)});
    await p.clock.setSystemTime(clock(25));
    // 两个离线副本同时跨三天打开。每次来袭选择相同败局，直接考验“一段最多扣一次”。
    for (const page of [p,q]) await page.addInitScript(() => {
      const original = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = array => array.length === 1 ? (array[0] = 4, array) : original(array);
    });
    await Promise.all([p.reload(), q.goto(url)]);
    for (const page of [p,q]) await heading(page,'你不在的这段日子');
    const text = await p.locator('#sheet .sh-body').innerText();
    assert.match(text, /离开 3 天.*3 次门/);
    assert.match(text, /门破 3 次.*钱箱少了 12 文/);
    assert.match(text, /3 \/ 3/);
    const state = await ledger(p);
    assert.deepEqual([state.chest,state.purse,state.day,state.ids.length,state.autoBroken,state.broken], [108,9,1,3,3,0]);
    assert.deepEqual(await ledger(q),state);
    await shot(p,'stage3-return-320');
    assert.ok(await p.locator('#sheet .card').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight + 1));
    await q.setViewportSize({width:390,height:844});
    await shot(q,'stage3-return-390');
    assert.ok(await q.locator('#sheet .card').evaluate(el => el.scrollHeight <= el.clientHeight + 1));
    await button(p,'知道了').click(); await heading(p,'机关没守住');
    await q.reload();
    await heading(q,'机关没守住');
    assert.deepEqual(await ledger(q),state);
    await button(p,'天亮了').click(); await p.waitForFunction(() => G.phase === 'home');
    await p.locator('#menu').click(); await act(p,'summary'); await heading(p,'你不在的这段日子');
    assert.match(await p.locator('#sheet .sh-body').innerText(),/少了 12 文/);
    await button(p,'知道了').click();
    assert.equal((await ledger(p)).chest,108);
    // 已花光的等待面板。历史回看并不改变资产、进度或家人的关系。
    await p.evaluate(async () => { G.phase='dawn'; G.bankedDays=0; await save(); render(); });
    const before = await ledger(p);
    for (const name of ['out','night','build','market','deposit']) {
      const el = p.locator('[data-a="'+name+'"]');
      assert.ok(await el.isDisabled()); assert.match(await el.innerText(),/明天才能/);
    }
    for (const name of ['yard','family','reports','summary']) assert.ok(await p.locator('[data-a="'+name+'"]').isEnabled());
    await p.locator('[data-a=deposit]').scrollIntoViewIfNeeded();
    await p.clock.fastForward(3000);
    await shot(p,'stage3-wait-320');
    await act(p,'family'); await button(p,'去祠堂').click();
    assert.ok(await p.locator('.pt').count() > 0);
    await p.keyboard.press('Escape');
    await act(p,'yard'); await p.keyboard.press('Escape');
    await act(p,'reports'); await p.locator('#sheet .sh-btns button').first().click(); await heading(p,'这晚的战报');
    assert.deepEqual(await ledger(p),before);
  } finally { await ctx.close(); }
}

async function resumeFight(browser) {
  const p = await browser.newPage({timezoneId:'Asia/Shanghai'});
  try {
    await open(p); await act(p,'night'); await act(p,'manual'); await p.locator('#nsvg').waitFor();
    const progress = await p.evaluate(() => {
      cancelAnimationFrame(raf);
      for (let i=0;i<70;i++) nightStep(.05);
      N.door -= 8;
      return {id:G.nightId,hp:N.door,ghosts:N.ghosts.map(g=>g.id),wave:N.wave};
    });
    assert.ok(progress.ghosts.length > 0);
    await p.reload(); await p.locator('#nsvg').waitFor();
    assert.deepEqual(await p.evaluate(() => ({id:G.nightId,hp:N.door,ghosts:N.ghosts.map(g=>g.id),wave:N.wave})),progress);
    assert.equal(await p.locator('[data-a=delegate]').count(),0);
    await p.clock.setSystemTime(clock(23));
    await p.evaluate(() => window.dispatchEvent(new Event('focus')));
    await heading(p,'你不在的这段日子');
    const result = await ledger(p);
    assert.equal(result.nightId,progress.id);
    assert.equal(result.receipt.mode,'offline');
    assert.equal(result.ids.length,1);
    await p.reload(); await heading(p,'你不在的这段日子');
    assert.deepEqual(await ledger(p),result);
  } finally { await p.close(); }
}

(async () => {
  const browser = await chromium.launch();
  try {
    await choice(browser,7,true); await choice(browser,4,true); await choice(browser,4,false);
    await away(browser); await resumeFight(browser);
    assert.deepEqual(errors,[]);
    console.log('PASS 机关守胜负、首世保护、修门预览、跨页回访、只读院子、同日战斗续打和隔日接管');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
