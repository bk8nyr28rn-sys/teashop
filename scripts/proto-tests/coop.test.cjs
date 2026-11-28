// 一起守夜（docs/proto/coop）：族人被砸门，点「去帮忙」两个人一起打；不去就不进来；一个人也能试（电脑当族人）。
// 守夜直接跑规则核心，打完照记录重放，结果要一样
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { OUT, ROOT } = require('./lib.cjs');

const url = (entry) => pathToFileURL(path.join(ROOT, entry)).href;
// 自动打：盯离门最近的鬼；挑本事点第一个能点的
const drive = (who) => `window.__drive = setInterval(() => {
  if (!view || view.over) return;
  if (view.picking) { const b = document.querySelector('[data-perk]:not([disabled])'); if (b) b.click(); return; }
  const g = view.ghosts.slice().sort((a, b) => b.y - a.y)[0]; if (!g) return;
  act({ type: 'item', item: '${who}' === 'host' ? (g.type === 'shade' ? 'lamp' : 'sword') : 'bow' });
  act({ type: 'hitAt', x: g.x + g.ox, y: g.y - 44 * g.k });
}, 110)`;

async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'page overflow');
}

async function twoTabs(browser, width, height, entry) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const errors = [];
  const A = await ctx.newPage(), B = await ctx.newPage();
  for (const p of [A, B]) { p.setDefaultTimeout(8000); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); }
  try {
    await A.goto(url(entry)); await B.goto(url(entry));
    await noOverflow(A);
    // 族人先点「不去」：不进来，主人那边还在等
    await B.locator('[data-a=wait]').click();
    await A.locator('[data-a=host]').click();
    await B.locator('[data-a=no]').click();
    await A.waitForTimeout(1500);
    assert.equal(await B.locator('[data-a=go]').count(), 0, '点了不去，这一夜不再弹');
    assert.match(await A.locator('#nstatus').innerText(), /等人来帮忙/);
    await A.locator('[data-a=back]').count();
    // 再开一夜：这回去帮忙
    await A.evaluate(() => renderMenu());
    await A.locator('[data-a=host]').click();
    await B.locator('[data-a=go]').click();
    await B.locator('#nsvg').waitFor();
    await A.waitForFunction(() => view && view.guests.length === 1);
    assert.match(await A.locator('#nstatus').innerText(), /林大.*一起打/);
    await noOverflow(A); await noOverflow(B);
    // 族人换家伙：主人那边看得到
    await B.locator('[data-item=lamp]').click();
    await A.waitForFunction(() => view.guests[0].item === 'lamp');
    await A.evaluate(drive('host')); await B.evaluate(drive('guest'));
    await A.waitForTimeout(2500);
    await A.screenshot({ path: path.join(OUT, `coop-host-${width}.png`) });
    await B.screenshot({ path: path.join(OUT, `coop-guest-${width}.png`) });
    await A.locator('#verify').waitFor({ timeout: 120000 });
    await B.locator('#verify').waitFor();
    for (const p of [A, B]) assert.match(await p.locator('#verify').innerText(), /一致/);
    assert.equal(await A.locator('h1').innerText(), await B.locator('h1').innerText());
    assert.match(await A.locator('.stat').innerText(), /林小 \+ 林大/);
    await noOverflow(A);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}×${height} 两个标签一起打：不去就不进来、去了一起打、族人换家伙主人看得到、两边结果一样、重放一致`);
  } finally { await ctx.close(); }
}

async function solo(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(url('prototype/coop.html'));
    await page.locator('[data-a=bot]').click();
    await page.waitForFunction(() => view && view.guests.length === 1, null, { timeout: 15000 });
    await page.evaluate(drive('host'));
    await page.locator('#verify').waitFor({ timeout: 120000 });
    assert.match(await page.locator('#verify').innerText(), /一致/);
    assert.match(await page.locator('.stat').innerText(), /林大（电脑）/);
    assert.deepEqual(errors, []);
    console.log('PASS 一个人试：电脑当族人进来一起打，离线版也能打，重放一致');
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch();
  try {
    await twoTabs(browser, 390, 844, 'docs/proto/coop/index.html');
    await twoTabs(browser, 320, 640, 'prototype/coop.html');
    await solo(browser);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
