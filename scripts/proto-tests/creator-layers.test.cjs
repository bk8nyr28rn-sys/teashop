const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { OUT, ROOT, enableAllFeatures } = require('./lib.cjs');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: {width: 390, height: 844}, hasTouch: true, offline: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(ROOT, 'prototype/loop.html')).href);
    await page.getByRole('button', {name:'先捏个人'}).click();
    const editor = page.frameLocator('#avatar-dialog iframe');
    await editor.locator('#finish-look:enabled').waitFor();
    const frame = await (await page.locator('#avatar-dialog iframe').elementHandle()).contentFrame();
    const snap = name => page.screenshot({path:path.join(OUT,`draw-${name}.png`),animations:'disabled'});
    assert.ok(await editor.locator('#draw-intro').isVisible());
    const tabs = editor.getByRole('tab');
    assert.equal(await tabs.nth(1).getAttribute('id'), 'tab-draw');
    for (const id of await tabs.evaluateAll(items => items.map(item => item.id))) {
      await editor.locator('#' + id).click();
      await frame.evaluate(() => window.scrollTo(0, 0));
      assert.ok(await editor.locator('#draw-self').evaluate(el => {
        const box = el.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight && el.contains(document.elementFromPoint(box.x + box.width/2, box.y + box.height/2));
      }), id + ' 首屏入口');
      await snap(id);
    }
    await editor.locator('#tab-body').click();
    await editor.locator('#blank-base').click();
    await editor.locator('#tab-hair').click();
    await editor.locator('#draw-self').click();
    const color = hex => editor.locator(`.drawtools [data-c="${hex}"]`).first().click();
    const width = value => editor.locator(`[id="d-width-${value}"]`).click();
    async function stroke(points) {
      const pad = editor.locator('#pad');
      await pad.evaluate(el => el.scrollIntoView({block:'center'}));
      const offset = await page.locator('#avatar-dialog iframe').boundingBox();
      const coords = await frame.evaluate(points => points.map(([x,y]) => {
        const p = new DOMPoint(x,y).matrixTransform(document.querySelector('#pad-local').getScreenCTM());
        if (!document.querySelector('#pad').contains(document.elementFromPoint(p.x,p.y))) throw Error('画板未接收到点击 '+[p.x,p.y]);
        return [p.x,p.y];
      }),points);
      const [x,y] = coords[0];
      await page.mouse.move(x+offset.x,y+offset.y); await page.mouse.down();
      for (const [nx,ny] of coords.slice(1)) await page.mouse.move(nx+offset.x,ny+offset.y,{steps:2});
      await page.mouse.up();
    }
    async function shape(points, inside, hex) {
      await color(hex);
      await editor.locator('#d-pen').click(); await stroke(points);
      await editor.locator('#d-fill').click(); await stroke([inside]);
    }
    const ink = '#2B2233', jade = '#3E6E8E', gold = '#E3A33B';
    await width(.025);
    await shape([[.13,.67],[.11,.46],[.17,.27],[.3,.17],[.49,.11],[.67,.15],[.79,.23],[.88,.42],[.89,.65],[.77,.48],[.68,.41],[.59,.48],[.6,.36],[.5,.45],[.49,.35],[.36,.48],[.38,.37],[.24,.46],[.13,.67]], [.45,.29], ink);
    const layer = () => frame.evaluate(() => JSON.stringify(S.draw[drawUI.layer]));
    const filled = await layer();
    assert.ok(JSON.parse(filled).some(s => s.fill));
    await editor.locator('#d-undo').click(); assert.notEqual(await layer(),filled);
    await editor.locator('#d-redo').click(); assert.equal(await layer(),filled);
    await editor.locator('#d-line').click(); await color(gold); await width(.01);
    await stroke([[.69,.27],[.83,.34]]); await stroke([[.68,.30],[.82,.37]]);
    await editor.locator('#dl-back').click();
    await editor.locator('#d-guide').selectOption('cape.short');
    for (const tool of ['circle','square','wave']) {
      await editor.locator('#d-' + tool).click(); await stroke([[.5,.5]]);
      assert.ok(JSON.parse(await layer())[0].p.length >= 3);
      await editor.locator('#d-undo').click();
    }
    await editor.locator('#d-line').click();
    const outline = [[.25,.25],[.75,.25],[.75,.75],[.25,.75],[.25,.25]];
    for (let i = 1; i < outline.length; i++) await stroke(outline.slice(i-1,i+1));
    await editor.locator('#d-fill').click(); await stroke([[.5,.5]]);
    assert.ok(JSON.parse(await layer()).some(s => s.fill));
    await editor.locator('#d-erase').click(); await stroke([[.5,.5]]);
    assert.equal(JSON.parse(await layer()).length,4);
    await editor.locator('#d-clear').click();
    await editor.locator('#dl-top').click();
    await width(.025);
    await shape([[.25,.12],[.42,.08],[.50,.17],[.58,.08],[.75,.12],[.73,.39],[.68,.52],[.79,.89],[.64,.94],[.45,.91],[.23,.94],[.30,.53],[.25,.12]], [.49,.47], jade);
    await color(gold); await width(.01); await editor.locator('#d-line').click();
    await stroke([[.42,.12],[.58,.48]]);
    await stroke([[.58,.12],[.46,.31]]);
    await editor.locator('#dl-sleeve').click();
    await shape([[.32,.15],[.67,.17],[.68,.86],[.22,.82],[.32,.15]], [.47,.46], jade);
    await editor.locator('#dl-bottom').click();
    await shape([[.27,.06],[.72,.06],[.80,.91],[.56,.93],[.49,.39],[.43,.94],[.21,.89],[.27,.06]], [.36,.35], ink);
    await editor.locator('#tab-expr').click();
    await editor.locator('#expr-source').selectOption('happy');
    await editor.locator('#expr-slot').selectOption('h8');
    await editor.locator('#edit-preset').click();
    await width(.025); await color('#FF8FA3');
    await editor.locator('#d-mirror').click(); await editor.locator('#d-pen').click();
    await stroke([[.28,.63],[.32,.62],[.34,.62]]);
    const marks = await frame.evaluate(() => S.draw.h8);
    assert.ok(marks.flatMap(s=>s.p).some(([x])=>x>.6));
    assert.ok(marks.flatMap(s=>s.p).some(([x])=>x<.4));
    await editor.locator('#pad').evaluate(el => el.scrollIntoView({block:'center'}));
    await snap('canvas');
    await frame.evaluate(() => window.scrollTo(0, 0));
    await snap('finished-look');
    await editor.locator('#finish-look').click();
    await page.locator('#avatar-dialog').waitFor({state:'hidden'});
    await page.reload();
    await enableAllFeatures(page);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('wulin-loop')).look);
    assert.equal(saved.draw.baseExpr.h8,'happy');
    for (const k of ['hairFront','top','sleeve','bottom']) {
      assert.ok(saved.draw[k].length > 0 && saved.draw.customOnly[k]);
      assert.ok(await page.locator(`#scene [data-draw-layer="${k}"]`).count());
    }
    await page.locator('#show-expressions').click();
    await page.locator('[data-expression="h8"]').click();
    assert.equal(await page.evaluate(() => G.expression),'h8');
    assert.ok(await page.locator('#scene [data-draw-layer="h8"]').count());
    const code = await page.evaluate(() => encode(ME));
    fs.writeFileSync(path.join(OUT,'draw-look.txt'),code);
    const top = () => page.evaluate(()=>window.scrollTo(0,0));
    await top(); await snap('home');
    await page.locator('#show-expressions').click(); await snap('expressions');
    await page.locator('[data-expression="h8"]').click();
    await page.evaluate(() => {
      G.day=3; G.time=CFG.dusk;
      G.kids.push({name:'林小青',kind:'徒',look:randomLook(),grade:'良才',power:1.05});
      startNight(false); cancelAnimationFrame(raf);
      for(let i=0;i<90;i++) nightStep(.05);
    });
    assert.ok(await page.locator('#nplayer [data-draw-layer="top"]').count());
    await top(); await snap('night');
    await page.evaluate(() => {N.over=true; die('old','走完了这一世。');});
    const ghostColor = await page.locator('#scene [data-draw-layer="top"] path[fill^="#"]').first().getAttribute('fill');
    assert.notEqual(ghostColor.toUpperCase(),jade);
    await top(); await snap('ghost');
    await page.locator('[data-a="skip"]').click();
    await page.locator('[data-fam="0"]').click();
    await page.locator('[data-a="family"]').click();
    await page.getByRole('button',{name:'去祠堂'}).click();
    assert.ok(await page.locator('.pt [data-draw-layer="top"]').count());
    assert.ok(await page.locator('.pt [data-draw-layer="hairFront"]').count());
    await snap('hall');
    assert.deepEqual(errors,[]);
    console.log('PASS bare model, painted hair/clothes, fill, mirror, undo/redo, expression slot 8, reload, courtyard, night, ghost tint and inherited portrait');
    console.log('drawing JSON bytes',Buffer.byteLength(JSON.stringify(saved.draw)),'share code bytes',Buffer.byteLength(code));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
