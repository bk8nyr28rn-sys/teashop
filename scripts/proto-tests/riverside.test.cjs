const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { wrap, OUT, enableAllFeatures } = require('./lib.cjs');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      offline: true,
    });
    const errors = [],
      external = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('request', (req) => {
      if (/^https?:/.test(req.url())) external.push(req.url());
    });
    page.setDefaultTimeout(3500);
    await page.goto(pathToFileURL(wrap('loop')).href);
    assert.equal(await page.title(), '一日一夜');
    const button = (name) => page.getByRole('button', { name, exact: true });
    const click = (selector) => page.locator(selector).first().click();
    const at = async (id) => {
      await click('[data-r-target="' + id + '"] > rect:last-child');
      if (id === 'far') await page.locator('#mapsvg').waitFor();
      else
        await page.waitForFunction(
          (id) => G.river.focus === id && !document.querySelector('#rb-map[aria-busy="true"]'),
          id,
        );
    };
    const act = (id) => click('[data-r-act="' + id + '"]');
    const openHeld = () => click('[data-r-held]');
    const emptyGround = async () => {
      const map = page.locator('#rb-map');
      await map.tap({ position: { x: 30, y: 40 } });
      await page.waitForFunction(() => G.river.focus === null && !document.querySelector('#rb-actions'));
    };
    const study = () => page.evaluate(() => JSON.parse(JSON.stringify(G.river)));
    const snap = async (file) => {
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(OUT, 'river-' + file + '.png') });
    };
    await button('开始').click();
    await enableAllFeatures(page);
    await click('[data-a="out"]');
    await button('一个人去').click();
    const initial = await page.evaluate(() => JSON.stringify(G));
    const reset = async () => {
      // 用同一清晨的快照测试互斥路线，如“同一根木头烧柴或搭桥”。
      await page.goto('about:blank');
      await page.goto(pathToFileURL(wrap('loop')).href);
      await page.evaluate((s) => {
        localStorage.setItem('wulin-loop', s);
        location.reload();
      }, initial);
      await page.locator('#rb-map').waitFor();
    };
    assert.equal(await page.locator('[data-r-target^="wood"]').count(), 3);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await snap('01-wharf');
    assert.match(await page.locator('#rb-hint').innerText(), /点石板路/);
    await page.reload();
    assert.equal(await page.locator('#rb-hint').count(), 0, '刷新不会再提示如何走路');
    assert.equal(await page.locator('#rb-description,.rb-panel').count(), 0);
    for (const id of ['stone', 'herb', 'wood0', 'rope', 'porter']) {
      await at(id);
      await act('hail');
      assert.ok((await study()).record.events.at(-1).内容.startsWith('招呼'));
    }
    assert.match(await page.locator('#rb-speech').innerText(), /我来搭手/);
    await page.locator('#rb-speech').waitFor({ state: 'detached', timeout: 5500 });
    await act('carry');
    assert.match((await study()).msg, /扁担/);
    await act('tie');
    assert.match((await study()).msg, /麻绳/);
    await at('rope');
    await act('carry');
    assert.equal((await study()).belt, true);
    assert.match(await page.locator('#rb-hint').innerText(), /头顶/);
    await at('porter');
    await act('tie');
    assert.equal((await study()).helped, true);
    assert.equal(await page.locator('#rb-speech .rb-speaker').count(), 1, '初次道谢带周伯的头像');
    await page.reload();
    await at('wood0');
    await act('tie');
    assert.equal((await study()).wood.filter((w) => w === 'raft').length, 2);
    assert.equal((await study()).belt, false);
    await snap('02-raft');
    // 旧存档无文字开关时默认关闭。开关只影响河埠描述，刷新依然生效。
    await click('#menu');
    assert.equal(await page.locator('#river-text').isChecked(), false);
    await page.locator('#river-text').check();
    await button('关上').click();
    await at('raft');
    assert.match(await page.locator('#rb-description').innerText(), /绳结扣得很牢/);
    await page.reload();
    assert.match(await page.locator('#rb-description').innerText(), /绳结扣得很牢/);
    await click('#menu');
    await page.locator('#river-text').uncheck();
    await button('关上').click();
    await emptyGround();
    assert.equal(await page.locator('#rb-actions').count(), 0);
    await at('raft');
    for (const width of [320, 390, 900]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const fits = await page.evaluate(() => {
        const target = document
          .querySelector('[data-r-target="raft"] > rect:last-child')
          .getBoundingClientRect();
        const board = document.querySelector('#rb-board').getBoundingClientRect(),
          menu = document.querySelector('#rb-actions').getBoundingClientRect();
        return (
          menu.left >= board.left &&
          menu.right <= board.right &&
          menu.top >= board.top &&
          menu.bottom <= board.bottom &&
          (menu.bottom <= target.top ||
            menu.top >= target.bottom ||
            menu.right <= target.left ||
            menu.left >= target.right)
        );
      });
      assert.ok(fits, '木排按钮在边界内且不挡木排 ' + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await act('untie');
    assert.equal((await study()).belt, true);
    await at('wood0');
    await act('tie');
    await at('wood2');
    const beforeLift = await page.evaluate(() => G.time);
    await act('carry');
    assert.equal((await page.evaluate(() => G.time)) - beforeLift, 3);
    await at('ditch');
    await act('bridge');
    assert.equal((await study()).bridge, true);
    await at('market');
    await act('noon');
    await act('market');
    assert.match(await page.locator('.rb-greeting').innerText(), /周伯认出了你/);
    assert.match(await page.locator('.rb-greeting').innerText(), /草药|采药/);
    await snap('03-market');
    await button('回去').click();
    await at('ditch');
    assert.equal(await page.locator('[data-r-act="bridgeHome"]').count(), 0);
    await at('stone');
    await act('carry');
    await at('raft');
    const raftStart = await page.evaluate(() => G.time);
    await act('raftHome');
    await button('院门右边').click();
    assert.equal((await page.evaluate(() => G.time)) - raftStart, 5);
    assert.equal(await page.locator('[data-yard-stone="2"]').count(), 1);
    await page.reload();
    await click('[data-a="night"]');
    assert.equal(await page.locator('#nsvg [data-yard-stone="2"]').count(), 1);
    await page.waitForTimeout(650); // 等昼夜主题渐变结束再留图。
    await snap('04-night');
    await page.evaluate(() => {
      cancelAnimationFrame(raf);
      endNight(true);
    });
    await button('天亮了').click();
    await page.evaluate(() => {
      if (!$('sheet').hidden) closeSheet();
    });
    assert.equal(await page.evaluate(() => G.day), 2);
    await click('[data-a="river"]');
    await button('一个人去').click();
    let r = await study();
    assert.ok(r.raft && r.bridge && r.helped && r.stone === 'yard');
    await at('ditch');
    const bridgeStart = await page.evaluate(() => G.time);
    await act('bridgeHome');
    await page.locator('[data-a="out"]').waitFor();
    assert.equal((await page.evaluate(() => G.time)) - bridgeStart, 12);
    await click('[data-a="out"]');
    await button('一个人去').click();
    await page.locator('#mapsvg').waitFor();
    await reset();
    await at('wood0');
    await act('carry');
    await openHeld();
    await act('drop');
    assert.equal((await study()).hand, null);
    await act('carry');
    await at('home');
    const walkStart = await page.evaluate(() => G.time);
    await act('walkHome');
    await page.locator('[data-a="market"]').waitFor();
    assert.equal((await page.evaluate(() => G.time)) - walkStart, 30);
    await click('[data-a="market"]');
    await page.getByRole('button', { name: '卖 1 件柴' }).click();
    assert.equal(await page.evaluate(() => G.money), 23);
    await reset();
    await at('herb');
    await act('carry');
    assert.equal(await page.evaluate(() => G.bag[0].n), '草药');
    await at('rope');
    await act('tie');
    assert.equal((await study()).belt, true);
    await openHeld();
    await act('dropRope');
    await act('carry');
    await at('stone');
    await act('tie');
    assert.equal((await study()).hand, 'stone');
    await openHeld();
    await act('drop');
    await at('far');
    assert.equal((await page.locator('[data-spot]').count()) >= 8, true);
    await click('[data-a="home"]');
    assert.equal(await page.evaluate(() => G.store['草药']), 1, '从原地图立刻折返，河埠采的药也入库');
    await reset();
    await page.evaluate(() => {
      G.time = 710;
      save();
      render();
    });
    await at('herb');
    await act('carry');
    assert.match((await study()).msg, /够不着/);
    await at('rope');
    await act('carry');
    await at('herb');
    await act('tie');
    assert.equal(await page.evaluate(() => G.bag.length), 1);
    await at('home');
    await act('walkHome');
    await page.locator('[data-a="market"]').waitFor();
    assert.equal(await page.evaluate(() => G.store['草药']), 1);
    await click('#menu');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (s) => {
            window.copied = s;
          },
        },
      });
    });
    await click('#copy-river-log');
    const copied = await page.evaluate(() => JSON.parse(window.copied));
    assert.ok(copied.顺序.some((e) => e.事件 === '决定回家'));
    assert.ok(copied.顺序.filter((e) => e.事件 === '搭配').length >= 3);
    assert.ok(Object.keys(copied.附近停留秒).length > 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(
      'PASS 河埠 3 × 5 搭配、木柴出售、搭桥/解绳、三路回家、午集认人、夜间院石、跨日存档、试玩记录与离线加载',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
