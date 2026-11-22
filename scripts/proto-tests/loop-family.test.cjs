const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('node:util');
const { OUT, wrap, enableUnlimitedDays, enableAllFeatures } = require('./lib.cjs');
const TMP = wrap('loop');
const ok = (n, c, x = '') => console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + TMP);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200);
  await p.getByRole('button', {name:'开始', exact:true}).click();
  await enableAllFeatures(p);
    await enableUnlimitedDays(p);
  ok('has a name and grade', await p.evaluate(() => !!G.name && G.grade === '良才' && G.power === 1.05), await p.evaluate(() => `${G.name} ${G.grade}`));
  ok('clock shows 时辰', /个时辰/.test(await p.textContent('.clock')));
  await p.evaluate(() => nextMorning());
  ok('day 2 match offer', (await p.textContent('#sh-t')).includes('长大'));
  await p.screenshot({ path: path.join(OUT, 'loop', 'f1-match.png') });
  await p.locator('#sheet .sh-btns button').first().click();
  ok('spouse set', await p.evaluate(() => !!G.spouse && G.love === 10));
  await p.evaluate(() => { G.chest = 100; save(); render(); });
  await p.click('[data-a="family"]');
  await p.locator('#sheet .sh-btns button', { hasText: '陪伴' }).click();
  ok('accompany raises love and costs time', await p.evaluate(() => G.love >= 22 && G.time === CFG.dayStart + 120));
  await p.locator('#sheet .sh-btns button', { hasText: '收个徒弟' }).click();
  ok('disciple taken', await p.evaluate(() => G.kids.some((k) => k.kind === '徒')));
  await p.evaluate(() => { G.love = 50; nextMorning(); });
  ok('child born with grade from thread', await p.evaluate(() => G.kids.some((k) => k.kind !== '徒' && k.grade === '上等')), await p.textContent('#sh-t'));
  await p.locator('#sheet .sh-btns button').first().click();
  await p.screenshot({ path: path.join(OUT, 'loop', 'f2-home.png') });
  await p.evaluate(async () => { G.time = CFG.dusk; await startNight(false); });
  ok('family helps at night', await p.evaluate(() => N.fam.length === 3), String(await p.evaluate(() => N.fam.length)));
  await p.evaluate(() => { SPEED = 3; });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(OUT, 'loop', 'f3-night.png') });
  await p.evaluate(() => {
    N.over = true; cancelAnimationFrame(raf);
    River.enter(); G.river.stone = 'yard'; G.river.yardSlot = 2;
    G.chest = 100; G.store = {柴:3}; G.door = 1; G.traps = {crossbow:2,lamp:1,talisman:1};
    G.treasures = [{n:'古玉',v:90}]; die('old', '测试。');
  });
  await p.click('[data-a="skip"]');
  ok('own family offered first', await p.evaluate(() => G.reborn.fams[0].own === true));
  const heirs = await p.evaluate(() => G.kids.map(k => k.name));
  const ownChoices = p.locator('[data-fam]').filter({ hasText: '回自己家投胎' });
  ok('one choice per heir, plus two other households', heirs.length === 2 && await ownChoices.count() === 2 && await p.locator('[data-fam]').count() === 4);
  ok('both choices name the corresponding heir', (await ownChoices.allTextContents()).every((text, i) => text.includes(`做${heirs[i]}的孩子`)));
  // 模拟旧版已经停在奈何桥的存档：第二个后人需要补上，原来三户不能重抽。
  const originalFamilies = await p.evaluate(() => {
    G.reborn.fams.splice(1, 1); save();
    return G.reborn.fams;
  });
  await p.reload();
  ok('old save gains its second heir and keeps existing candidates', await ownChoices.count() === 2 &&
    isDeepStrictEqual(await p.evaluate(() => G.reborn.fams.filter((_, i) => i !== 1)), originalFamilies));
  const choices = await p.evaluate(() => G.reborn.fams);
  const bridgeSave = await p.evaluate(() => {
    const old = { ...G, v: 3, money: G.chest };
    for (const key of ['chest','purse','goods','personalTreasures','houseId','lifeId','abandoned',
      'receipts','nightId','nightPlan','nightReceipt','estateSettled']) delete old[key];
    old.ancestors = old.ancestors.filter(a => !a.lifeId);
    return JSON.parse(JSON.stringify(old));
  });
  // 两个独立新标签各自载入同一份奈何桥旧档，用页面上的候选卡核对实收。
  for (const [index, own] of [[0, true], [choices.findIndex(f => !f.own), false]]) {
    const branch = await b.newPage({ viewport: { width: 320, height: 640 } });
    try {
      await branch.addInitScript(save => {
        for (const f of save.reborn.fams.filter(f => f.own)) {
          f.money = 60; delete f.store;
        }
        localStorage.setItem('wulin-loop', JSON.stringify(save));
      }, bridgeSave);
      await branch.goto('file://' + TMP);
      const card = branch.locator('[data-fam="' + index + '"]');
      const actualMoney = own ? 100 : choices[index].money;
      ok('旧档候选卡金额与当前家庭一致', (await card.innerText()).includes(actualMoney + ' 文'));
      await card.click();
      const assets = await branch.evaluate(() => [G.chest, G.store, G.parents[0].rel, G.own]);
      ok(own ? '投回徒弟家，100 文和柴 3 件原样留下' : '投别家，只得该候选卡的家产', assets[0] === actualMoney &&
        assets[3] === own && (own ? assets[1].柴 === 3 && assets[2].includes('上一世你的徒弟') : Object.keys(assets[1]).length === 0));
    } finally { await branch.close(); }
  }
  await p.reload();
  ok('heir choices persist on reload', isDeepStrictEqual(await p.evaluate(() => G.reborn.fams), choices));
  await p.screenshot({ path: path.join(OUT, 'loop', 'f4-reborn.png'), fullPage: true, animations: 'disabled' });
  const prevName = await p.evaluate(() => G.name);
  ok('候选卡写明实收 100 文', (await ownChoices.nth(1).innerText()).includes('100 文'));
  await ownChoices.nth(1).click();
  ok('回家钱、仓货、门、机关、宝物、院石全部保留', await p.evaluate(() =>
    G.chest === 100 && G.purse === 0 && G.store.柴 === 3 && G.door === 1 && G.traps.crossbow === 2 &&
    G.traps.lamp === 1 && G.traps.talisman === 1 && G.treasures[0].n === '古玉' &&
    G.river.stone === 'yard' && G.river.yardSlot === 2));
  ok('second heir becomes the parent', await p.evaluate(name => G.own && G.lifeNo === 2 && G.parents[0].name === name && /上一世你的[儿女]/.test(G.parents[0].rel), heirs[1]));
  ok('ancestor portrait of past self', await p.evaluate((n) => G.ancestors.some((a) => a.name === n), prevName));
  await p.click('[data-a="family"]');
  const parent = await p.locator('#sheet .list li').first().textContent();
  ok('family panel names the selected heir as parent', parent.startsWith(heirs[1]) && /[爹娘]（上一世你的[儿女]/.test(parent), parent);
  await p.screenshot({ path: path.join(OUT, 'loop', 'f4-parent.png'), animations: 'disabled' });
  await p.locator('#sheet .sh-btns button', { hasText: '去祠堂' }).click();
  ok('hall renders portraits', (await p.locator('.pt').count()) >= 1);
  await p.screenshot({ path: path.join(OUT, 'loop', 'f5-hall.png') });
  await p.evaluate(() => { closeSheet(); G.allFeatures = false; save(); render(); });
  await p.click('[data-a=build]');
  ok('回自家第一天不显示买机关', await p.locator('[data-buy]').count() === 0);
  await p.getByRole('button',{name:'回去',exact:true}).click();
  await p.click('[data-a=night]');
  await p.click('[data-a=manual]');
  await p.locator('#nsvg').waitFor();
  ok('两台祖传弩机首夜各射一箭', await p.evaluate(() => {
    cancelAnimationFrame(raf);
    spawnGhost(N.spawns[0]); N.spawns = [];
    const g = N.ghosts[0]; g.y = 230;
    const before = g.hp;
    for (let i=0; i<29; i++) nightStep(.05);
    return G.day === 1 && N.bows.length === 2 && before - g.hp === 2 * NIGHT.bowDmg;
  }));
  ok('回自家首夜即使有祖传弩机，五波也都只排普通鬼', await p.evaluate(() =>
    G.own && !Guidance.open(2) && [3,4,6,7,9].every((count, w) => {
      startWave(w);
      return N.spawns.length === count && N.spawns.every(g => g.type === 'evil');
    })));
  ok('no NaN', !(await p.evaluate(() => /NaN|undefined/.test(document.body.innerHTML.replace(/<script[\s\S]*<\/script>/, '')))));
  console.log('errors', errs);
  await b.close();
})();
