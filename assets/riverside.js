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
  const held = () => G.river.hand;
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
    r.visited = true;
    r.p = { ...start };
    r.focus = null;
    r.msg = '沿石板路走，或点一样看中的东西。';
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
      { id: 'far', x: 203, y: 35 },
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
    const t = tide(),
      x = t * 22;
    return `<g aria-hidden="true" pointer-events="none"><path d="M134 165q-3 52-8 100t-9 80l${x} -1q9-77 12-105t5-73z" fill="#8fc8b4" opacity="${0.18 + t * 0.43}"/><path d="M${133 + x} 229q-2 33-7 61m-2 14-3 25" stroke="#d6f2d8" opacity="${0.2 + t * 0.6}" fill="none"/>
      <g transform="translate(135 245)"><path d="M0 10v-35" stroke="#694c38" stroke-width="4"/><path d="M-2-19h4m-4 6h4m-4 6h4m-4 6h4" stroke="#eed2a4"/><ellipse cy="${7 - t * 25}" rx="8" ry="2" fill="#bedfd0" opacity=".9"/></g></g>`;
  }
  function player() {
    const r = state();
    const carrying =
      type(r.hand) === 'wood' ? woodArt(13, -15, -52) : r.hand === 'stone' ? stoneArt(10, -12, 0.65) : '';
    return `<g id="rb-player" pointer-events="none" transform="translate(${r.p.x} ${r.p.y})"><ellipse rx="11" ry="3.5" fill="#42483b55"/>${person(ME, 'calm', ageOf(G.day), 0, 0, 0.17)}${carrying}${r.belt ? ropeArt(-10, -8) : ''}</g>`;
  }
  function btn(id, title) {
    return `<button type="button" data-r-act="${id}">${title}</button>`;
  }
  function render() {
    const r = state(),
      ts = targets(),
      focus = ts.find((t) => t.id === r.focus);
    $('scene').innerHTML =
      `<section class="rb-view"><header><div><small>${G.fam}门外</small><h1>河埠</h1></div><div class="rb-time"><b>${shichen(G.time)} · ${hm(G.time)}</b><span>${high() ? '水漫低岸' : tide() > 0.32 ? '河水渐涨' : '水浅风轻'}</span></div></header>
    <svg id="rb-map" viewBox="0 0 360 450" aria-label="可以点按行走的河埠"><image href="${background}" width="360" height="450"/>${water()}${ts
      .sort((a, b) => a.y - b.y)
      .map(targetMarkup)
      .join('')}${player()}</svg></section>`;
    let controls = '';
    if (focus && verbsFor(focus.id))
      controls = Object.entries(verbs)
        .map(([v, label]) => btn(v, label))
        .join('');
    if (focus?.id === 'home') controls = btn('walkHome', '沿高岸回家 · 30 分');
    if (focus?.id === 'raft') controls = btn('raftHome', '踩上木排回家 · 5 分') + btn('untie', '解绳收排');
    if (focus?.id === 'ditch') {
      if (type(r.hand) === 'wood') controls = btn('bridge', '放下 · 搭桥');
      if (r.bridge && !high()) controls += btn('bridgeHome', '过桥回家 · 12 分');
    }
    if (focus?.id === 'market')
      controls = btn('market', '进集市') + (r.helped && G.time < 720 ? btn('noon', '等午集开市') : '');
    if (r.hand) controls += btn('drop', '放下' + name(r.hand));
    if (r.belt && !r.hand && !focus) controls += btn('dropRope', '放下麻绳');
    $('panel').innerHTML =
      `<section class="rb-panel"><div class="rb-status"><b>${focus ? name(focus.id) : '石板岸'}</b><span>${r.hand ? '手里 · ' + name(r.hand) : r.belt ? '腰间 · 麻绳' : '两手空空'}${r.helper ? ' · 周伯搭手' : ''}</span></div>
      <p role="status">${r.msg || '沿岸走走。'}</p>${controls ? `<div class="rb-actions">${controls}</div>` : ''}</section>`;
    $('rb-map').onclick = (e) => {
      const el = e.target.closest('[data-r-target]');
      const p = toSvg($('rb-map'), e);
      move(el?.dataset.rTarget, p);
    };
    $('rb-map').onkeydown = (e) => {
      const el = e.target.closest('[data-r-target]');
      if (el && ['Enter', ' '].includes(e.key)) {
        e.preventDefault();
        move(el.dataset.rTarget);
      }
    };
    $('panel')
      .querySelectorAll('[data-r-act]')
      .forEach((b) => (b.onclick = () => act(b.dataset.rAct)));
    startDwell();
  }
  const verbsFor = (id) => ['wood', 'stone', 'porter', 'rope', 'herb'].includes(type(id));
  function move(id, clicked) {
    if (movement || G.phase !== 'river') return;
    const r = state(),
      t = targets().find((o) => o.id === id);
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
      avatar.setAttribute('transform', `translate(${a.x + (b.x - a.x) * f} ${a.y + (b.y - a.y) * f})`);
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
      if (id === 'far' && !r.hand) {
        log('离开河埠', '往远处走 → 三圈地图');
        r.fromWharf = true;
        r.helper = false;
        G.phase = 'map';
        save();
        window.render();
        return;
      }
      r.msg = describe(id);
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
    if (id === 'wood0' || id === 'wood1' || id === 'wood2') return '木头在码头边轻轻相碰，能搬，也能绑。';
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
    if (r.hand) return '怀里已经抱着' + name(r.hand) + '，得先放下。';
    put(id, 'hand');
    r.hand = id;
    r.focus = null;
    spend(r.helper ? 3 : 10);
    return (r.helper ? '周伯托了一把，' : '') + '抱起了' + name(id) + '。';
  }
  function harvest() {
    const r = state();
    if (G.bag.length >= bagCap()) return '背包已经满了，草药还长在原处。';
    G.bag.push({ n: '草药', v: GOODS['草药'] });
    r.herb = null;
    r.focus = null;
    spend(6);
    return '捋下一把草药，已收进背包。';
  }
  function getRope() {
    const r = state();
    r.belt = true;
    r.rope = 'belt';
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
        return '水已经没过低阶，手够不着了。高岸还通着。';
      }
      if (k === 'herb') return harvest();
      return lift(id);
    }
    if (v === 'tie') {
      if (k === 'rope') return getRope();
      if (!r.belt) return r.raft ? '绳子系在木排上。到码头解绳，就能拿回来。' : '先把岸上的麻绳拿在手边。';
      if (k === 'wood') {
        const logs = targets().filter((o) => type(o.id) === 'wood' && o.x < 155 && apart(o, here) <= 70);
        if (logs.length < 2) return '岸边需要两根挨近的浮木。';
        if (here.x >= 155) return '木排得在码头下水。把木头搬回河沿再绑。';
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
        if (r.hand) return '要先腾出双手，才拉得动石头。';
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
    if (type(r.hand) === 'wood') {
      put(r.hand, 'firewood');
      G.store['柴'] = (G.store['柴'] || 0) + 1;
    }
    if (stone) {
      r.stone = 'yard';
      r.yardSlot = 1;
    }
    r.hand = null;
    r.helper = false;
    r.focus = null;
    const packed = arriveHome();
    // 先提交抵家状态，过渡中刷新也只入库一次。
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
    $('panel')
      .querySelectorAll('button')
      .forEach((b) => (b.disabled = true));
    const finish = () => {
      window.render();
      if (stone) placeStone();
      else {
        toast([route + '到了家', packed].filter(Boolean).join('。'));
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
    r.msg = message;
    log(verbs[action] ? '搭配' : '动手', (verbs[action] || action) + ' × ' + name(id) + ' → ' + message);
    save();
    render();
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
  return { firstVisit, enter, render, yardStone, placeStone, marketGreeting, copyLog, inherit, leavingMap };
})();
