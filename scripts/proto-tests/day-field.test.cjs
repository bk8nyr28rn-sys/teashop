const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { wrap } = require('./lib.cjs');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const button = id => page.locator('[data-a="' + id + '"]');
    const spot = id => page.locator('[data-spot="' + id + '"]');
    await page.goto(pathToFileURL(wrap('loop')).href);
    await page.getByRole('button', { name: /开始/ }).first().click();
    assert.equal(await page.evaluate(() => G.field), undefined, '线索在第一次看地图时才抽取');
    await page.evaluate(() => { G.unlimitedDays = true; save(); SPEED = 50; });
    await button('out').click();
    await page.locator('#sheet .sh-btns button', { hasText: /一个人|独行/ }).first().click();
  await page.locator('[data-r-target="far"]').click();
  await page.locator('#mapsvg').waitFor();
    const initial = await page.evaluate(() => G.field.clues);
    assert.equal(initial.length, 8);
    for (let i = 0; i < 8; i++) {
      await spot(i).click();
      const text = await page.locator('.plan').innerText();
      const expected = await page.evaluate(i => siteClue(SPOTS[i]).text, i);
      assert.ok(text.includes(expected), '地图线索 ' + i);
      await button('go').click();
      await page.locator('.field-scene').waitFor();
      assert.equal(await page.locator('.field-acts button').count(), 3);
      assert.match(await button('gather').innerText(), /分钟.*件.*危险[低中高]/);
      assert.match(await button('rich').innerText(), /分钟.*件.*危险[低中高]/);
      assert.match(await button('mark').innerText(), /10 分钟.*翻倍.*无危险/);
      assert.equal(await page.locator('.field-scene').innerText(), await page.evaluate(i => SPOTS[i].scene, i));
      if (i === 7) break;
      await page.evaluate(() => { G.time = CFG.dayStart; });
    }
    await page.reload();
    assert.deepEqual(await page.evaluate(() => G.field.clues), initial);
    assert.equal(await page.evaluate(() => G.at), 7);

    // 每地的两条线索都核实真实抽样结果，同时验证换线索会改变深入行动。
    const sampled = await page.evaluate(() => {
      const rng = Math.random;
      const result = [];
      try {
        G.buddy = 'wang';
        for (const sp of SPOTS) {
          const actions = [];
          for (let c = 0; c < sp.clues.length; c++) {
            G.field.clues[sp.id] = c;
            const clue = siteClue(sp);
            const action = fieldAction(sp, true);
            let focusCount = 0;
            for (let n = 0; n < 1000; n++) {
              Math.random = () => (n + .5) / 1000;
              const item = rollLoot(sp);
              if ((item.tre ? '宝物' : item.n) === clue.focus) focusCount++;
            }
            actions.push({ name: action.name, expected: (sp.loot[clue.focus] || 0) * 7 + 300, focusCount });
          }
          result.push(actions);
        }
      } finally { Math.random = rng; }
      return result;
    });
    for (const actions of sampled) {
      assert.notEqual(actions[0].name, actions[1].name);
      for (const a of actions) {
        assert.equal(a.focusCount, a.expected, a.name);
        assert.ok(a.focusCount > 0 && a.focusCount < 1000);
      }
    }
    const setup = (id, buddy = null) => page.evaluate(({ id, buddy }) => {
      closeSheet(); G.at = id; G.target = null; G.buddy = buddy; G.time = CFG.dayStart; G.bag = [];
      G.field.visits = {}; G.field.encounter = null; G.shareRemainder = {};
      Math.random = () => .99; save(); render();
    }, { id, buddy });
    for (const id of [4, 6]) {
      await setup(id);
      const solo = await button('rich').innerText();
      const minute = await page.evaluate(id => fieldAction(SPOTS[id], true).minutes, id);
      assert.ok(solo.includes(await page.evaluate(id => SPOTS[id].solo, id)));
      await setup(id, 'wang');
      assert.ok(!(await button('rich').innerText()).includes(await page.evaluate(id => SPOTS[id].solo, id)));
      assert.equal(await page.evaluate(id => fieldAction(SPOTS[id], true).minutes, id) - minute, 10);
    }

    await setup(2, 'wang');
    await button('gather').click();
    assert.equal(await page.evaluate(() => G.bag.length), 2);
    await page.reload();
    await page.evaluate(() => { Math.random = () => .99; });
    assert.match(await button('gather').innerText(), /1 件/);
    await button('gather').click();
    assert.equal(await page.evaluate(() => G.bag.length), 2, '跨刷新累计第 3 件分给伙伴');
    assert.match(await page.locator('#toast').innerText(), /分到/);
    assert.match(await button('gather').innerText(), /0–1 件/);
    await button('gather').click();
    assert.ok(await button('gather').isDisabled(), '当日三次后此地采尽');
    const before = await page.evaluate(() => ({ time: G.time, bag: G.bag }));
    await button('mark').click();
    assert.equal(await page.evaluate(() => G.time), before.time + 10);
    assert.deepEqual(await page.evaluate(() => G.bag), before.bag);
    assert.ok(await button('mark').isDisabled());
    await page.reload();
    assert.ok(await button('mark').isDisabled());
    assert.ok(await button('gather').isDisabled());
    await page.evaluate(() => { Math.random = () => 0; G.day++; G.time = CFG.dayStart; G.buddy = null; G.bag = []; render(); });
    assert.deepEqual(await page.evaluate(() => G.field.clues), Array(8).fill(0));
    assert.deepEqual(await page.evaluate(() => G.field.visits), {});
    assert.equal(await page.evaluate(() => fieldAction(SPOTS[2], false).double), false);
    await page.evaluate(() => { Math.random = () => .99; G.buddy = 'wang'; render(); });
    assert.match(await button('gather').innerText(), /4 件/);
    await button('gather').click();
    assert.equal(await page.evaluate(() => G.bag.length), 3, '翻倍的 4 件中有 1 件分给伙伴');
    assert.equal(await page.evaluate(() => G.field.bonus[2]), undefined);
    await page.reload();
    assert.equal(await page.evaluate(() => fieldAction(SPOTS[2], false).double), false);
    await setup(0);
    await button('mark').click();
    await page.evaluate(() => { G.day += 2; render(); });
    assert.deepEqual(await page.evaluate(() => G.field.bonus), {}, '隔一天失约不会再翻倍');

    await setup(7, 'wang');
    await page.evaluate(() => { G.field.clues[7] = 0; G.shareRemainder.wang = 1; Math.random = () => 0; });
    await button('gather').click();
    await page.getByRole('button', { name: /^打（/ }).waitFor();
    assert.equal(await page.evaluate(() => G.bag[0].tre), true);
    const foe = await page.locator('#sh-t').innerText();
    await page.reload();
    assert.equal(await page.locator('#sh-t').innerText(), foe);
    await page.evaluate(() => { Math.random = () => 0; });
    await page.getByRole('button', { name: /^打（/ }).click();
    assert.match(await page.locator('#sheet').innerText(), /赢了.*分到/s);
    assert.equal(await page.evaluate(() => G.bag.length), 1, '战利宝物也参与分成');
    await page.getByRole('button', { name: '知道了' }).click();
    await setup(5);
    await page.evaluate(() => { Math.random = () => 0; });
    await button('rich').click();
    const time = await page.evaluate(() => G.time);
    await page.getByRole('button', { name: /^跑（/ }).click();
    assert.equal(await page.evaluate(() => G.time), time + 30);
    assert.equal(await page.evaluate(() => G.field.encounter), null);
    await setup(3);
    await page.evaluate(() => { G.time = CFG.dusk - 5; });
    await button('mark').click();
    assert.match(await page.locator('#sheet').innerText(), /刚记好位置，天就黑了/);
    await page.reload();
    assert.match(await page.locator('#sheet').innerText(), /刚记好位置，天就黑了/);
    assert.deepEqual(errors, []);
    console.log('PASS 八地场面、16 条概率线索、独行潜入、分成、重复采集、隔日标记和遇险存档');
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
