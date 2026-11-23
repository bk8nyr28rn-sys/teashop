// The same rules drive the ribbon, its explanation and the ancestor's idle hint.
const Guidance = (() => {
  const thoughts = {
    after: ['给下一世选个去处', '走完这一世，可以先当一晚鬼，也可以直接去奈何桥选人家。', '又有个家了。'],
    wharf: ['去河埠走走', '从院门出去就能到水边，随时可以空手回来。', '听见水声了。', 'out'],
    find: ['看看岸边有什么拿得动', '点一下木头、石头或草药，走近就能动手。', '这件东西有着落了。'],
    porter: ['带着绳去看看挑担人', '他的筐卡在水边，你腰上正好有根绳。', '周伯的筐上岸了。'],
    carry: ['把手里的东西带回院子', '点右下角的「家门口」，走近后再点「回家」，东西就会随你进院。', '东西到家了。'],
    late: ['天快黑了，回家吧', '离天黑不到一个时辰，再耽搁就难赶路了。', '已经进了自家院门。'],
    sell: ['带货去集市卖', '自己背回来的货，在「我的」里能全卖，也能一件件卖。', '这笔钱收到了。', 'market'],
    door: ['换扇结实的木门', '换木门要 40 文，家里的钱加上卖货的钱已经够了。', '木门立起来了。', 'build'],
    heal: ['用草药敷一下伤', '一份草药能回一点体力，先用自己的，再用仓库的。', '伤轻了一些。', 'heal'],
    kiln: ['灶台能生火了', '3 件柴能烧成 1 件木炭，2 份草药能熬成 1 份金疮药。睡前放进去，明早就好，比直接卖值钱。', '灶里生上火了。', 'stove'],
    stove: ['灶上的东西烧好了，去取吧', '过了一夜，灶里那锅已经好了，取出来能卖，也能留着用。', '取出来了。', 'stove'],
    deliver: ['邻居托的东西凑够了', '去集市的「邻居托付」交货，给的钱比集市多，交情也会涨。', '交到了。', 'market'],
    field: ['挑个想去的地方，看看线索', '点地图上的地名，就能先看今天会碰到什么。', '这条路心里有数了。', 'out'],
    trail: ['照着眼前的线索找一次', '到了地方可以稳稳找，也可以照线索多冒一点险。', '在这里找过一回了。'],
    family: ['钱存进钱箱更安全，只能花在家上', '今天可以进「家和祠堂」，认一认守过这个家的祖宗。', '这张脸记住了。', 'family'],
    rest: ['回屋歇脚，等天黑守门', '可以趁天亮再出去一趟。入夜后，亲手守或交给机关都行。', '今晚有人守门了。', 'night'],
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
    if (G.day === 3 && !G.guideHall) return 'family';
    if (G.hp < CFG.hpMax && ['草药', '金疮药'].some(k => G.goods[k] > 0 || G.store[k] > 0)) return 'heal';
    if (G.door === 0 && !LoopCore.quoteHome(G, G, DOORS[1].cost).shortfall) return 'door';
    if (stoveOpen() && stoveState() === 'ready') return 'stove';
    if (requestDeliverable()) return 'deliver';
    if (open(LoopCore.TRADE.unlock.stove) && !G.guideStove && !G.stove && canCookAny()) return 'kiln';
    const remaining = storeCount(G.goods) + storeCount() + G.personalTreasures.length + G.treasures.length;
    if (remaining && (!soldToday() || (G.day === 1 && G.door === 0))) return 'sell';
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
      return ['把背包里的东西带回院子', '按「回家」就能把这趟的收获带回去，东西先归你。', thoughts.carry[2]];
    if (id === 'rest' && G.time >= CFG.dusk)
      return ['天黑了，选谁守门', '今晚可以亲手守，也可以交给机关。', thoughts.rest[2], 'night'];
    if (id === 'late' && G.time >= CFG.dusk)
      return ['天黑了，赶紧回家', G.phase === 'river' ? '低处已经淹了，从家门口走高岸还能回去。' : '人在野外，先想法脱身，再回院子守门。', thoughts.late[2]];
    if (id === 'heal' && !(G.goods.草药 > 0 || G.store.草药 > 0))
      return ['用金疮药敷一下伤', '一份金疮药能回两点体力，先用自己的，再用仓库的。', thoughts.heal[2], 'heal'];
    if (id === 'stove' && G.stove)
      return ['灶上的' + LoopCore.TRADE.recipes[G.stove.recipe].name + '烧好了，去取吧', thoughts.stove[1], thoughts.stove[2], 'stove'];
    if (id === 'deliver') {
      const r = requestDeliverable();
      if (r) return [nb(r.neighbor).who + '要的' + r.kind + '，你手上已经够了', thoughts.deliver[1], thoughts.deliver[2], 'market'];
    }
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
    persistGuideSeen();
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
