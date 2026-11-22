/* 河埠试验。坐标单位与 360 × 450 的河岸插图一致，物件位置和潮位以游戏时间结算。 */
const River = (() => {
  const background = new URL('riverside.webp', document.currentScript.src).href;
  const start = { x: 278, y: 381 };
  const labels = {
    wood: '浮木',
    rope: '麻绳',
    herb: '岸边草药',
    porter: '挑担的周伯',
    stone: '青纹石',
    home: '家门口',
    far: '往远处走',
    market: '集市口',
    ditch: '水沟',
    raft: '木排',
  };
  const verbs = { carry: '搬', tie: '用绳子', hail: '招呼' };
  const placeNames = ['宝物架旁', '院门左边', '院门右边'];
  const initialWood = [
    [66, 236],
    [95, 250],
    [116, 267],
  ];
  const type = (id) => (id?.startsWith('wood') ? 'wood' : id);
  const name = (id) => labels[type(id)] || '石板路';
  const point = (x, y) => ({ x, y });
  const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const firstVisit = () => G.day === 1 && !G.river?.visited;
  const tide = () => clamp((G.time - CFG.dayStart) / 300, 0, 1);
  const high = () => tide() >= 0.72;
  let movement = null;
  let near = [],
    dwellStart = 0,
    tracked = null;

  function state() {
    return (G.river ||= {
      visited: false,
      day: 0,
      p: { ...start },
      focus: null,
      hand: null,
      belt: false,
      wood: initialWood.map(([x, y]) => point(x, y)),
      rope: point(157, 214),
      stone: point(159, 337),
      herb: point(159, 280),
      raft: false,
      bridge: false,
      helped: false,
      helper: false,
      clue: false,
      yardSlot: 1,
      record: { events: [], dwell: {}, started: Date.now() },
    });
  }
  function log(event, detail) {
    const r = state();
    r.record.events.push({
      序: r.record.events.length + 1,
      现实: new Date().toISOString(),
      世: G.lifeNo,
      天: G.day,
      游戏时刻: hm(G.time),
      事件: event,
      内容: detail,
    });
  }
  function stopDwell() {
    if (!tracked) return;
    const elapsed = Math.max(0, performance.now() - dwellStart);
    for (const id of near) tracked.dwell[id] = Math.round((tracked.dwell[id] || 0) + elapsed);
    tracked = null;
    near = [];
  }
  function startDwell() {
    stopDwell();
    if (
      !G?.river ||
      G.phase !== 'river' ||
      movement ||
      document.hidden ||
      !$('sheet').hidden ||
      document.querySelector('dialog[open]')
    )
      return;
    const r = G.river;
    const spots = targets().filter((t) => ['wood', 'rope', 'herb', 'porter', 'stone'].includes(type(t.id)));
    const closest = spots
      .filter((t) => t.id === r.focus || apart(r.p, t) <= 30)
      .sort((a, b) => apart(r.p, a) - apart(r.p, b));
    near = r.focus && spots.some((t) => t.id === r.focus) ? [r.focus] : closest.slice(0, 1).map((t) => t.id);
    tracked = r.record;
    dwellStart = performance.now();
  }
  window.addEventListener('pagehide', () => {
    if (tracked) {
      stopDwell();
      save();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (tracked) {
        stopDwell();
        save();
      }
    } else startDwell();
  });
  window.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver(startDwell);
    observer.observe($('sheet'), { attributes: true, attributeFilter: ['hidden'] });
    for (const el of document.querySelectorAll('dialog'))
      observer.observe(el, { attributes: true, attributeFilter: ['open'] });
  });
  function enter() {
    const r = state();
    if (r.day !== G.day) {
      r.day = G.day;
      r.herb = point(159, 280);
      r.helper = false;
      r.wood.forEach((w, i) => {
        if (w === 'firewood') r.wood[i] = point(...initialWood[i]);
      });
    }
    notice = null;
    heldMenu = false;
    if (!r.visited) hintOnce('entry', '点石板路行走，点物件动手。');
    Guidance.done('wharf');
    r.visited = true;
    r.p = { ...start };
    r.focus = null;
    r.msg = '';
    G.phase = 'river';
    G.at = 'home';
    G.target = null;
    log('出门', '家门 → 河埠');
    save();
    window.render();
  }
  function porterLook() {
    return lookOf({
      ...INSPIRE[3][1],
      top: 'ru',
      topColor: '#a45b34',
      trimColor: '#f8d390',
      weapon: 'none',
      pattern: 'none',
      head: 'hat',
    });
  }
  function porterArt(x, y, k) {
    return (
      person(porterLook(), 'happy', 'adult', x, y, k) +
      `<g transform="translate(${x} ${y - 31})"><path d="M-25 -3 Q0 -12 24 -8" fill="none" stroke="#614324" stroke-width="2.4"/>
    <path d="M-23 -3 l-4 16 h11 l-5 -16 M21 -8 l-5 14 h11 l-4 -15" fill="none" stroke="#956324"/>
    <g fill="#d39642" stroke="#704623"><path d="M-31 12 h19 l-3 9 h-12z M13 6 h18 l-3 9 H16z"/></g></g>`
    );
  }
  function trappedBasket(x, y) {
    return `<g transform="translate(${x} ${y}) rotate(-18)">
      <path d="M-13 -5q13-21 26 0" fill="none" stroke="#72512d" stroke-width="2"/>
      <path d="M-16-7q16-4 32 0l-4 16q-13 4-24-2z" fill="#c38944" stroke="#57472d"/>
      <path d="M-12-2h24m-22 4h20m-17 4h16m-15-12 3 13m3-13 2 14m4-15v14" fill="none" stroke="#ebbf73"/>
      <path d="M-19 6q14 6 34 1" fill="none" stroke="#cae2cb" stroke-width="2"/></g>`;
  }
  function targets() {
    const r = state(),
      late = G.time >= 720;
    const t = [
      { id: 'home', x: 308, y: 399 },
      ...(Guidance.open(2) ? [{ id: 'far', x: 203, y: 35 }] : []),
      { id: 'market', x: 269, y: 117 },
      { id: 'ditch', x: 155, y: 315 },
    ];
    r.wood.forEach((pos, i) => {
      if (pos && typeof pos === 'object') t.push({ id: 'wood' + i, ...pos });
    });
    for (const k of ['rope', 'stone', 'herb'])
      if (r[k] && typeof r[k] === 'object') t.push({ id: k, ...r[k] });
    let porter =
      late && r.helped
        ? point(257, 154)
        : point(189 + Math.round(8 * Math.sin(G.time / 53)), 193 + Math.round(10 * Math.sin(G.time / 40)));
    if (r.helper && r.hand && !late) porter = point(r.p.x + 25, r.p.y - 3);
    t.push({ id: 'porter', ...porter });
    if (r.raft) t.push({ id: 'raft', x: 76, y: 214 });
    return t;
  }
  function left(y) {
    return 142 + (220 - y) * 0.105;
  }
  function ground(p) {
    const y = clamp(p.y, 23, 431);
    if (p.x < 149 && p.x >= 48 && y >= 185 && y <= 212)
      return point(Math.round(clamp(p.x, 60, 149)), Math.round(y));
    const right = y < 145 ? 238 + y * 0.25 : y > 280 ? 268 + (y - 280) * 0.19 : 284;
    return point(Math.round(clamp(p.x, left(y) + (high() ? 14 : 0), right)), Math.round(y));
  }
  function landing(t) {
    if (t.id === 'raft' || (type(t.id) === 'wood' && t.x < left(t.y))) return point(107, 201);
    return ground(t);
  }
  function woodArt(x, y, angle = 0) {
    return `<g transform="translate(${x} ${y}) rotate(${angle})"><ellipse cy="2" rx="16" ry="4.5" fill="#263c3870"/><rect x="-16" y="-3.5" width="33" height="7" rx="3.5" fill="#96623a" stroke="#593e2a"/><path d="M-12 -1l22 -1m-19 4h14" stroke="#e4b677"/><ellipse cx="15" rx="3.1" ry="3.6" fill="#e5c58b" stroke="#805132"/></g>`;
  }
  function stoneArt(x, y, k = 1) {
    return `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cy="1" rx="15" ry="4" fill="#38413260"/><path d="M-14 -2l4-10 8-5 9 3 7 11-7 5-15-1z" fill="#698b77" stroke="#354d48" stroke-width="1.4"/><path d="M-11 -7l9-5 4 2 7-1M-6 -1l6-6 6 1" fill="none" stroke="#dfebc9" stroke-width="2.1"/></g>`;
  }
  function ropeArt(x, y) {
    return `<g transform="translate(${x} ${y}) rotate(-14)" fill="none" stroke="#8e5929" stroke-width="4"><ellipse rx="12" ry="6"/><ellipse rx="7" ry="3"/><path d="M10 3q8 8 13 1"/><g stroke="#f4ce77" stroke-width="1.7"><ellipse rx="12" ry="6"/><ellipse rx="7" ry="3"/><path d="M10 3q8 8 13 1"/></g></g>`;
  }
  function herbArt(x, y) {
    return `<g transform="translate(${x} ${y})" stroke="#2b6448" stroke-width="1.3"><path d="M0 2q-14-2-11-14Q0-10 0 2q3-17 12-18Q15-3 0 2q-4-18 2-22Q8-12 0 2" fill="#73a854"/><g fill="#eac3cf" stroke="#aa6d89"><circle cx="-9" cy="-13" r="2.6"/><circle cx="3" cy="-20" r="2.7"/><circle cx="12" cy="-16" r="2.4"/></g></g>`;
  }
  function raftArt() {
    return `<g transform="translate(76 215) rotate(-16)"><ellipse cy="6" rx="31" ry="13" fill="#315f5977"/>${[-6, 0, 6].map((y) => `<rect x="-27" y="${y - 3}" width="54" height="6" rx="3" fill="#b7844f" stroke="#674b34"/><path d="M-22 ${y}h42" stroke="#e1b878"/>`).join('')}<path d="M-16-10v20m3-20v20M15-10v20m3-20v20" stroke="#f3d385" stroke-width="2"/><path d="M18-8q8-12 25-10" fill="none" stroke="#b48542" stroke-width="2"/></g>`;
  }
  function art(t) {
    const { id, x, y } = t;
    switch (type(id)) {
      case 'wood':
        return woodArt(x, y, -18);
      case 'stone':
        return stoneArt(x, y);
      case 'herb':
        return herbArt(x, y);
      case 'rope':
        return ropeArt(x, y);
      case 'porter':
        return (
          (!G.river.helped && !(G.river.helper && G.river.hand)
            ? `<path d="M${x - 22} ${y - 18} Q145 179 130 204" fill="none" stroke="#715439" stroke-width="1.5"/>${trappedBasket(127, 205)}`
            : '') + porterArt(x, y, 0.16)
        );
      case 'raft':
        return raftArt();
      case 'ditch':
        return `<path d="M118 325q18-4 29-9t24-9l20-4-17 6q-17 3-26 10t-30 11z" fill="#938767"/><path d="M118 324q21-5 32-11t40-10q-26 8-38 15t-34 10z" fill="#8eaf9a"/>${G.river.bridge ? woodArt(x, y, -83) : ''}${high() ? '<path d="M120 314q22-2 40-11t32-7q-14 12-36 20t-37 15z" fill="#78ab9c" opacity=".77"/><path d="M135 316q12-2 19-6m9-2 13-5" fill="none" stroke="#cce2cf"/>' : ''}`;
      default:
        return `<g transform="translate(${x} ${y})"><rect x="-27" y="-14" width="54" height="19" rx="4" fill="#443b2ee8" stroke="#dfbf80"/><text y="-.5" text-anchor="middle" font-size="10" fill="#fff4d2">${name(id)}${id === 'far' ? ' ↑' : ''}</text></g>`;
    }
  }
  function targetMarkup(t) {
    const selected = G.river.focus === t.id;
    return `<g class="rb-target" role="button" tabindex="0" data-r-target="${t.id}" aria-label="${name(t.id)}"><title>${name(t.id)}</title>
      ${selected ? `<ellipse cx="${t.x}" cy="${t.y + 1}" rx="21" ry="8" fill="#ffe6a457" stroke="#fff0b3" stroke-width="1.7"/>` : ''}
      ${art(t)}<rect x="${t.x - (t.id === 'raft' ? 26 : 18)}" y="${t.y - (t.id === 'porter' ? 44 : 19)}" width="${t.id === 'raft' ? 52 : 36}" height="${t.id === 'porter' ? 55 : 37}" fill="transparent"/></g>`;
  }
  function water() {
    const t = tide();
    // 同一条斜岸线随游戏时辰内移，浅水保留石纹，白色水线标出仍能落脚的位置。
    const previous = Number($('rb-map')?.dataset.tide ?? t);
    const line = (level) => {
      const w = level * 36;
      return `M${171 + w * 0.25} 0 Q${150 + w * 0.65} 67 ${144 + w * 0.68} 131 T${134 + w * 0.82} 224 Q${130 + w} 266 ${124 + w} 317 T${106 + w * 0.83} 450`;
    };
    const wet = (level) => line(level) + ' H0 V0 Z';
    const glide = (path) =>
      previous !== t && !matchMedia('(prefers-reduced-motion: reduce)').matches
        ? `<animate attributeName="d" from="${path(previous)}" to="${path(t)}" dur=".85s" fill="freeze"/>`
        : '';
    return `<g aria-hidden="true" pointer-events="none">
      <defs><linearGradient id="rb-shallows" gradientUnits="userSpaceOnUse" x1="90" x2="165"><stop stop-color="#679e97" stop-opacity="0"/><stop offset=".52" stop-color="#76aaa1" stop-opacity=".8"/><stop offset="1" stop-color="#8cbfb2"/></linearGradient>
        <clipPath id="rb-wet-edge"><path d="${wet(t)}">${glide(wet)}</path></clipPath></defs>
      <path d="${wet(t)}" fill="url(#rb-shallows)" opacity="${0.08 + t * 0.58}">${glide(wet)}</path>
      <g clip-path="url(#rb-wet-edge)" fill="none" stroke="#e2edcf" stroke-width=".8" opacity="${t * 0.87}"><path class="rb-ripples" d="M139 92q9-2 21 0m-14 4h8m-23 67 14 1m-16 94q13 2 28 0m-15 5h10m-26 37 18-1m-18 44q10 1 22-1m-32 66q11-2 23 0"/></g>
      <path d="${line(t)}" fill="none" stroke="#e4f1d3" stroke-opacity="${0.15 + t * 0.7}" stroke-width="1.1" stroke-dasharray="18 4 3 4 30 12">${glide(line)}</path>
      <path class="rb-ripples" d="M14 277q11-2 22 0m-15 4h13m34 42q11 2 21-1m-67 78q8-2 16 0m84-112q9-2 19-1" fill="none" stroke="#deefcf" opacity=".65"/>
      <g transform="translate(135 245)"><path d="M0 10v-35" stroke="#694c38" stroke-width="4"/><path d="M-2-19h4m-4 6h4m-4 6h4m-4 6h4" stroke="#eed2a4"/><ellipse cy="${7 - t * 25}" rx="8" ry="2" fill="#bedfd0" opacity=".9"/></g></g>`;
  }

  const strokes = {
    carry: 'M5 16l3 3h9l4-5q-1-2-3 0l-2 1h-4m-8-1 3-3h6q3 0 2 3 M8 6l4-2 4 2-4 2z M8 6v4m8-4v4',
    tie: 'M18 16c-3 4-13 3-14-2S9 4 14 5s6 7 2 9-8 1-8-2 6-5 6-2-3 3-3 2 M17 15q3 7 5 2',
    hail: 'M3 11l3 2 3 5q2 2 5 1l4-2q2-1 2-4l-1-7q-1-1-2 1v4l-2-8q-1-1-2 1l1 7-3-8q-1-1-2 1l2 8-3-5q-1-1-2 1l2 6',
    raftHome: 'M2 14q9 1 20-3l-4 6H7z M8 13l8-10m-2 0h3v3 M3 20q3-2 6 0t6 0 6 0',
    untie: 'M9 14l11-9M10 11l9 9 M9 15a3 3 0 1 1-5-1 3 3 0 0 1 5 1z M9 8a3 3 0 1 1-5-1 3 3 0 0 1 5 1z',
    walkHome: 'M2 11l10-8 10 8M5 10v11h14V10M10 21v-7h4v7',
    bridge: 'M2 15l20-4m-19 7 19-4M5 10v10m14-13v10M8 13l2 3m3-4 2 3',
    market: 'M3 9l2-5h14l2 5q-2 4-5 1-3 3-5 0-3 3-5 0-1 2-3-1zM5 12v8h14v-8',
    noon: 'M12 3v2m7 1-2 2m4 5h-3M3 13h3m-1-7 2 2m1 7a5 5 0 1 1 8 0M3 18h18',
    drop: 'M12 2v12m-4-4 4 4 4-4M4 15v5h16v-5',
    wood: 'M4 14l10-9q4-3 6 1t-1 6l-10 8M5 14q-3 1-1 4t5 1q1-2-1-4t-3-1zm5-2 6-6m-4 8 6-5',
    stone: 'M2 16l6-10 7-2 7 11-7 5-9-1zM5 14l6-3 3 1 3-2',
    helper:
      'M3 8l4-2 4 2m-7 1a3 3 0 1 0 6 0m2 0 4-2 5 2m-8 1a3 3 0 1 0 6 0M2 20q0-6 5-6 3 0 5 3m0 3q0-5 5-5 4 0 5 5',
    wave: 'M2 14q3-3 6 0t6 0 7-1M2 18q3-3 6 0t6 0 7-1',
  };
  function glyph(id) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${strokes[id]}"/></svg>`;
  }
  // 只错开绘制位置，脚下的寻路、耗时和物件坐标照旧。
  function spriteOffset(pos, things) {
    const nearPorter = things.some(
      (t) => t.id === 'porter' && Math.abs(t.x - pos.x) < 24 && Math.abs(t.y - pos.y) < 34,
    );
    if (nearPorter) return 38;
    return things.some((t) => t.id !== 'porter' && Math.abs(t.x - pos.x) < 18 && Math.abs(t.y - pos.y) < 16)
      ? 22
      : 0;
  }
  function player(things) {
    const r = state();
    const carrying =
      type(r.hand) === 'wood' ? woodArt(13, -15, -52) : r.hand === 'stone' ? stoneArt(10, -12, 0.65) : '';
    const badges = [];
    if (r.hand) badges.push([type(r.hand), name(r.hand)]);
    if (r.belt) badges.push(['tie', '麻绳']);
    if (r.helper) badges.push(['helper', '周伯搭手']);
    const w = badges.length * 17 + 6;
    const canDrop = r.hand || r.belt;
    const badge = !badges.length
      ? ''
      : `<g transform="translate(${-w / 2} -69)" aria-label="${badges.map((b) => b[1]).join('、')}${canDrop ? '，点开随身物品' : ''}" ${canDrop ? 'data-r-held role="button" tabindex="0" pointer-events="all"' : 'role="img"'}><title>${badges.map((b) => b[1]).join('、')}</title>
      <rect x="-8" y="-9" width="${w + 16}" height="39" rx="9" fill="transparent"/>
      <path d="M${w / 2 - 3} 18l3 4 3-4" fill="#315448"/><rect width="${w}" height="19" rx="8" fill="#315448" stroke="#fff1c8"/>
      ${badges.map(([id], i) => `<svg x="${3 + i * 17}" y="2" width="15" height="15" viewBox="0 0 24 24"><path d="${strokes[id]}" fill="none" stroke="#ffedc4" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`).join('')}</g>`;
    return `<g id="rb-player" pointer-events="none" transform="translate(${r.p.x + spriteOffset(r.p, things)} ${r.p.y})"><ellipse rx="11" ry="3.5" fill="#42483b55"/>${person(ME, 'calm', ageOf(G.day), 0, 0, 0.17)}${carrying}${r.belt ? ropeArt(-10, -8) : ''}${badge}</g>`;
  }
  function btn(id, label, icon = id, disabled = false) {
    return `<button type="button" data-r-act="${id}"${disabled ? ' disabled' : ''}>${glyph(icon)}<span>${label}</span></button>`;
  }
  function controlsFor(id) {
    const r = state();
    if (heldMenu) return r.hand ? btn('drop', '放下', 'drop') : r.belt ? btn('dropRope', '放绳', 'drop') : '';
    if (verbsFor(id))
      return (
        btn('carry', id === 'herb' ? '采' : id === 'rope' ? '拿' : '搬') +
        btn('tie', '用绳') +
        btn('hail', '招呼')
      );
    switch (id) {
      case 'raft':
        return btn('raftHome', '回家 · 5 分') + btn('untie', '收排');
      case 'home':
        return btn('walkHome', type(r.hand) === 'wood' ? '回家劈柴 · 30 分' : '回家 · 30 分');
      case 'ditch':
        if (r.bridge && !high()) return btn('bridgeHome', '回家 · 12 分', 'bridge');
        return btn('bridge', r.bridge ? '桥已淹' : '搭桥', 'bridge', high() || type(r.hand) !== 'wood');
      case 'market':
        return btn('market', '进集') + (r.helped && G.time < 720 ? btn('noon', '等午集') : '');
      case 'far':
        return r.hand ? btn('drop', '放下', 'drop') : '';
      default:
        return '';
    }
  }
  let heldMenu = false,
    notice = null,
    nudge = null;
  function hintOnce(key, text) {
    const r = state();
    r.hints ||= {};
    if (r.hints[key]) return;
    r.hints[key] = true;
    notice = { kind: 'hint', text, until: performance.now() + 4700 };
  }
  function say(text, portrait = false) {
    notice = { portrait, kind: 'speech', text, until: performance.now() + 4000 };
  }
  function placeOverlays() {
    const board = $('rb-board');
    if (!board) return;
    const { width, height } = board.getBoundingClientRect(),
      scale = width / 360,
      gap = 6;
    const bubble = $('rb-speech'),
      porter = targets().find((t) => t.id === 'porter');
    if (bubble) {
      const bx = clamp(porter.x * scale - bubble.offsetWidth / 2, gap, width - bubble.offsetWidth - gap);
      bubble.style.left = bx + 'px';
      bubble.style.top = Math.max(gap, (porter.y - 64) * scale - bubble.offsetHeight) + 'px';
      bubble.style.setProperty('--tail', clamp(porter.x * scale - bx, 11, bubble.offsetWidth - 11) + 'px');
    }
    const menu = $('rb-actions');
    if (!menu) return;
    const r = state(),
      all = targets();
    const heroX = r.p.x + spriteOffset(r.p, all);
    const anchor = heldMenu
      ? { id: 'held', x: heroX, y: Math.max(12, r.p.y - 58) }
      : all.find((t) => t.id === r.focus);
    if (!anchor) return;
    const ax = anchor.x * scale,
      ay = anchor.y * scale,
      w = menu.offsetWidth,
      h = menu.offsetHeight;
    const padding = anchor.id === 'porter' ? 60 : anchor.id === 'held' ? 15 : 23;
    const side = anchor.id === 'raft' || anchor.id === 'porter' ? 36 : 22;
    const x = clamp(ax - w / 2, gap, width - w - gap),
      y = clamp(ay - h / 2, gap, height - h - gap);
    const slots = [
      [x, ay + 19 * scale + gap],
      [x, ay - padding * scale - h - gap],
      [ax + side * scale + gap, y],
      [ax - side * scale - w - gap, y],
    ];
    for (const edgeX of [clamp(ax - 16, gap, width - w - gap), clamp(ax - w + 16, gap, width - w - gap)]) {
      slots.push([edgeX, ay + 19 * scale + gap], [edgeX, ay - padding * scale - h - gap]);
    }
    // 不盖到目标；几处都放得下时，保留人物和邻近物件的点按区域。
    const protect = all
      .filter((t) => t.id !== anchor.id)
      .map((t) => ({ x: t.x * scale, y: (t.y - (t.id === 'porter' ? 20 : 4)) * scale }));
    protect.push({ x: heroX * scale, y: (r.p.y - 25) * scale });
    let best = null;
    for (const [left, top] of slots) {
      if (left < gap - 1 || top < gap - 1 || left + w > width - gap + 1 || top + h > height - gap + 1)
        continue;
      const blocked = protect.filter(
        (p) => p.x > left - 8 && p.x < left + w + 8 && p.y > top - 8 && p.y < top + h + 8,
      ).length;
      const bb = bubble?.getBoundingClientRect(),
        origin = board.getBoundingClientRect();
      const hitsSpeech =
        bb &&
        left + origin.left < bb.right &&
        left + w + origin.left > bb.left &&
        top + origin.top < bb.bottom &&
        top + h + origin.top > bb.top;
      const score = blocked + (hitsSpeech ? 10 : 0);
      if (!best || score < best.score) best = { left, top, score };
    }
    menu.style.left = (best?.left ?? x) + 'px';
    menu.style.top = (best?.top ?? clamp(ay + 20 * scale, gap, height - h - gap)) + 'px';
  }
  const resize = new ResizeObserver(placeOverlays);
  function render() {
    Guidance.update();
    const r = state(),
      ts = targets(),
      focus = ts.find((t) => t.id === r.focus);
    const active = notice?.until > performance.now() ? notice : null;
    const controls = controlsFor(focus?.id);
    $('scene').innerHTML =
      `<section class="rb-view"><div class="rb-heading"><span>河埠</span><time>${shichen(G.time)} · ${hm(G.time)}</time><small>${glyph('wave')}${high() ? '高水' : tide() > 0.32 ? '渐涨' : '浅水'}</small></div>
      <div id="rb-board"><svg id="rb-map" data-tide="${tide()}" viewBox="0 0 360 450" aria-label="可以点按行走的河埠"><image href="${background}" width="360" height="450"/>${water()}${ts
        .sort((a, b) => a.y - b.y)
        .map(targetMarkup)
        .join('')}${player(ts)}</svg>
      ${controls ? `<div id="rb-actions" role="group" aria-label="${heldMenu ? '随身物品' : name(focus.id)}">${controls}</div>` : ''}
      ${active ? `<div id="rb-${active.kind}" role="status" class="rb-notice"></div>` : ''}</div>
      ${r.textOn && (r.focus || r.msg) ? '<p id="rb-description"></p>' : ''}</section>`;
    $('panel').replaceChildren();
    if ($('rb-description')) $('rb-description').textContent = r.msg || describe(r.focus);
    if (active) {
      const el = $('rb-' + active.kind);
      el.textContent = active.text;
      if (active.portrait)
        el.insertAdjacentHTML(
          'afterbegin',
          `<svg class="rb-speaker" viewBox="8 14 64 64" aria-label="周伯">${porterArt(40, 76, 0.18)}</svg>`,
        );
      const ms = active.until - performance.now();
      el.style.setProperty('--stay', Math.max(1, ms) + 'ms');
      setTimeout(() => el.remove(), Math.max(1, ms));
    }
    const map = $('rb-map');
    const heldAction = () => {
      if (movement || G.phase !== 'river') return;
      heldMenu = !heldMenu;
      r.focus = null;
      r.msg = '';
      notice = null;
      save();
      render();
    };
    map.onclick = (e) => {
      if (e.target.closest('[data-r-held]')) return heldAction();
      const el = e.target.closest('[data-r-target]');
      move(el?.dataset.rTarget, toSvg(map, e));
    };
    map.onkeydown = (e) => {
      if (!['Enter', ' '].includes(e.key)) return;
      e.preventDefault();
      if (e.target.closest('[data-r-held]')) return heldAction();
      const el = e.target.closest('[data-r-target]');
      if (el) move(el.dataset.rTarget);
    };
    $('rb-actions')
      ?.querySelectorAll('button')
      .forEach((b) => (b.onclick = () => act(b.dataset.rAct)));
    resize.disconnect();
    for (const id of ['rb-board', 'rb-actions', 'rb-speech']) {
      if ($(id)) resize.observe($(id));
    }
    placeOverlays();
    startDwell();
  }

  const verbsFor = (id) => ['wood', 'stone', 'porter', 'rope', 'herb'].includes(type(id));
  function move(id, clicked) {
    if (movement || G.phase !== 'river') return;
    const r = state(),
      t = targets().find((o) => o.id === id);
    heldMenu = false;
    notice = null;
    $('rb-map').setAttribute('aria-busy', 'true');
    $('rb-actions')?.remove();
    $('rb-speech')?.remove();
    $('rb-hint')?.remove();
    const dest = t ? landing(t) : ground(clicked),
      via = [];
    // 浮桥只在码头与岸相接。远处先沿干岸走，再转入码头。
    const dock = (p) => p.x < left(p.y) && p.y >= 185 && p.y <= 212;
    if (dock(r.p) !== dock(dest)) via.push(point(157, 202));
    if (!dock(r.p) && !dock(dest) && Math.abs(dest.y - r.p.y) > 80)
      via.push(ground(point(Math.max(186, (r.p.x + dest.x) / 2), (r.p.y + dest.y) / 2)));
    const pts = [r.p, ...via, dest];
    const lengths = pts.slice(1).map((p, i) => apart(p, pts[i]));
    const distance = lengths.reduce((a, b) => a + b, 0);
    const cost = distance < 2 ? 0 : Math.ceil(distance * (r.hand && !r.helper ? 0.13 : 0.085));
    const things = targets(),
      startOffset = spriteOffset(r.p, things),
      endOffset = spriteOffset(dest, things);
    const duration = Math.max(100, Math.min(760, distance * 3));
    stopDwell();
    const avatar = $('rb-player'),
      begun = performance.now();
    const helper =
      r.helper && r.hand && G.time < 720 && $('rb-map').querySelector('[data-r-target="porter"]');
    function frame(now) {
      if (G.phase !== 'river' || !avatar.isConnected) {
        movement = null;
        return;
      }
      let covered = Math.min(1, (now - begun) / duration) * distance,
        i = 0;
      while (i < lengths.length - 1 && covered > lengths[i]) covered -= lengths[i++];
      const a = pts[i],
        b = pts[i + 1],
        f = lengths[i] ? Math.min(1, covered / lengths[i]) : 1;
      const shift = startOffset + (endOffset - startOffset) * Math.min(1, (now - begun) / duration);
      avatar.setAttribute(
        'transform',
        `translate(${a.x + (b.x - a.x) * f + shift} ${a.y + (b.y - a.y) * f})`,
      );
      if (helper)
        helper.setAttribute(
          'transform',
          `translate(${a.x + (b.x - a.x) * f - r.p.x} ${a.y + (b.y - a.y) * f - r.p.y})`,
        );
      if (now - begun < duration) {
        movement = requestAnimationFrame(frame);
        return;
      }
      movement = null;
      r.p = dest;
      r.focus = t?.id || null;
      spend(cost);
      if (G.time >= CFG.dusk) {
        r.focus = 'home';
        r.msg = '暮色到了，沿高岸还能安全回家。';
        save();
        render();
        return;
      }
      if (id === 'far' && Guidance.open(2) && !r.hand) {
        log('离开河埠', '往远处走 → 三圈地图');
        r.fromWharf = true;
        r.helper = false;
        G.phase = 'map';
        save();
        window.render();
        return;
      }
      r.msg = id ? describe(id) : '';
      if (id === 'ditch' && !r.bridge && !high() && type(r.hand) !== 'wood')
        hintOnce('ditch', '搬一根长木到沟边。');
      if (id === 'far' && r.hand) hintOnce('far', '手里的重物要先放下。');
      if (id === 'porter' && !r.helped) say('哎，筐卡住了。');

      save();
      render();
    }
    movement = requestAnimationFrame(frame);
  }
  function spend(minutes) {
    G.time = Math.min(CFG.dusk, G.time + minutes);
  }
  function describe(id) {
    const r = state();
    if (id === 'far') return '远路难提重物。先放下手里的东西，或带它回家。';
    if (type(id) === 'wood') return `这根长木能绑排，搬回家也能劈成 ${LoopCore.FIREWOOD_PER_LOG} 件柴。`;
    if (id === 'porter')
      return r.helped ? '周伯瞧见你，腾出手来招了招。' : '周伯把扁担抵在岸上，一头箩筐卡住了。';
    return (
      {
        stone: '石面露出一道细青纹。',
        herb: '紫色花穗下藏着嫩叶。',
        rope: '一圈干麻绳，绳头垂在石阶上。',
        market: '布棚底下是集市。午后，挑担的人会在这儿歇脚。',
        home: '石阶上去就是家，高岸一直通着。',
        raft: '绳结扣得很牢。木排顺水直达家门。',
        ditch: high()
          ? '低岸漫水了，回家要走高岸。'
          : r.bridge
            ? '木桥架稳了，过沟就是回家的小路。'
            : '窄沟挡住了回家的小路，一根长木就能架过去。',
      }[id] || '脚下是晒暖的青石。'
    );
  }
  function put(id, pos) {
    if (type(id) === 'wood') state().wood[Number(id.slice(4))] = pos;
    else state()[id] = pos;
  }
  function lift(id) {
    const r = state();
    if (r.hand) {
      nudge = 'held';
      return '怀里已经抱着' + name(r.hand) + '，得先放下。';
    }
    Guidance.done('find');
    put(id, 'hand');
    r.hand = id;
    hintOnce('held', '点头顶的物件图标，可以放下。');
    r.focus = null;
    spend(r.helper ? 3 : 10);
    return (r.helper ? '周伯托了一把，' : '') + '抱起了' + name(id) + '。';
  }
  function harvest() {
    const r = state();
    if (G.bag.length >= bagCap()) {
      notice = {
        kind: 'hint',
        text: '背包 ' + G.bag.length + ' / ' + bagCap(),
        until: performance.now() + 3000,
      };
      return '背包已经满了，草药还长在原处。';
    }
    Guidance.done('find');
    G.bag.push({ n: '草药', v: GOODS['草药'] });
    r.herb = null;
    r.focus = null;
    spend(6);
    return '捋下一把草药，已收进背包。';
  }
  function getRope() {
    const r = state();
    Guidance.done('find');
    r.belt = true;
    r.rope = 'belt';
    hintOnce('held', '点头顶的物件图标，可以放下。');
    r.focus = null;
    spend(3);
    return '把麻绳盘在腰间，可以腾出双手。';
  }
  function clue() {
    state().clue = true;
    return high()
      ? '「低阶淹了也能采药，把绳头绕在花茎底下，一兜就上来。」'
      : '「石沟边那条近路，巳时水就要漫上去。手上有长木，趁早架。」';
  }
  function interact(v, id) {
    const r = state(),
      k = type(id),
      here = targets().find((t) => t.id === id);
    if (!here) return '东西已经挪开了。';
    if (v === 'carry') {
      if (k === 'rope') return getRope();
      if (k === 'porter') {
        spend(4);
        return r.helped
          ? '周伯抬起扁担，给你让了半步。'
          : '你抬了一下扁担，箩筐仍卡在石缝里。周伯朝绳圈努努嘴。';
      }
      if (high() && (k === 'herb' || (k === 'wood' && here.x < 128))) {
        spend(2);
        nudge = r.belt ? 'held' : r.raft ? 'raft' : 'rope';
        hintOnce('deep', '水深了，试试绳子。');
        return '水已经没过低阶，手够不着了。高岸还通着。';
      }
      if (k === 'herb') return harvest();
      return lift(id);
    }
    if (v === 'tie') {
      if (k === 'rope') return getRope();
      if (!r.belt) {
        hintOnce(r.raft ? 'raftRope' : 'findRope', r.raft ? '绳子系在排上。' : '先拿岸上的绳圈。');
        nudge = r.raft ? 'raft' : 'rope';
        return r.raft ? '绳子系在木排上。到码头解绳，就能拿回来。' : '先把岸上的麻绳拿在手边。';
      }
      if (k === 'wood') {
        const logs = targets().filter((o) => type(o.id) === 'wood' && o.x < 155 && apart(o, here) <= 70);
        if (logs.length < 2) {
          notice = { kind: 'hint', text: '浮木 ' + logs.length + ' / 2', until: performance.now() + 3000 };
          return '岸边需要两根挨近的浮木。';
        }
        if (here.x >= 155) {
          hintOnce('launch', '在码头边绑排。');
          return '木排得在码头下水。把木头搬回河沿再绑。';
        }
        [here, logs.find((o) => o.id !== id)].forEach((o) => put(o.id, 'raft'));
        r.belt = false;
        r.rope = 'raft';
        r.raft = true;
        r.focus = 'raft';
        spend(15);
        return '两根浮木并在一起，麻绳绞紧。木排能载你顺水回家了。';
      }
      if (k === 'porter') {
        if (r.helped) {
          spend(2);
          return '周伯接过绳头，利落地还你一个活结。';
        }
        r.helped = true;
        spend(12);
        return '你把绳头递给周伯，两个人一起拉出了箩筐。「午集来找我！」';
      }
      if (k === 'herb') return harvest();
      if (k === 'stone') {
        if (r.hand) {
          nudge = 'held';
          return '要先腾出双手，才拉得动石头。';
        }
        const msg = lift(id);
        return '绳套兜住了石头。' + msg;
      }
    }
    if (v === 'hail') {
      spend(3);
      if (k === 'porter') {
        r.helper = true;
        return '周伯应声过来，答应这趟帮你搬重物。' + clue();
      }
      return {
        wood: '喊声落在水面上，浮木顺着涟漪轻轻碰了碰。',
        rope: '你喊了声，绳头只在风里晃。',
        herb: '声音惊动了草叶，花穗抖了两下。',
        stone: '青纹石安安静静，水声从背后传回来。',
      }[k];
    }
  }
  function drop() {
    const r = state(),
      id = r.hand;
    // 在码头放下的木头仍漂在边上；陆上的重物留在玩家脚旁。
    const pos = point(r.p.x - 9, r.p.y + 8);
    put(id, pos);
    r.hand = null;
    r.focus = id;
    spend(3);
    return '放下了' + name(id) + '，它留在这里。';
  }
  function goHome(route, minutes) {
    const r = state();
    stopDwell();
    log('决定回家', route + ' · ' + minutes + ' 分');
    spend(minutes);
    const stone = r.hand === 'stone';
    const wood = type(r.hand) === 'wood';
    if (wood) {
      put(r.hand, 'firewood');
      LoopCore.splitFirewood(G);
    }
    if (stone) {
      r.stone = 'yard';
      r.yardSlot = 1;
    }
    r.hand = null;
    r.helper = false;
    r.focus = null;
    const packed = arriveHome(stone || wood);
    // 先提交抵家状态，过渡中刷新也只收到一次东西。
    save();
    const hero = $('rb-player');
    const craft = $('rb-map').querySelector('[data-r-target="raft"]');
    const offsets =
      route === '坐木排'
        ? [
            [0, 0],
            [-30, 10],
            [-43, 125],
            [-39, 236],
          ]
        : route === '走木桥'
          ? [
              [0, 0],
              [3, -9],
              [13, 17],
              [119, 70],
            ]
          : [
              [0, 0],
              [12, 3],
              [26, -9],
            ];
    const frames = offsets.map(([dx, dy]) => ({ transform: `translate(${r.p.x + dx}px,${r.p.y + dy}px)` }));
    if (route === '坐木排' && craft)
      craft.animate(
        offsets.map(([dx, dy], i) => ({
          transform: `translate(${i < 2 ? 0 : dx + 30}px,${i < 2 ? 0 : dy - 10}px)`,
        })),
        { duration: 780, fill: 'forwards' },
      );
    $('rb-board')
      .querySelectorAll('button')
      .forEach((b) => (b.disabled = true));
    const finish = () => {
      window.render();
      if (stone && G.time < CFG.dusk) placeStone();
      else {
        toast([route + '到了家', stone ? '青纹石已放在院里' : '', wood ? `劈出 ${LoopCore.FIREWOOD_PER_LOG} 件柴，都归你` : '', packed].filter(Boolean).join('。'));
        afterArrive();
      }
    };
    hero
      .animate(frames, {
        duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 780,
        fill: 'forwards',
      })
      .finished.then(finish, finish);
  }
  function act(action) {
    if (movement || G.phase !== 'river') return;
    const r = state(),
      id = r.focus;
    stopDwell();
    notice = null;
    heldMenu = false;
    const rescuedBefore = r.helped;
    if (action === 'walkHome' && id === 'home') return goHome('沿高岸', 30);
    if (action === 'raftHome' && id === 'raft' && r.raft) return goHome('坐木排', 5);
    if (action === 'bridgeHome' && id === 'ditch' && r.bridge && !high()) return goHome('走木桥', 12);
    if (action === 'market' && id === 'market') {
      log('赶集', '走进集市');
      save();
      openMarket();
      return;
    }
    let message = '';
    if (action === 'noon' && id === 'market' && r.helped) {
      spend(Math.max(0, 720 - G.time));
      message = '午市开了，熟悉的扁担就在布棚下。';
    } else if (action === 'untie' && id === 'raft' && r.raft) {
      r.wood.forEach((v, i) => {
        if (v === 'raft') r.wood[i] = point(...initialWood[i]);
      });
      r.raft = false;
      r.rope = 'belt';
      r.belt = true;
      r.focus = null;
      spend(8);
      message = '解开绳结，两根浮木又分开了。';
    } else if (action === 'drop' && r.hand) message = drop();
    else if (action === 'dropRope' && r.belt) {
      r.rope = point(r.p.x - 10, r.p.y + 5);
      r.belt = false;
      r.focus = 'rope';
      spend(2);
      message = '绳圈留在脚边。';
    } else if (action === 'bridge' && id === 'ditch' && type(r.hand) === 'wood') {
      if (high()) message = '沟沿已经没在水里，去高岸回家吧。';
      else if (r.bridge) message = '沟上已经有座桥了。';
      else {
        put(r.hand, 'bridge');
        r.hand = null;
        r.bridge = true;
        spend(8);
        message = '把长木横过水沟，往家少绕一段。';
      }
    } else if (verbs[action] && verbsFor(id)) message = interact(action, id);
    if (!message) {
      startDwell();
      return;
    }
    if (!rescuedBefore && r.helped) Guidance.done('porter');
    r.msg = message;
    if (id === 'porter') {
      if (action === 'hail') say(high() ? '我来搭手。水深，用绳兜药。' : '我来搭手。巳时水就漫沟了。');
      if (action === 'carry') say(r.helped ? '你先过。' : '抬不动，递根绳？');
      if (action === 'tie' && r.belt && r.helped)
        say(rescuedBefore ? '打个活结，好解。' : '多谢！午集来找我。', !rescuedBefore);
    }
    log(verbs[action] ? '搭配' : '动手', (verbs[action] || action) + ' × ' + name(id) + ' → ' + message);
    save();
    render();
    if (nudge) {
      const mark =
        nudge === 'held'
          ? $('rb-map').querySelector('[data-r-held]')
          : $('rb-map').querySelector('[data-r-target="' + nudge + '"]');
      mark?.classList.add('rb-nudge');
      nudge = null;
    }
    const hit = $('rb-map')?.querySelector('[data-r-target="' + id + '"]');
    if (hit && action === 'hail')
      hit.animate(
        [
          { transform: 'translateY(0)' },
          { transform: 'translateY(-2px)', opacity: 0.78 },
          { transform: 'translateY(0)' },
        ],
        { duration: 460 },
      );
    if (G.time >= CFG.dusk) {
      r.focus = 'home';
      r.msg = '天黑了，高岸还能通回家。';
      save();
      render();
    }
  }
  function yardStone(night) {
    const r = G.river;
    if (r?.stone !== 'yard') return '';
    const points = night
      ? [
          [83, 456],
          [134, 477],
          [228, 479],
        ]
      : [
          [77, 241],
          [134, 243],
          [242, 243],
        ];
    const [x, y] = points[r.yardSlot] || points[1];
    return `<g data-yard-stone="${r.yardSlot}" pointer-events="none">${night ? `<ellipse cx="${x}" cy="${y - 4}" rx="22" ry="13" fill="#ffd87b" opacity=".12"/>` : ''}${stoneArt(x, y, night ? 1.12 : 0.9)}</g>`;
  }
  function placeStone() {
    if (G.phase !== 'home' || G.river?.stone !== 'yard') return;
    sheet({
      title: '把青纹石摆在哪里？',
      body: '<p>石上的青纹，在灯下也认得出。</p>',
      buttons: placeNames.map((title, i) => [
        title,
        () => {
          G.river.yardSlot = i;
          log('摆院石', title);
          save();
          window.render();
          toast('青纹石摆在' + title + '。');
          afterArrive();
        },
      ]),
    });
  }
  function marketGreeting() {
    if (!G.river?.helped || G.time < 720) return '';
    const tip = clue();
    save();
    return `<section class="rb-greeting"><svg viewBox="0 0 80 80" aria-label="挑担的周伯">${porterArt(40, 70, 0.19)}</svg><div><small>河埠的熟人</small><b>周伯认出了你</b><p>「拉筐的恩人！给你个信儿。」</p><p>${tip}</p></div></section>`;
  }
  async function copyLog() {
    stopDwell();
    const rec = state().record;
    save();
    const report = JSON.stringify(
      {
        试验: '河埠 · 1',
        开局: '清晨六点、三根浮木、一圈绳',
        开始: new Date(rec.started).toISOString(),
        附近停留秒: Object.fromEntries(
          Object.entries(rec.dwell).map(([k, v]) => [
            name(k) + (type(k) === 'wood' ? ' ' + (Number(k.slice(4)) + 1) : ''),
            +(v / 1000).toFixed(1),
          ]),
        ),
        顺序: rec.events,
      },
      null,
      2,
    );
    const status = $('river-copy-status');
    try {
      await navigator.clipboard.writeText(report);
      status.textContent = '试玩记录已复制。';
    } catch {
      const area = document.createElement('textarea');
      area.readOnly = true;
      area.value = report;
      status.replaceChildren(area);
      area.select();
      if (document.execCommand('copy')) status.textContent = '试玩记录已复制。';
      else area.setAttribute('aria-label', '试玩记录，长按全选复制');
    }
  }
  function inherit(prev, own) {
    if (!prev.river) return;
    const r = state();
    r.record = prev.river.record;
    r.hints = { ...prev.river.hints };
    if (prev.river.visited) r.hints.entry = true;
    r.textOn = prev.river.textOn === true;
    if (own && prev.river.stone === 'yard') {
      r.stone = 'yard';
      r.yardSlot = prev.river.yardSlot;
    }
  }
  function leavingMap() {
    if (!G.river?.fromWharf) return;
    log('决定回家', '从河埠进三圈地图后折返');
    G.river.fromWharf = false;
    if (G.at === 'home' && G.bag.length) arriveHome();
  }
  function setText(enabled) {
    state().textOn = enabled;
    save();
    if (G.phase === 'river') render();
  }
  return {
    firstVisit,
    enter,
    render,
    setText,
    yardStone,
    placeStone,
    marketGreeting,
    copyLog,
    inherit,
    leavingMap,
  };
})();
