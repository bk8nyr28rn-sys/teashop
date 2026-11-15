/**
 * 守夜局的实时画面。和其他页面不同：这里每帧都在动，所以不走“整块重画”，
 * 而是开局时搭好一次骨架，之后每帧只改位置、血条和数字（requestAnimationFrame）。
 * 点鬼、点孩子用 pointerdown，按下就生效，手感最快；局内元素是自己管的，不会被重画换掉。
 */
import { GUARD_NOTES, RAID_DOOR, raidUpgradeCost, type RaidFx, type RaidGhost, type RaidGuard } from '../core';
import { chibi, ghost } from './art';
import type { Game } from './game';
import { lookOfGuard, raidBackdrop } from './ui';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PATH_COLOR: Record<string, string> = {
  当家人: '#FFFFFF',
  剑修: '#FFC24B',
  符修: '#7FE0FF',
  阵修: '#52D6A6',
  丹修: '#FF8FC7',
  器修: '#B9A8FF',
  御兽: '#FF9A6B',
};
const PATH_SHORT: Record<string, string> = { 当家人: '我', 剑修: '剑', 符修: '符', 阵修: '阵', 丹修: '丹', 器修: '器', 御兽: '兽' };

interface View {
  root: HTMLElement;
  dyn: SVGGElement;
  fx: SVGGElement;
  ghosts: Map<number, SVGGElement>;
  guards: Map<string, SVGGElement>;
  raf: number;
  last: number;
  shownResult: boolean;
  lastCall: string;
}

let view: View | null = null;

const el = <T extends Element = HTMLElement>(id: string) => document.getElementById(id) as T | null;

/** 每次主循环调用：有局就挂上画面，没局就拆掉 */
export function syncRaid(game: Game, app: HTMLElement, rerender: () => void): void {
  if (game.raid && !view) mount(game, app, rerender);
  else if (!game.raid && view) unmount();
}

function mount(game: Game, app: HTMLElement, rerender: () => void): void {
  const s = game.raid!;
  const root = document.createElement('div');
  root.id = 'raid';
  root.className = 'raid';
  root.innerHTML = `
    <div class="raid-top gutter">
      <div class="raid-wave"><span>守夜</span><b class="num" id="r-wave">1 / 5</b></div>
      <div class="raid-door"><span>门</span><div class="raid-bar"><b id="r-door-bar"></b></div><b class="num" id="r-door"></b></div>
      <button type="button" class="raid-quit" id="r-quit">撤退</button>
    </div>
    <div class="raid-stage">
      <div class="raid-back">${raidBackdrop(game)}</div>
      <svg class="scene-svg raid-svg" viewBox="0 0 390 430" id="r-svg" aria-label="守夜：点鬼打它，点孩子升级">
        <g id="r-guards"></g><g id="r-ghosts"></g><g id="r-fx"></g>
      </svg>
      <div class="raid-call display" id="r-call"></div>
      <div class="raid-qi"><span>灵气</span><b class="num" id="r-qi">0</b></div>
    </div>
    <div class="raid-actions gutter">
      <button type="button" class="raid-btn" id="r-repair"><b>修门</b><small id="r-repair-cost"></small></button>
      <button type="button" class="raid-btn" id="r-reinforce"><b>加固门</b><small id="r-reinforce-cost"></small></button>
    </div>
    <p class="raid-hint gutter" id="r-hint">点鬼打它 · 点孩子花灵气升级 · 门破了就输</p>
    <ul class="raid-legend gutter">${[...new Set(s.guards.map((g) => g.path))]
      .map((p) => `<li><b style="color:${PATH_COLOR[p]}">${PATH_SHORT[p]}</b><span>${p === '当家人' ? '你自己' : p}：${GUARD_NOTES[p]}</span></li>`)
      .join('')}</ul>
    <div class="raid-result" id="r-result" hidden></div>`;
  app.appendChild(root);

  view = {
    root,
    dyn: el<SVGGElement>('r-ghosts')!,
    fx: el<SVGGElement>('r-fx')!,
    ghosts: new Map(),
    guards: new Map(),
    raf: 0,
    last: performance.now(),
    shownResult: false,
    lastCall: '',
  };

  // 守卫：开局搭一次
  const guardLayer = el<SVGGElement>('r-guards')!;
  for (const g of s.guards) {
    const node = document.createElementNS(SVG_NS, 'g');
    node.setAttribute('data-guard', g.id);
    node.setAttribute('class', 'r-guard');
    node.setAttribute('transform', `translate(${g.x} ${g.y})`);
    const big = g.id === 'self';
    const w = big ? 46 : 32;
    const h = w * 1.25;
    const color = PATH_COLOR[g.path] ?? '#FFFFFF';
    node.innerHTML = `<g class="r-inner"><circle r="${big ? 30 : 24}" cy="${-h / 2}" fill="transparent"/>
      <ellipse rx="${w / 2 + 2}" ry="5" fill="${color}" opacity="0.35"/>
      ${chibi(lookOfGuard(game, g.id), 'angry', `x="${-w / 2}" y="${-h}" width="${w}" height="${h}"`)}
      <g transform="translate(0 ${-h - 9})"><rect x="-19" y="-8" width="38" height="15" rx="7.5" fill="#15173A" stroke="${color}" stroke-width="1.5"/>
        <text y="3.5" text-anchor="middle" font-size="9.5" fill="${color}"><tspan class="r-lv">${PATH_SHORT[g.path]} 1</tspan></text></g>
      <g class="r-cost" transform="translate(0 12)"><rect x="-17" y="-7" width="34" height="14" rx="7"/><text y="3.5" text-anchor="middle" font-size="9.5"></text></g></g>`;
    guardLayer.appendChild(node);
    view.guards.set(g.id, node);
  }

  // 输入：按下就生效
  root.addEventListener('pointerdown', (ev) => {
    const t = ev.target as Element;
    const gh = t.closest('[data-ghost]');
    if (gh) {
      ev.preventDefault();
      if (game.raidTap(Number(gh.getAttribute('data-ghost')))) bump(gh);
      return;
    }
    const gd = t.closest('[data-guard]');
    if (gd) {
      ev.preventDefault();
      const id = gd.getAttribute('data-guard')!;
      if (game.raidUpgrade(id)) {
        bump(gd);
        const g = game.raid?.guards.find((x) => x.id === id);
        if (g) popText(g.x, g.y - 52, `升到 ${g.level} 级！`, PATH_COLOR[g.path] ?? '#FFFFFF', 16);
      }
    }
  });
  el('r-repair')!.addEventListener('click', () => game.raidRepair());
  el('r-reinforce')!.addEventListener('click', () => game.raidReinforce());
  el('r-quit')!.addEventListener('click', () => game.retreatRaid());

  const frame = (now: number) => {
    if (!view) return;
    const dt = Math.min(0.1, (now - view.last) / 1000);
    view.last = now;
    game.raidFrame(dt);
    draw(game);
    if (game.raidReward && !view.shownResult) showResult(game, rerender);
    view.raf = requestAnimationFrame(frame);
  };
  view.raf = requestAnimationFrame(frame);
}

function unmount(): void {
  if (!view) return;
  cancelAnimationFrame(view.raf);
  view.root.remove();
  view = null;
}

/** 点中时弹一下。弹的是里层：外层的 transform 管位置，不能被动画盖掉 */
function bump(outer: Element): void {
  const node = outer.querySelector('.r-inner, .r-ghost-body') ?? outer;
  node.classList.remove('r-bump');
  void (node as SVGGraphicsElement).getBoundingClientRect();
  node.classList.add('r-bump');
}

function popText(x: number, y: number, text: string, color: string, size = 14): void {
  if (!view) return;
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', x.toFixed(1));
  t.setAttribute('y', y.toFixed(1));
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('font-size', String(size));
  t.setAttribute('fill', color);
  t.setAttribute('stroke', '#15173A');
  t.setAttribute('stroke-width', '4');
  t.setAttribute('paint-order', 'stroke');
  t.setAttribute('class', 'r-pop display');
  t.textContent = text;
  view.fx.appendChild(t);
  setTimeout(() => t.remove(), 900);
}

function playFx(f: RaidFx): void {
  if (!view) return;
  switch (f.type) {
    case 'shot': {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(f.x1));
      line.setAttribute('y1', String(f.y1 - 20));
      line.setAttribute('x2', String(f.x2));
      line.setAttribute('y2', String(f.y2));
      line.setAttribute('stroke', PATH_COLOR[f.path] ?? '#FFFFFF');
      line.setAttribute('stroke-width', f.path === '剑修' || f.path === '当家人' ? '3' : '2.4');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('class', 'r-shot');
      view.fx.appendChild(line);
      setTimeout(() => line.remove(), 220);
      if (f.path === '御兽') {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', String(f.x2));
        c.setAttribute('cy', String(f.y2));
        c.setAttribute('r', '45');
        c.setAttribute('fill', '#FF9A6B');
        c.setAttribute('class', 'r-splash');
        view.fx.appendChild(c);
        setTimeout(() => c.remove(), 300);
      }
      break;
    }
    case 'tap': {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('transform', `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)})`);
      g.setAttribute('class', 'r-hit');
      g.innerHTML = '<path d="M0 -16 5 -5 16 -7 7 2 12 13 0 6 -12 13 -7 2 -16 -7 -5 -5Z" fill="#FFC24B"/>';
      view.fx.appendChild(g);
      setTimeout(() => g.remove(), 300);
      popText(f.x + 10, f.y - 18, `-${Math.round(f.dmg)}`, '#FFFFFF', 13);
      break;
    }
    case 'kill': {
      popText(f.x, f.y - 10, `+${f.qi} 灵气`, '#7FE0FF', f.kind === 'boss' ? 22 : 13);
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', f.x.toFixed(1));
      c.setAttribute('cy', f.y.toFixed(1));
      c.setAttribute('r', f.kind === 'boss' ? '40' : '18');
      c.setAttribute('fill', '#FFFFFF');
      c.setAttribute('class', 'r-poof');
      view.fx.appendChild(c);
      setTimeout(() => c.remove(), 400);
      break;
    }
    case 'heal':
      popText(RAID_DOOR.x, RAID_DOOR.y - 50, `门 +${Math.round(f.amount)}`, '#52D6A6', 15);
      break;
    case 'wave':
      call(f.wave === 5 ? '最后一波 · 大鬼来了！' : `第 ${f.wave} 波！`);
      break;
    case 'hitDoor':
      break;
  }
}

function call(text: string): void {
  const c = el('r-call');
  if (!c || !view) return;
  view.lastCall = text;
  c.textContent = text;
  c.classList.remove('show');
  void c.offsetWidth;
  c.classList.add('show');
}

function ghostSize(g: RaidGhost): number {
  return g.kind === 'boss' ? 70 : g.kind === 'imp' ? 28 : g.kind === 'spirit' ? 40 : 36;
}

function draw(game: Game): void {
  const s = game.raid;
  if (!s || !view) return;
  for (const f of s.fx) playFx(f);
  s.fx.length = 0;

  // 鬼：新出现的建节点，死掉的拆掉，其余只改位置和血条
  const alive = new Set<number>();
  for (const g of s.ghosts) {
    alive.add(g.id);
    let node = view.ghosts.get(g.id);
    const size = ghostSize(g);
    if (!node) {
      node = document.createElementNS(SVG_NS, 'g');
      node.setAttribute('data-ghost', String(g.id));
      node.setAttribute('class', 'r-ghost');
      node.innerHTML = `<circle r="${Math.max(26, size / 2 + 6)}" fill="transparent"/>
        <g class="r-ghost-body">${ghost(g.kind === 'spirit' || g.kind === 'boss' ? 'spirit' : 'wild', `x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}"`)}</g>
        <circle class="r-slow" r="${size / 2 + 3}" fill="none" stroke="#7FE0FF" stroke-width="2" stroke-dasharray="4 3"/>
        <g transform="translate(0 ${-size / 2 - 7})"><rect x="-15" y="-2.5" width="30" height="5" rx="2.5" fill="#15173A"/><rect class="r-hp" x="-15" y="-2.5" width="30" height="5" rx="2.5" fill="#FF6B6B"/></g>`;
      if (g.kind === 'imp') node.querySelector('.r-ghost-body')!.setAttribute('opacity', '0.85');
      view.dyn.appendChild(node);
      view.ghosts.set(g.id, node);
    }
    const jitter = g.atDoor ? ((g.id % 5) - 2) * 9 : 0;
    node.setAttribute('transform', `translate(${(g.x + jitter).toFixed(1)} ${(g.y - (g.atDoor ? 6 : 0)).toFixed(1)})`);
    (node.querySelector('.r-hp') as SVGRectElement).setAttribute('width', (30 * Math.max(0, g.hp / g.maxHp)).toFixed(1));
    node.classList.toggle('slowed', g.slowUntil > s.t);
    node.classList.toggle('at-door', g.atDoor);
  }
  for (const [id, node] of view.ghosts) {
    if (!alive.has(id)) {
      node.remove();
      view.ghosts.delete(id);
    }
  }

  // 守卫：等级、升级价钱（买得起是金色）
  for (const g of s.guards) {
    const node = view.guards.get(g.id);
    if (!node) continue;
    (node.querySelector('.r-lv') as SVGTSpanElement).textContent = `${PATH_SHORT[g.path]} ${g.level}`;
    const cost = raidUpgradeCost(game.world, g as RaidGuard);
    const tag = node.querySelector('.r-cost') as SVGGElement;
    const text = tag.querySelector('text')!;
    text.textContent = cost === null ? '满级' : `↑${cost}`;
    tag.classList.toggle('can', cost !== null && s.qi >= cost);
  }

  // 顶栏和按钮
  const cfg = game.world.config.raid;
  el('r-wave')!.textContent = `${s.wave} / ${cfg.waves}`;
  el('r-qi')!.textContent = String(Math.floor(s.qi));
  const pct = Math.max(0, s.doorHp / s.doorMax);
  const bar = el('r-door-bar')!;
  bar.style.width = `${(pct * 100).toFixed(1)}%`;
  bar.classList.toggle('low', pct < 0.3);
  el('r-door')!.textContent = `${Math.ceil(s.doorHp)}`;
  const repairWait = Math.max(0, s.repairReadyAt - s.t);
  el('r-repair-cost')!.textContent = repairWait > 0 ? `${repairWait.toFixed(1)} 秒` : `${cfg.repairCost} 灵气`;
  (el('r-repair') as HTMLButtonElement).classList.toggle('can', repairWait <= 0 && s.qi >= cfg.repairCost && s.doorHp < s.doorMax);
  const rc = Math.round(s.reinforceCost);
  el('r-reinforce-cost')!.textContent = `${rc} 灵气`;
  (el('r-reinforce') as HTMLButtonElement).classList.toggle('can', s.qi >= rc);
  view.root.classList.toggle('danger', pct < 0.3);

  // 开局倒数
  if (s.t < cfg.prepSeconds) {
    const left = Math.ceil(cfg.prepSeconds - s.t);
    const text = `鬼要来了… ${left}`;
    if (view.lastCall !== text) {
      view.lastCall = text;
      const c = el('r-call')!;
      c.textContent = text;
      c.classList.add('show', 'steady');
    }
  } else el('r-call')?.classList.remove('steady');

  // 提示：有操作失败的原因就显示原因
  const n = game.activeNotice();
  el('r-hint')!.textContent = n ? n.text : '点鬼打它 · 点孩子花灵气升级 · 门破了就输';
}

function showResult(game: Game, rerender: () => void): void {
  const r = game.raidReward;
  const s = game.raid;
  if (!r || !s || !view) return;
  view.shownResult = true;
  const box = el('r-result')!;
  const notes = [...new Set(s.guards.map((g) => g.path))]
    .map((p) => `<li><b style="color:${PATH_COLOR[p]}">${p}</b> ${GUARD_NOTES[p]}</li>`)
    .join('');
  box.innerHTML = `<div class="raid-card ${r.win ? 'win' : 'lose'}">
      <h2 class="display">${r.win ? '守夜大胜！' : '门破了…'}</h2>
      <p>${r.win ? '五波鬼尽数打散' : `撑到第 ${r.wave} 波`} · 打散 ${s.kills} 只鬼</p>
      ${
        r.rewarded
          ? `<div class="raid-gains"><span>灵石 <b class="num">+${r.stones}</b></span>${r.hearts ? `<span>诡心 <b class="num">+${r.hearts}</b></span>` : ''}<span>上阵的孩子修为 <b class="num">+${r.cultivation}</b></span></div>`
          : '<p class="muted">今天的奖励已经领完，这局是练手。</p>'
      }
      ${r.win ? '' : '<p class="muted">输了不掉东西。多升级孩子、记得修门，再来一局！</p>'}
      <details><summary>这局的守卫都会什么</summary><ul>${notes}</ul></details>
      <button type="button" class="btn primary huge" id="r-close">回院子</button>
    </div>`;
  box.hidden = false;
  el('r-close')!.addEventListener('click', () => {
    game.closeRaid();
    unmount();
    rerender();
  });
}
