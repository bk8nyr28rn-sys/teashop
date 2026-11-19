const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { ROOT, OUT } = require('./lib.cjs');

async function checkEdition(browser, gamePath, creatorPath, takeScreenshots) {
  const gameURL = pathToFileURL(path.join(ROOT, gamePath)).href;
  const creatorURL = pathToFileURL(path.join(ROOT, creatorPath)).href;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, offline: true });
  const external = [], errors = [];
  try {
    // 即使请求被断网阻止，只要尝试访问外部也让测试失败。
    await context.route(/^https?:/i, route => { external.push(route.request().url()); return route.abort(); });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(creatorURL);
    assert.equal(await page.locator('#embed-actions').isVisible(), false);
    await page.locator('#tab-acc').click();
    await page.locator('#o-head-pin').click();
    const standalone = await page.evaluate(() => localStorage.getItem('wulin-creator'));
    assert.equal(JSON.parse(standalone).head, 'pin');
    const localFonts = async doc => {
      const fonts = await doc.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family);
      });
      assert.ok(fonts.some(f => f.includes('Noto Sans SC')) && fonts.some(f => f.includes('ZCOOL KuaiLe')));
    };
    await localFonts(page);
    await page.goto(gameURL);
    await localFonts(page);
    await page.getByRole('button', { name: '先捏个人' }).click();
    const frame = page.frameLocator('#avatar-dialog iframe');
    const finish = frame.getByRole('button', { name: '完成，回到游戏' });
    await frame.locator('#finish-look:enabled').waitFor();
    assert.equal(page.frames()[1].url(), creatorURL + '?embed=1');
    await frame.locator('#tab-acc').click();
    assert.equal(await frame.locator('#o-head-band').getAttribute('aria-pressed'), 'true');
    await frame.locator('#o-head-hat').click();
    await frame.locator('body').evaluate(el => el.ownerDocument.defaultView.scrollTo(0, 0));
    if (takeScreenshots) await page.screenshot({ path: path.join(OUT, 'creator-in-game.png'), animations: 'disabled' });
    await finish.click();
    await page.locator('#avatar-dialog').waitFor({ state: 'hidden' });
    const readSave = () => page.evaluate(() => localStorage.getItem('wulin-loop'));
    const saved = await readSave();
    assert.equal(JSON.parse(saved).look.head, 'hat');
    assert.equal(await page.evaluate(() => ME.head), 'hat');
    if (takeScreenshots) await page.screenshot({ path: path.join(OUT, 'back-in-game.png'), animations: 'disabled' });
    await page.reload();
    assert.equal(await page.evaluate(() => ME.head), 'hat');
    await page.setViewportSize({ width: 320, height: 640 });
    await page.locator('#menu').click();
    await page.getByRole('button', { name: '改样子' }).click();
    await frame.locator('#finish-look:enabled').waitFor();
    await frame.locator('#tab-acc').click();
    assert.equal(await frame.locator('#o-head-hat').getAttribute('aria-pressed'), 'true');
    // 来自真实编辑器的无效部件也不能写入游戏。
    await frame.locator('body').evaluate(() => sendAvatar(parent, 'finish', { look: { head: 'unknown' } }));
    await frame.getByText('形象数据无效，请检查后重试。').waitFor();
    assert.equal(await readSave(), saved);
    await frame.locator('#o-head-flower').click();
    await frame.getByRole('button', { name: '取消' }).click();
    await page.locator('#avatar-dialog').waitFor({state:'hidden'});
    assert.equal(await readSave(), saved);
    assert.equal(await page.evaluate(() => ME.head), 'hat');
    await page.goto(creatorURL);
    assert.equal(await page.evaluate(() => localStorage.getItem('wulin-creator')), standalone);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    console.log(`PASS ${gamePath}: offline fonts and iframe, first launch and settings, commit, reload, cancel, isolated standalone draft; zero external requests`);
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch();
  try {
    await checkEdition(browser, 'docs/proto/loop/index.html', 'docs/art/creator/index.html', false);
    await checkEdition(browser, 'prototype/loop.html', 'prototype/creator.html', true);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
