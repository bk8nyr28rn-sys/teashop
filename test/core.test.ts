import { describe, expect, it } from 'vitest';
import {
  addGrudge,
  addHouse,
  advanceHour,
  blockHouse,
  canCreateHeir,
  createHeir,
  createWorld,
  cutThread,
  dailyThreadUpdate,
  getHouse,
  heirAdulthoodChoice,
  interact,
  isInRetreat,
  reconcile,
  resolveKnock,
  returnStrands,
  rollKnock,
  setHeirHomeByAgreement,
  signHeir,
  startRetreat,
  tieThread,
  visitHeir,
  type DeepPartial,
  type GameConfig,
  type Thread,
  type World,
} from '../src/core';

const DAY = 24;

function world(config: DeepPartial<GameConfig> = {}, seed = 7): World {
  return createWorld({ seed, config });
}

function tie(w: World, a: string, b: string, kind: 'friend' | 'stranger' = 'friend'): Thread {
  const r = tieThread(w, a, { kind, house: b });
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

function hours(w: World, n: number): void {
  for (let i = 0; i < n; i++) advanceHour(w);
}

/** 只推进时间、跳过每天结算以外的随机砸门：把鬼的概率设成 0 */
const calm: DeepPartial<GameConfig> = { ghosts: { wildPerHour: 0, spiritPerHourPerGrudge: 0 } };

describe('#12 每日怨丝上限', () => {
  it('超出上限的部分直接散掉，第二天重新计算', () => {
    const w = world({ ...calm, grudge: { dailyCap: 30 } });
    addHouse(w, { id: 'A' });
    expect(addGrudge(w, 'A', 25, 'other')).toBe(25);
    expect(addGrudge(w, 'A', 25, 'other')).toBe(5);
    expect(getHouse(w, 'A').grudge).toBe(30);
    hours(w, DAY + 1);
    expect(addGrudge(w, 'A', 25, 'other')).toBe(25);
  });
});

describe('#1 #2 牵线与匹配', () => {
  it('好友不受等级门槛限制，陌生人要过门槛', () => {
    const w = world();
    addHouse(w, { id: 'A', realm: 1 });
    addHouse(w, { id: 'B', realm: 1 });
    addHouse(w, { id: 'C', realm: 5 });
    addHouse(w, { id: 'D', realm: 5 });
    expect(tieThread(w, 'A', { kind: 'friend', house: 'B' }).ok).toBe(true);
    expect(tieThread(w, 'A', { kind: 'stranger', house: 'C' }).ok).toBe(false);
    expect(tieThread(w, 'C', { kind: 'stranger', house: 'D' }).ok).toBe(true);
  });

  it('陌生人匹配要求双方成年', () => {
    const w = world();
    addHouse(w, { id: 'A', realm: 9 });
    addHouse(w, { id: 'M', realm: 9, isMinor: true });
    expect(tieThread(w, 'A', { kind: 'stranger', house: 'M' }).ok).toBe(false);
    expect(tieThread(w, 'A', { kind: 'friend', house: 'M' }).ok).toBe(true);
  });

  it('NPC 线随时能牵，但结不出嫡传', () => {
    const w = world();
    addHouse(w, { id: 'A' });
    const r = tieThread(w, 'A', { kind: 'npc', name: '散修' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(signHeir(w, 'A', r.value.id).ok).toBe(false);
  });
});

describe('#3 #4 剪线、复合、拉黑', () => {
  it('剪线：按比例转成怨丝，两边各生', () => {
    const w = world({ cut: { toGrudgeRatio: 0.5 } });
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    t.strands = 40;
    expect(cutThread(w, 'A', t.id).ok).toBe(true);
    expect(getHouse(w, 'A').grudge).toBe(20);
    expect(getHouse(w, 'B').grudge).toBe(20);
    expect(t.strands).toBe(0);
  });

  it('期限内双方同意可以复合，浓度比剪线前更高', () => {
    const w = world({ ...calm, cut: { reconcileWindowDays: 7, reconcileBonus: 1.2 } });
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    t.strands = 50;
    cutThread(w, 'A', t.id);
    expect(reconcile(w, t.id, ['A']).ok).toBe(false);
    expect(reconcile(w, t.id, ['A', 'B']).ok).toBe(true);
    expect(t.strands).toBeCloseTo(60);
  });

  it('过了期限就不能复合', () => {
    const w = world({ ...calm, cut: { reconcileWindowDays: 7 } });
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    cutThread(w, 'A', t.id);
    hours(w, 8 * DAY);
    expect(reconcile(w, t.id, ['A', 'B']).ok).toBe(false);
  });

  it('拉黑零代价、不可逆：不生怨丝，不能复合，也不能再牵线', () => {
    const w = world();
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    t.strands = 80;
    blockHouse(w, 'A', 'B');
    expect(getHouse(w, 'A').grudge).toBe(0);
    expect(getHouse(w, 'B').grudge).toBe(0);
    expect(t.state).toBe('severed');
    expect(reconcile(w, t.id, ['A', 'B']).ok).toBe(false);
    expect(tieThread(w, 'B', { kind: 'friend', house: 'A' }).ok).toBe(false);
  });
});

describe('#5 冷落与闭关', () => {
  it('不在线本身不算冷落：没有未回的互动就不生怨', () => {
    const w = world(calm);
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    t.strands = 30;
    hours(w, 10 * DAY);
    expect(getHouse(w, 'A').grudge).toBe(0);
    expect(t.strands).toBe(30);
  });

  it('搭档发来的互动超过宽限天数没回，才算冷落', () => {
    const w = world({ ...calm, neglect: { graceDays: 3, dimPerDay: 4, grudgePerDay: 3, grudgeTo: 'neglecter' } });
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    t.strands = 30;
    interact(w, 'A', t.id);
    hours(w, 3 * DAY);
    expect(getHouse(w, 'B').grudge).toBe(0);
    hours(w, DAY);
    expect(getHouse(w, 'B').grudge).toBe(3);
    expect(getHouse(w, 'A').grudge).toBe(0);
    expect(t.strands).toBe(26);
  });

  it('回应之后就不再算冷落，而且涨情丝', () => {
    const w = world(calm);
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    interact(w, 'A', t.id);
    interact(w, 'B', t.id);
    expect(t.pendingRequest).toBeNull();
    expect(t.strands).toBe(w.config.thread.interactionGain);
  });

  it('闭关期间冷落不计时', () => {
    const w = world({ ...calm, neglect: { graceDays: 3 } });
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    interact(w, 'A', t.id);
    expect(startRetreat(w, 'B', 5).ok).toBe(true);
    hours(w, 6 * DAY);
    expect(getHouse(w, 'B').grudge).toBe(0);
  });

  it('闭关有每个周期的天数上限', () => {
    const w = world({ retreat: { daysPerWindow: 7, windowDays: 30 } });
    addHouse(w, { id: 'A' });
    expect(startRetreat(w, 'A', 5).ok).toBe(true);
    expect(startRetreat(w, 'A', 3).ok).toBe(false);
    expect(startRetreat(w, 'A', 2).ok).toBe(true);
  });
});

describe('#7 多对象', () => {
  function setup(oldPartner: 'open' | 'devoted') {
    const w = world({ ...calm, multiPartner: { strainPerExisting: 2, grudgePerStrain: 1, naturalDecayPerDay: 0 } });
    addHouse(w, { id: 'A', openness: 'open' });
    addHouse(w, { id: 'B', openness: oldPartner });
    addHouse(w, { id: 'C' });
    const old = tie(w, 'A', 'B');
    old.strands = 50;
    tie(w, 'A', 'C');
    hours(w, DAY + 1);
    return { w, old };
  }

  it('旧搭档开放：怨丝只落在牵新线的人家里，旧线只是暗淡', () => {
    const { w, old } = setup('open');
    expect(getHouse(w, 'A').grudge).toBe(2);
    expect(getHouse(w, 'B').grudge).toBe(0);
    expect(old.strands).toBeLessThan(50);
  });

  it('旧搭档专一：两边都生怨', () => {
    const { w } = setup('devoted');
    expect(getHouse(w, 'A').grudge).toBe(2);
    expect(getHouse(w, 'B').grudge).toBe(2);
  });

  it('对象越多，每根旧线加的心力分散越多', () => {
    const w = world(calm);
    for (const id of ['A', 'B', 'C', 'D']) addHouse(w, { id });
    const t1 = tie(w, 'A', 'B');
    tie(w, 'A', 'C');
    expect(t1.strain['A']).toBe(1);
    tie(w, 'A', 'D');
    expect(t1.strain['A']).toBe(1 + 2);
  });

  it('在旧线上互动可以抵消心力分散', () => {
    const w = world(calm);
    for (const id of ['A', 'B', 'C']) addHouse(w, { id });
    const t1 = tie(w, 'A', 'B');
    tie(w, 'A', 'C');
    interact(w, 'A', t1.id);
    expect(t1.strain['A']).toBe(0);
  });
});

describe('#8 #11 守宅：失败惩罚与劫后余生', () => {
  it('门被砸破后进入劫后余生，期间不会再被砸', () => {
    const w = world({ ghosts: { wildPerHour: 1, wildBaseStrength: 1e9 } });
    const a = addHouse(w, { id: 'A', stones: 100 });
    hours(w, 1);
    expect(w.events.filter((e) => e.type === 'breach')).toHaveLength(1);
    expect(a.graceActionsLeft).toBe(w.config.breach.graceActions);
    expect(rollKnock(w, a)).toBeNull();
  });

  it('离线期间最多输一次：劫后余生按行动次数算，离线不行动', () => {
    const w = world({ ghosts: { wildPerHour: 1, wildBaseStrength: 1e9 } });
    addHouse(w, { id: 'A', stones: 1000 });
    hours(w, 30 * DAY);
    expect(w.events.filter((e) => e.type === 'breach')).toHaveLength(1);
  });

  it('当家人不掉修为；灵石损失有上限', () => {
    const w = world({ ghosts: { wildPerHour: 1, wildBaseStrength: 1e9 }, breach: { stoneLossRatio: 0.5, stoneLossCap: 100 } });
    const a = addHouse(w, { id: 'A', stones: 1000, realm: 4 });
    hours(w, 1);
    expect(a.realm).toBe(4);
    expect(a.stones).toBe(900);
  });

  it('闭关期间鬼不来', () => {
    const w = world({ ghosts: { wildPerHour: 1 } });
    const a = addHouse(w, { id: 'A' });
    startRetreat(w, 'A', 2);
    expect(rollKnock(w, a)).toBeNull();
  });
});

describe('#21 未成年人', () => {
  it('禁玩时段自动闭关，不占闭关额度；可玩时段恢复', () => {
    const w = world();
    const m = addHouse(w, { id: 'M', isMinor: true });
    expect(isInRetreat(w, m, 0)).toBe(true); // 周一 0 点
    expect(isInRetreat(w, m, 4 * DAY + 20)).toBe(false); // 周五 20 点
    expect(isInRetreat(w, m, 4 * DAY + 21)).toBe(true);
    expect(m.retreatDaysUsed).toBe(0);
  });
});

describe('#13 #14 两种鬼与情丝去向', () => {
  it('打赢野鬼掉诡心', () => {
    const w = world({ ghosts: { wildBaseStrength: 0 } });
    addHouse(w, { id: 'A' });
    resolveKnock(w, 'A', 'wild', true);
    expect(getHouse(w, 'A').ghostHearts).toBe(1);
  });

  it('打散怨灵：情丝回到来帮忙的搭档那根线上', () => {
    const w = world({ ghosts: { spiritBaseStrength: 0, spiritStrengthPerGrudge: 0 }, conversion: { purifyThreshold: 1e9 } });
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    addHouse(w, { id: 'C' });
    const strong = tie(w, 'A', 'B');
    const weak = tie(w, 'A', 'C');
    strong.strands = 30;
    weak.strands = 10;
    getHouse(w, 'A').grudge = 10;
    resolveKnock(w, 'A', 'spirit', true);
    expect(getHouse(w, 'A').grudge).toBe(0);
    expect(strong.strands).toBeGreaterThan(30);
    expect(weak.strands).toBe(10);
  });

  it('红线够浓时直接感化，还原得比打散多，被感化的怨灵会帮忙守门', () => {
    const w = world({ conversion: { purifyThreshold: 60, purifyReturn: 2, purifiedGuardKnocks: 3 } });
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    t.strands = 60;
    getHouse(w, 'A').grudge = 10;
    resolveKnock(w, 'A', 'spirit', true);
    expect(t.strands).toBe(80);
    expect(getHouse(w, 'A').guardianKnocks).toBe(3);
    expect(getHouse(w, 'A').ghostHearts).toBe(0);
  });

  it('一根线都没有时，变回的情丝用来加固门', () => {
    const w = world();
    addHouse(w, { id: 'A' });
    returnStrands(w, 'A', 10, null);
    expect(getHouse(w, 'A').ward).toBeGreaterThan(0);
  });
});

describe('#9 #10 #6 #15 族人与嫡传', () => {
  it('红线会慢慢结出族人，记录父母；真人线两边各结一位', () => {
    const w = world({ ...calm, family: { memberStrandHours: 100 } });
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    t.strands = 50;
    hours(w, 2);
    expect(getHouse(w, 'A').members).toHaveLength(1);
    expect(getHouse(w, 'B').members).toHaveLength(1);
    expect(getHouse(w, 'A').members[0]?.parents).toEqual(['A', 'B']);
  });

  it('嫡传需要浓度门槛 + 双方签署；消耗浓度，灵根按消耗前算', () => {
    const w = world({ heir: { strandThreshold: 80, consumeRatio: 0.4 } });
    addHouse(w, { id: 'A', traits: ['武生'] });
    addHouse(w, { id: 'B', traits: ['花旦', '武生'] });
    const t = tie(w, 'A', 'B');
    t.strands = 100;
    signHeir(w, 'A', t.id);
    expect(canCreateHeir(w, t.id).ok).toBe(false);
    signHeir(w, 'B', t.id);
    const r = createHeir(w, t.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.spiritualRoot).toBe(100);
    expect(t.strands).toBeCloseTo(60);
    expect(r.value.traitKinds.sort()).toEqual(['武生', '花旦'].sort());
    expect(createHeir(w, t.id).ok).toBe(false);
  });

  function withHeir() {
    const w = world(calm);
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    t.strands = 100;
    signHeir(w, 'A', t.id);
    signHeir(w, 'B', t.id);
    const r = createHeir(w, t.id);
    if (!r.ok) throw new Error(r.reason);
    return { w, t, heir: r.value };
  }

  it('分手时归属还没定，按孩子当时的表态（谁陪得多）直接定', () => {
    const { w, t, heir } = withHeir();
    visitHeir(w, 'B', heir.id);
    visitHeir(w, 'B', heir.id);
    visitHeir(w, 'A', heir.id);
    cutThread(w, 'A', t.id);
    expect(heir.home).toBe('B');
    expect(heir.spiritualRoot).toBe(100);
  });

  it('拉黑后，不住在自己家的一方不能再探望', () => {
    const { w, heir } = withHeir();
    setHeirHomeByAgreement(w, heir.id, 'A', ['A', 'B']);
    blockHouse(w, 'B', 'A');
    expect(visitHeir(w, 'B', heir.id).ok).toBe(false);
    expect(visitHeir(w, 'A', heir.id).ok).toBe(true);
  });

  it('成年时再选一次，看谁陪得多；只选一次', () => {
    const { w, heir } = withHeir();
    setHeirHomeByAgreement(w, heir.id, 'A', ['A', 'B']);
    for (let i = 0; i < 3; i++) visitHeir(w, 'B', heir.id);
    const r = heirAdulthoodChoice(w, heir.id);
    expect(r.ok && r.value).toBe('B');
    expect(heirAdulthoodChoice(w, heir.id).ok).toBe(false);
  });

  it('拉黑了的不再重选', () => {
    const { w, heir } = withHeir();
    setHeirHomeByAgreement(w, heir.id, 'A', ['A', 'B']);
    for (let i = 0; i < 3; i++) visitHeir(w, 'B', heir.id);
    blockHouse(w, 'A', 'B');
    const r = heirAdulthoodChoice(w, heir.id);
    expect(r.ok && r.value).toBe('A');
  });
});

describe('确定性', () => {
  it('同一个种子得到同样的结果', () => {
    const run = () => {
      const w = world({}, 42);
      addHouse(w, { id: 'A' });
      getHouse(w, 'A').grudge = 25;
      hours(w, 10 * DAY);
      return w.events.length;
    };
    expect(run()).toBe(run());
  });
});

// 保证 dailyThreadUpdate 可单独调用（界面层可能自己控制结算时机）
describe('API', () => {
  it('dailyThreadUpdate 可以单独调用', () => {
    const w = world();
    expect(() => dailyThreadUpdate(w)).not.toThrow();
  });
});
