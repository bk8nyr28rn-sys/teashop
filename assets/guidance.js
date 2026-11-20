// The same rules drive the ribbon, its explanation and the ancestor's idle hint.
const Guidance = (() => {
  const thoughts = {
    after: ['给下一世选个去处', '走完这一世，可以先当一晚鬼，也可以直接去奈何桥选人家。', '又有个家了。'],
    wharf: ['去河埠走走', '从院门出去就能到水边，随时可以空手回来。', '听见水声了。', 'out'],
    find: ['看看岸边有什么拿得动', '点一下木头、石头或草药，走近就能动手。', '这件东西有着落了。'],
    porter: ['带着绳去看看挑担人', '他的筐卡在水边，你腰上正好有根绳。', '周伯的筐上岸了。'],
    carry: ['把手里的东西带回院子', '点右下角的「家门口」，走近后再点「回家」，东西就会随你进院。', '东西到家了。'],
    late: ['天快黑了，回家吧', '离天黑不到一个时辰，再耽搁就难赶路了。', '已经进了自家院门。'],
    sell: ['拿一件存货去集市卖', '仓里的东西能卖钱，想留下的可以单独留着。', '这笔钱落袋了。', 'market'],
    door: ['换扇结实的木门', '柴门只有 140 点门血，手里的 40 文已经够换木门了。', '木门立起来了。', 'build'],
    heal: ['用仓里的草药敷一下伤', '你受了伤，仓库里正好有草药，敷了能回一点体力。', '伤轻了一些。', 'heal'],
    field: ['挑个想去的地方，看看线索', '点地图上的地名，就能先看今天会碰到什么。', '这条路心里有数了。', 'out'],
    trail: ['照着眼前的线索找一次', '到了地方可以稳稳找，也可以照线索多冒一点险。', '在这里找过一回了。'],
    family: ['回家看看祠堂里的画像', '你长大了，从「家和祠堂」进去就能认一认祖宗。', '这张脸记住了。', 'family'],
    rest: ['回屋歇脚，等天黑守门', '今天可以收工了，也可以趁天亮再出去一趟。', '该提剑守门了。', 'night'],
    fight: ['守住自家的门', '点靠近家门的鬼，守完一波就能挑本事。', '这一夜守住了。'],
    dawn: ['等天亮，再过一天', '攒着的天能用来开始新一天，日子用完就等下个现实日。', '新的一天开始了。', 'dawn'],
  };
  const outside = () => ['river', 'map'].includes(G.phase);
  const open = day => G.allFeatures === true || G.day >= day;
  const soldToday = () => G.guideSoldDay === G.day;
  function pickThought() {
    if (G.phase === 'intro') return 'dawn';
    if (['haunt','death','reborn'].includes(G.phase)) return 'after';
    if (G.phase === 'night' || G.phase === 'guard') return 'fight';
    if (G.phase === 'dawn' || G.phase === 'birth') return 'dawn';
    if (outside() && CFG.dusk - G.time < 120) return 'late';
    if (G.phase === 'river') {
      if (G.river.hand || G.bag.length) return 'carry';
      if (G.river.belt && !G.river.helped) return 'porter';
      return 'find';
    }
    if (G.phase === 'map' && G.bag.length && G.target == null) return 'carry';
    if (G.phase === 'map') return G.at === 'home' && G.target == null ? 'field' : 'trail';
    if (G.phase !== 'home') return null;
    if (G.time >= CFG.dusk) return 'rest';
    if (G.hp < CFG.hpMax && G.store['草药'] > 0) return 'heal';
    if (G.door === 0 && G.money >= DOORS[1].cost) return 'door';
    if (storeCount() && !soldToday()) return 'sell';
    if (CFG.dusk - G.time < 120) return 'rest';
    if (G.day >= 3 && !G.guideHall) return 'family';
    if (G.day === 1 && River.firstVisit()) return 'wharf';
    if (open(2) && G.field?.day !== G.day && G.guideMapDay !== G.day) return 'field';
    return 'rest';
  }
  function wording(id) {
    if (id === 'find' && G.river.belt && G.river.helped)
      return ['看看岸边还有什么能带走', '走近木头、石头或草药就能动手，空手回家也行。', thoughts.find[2]];
    if (id === 'dawn' && G.phase === 'intro')
      return ['推开院门，过第一天', '今天从自家小院开始，河埠就在门外。', '天亮了。', 'start'];
    if (id === 'carry' && G.phase === 'map')
      return ['把背包里的东西带回院子', '按「回家」就能把背包里的东西送进仓库。', thoughts.carry[2]];
    if (id === 'rest' && G.time >= CFG.dusk)
      return ['天黑了，去守门', '鬼要来砸门了，从院里就能去守夜。', thoughts.rest[2], 'night'];
    if (id === 'late' && G.time >= CFG.dusk)
      return ['天黑了，赶紧回家', G.phase === 'river' ? '低处已经淹了，从家门口走高岸还能回去。' : '人在野外，先想法脱身，再回院子守门。', thoughts.late[2]];
    if (id === 'trail' && G.target != null)
      return ['去看看线索指的地方', '选「走过去」才会动身，到地方后可以选一种找法。', thoughts.trail[2], 'go'];
    return thoughts[id];
  }
  let current = null, idleTimer, speechTimer, feedbackTimer;
  function ancestor() {
    return G.ancestors.at(-1) || {
      name: surnameOf(G.fam) + '太婆', look: lookOf({...INSPIRE[2][1], hairColor:'#aaa39d', weapon:'none'}),
      note: '曾在院门前守夜', expression: 'happy',
    };
  }
  function silence() {
    clearTimeout(speechTimer);
    const el = $('ancestor');
    el.hidden = true;
    $('guide-anchor').append(el);
  }
  function speak(text, inSheet = false) {
    if (!text || G.guideOff || document.hidden || $('avatar-dialog').open || G.guideSeen?.includes(text)) return;
    const stored = storedGame();
    if (stored && (stored.lifeNo > G.lifeNo || (stored.lifeNo === G.lifeNo && stored.day > G.day))) return;
    G.guideSeen = [...new Set([...(G.guideSeen || []), ...(stored?.guideSeen || [])])];
    if (G.guideSeen.includes(text)) return;
    const host = inSheet ? $('sheet').querySelector('.card') : $('guide-anchor');
    if (!host) return;
    const el = $('ancestor'), a = ancestor();
    clearTimeout(speechTimer);
    if (inSheet) host.querySelector('h2').after(el);
    else host.append(el);
    el.innerHTML = '<svg viewBox="0 0 66 82" aria-hidden="true">' + ghostSvg(a.look, 'happy', 'elder', 33, 82, .205) + '</svg><div><small></small><span></span></div>';
    el.querySelector('small').textContent = a.name + ' · 祖宗';
    el.querySelector('span').textContent = text;
    el.hidden = false;
    el.getAnimations().forEach(animation => animation.cancel());
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
      el.animate([{opacity:1, offset:0}, {opacity:1, offset:.84}, {opacity:0}], {duration:5500});
    speechTimer = setTimeout(silence, 5500);
    G.guideSeen.push(text);
    // A guide timeout in an older tab must never roll back the actual game.
    try {
      if (stored && stored.lifeNo === G.lifeNo) localStorage.setItem('wulin-loop', JSON.stringify({...stored, guideSeen:G.guideSeen}));
      else save();
    } catch {}
  }
  function update() {
    const id = pickThought(), copy = id && wording(id);
    const changed = id !== current || (id && $('thought-title').textContent !== copy[0]);
    if (changed) {
      $('thought-why').hidden = true;
      $('thought-button').setAttribute('aria-expanded', 'false');
      silence();
    }
    current = id;
    $('thought').hidden = !id;
    if (!id) return;
    $('thought').dataset.thought = id;
    $('thought-title').textContent = copy[0];
    $('thought-why').textContent = copy[1];
    document.querySelectorAll('#panel [data-a]').forEach(el =>
      el.classList.toggle('suggested', el.dataset.a === copy[3]));
    if (!$('sheet').hidden) return;
    if (id === 'late') speak('天快黑了，还不回家？');
    else if (G.phase === 'intro') speak('我是祠堂里的老祖宗。白天随你逛，夜里咱们守这扇门。');
    else if (G.phase === 'home' && G.day === 2) speak('近郊和山林的路通了，出门还能叫个伴。');
    else if (G.phase === 'home' && G.day === 3) speak('你长大了，家里能结缘、收徒，祠堂也该去认认了。');
    else if (G.phase === 'home' && G.day === 4) speak('去邻家串串门，交情深了，夜里也能喊来帮忙。');
    else if (G.phase === 'river') speak('这段河岸我也走过，喜欢哪样就凑近看看。');
    else if (G.phase === 'map' && open(3)) speak('最外圈是禁地，要不要走进去，你自己掂量。');
    else if (G.phase === 'map') speak('点个地名，先听听那一带今日的消息。');
    else if (G.phase === 'night') speak(open(2) ? '弓和灯都能上手了，今晚你自己挑家伙。' : '鬼近了就点它，一波守住，自己挑个本事。');
  }
  function done(id) {
    if (id !== current) return;
    const el = $('thought-feedback');
    el.textContent = '✓ ' + wording(id)[2];
    el.hidden = false;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => { el.hidden = true; }, 2400);
    // Future audio can subscribe here. No sound is loaded or played.
    window.dispatchEvent(new CustomEvent('thought-complete', {detail: id}));
  }
  function resetIdle() {
    clearTimeout(idleTimer);
    if (document.hidden) return;
    idleTimer = setTimeout(() => {
      if (!current || !['intro','home','river','map','dawn','birth'].includes(G.phase) ||
          !$('sheet').hidden || $('avatar-dialog').open || document.querySelector(':popover-open')) return;
      speak('要是没拿定主意，' + wording(current)[0] + '。');
    }, 20000);
  }
  function bind() {
    $('thought-button').onclick = () => {
      const why = $('thought-why');
      why.hidden = !why.hidden;
      $('thought-button').setAttribute('aria-expanded', String(!why.hidden));
    };
    for (const event of ['pointerdown','pointermove','keydown','wheel','scroll'])
      document.addEventListener(event, resetIdle, {passive:true, capture:true});
    document.addEventListener('visibilitychange', resetIdle);
    resetIdle();
  }
  return {open, update, done, speak, silence, bind, resetIdle, ancestor};
})();
