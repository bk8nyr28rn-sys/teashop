// 敏感说法一键换词：在临时拷贝上真的换一遍，再打开样机玩到投胎，确认换完还能玩
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { ROOT } = require('./lib.cjs');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'teashop-terms-'));
  const browser = await chromium.launch();
  try {
    for (const dir of ['docs/proto', 'docs/art/creator', 'assets', 'src', 'prototype']) {
      fs.cpSync(path.join(ROOT, dir), path.join(tmp, dir), { recursive: true });
    }
    fs.mkdirSync(path.join(tmp, 'scripts'));
    for (const f of ['build-loop-core.mjs', 'sync-shared-draw.mjs', 'terms.mjs']) fs.copyFileSync(path.join(ROOT, 'scripts', f), path.join(tmp, 'scripts', f));
    fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(tmp, 'package.json'));
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));

    const run = (...args) => spawnSync(process.execPath, ['scripts/terms.mjs', ...args, '--root', tmp], { cwd: tmp, encoding: 'utf8' });
    const applied = run('--apply', path.join(ROOT, 'docs/terms-alt.json'));
    assert.equal(applied.status, 0, applied.stderr);
    const report = run().stdout;
    for (const term of ['厉鬼', '护家神', '奈何桥', '投胎', '鬼']) assert.match(report, new RegExp(`^${term}\\t—$`, 'm'), `${term} 应该换干净`);
    const page = fs.readFileSync(path.join(tmp, 'docs/proto/loop/index.html'), 'utf8');
    assert.equal((page.match(/\r\n/g) || []).length, (fs.readFileSync(path.join(ROOT, 'docs/proto/loop/index.html'), 'utf8').match(/\r\n/g) || []).length, '换行符不变');

    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, offline: true });
    p.setDefaultTimeout(8000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(pathToFileURL(path.join(tmp, 'docs/proto/loop/index.html')).href);
    await p.getByRole('button', { name: '开始', exact: true }).click();
    await p.evaluate(async () => { Object.assign(G, { day: CFG.lifeDays, guideOff: true }); await save(); die('old', '你老了。'); });
    const death = await p.locator('#panel').innerText();
    assert.match(death, /守宅灵/);
    assert.match(death, /凶祟/);
    assert.doesNotMatch(death, /鬼|护家神|投胎/);
    await p.locator('[data-a=skip]').click();
    await p.waitForFunction(() => G.phase === 'reborn');
    const reborn = await p.locator('#panel').innerText() + await p.locator('#scene').innerText();
    assert.doesNotMatch(reborn, /奈何桥|投胎/);
    assert.match(reborn, /转世/);
    await p.locator('[data-fam="0"]').click();
    await p.waitForFunction(() => G.lifeNo === 2);
    assert.deepEqual(errors, []);
    console.log('PASS 照备用说法换词：换干净、换行符不变、样机照样能从老死玩到下一世');
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
