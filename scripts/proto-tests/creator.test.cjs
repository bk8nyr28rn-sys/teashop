const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { OUT, wrap } = require('./lib.cjs');
const TMP = wrap('creator');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errs.push(m.text()));
  await p.goto('file://' + TMP);
  await p.waitForTimeout(400);
  // 每个部件的每一款、三种年龄、五种表情
  const bad = await p.evaluate(() => {
    const out = [];
    const keys = Object.keys(OPT);
    for (const k of keys) for (const [v] of OPT[k]) for (const age of ['child', 'adult', 'elder']) for (const expr of ['calm', 'surprised']) {
      const svg = drawPerson({ ...DEFAULT, [k]: v, streak: k === 'streak' ? v : 'tips' }, expr, age);
      if (/NaN|undefined/.test(svg)) out.push(`${k}=${v} ${age} ${expr}`);
    }
    for (const [id] of EXPRESSIONS) for (const age of ['child', 'adult', 'elder']) { const svg = drawPerson({ ...DEFAULT, streak: 'tips' }, id, age); if (/NaN|undefined/.test(svg)) out.push('expr ' + id + ' ' + age); }
    for (const eye of EXPR_PARTS.eye.map((x) => x[0])) for (const mouth of EXPR_PARTS.mouth.map((x) => x[0])) for (const brow of EXPR_PARTS.brow.map((x) => x[0])) { const svg = drawPerson(DEFAULT, { eye, mouth, brow, fx: EXPR_PARTS.fx.map((x) => x[0]) }, 'adult'); if (/NaN|undefined/.test(svg)) out.push(`combo ${eye} ${mouth} ${brow}`); }
    for (const v of [0, 1]) { const ext = { ...DEFAULT, eyeRot: v * 2 - 1, eyeSquash: v, browY: v, browGap: v, browSize: v, noseY: v, noseSize: v, mouthSize: v, mouthSquash: v, mole: true, moleX: v * 2 - 1, moleY: v * 2 - 1, moleSize: v, glasses: 'round', glassesSize: v, glassesY: v }; const svg = drawPerson(ext, 'calm', 'adult'); if (/NaN|undefined/.test(svg)) out.push('extremes ' + v); }
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) { const t = personaType({ pMove: a, pTalk: a, pExpr: a, pAttitude: b, pQuirk: b }); if (!t.name || !t.line) out.push('persona ' + a + b); }
    for (let i = 0; i < 30; i++) { randomize(); if (/NaN|undefined/.test(document.getElementById('view').innerHTML)) out.push('random ' + i); }
    return out;
  });
  console.log((bad.length ? 'FAIL' : 'PASS') + ' every part, age and expression renders without NaN/undefined', bad.slice(0, 10).join('; '));
  // 捏人码往返
  const roundtrip = await p.evaluate(() => { const s = { ...S, hairColor: '#123456' }; return JSON.stringify(decode(encode(s))) === JSON.stringify(s); });
  console.log((roundtrip ? 'PASS' : 'FAIL') + ' share code round-trip');
  // 电脑尺寸截图：剑客默认 + 灵感
  await p.evaluate(() => { S = { ...DEFAULT }; renderView(); renderPane(); });
  await p.screenshot({ path: path.join(OUT, 'creator-desktop.png') });
  // 灵感角色合影（直接画 SVG）
  const cast = await p.evaluate(() => INSPIRE.map(([n, o]) => `<figure style="margin:0;text-align:center;font:14px sans-serif"><svg viewBox="-20 0 280 400" width="200" height="286">${background('day').replace(/-60/g, '-20').replace(/360/g, '280')}<g style="--skin:${({ ...DEFAULT, ...o }).skin}">${drawPerson({ ...DEFAULT, ...o }, 'calm', 'adult')}</g></svg><figcaption>${n}</figcaption></figure>`).join(''));
  const ages = await p.evaluate(() => ['child', 'adult', 'elder'].map((a) => `<svg viewBox="-20 0 280 400" width="200" height="286"><rect x="-20" width="280" height="400" fill="#E7ECE8"/>${drawPerson({ ...DEFAULT, ...INSPIRE[4][1] }, 'happy', a)}</svg>`).join(''));
  const exprs = await p.evaluate(() => EXPRESSIONS.map(([e, n]) => `<figure style="margin:0;text-align:center;font:13px sans-serif"><svg viewBox="20 -20 200 170" width="140" height="119"><rect x="0" y="-40" width="240" height="400" fill="#E7ECE8"/>${drawPerson({ ...DEFAULT, ...INSPIRE[2][1] }, e, 'adult')}</svg><figcaption>${n}</figcaption></figure>`).join(''));
  const p2 = await ctx.newPage();
  await p2.setContent(`<body style="margin:0;padding:20px;background:#fff;font-family:sans-serif"><h3>灵感角色</h3><div style="display:flex;gap:10px;flex-wrap:wrap">${cast}</div><h3>同一个人：童年 / 成年 / 老年</h3><div style="display:flex;gap:10px">${ages}</div><h3>表情库</h3><div style="display:flex;gap:8px;flex-wrap:wrap;max-width:1100px">${exprs}</div></body>`);
  await p2.screenshot({ path: path.join(OUT, 'creator-cast.png'), fullPage: true });
  // 性格页：滑块和“听听声音”
  await p.evaluate(() => { S = { ...DEFAULT, draw: emptyDraw(), glasses: 'round', mole: true, nose: 'hook' }; view.tab = 'persona'; renderTabs(); renderPane(); renderView(); });
  await p.fill('#r-pAttitude', '7');
  await p.dispatchEvent('#r-pAttitude', 'input');
  await p.click('#speak');
  await p.waitForTimeout(300);
  console.log(((await p.textContent('#persona b')) ? 'PASS' : 'FAIL') + ' persona label shows');
  await p.screenshot({ path: path.join(OUT, 'creator-persona.png') });
  await p.evaluate(() => { view.tab = 'features'; renderTabs(); renderPane(); renderView(); });
  await p.screenshot({ path: path.join(OUT, 'creator-features.png'), fullPage: true });
  // 手机尺寸：打开服装页、调色盘
  const m = await b.newContext({ ...devices['iPhone 13'] });
  const pm = await m.newPage();
  pm.on('pageerror', (e) => errs.push('mobile: ' + e.message));
  await pm.goto('file://' + TMP);
  await pm.waitForTimeout(300);
  await pm.tap('#tab-outfit');
  await pm.tap('#pk-topColor');
  const hBox = await pm.locator('#h-topColor').boundingBox();
  await pm.locator('#h-topColor').scrollIntoViewIfNeeded();
  await pm.screenshot({ path: path.join(OUT, 'creator-mobile.png') });
  const overflow = await pm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log((!overflow && hBox ? 'PASS' : 'FAIL') + ' mobile: no horizontal overflow, colour picker opens');
  console.log('errors', errs);
  await b.close();
})();
