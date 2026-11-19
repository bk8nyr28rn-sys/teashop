const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { OUT, wrap } = require('./lib.cjs');
const TMP = wrap('loop');
const shots = path.join(OUT, 'loop');
fs.mkdirSync(shots, { recursive: true });
const ok = (n, c, extra = '') => console.log((c ? 'PASS ' : 'FAIL ') + n + (extra ? ' — ' + extra : ''));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errs.push(m.text()));
  await p.goto('file://' + TMP);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(300);
  const clean = async (where) => { const bad = await p.evaluate(() => /NaN|undefined/.test(document.getElementById('scene').innerHTML + document.getElementById('panel').innerHTML)); ok('no NaN/undefined: ' + where, !bad); };
  const overflow = async (where) => ok('no horizontal overflow: ' + where, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  const sheetBtn = async (re) => { const btn = p.locator('#sheet .sh-btns button', { hasText: re }).first(); await btn.click(); await p.waitForTimeout(80); };
  const sheetOpen = () => p.evaluate(() => !document.getElementById('sheet').hidden);
  const sheetTitle = () => p.evaluate(() => document.querySelector('#sh-t')?.textContent || '');
  // resolve any event sheets during the day by taking the first (main) option
  const drainSheets = async () => { for (let i = 0; i < 8 && (await sheetOpen()); i++) { await p.locator('#sheet .sh-btns button').first().click(); await p.waitForTimeout(120); } };

  ok('intro shows', (await sheetTitle()).includes('一日一夜'));
  await p.screenshot({ path: path.join(shots, '0-intro.png') });
  await sheetBtn('开始');
  await clean('home'); await overflow('home');
  await p.screenshot({ path: path.join(shots, '1-home.png') });

  // ---- day: go out with a buddy, gather in the woods, come home ----
  await p.click('[data-a="out"]');
  ok('buddy offered (王大哥 交情 26)', (await p.locator('#sheet button', { hasText: '王大哥' }).count()) === 1);
  await sheetBtn('王大哥');
  ok('map phase', (await p.evaluate(() => G.phase)) === 'map' && (await p.evaluate(() => G.buddy)) === 'wang');
  await p.evaluate(() => { SPEED = 8; });
  await p.click('[data-spot="3"]');
  ok('plan shows travel time', /走 .*到了是/.test(await p.textContent('.plan')));
  await clean('map plan'); await overflow('map');
  await p.screenshot({ path: path.join(shots, '2-map.png') });
  await p.click('[data-a="go"]');
  await p.waitForTimeout(200);
  ok('arrived at 松林', (await p.evaluate(() => G.at)) === 3);
  for (let i = 0; i < 3; i++) { await drainSheets(); if ((await p.evaluate(() => G.phase)) !== 'map') break; const g = p.locator('[data-a="gather"]'); if (await g.isEnabled()) await g.click(); await p.waitForTimeout(120); }
  await drainSheets();
  if ((await p.evaluate(() => G.phase)) === 'map') { await p.click('[data-a="home"]'); await p.waitForTimeout(250); }
  await drainSheets();
  const st = await p.evaluate(() => ({ phase: G.phase, store: G.store, tre: G.treasures.length, wang: G.friends.wang, time: G.time }));
  ok('back home with goods', st.phase === 'home' || st.phase === 'night', JSON.stringify(st));
  if (st.phase === 'home') {
    await p.click('[data-a="market"]');
    await p.screenshot({ path: path.join(shots, '3-market.png') });
    const sell = p.locator('#sheet .sh-btns button', { hasText: '全卖了' });
    if (await sell.isEnabled()) await sell.click(); else await sheetBtn('回去');
    await p.evaluate(() => { G.money += 200; save(); render(); });
    await p.click('[data-a="build"]');
    await p.click('#up-door');
    await p.click('[data-buy="crossbow"]');
    await p.click('[data-buy="lamp"]');
    await p.screenshot({ path: path.join(shots, '4-build.png') });
    await sheetBtn('回去');
    ok('upgrades bought', await p.evaluate(() => G.door === 1 && G.traps.crossbow === 1 && G.traps.lamp === 1));
    await p.click('[data-a="friends"]');
    await p.click('[data-coin="wang"]');
    ok('gift raises 交情', (await p.evaluate(() => G.friends.wang)) > st.wang);
    await p.evaluate(() => { G.friends.wang = 45; save(); });
    await sheetBtn('回去');
    await p.evaluate(() => { G.treasures.push({ n: '古玉', v: 90, tre: true }); G.store = { 柴: 3, 草药: 2, 兽皮: 1 }; save(); render(); });
    await p.screenshot({ path: path.join(shots, '5-home-upgraded.png') });
    await clean('home upgraded');
    await p.click('[data-a="night"]');
  }

  // ---- night with a smart bot ----
  const nightBot = async (mode, maxMs = 120000) => {
    const t0 = Date.now();
    let shot = false;
    while (Date.now() - t0 < maxMs) {
      if (await sheetOpen()) { if (await p.evaluate(() => N && N.picking)) { await p.evaluate(() => choosePerk(N.offer[Math.floor(Math.random() * N.offer.length)])); continue; } return true; }
      await p.evaluate((mode) => {
        if (!N || N.over) return;
        const gs = N.ghosts.slice().sort((a, b) => b.y - a.y);
        const g = gs[0];
        if (!g) return;
        if (mode === 'smart') { const want = { evil: 'sword', fly: 'bow', shade: 'lamp', armor: 'sword' }[g.type]; if (G.item !== want) setItem(want); }
        if (mode !== 'idle') { const c = ghostCenter(g); hitAt(c.x, c.y); }
      }, mode);
      if (!shot && Date.now() - t0 > 4000) { shot = true; await p.screenshot({ path: path.join(shots, `6-night-${mode}.png`) }); }
      await p.waitForTimeout(mode === 'idle' ? 200 : 45);
    }
    return false;
  };
  await p.evaluate(() => { SPEED = 3; });
  ok('night started', ['night', 'guard'].includes(await p.evaluate(() => G.phase)));
  await clean('night');
  // call for help once
  if (await p.locator('#callhelp').count()) { await p.click('#callhelp'); ok('help arrives', await p.evaluate(() => !!N.ally)); }
  const done = await nightBot('smart');
  ok('smart bot finishes night 1', done, await sheetTitle());
  const night1 = await sheetTitle();
  await p.screenshot({ path: path.join(shots, '7-night-end.png') });
  await p.locator('#sheet .sh-btns button').first().click();
  ok('next morning', (await p.evaluate(() => G.day)) === 2, String(await p.evaluate(() => G.day)));

  // ---- balance probes: idle night should break the door; smart on last day ----
  await p.evaluate(() => { G.time = CFG.dusk; startNight(false); });
  await nightBot('idle');
  ok('idle player loses the door', (await sheetTitle()).includes('门破了'), await sheetTitle());
  const lossBody = await p.textContent('#sheet .sh-body');
  ok('door broken takes money/treasure', /抢走了/.test(lossBody), lossBody.slice(0, 80));
  await p.locator('#sheet .sh-btns button').first().click();

  // ---- fast-forward to the last day, die, haunt ----
  await p.click('#menu');
  await p.click('#ff');
  ok('fast-forward', (await p.evaluate(() => G.day)) === await p.evaluate(() => CFG.lifeDays));
  await p.evaluate(() => { G.time = CFG.dusk; startNight(false); });
  await nightBot('smart');
  const lastNight = await sheetTitle();
  await p.locator('#sheet .sh-btns button').first().click();
  await p.waitForTimeout(100);
  ok('death screen', (await p.evaluate(() => G.phase)) === 'death', lastNight);
  await clean('death'); await overflow('death');
  await p.screenshot({ path: path.join(shots, '8-death.png') });
  await p.click('[data-a="haunt"]');
  ok('haunt started', (await p.evaluate(() => G.phase)) === 'haunt');
  await clean('haunt');
  // haunt bot: dodge when any bow is charging, else bash
  const t0 = Date.now(); let hs = false;
  while (Date.now() - t0 < 40000 && !(await sheetOpen())) {
    await p.evaluate(() => { if (!H || H.over) return; if (H.bows.some((b) => b.s === 'charge' && b.c < 0.5)) dodge(); else if (H.dodge <= 0) bash(); });
    if (!hs && Date.now() - t0 > 2500) { hs = true; await p.screenshot({ path: path.join(shots, '9-haunt.png') }); }
    await p.waitForTimeout(40);
  }
  const hr = await sheetTitle();
  ok('haunt ends', !!hr, hr);
  await p.locator('#sheet .sh-btns button').first().click();
  ok('reborn screen', (await p.evaluate(() => G.phase)) === 'reborn');
  await clean('reborn'); await overflow('reborn');
  await p.screenshot({ path: path.join(shots, '10-reborn.png'), fullPage: true });
  const k = await p.evaluate(() => G.reborn.total);
  await p.locator('[data-fam="0"]').click();
  ok('new life', await p.evaluate(() => G.lifeNo === 2 && G.day === 1 && G.phase === 'home'), 'karma ' + k);
  ok('kept 交情 from past life', (await p.evaluate(() => G.friends.wang)) >= 22, String(await p.evaluate(() => G.friends.wang)));

  // ---- guardian path ----
  await p.click('#menu'); await p.click('#ff');
  await p.evaluate(() => { die('old', '测试。'); });
  await p.click('[data-a="guard"]');
  ok('guardian night', (await p.evaluate(() => G.phase)) === 'guard');
  await p.evaluate(() => { SPEED = 3; });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(shots, '11-guard.png') });
  await nightBot('smart');
  await p.locator('#sheet .sh-btns button').first().click();
  ok('guardian → reborn', (await p.evaluate(() => G.phase)) === 'reborn' && (await p.evaluate(() => G.reborn.rows.some((r) => r[0] === '当护家神'))));

  // ---- reload mid-night restarts the night ----
  await p.locator('[data-fam="1"]').click();
  await p.evaluate(() => { G.time = CFG.dusk; startNight(false); });
  await p.reload(); await p.waitForTimeout(300);
  ok('reload during night restarts it', await p.evaluate(() => G.phase === 'night' && N && !N.over));

  // ---- share code import ----
  await p.evaluate(() => { N.over = true; cancelAnimationFrame(raf); G.phase = 'home'; render(); });
  const code = await p.evaluate(() => encode({ ...DEFAULT, hairColor: '#C8402E', top: 'armor' }));
  await p.click('#menu');
  await p.click('#share-look summary');
  await p.fill('#code-in', code);
  await p.click('#use-code');
  ok('share code import', (await p.evaluate(() => ME.hairColor)) === '#C8402E');

  // ---- desktop layout ----
  const d = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const pd = await d.newPage();
  pd.on('pageerror', (e) => errs.push('desktop: ' + e.message));
  await pd.goto('file://' + TMP);
  await pd.evaluate(() => localStorage.clear()); await pd.reload(); await pd.waitForTimeout(200);
  await pd.locator('#sheet .sh-btns button').first().click();
  await pd.evaluate(() => { G.time = CFG.dusk; startNight(false); SPEED = 1; });
  await pd.waitForTimeout(9000);
  await pd.screenshot({ path: path.join(shots, '12-desktop-night.png') });

  console.log('night1:', night1, '| last night:', lastNight, '| haunt:', hr, '| karma:', k);
  console.log('errors', errs);
  await b.close();
})();
