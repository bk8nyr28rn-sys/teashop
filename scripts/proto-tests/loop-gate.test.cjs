const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { OUT, wrap } = require('./lib.cjs');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(pathToFileURL(wrap('loop')).href);
    await page.evaluate(async () => {
      closeSheet();
      G.phase = 'home';
      G.day = CFG.lifeDays; G.time = CFG.dusk; G.item = 'lamp';
      save(); await startNight(false); cancelAnimationFrame(raf);
      startWave(NIGHT.waves - 1);
      // 复现最后一波只剩六个鬼的瞬间。用真实的生成、走到门口和受伤逻辑。
      for (const type of ['armor', 'fly', 'shade', 'armor', 'fly', 'shade']) {
        spawnGhost(N.spawns.find(spawn => spawn.type === type));
      }
      N.spawns = [];
      N.ghosts.forEach((g, i) => {
        g.tx = [134, 153, 171, 184, 206, 225][i];
        g.y = g.ty - 1;
        hurtGhost(g, i * 3, '', false, true);
      });
      for (let step = 0; step < 6; step++) nightStep(0.05);
    });
    // 等入场时短暂显示的鬼名淡出，和实际到达门口时的画面一致。
    await page.locator('.nametag').first().evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
    for (const [width, height] of [[390, 844], [320, 640]]) {
      await page.setViewportSize({ width, height });
      const layout = await page.evaluate(() => {
        const bounds = $('nsvg').getBoundingClientRect();
        const boxes = N.ghosts.map(g => {
          const bar = g.hpw.getBoundingClientRect(), tag = g.label.querySelector('circle').getBoundingClientRect();
          return { left: Math.min(bar.left, tag.left), right: Math.max(bar.right, tag.right),
            top: Math.min(bar.top, tag.top), bottom: Math.max(bar.bottom, tag.bottom) };
        });
        return {
          attacking: N.ghosts.filter(g => g.state === 'bash').length,
          traits: N.ghosts.map(g => g.label.querySelector('text').textContent).sort().join(''),
          visible: N.ghosts.every(g => g.hpw.getAttribute('opacity') === '1'),
          inside: boxes.every(b => b.left >= bounds.left && b.right <= bounds.right && b.top >= bounds.top && b.bottom <= bounds.bottom),
          clear: boxes.every((b, i) => boxes.slice(i + 1).every(c => b.right < c.left || c.right < b.left || b.bottom < c.top || c.bottom < b.top)),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.deepEqual(layout, { attacking: 6, traits: ['飞','隐','甲','飞','隐','甲'].sort().join(''), visible: true, inside: true, clear: true, overflow: false });
      await page.screenshot({ path: path.join(OUT, 'loop', `gate-six-${width}.png`) });
      console.log(`PASS six gate labels and health bars are visible and disjoint at ${width} × ${height}`);
    }
    await page.locator('[data-item="sword"]').click();
    assert.ok(await page.evaluate(() => N.ghosts.filter(g => g.type === 'shade').every(g => !revealed(g) && g.hpw.getAttribute('opacity') === '0')));
    const target = await page.evaluate(() => {
      const g = N.ghosts[0], c = ghostCenter(g);
      const at = new DOMPoint(c.x, c.y).matrixTransform($('nsvg').getScreenCTM());
      return { id: g.id, hp: g.hp, x: at.x, y: at.y };
    });
    await page.mouse.click(target.x, target.y);
    assert.ok(await page.evaluate(({id, hp}) => N.ghosts.find(g => g.id === id)?.hp < hp, target));
    assert.deepEqual(errors, []);
    console.log('PASS switching items hides unrevealed health bars and tapping the ghost still hits it');
  } finally {
    await browser.close();
  }
})();
