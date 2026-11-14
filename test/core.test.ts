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
  doorPower,
  startQuarrel,
  reconcileQuarrel,
  attemptTribulation,
  brewBreakthroughPill,
  canAttemptTribulation,
  collectMeditation,
  addStrands,
  bigInteract,
  NPC_SIDE,
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

/** 关掉随机砸门和随机误会，让测试只看要测的规则 */
const calm: DeepPartial<GameConfig> = { ghosts: { wildPerHour: 0, spiritPerHourPerGrudge: 0 }, quarrel: { baseChancePerDay: 0 } };

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

  it('期限内双方同意可以复合：散开的部分聚回，怨丝部分按破镜重圆转化一小部分', () => {
    const w = world({ ...calm, cut: { reconcileWindowDays: 7, toGrudgeRatio: 0.5 }, quarrel: { reunionConvert: 0.2 } });
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    t.strands = 50;
    cutThread(w, 'A', t.id);
    expect(reconcile(w, t.id, ['A']).ok).toBe(false);
    expect(reconcile(w, t.id, ['A', 'B']).ok).toBe(true);
    expect(t.strands).toBeCloseTo(25 + 5 + 5);
    expect(getHouse(w, 'A').grudge).toBeCloseTo(20);
  });

  it('剪线再复合刷不了浓度', () => {
    const w = world(calm);
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    t.strands = 100;
    for (let i = 0; i < 3; i++) {
      cutThread(w, 'A', t.id);
      reconcile(w, t.id, ['A', 'B']);
    }
    expect(t.strands).toBeLessThan(100);
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

  it('闭关期间族人照常结：冻结只管保护，不停止成长', () => {
    const w = world({ ...calm, family: { memberStrandHours: 100 } });
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    t.strands = 50;
    startRetreat(w, 'A', 3);
    hours(w, 2);
    expect(getHouse(w, 'A').members).toHaveLength(1);
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
    const w = world({ ...calm, multiPartner: { strainPerExisting: 1 } });
    for (const id of ['A', 'B', 'C', 'D']) addHouse(w, { id });
    const t1 = tie(w, 'A', 'B');
    tie(w, 'A', 'C');
    expect(t1.strain['A']).toBe(1);
    tie(w, 'A', 'D');
    expect(t1.strain['A']).toBe(1 + 2);
  });

  it('在旧线上互动可以抵消心力分散', () => {
    const w = world({ ...calm, multiPartner: { strainPerExisting: 1, reliefPerInteraction: 1 } });
    for (const id of ['A', 'B', 'C']) addHouse(w, { id });
    const t1 = tie(w, 'A', 'B');
    tie(w, 'A', 'C');
    interact(w, 'A', t1.id);
    expect(t1.strain['A']).toBe(0);
  });
});

describe('多对象回报递减', () => {
  it('守门：最浓的线全额，第二根打对折', () => {
    const w = world({ thread: { diminishing: 0.5 }, door: { perStrand: 1 } });
    for (const id of ['A', 'B', 'C']) addHouse(w, { id });
    const before = doorPower(w, getHouse(w, 'A'));
    const t1 = tie(w, 'A', 'B');
    const t2 = tie(w, 'A', 'C');
    t1.strands = 40;
    t2.strands = 100;
    expect(doorPower(w, getHouse(w, 'A')) - before).toBe(100 + 40 * 0.5);
  });

  it('结族人：第二根线只按一半速度结', () => {
    const w = world({ ...calm, thread: { diminishing: 0.5 }, family: { memberStrandHours: 100 } });
    addHouse(w, { id: 'A' });
    const t1 = tieThread(w, 'A', { kind: 'npc', name: '甲' });
    const t2 = tieThread(w, 'A', { kind: 'npc', name: '乙' });
    if (!t1.ok || !t2.ok) throw new Error();
    t1.value.strands = 50;
    t2.value.strands = 50;
    hours(w, 2);
    expect(getHouse(w, 'A').members).toHaveLength(1);
    hours(w, 2);
    expect(getHouse(w, 'A').members).toHaveLength(3);
  });
});

describe('NPC 线也要维护', () => {
  it('NPC 过几个小时才回，回了才涨情丝', () => {
    const w = world({ ...calm, npc: { replyHours: 12 } });
    addHouse(w, { id: 'A' });
    const r = tieThread(w, 'A', { kind: 'npc', name: '散修' });
    if (!r.ok) throw new Error();
    interact(w, 'A', r.value.id);
    expect(r.value.strands).toBe(0);
    hours(w, 13);
    expect(r.value.strands).toBe(w.config.thread.interactionGain);
  });

  it('NPC 发来的互动不回，一样算冷落，怨丝只落在玩家家里', () => {
    const w = world({ ...calm, neglect: { graceDays: 3, grudgePerDay: 3 } });
    addHouse(w, { id: 'A' });
    const r = tieThread(w, 'A', { kind: 'npc', name: '散修' });
    if (!r.ok) throw new Error();
    r.value.pendingRequest = { from: NPC_SIDE, at: 0 };
    hours(w, 4 * DAY + 1);
    expect(getHouse(w, 'A').grudge).toBeGreaterThan(0);
  });
});

describe('关系分级与吃醋', () => {
  it('按浓度分级，跨过区间会升级或降级', () => {
    const w = world(calm);
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    addStrands(w, t, 65);
    expect(w.config.tiers.names[t.tier]).toBe('倾心');
    addStrands(w, t, -10);
    expect(w.config.tiers.names[t.tier]).toBe('知己');
    expect(w.events.filter((e) => e.type === 'tierChanged')).toHaveLength(2);
  });

  it('和一根线互动，其他线按等级变淡并生怨；相识级别的线不在乎', () => {
    const w = world({ ...calm, jealousy: { dimPerTier: 1, grudgePerTier: 1 } });
    for (const id of ['A', 'B', 'C', 'D']) addHouse(w, { id });
    const tb = tie(w, 'A', 'B');
    const tc = tie(w, 'A', 'C');
    const td = tie(w, 'A', 'D');
    addStrands(w, tc, 65); // 倾心 = 2 级
    addStrands(w, td, 10); // 相识 = 0 级
    interact(w, 'A', tb.id);
    expect(tc.strands).toBe(63);
    expect(td.strands).toBe(10);
    expect(getHouse(w, 'A').grudge).toBe(2);
  });

  it('吃醋把浓度压到区间下限以下就降级', () => {
    const w = world({ ...calm, jealousy: { dimPerTier: 5 } });
    for (const id of ['A', 'B', 'C']) addHouse(w, { id });
    const tb = tie(w, 'A', 'B');
    const tc = tie(w, 'A', 'C');
    addStrands(w, tc, 32); // 知己
    interact(w, 'A', tb.id);
    expect(w.config.tiers.names[tc.tier]).toBe('相识');
  });
});

describe('争执与和好', () => {
  function pair(config: DeepPartial<GameConfig> = {}) {
    const w = world({ ...calm, ...config });
    addHouse(w, { id: 'A' });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    addStrands(w, t, 100);
    return { w, t };
  }

  it('争执时一部分浓度散掉，其中一部分变成怨丝，两边各生', () => {
    const { w, t } = pair({ quarrel: { lossRatio: 0.2, grudgeRatio: 0.5 } });
    startQuarrel(w, t, 'misunderstanding');
    expect(t.strands).toBe(80);
    expect(getHouse(w, 'A').grudge).toBe(10);
    expect(getHouse(w, 'B').grudge).toBe(10);
  });

  it('两人都和好才算数；没变成怨丝的部分聚回，破镜重圆再从怨丝转化一小部分', () => {
    const { w, t } = pair({ quarrel: { lossRatio: 0.2, grudgeRatio: 0.5, reunionConvert: 0.2 } });
    startQuarrel(w, t, 'misunderstanding');
    const first = reconcileQuarrel(w, 'A', t.id);
    expect(first.ok && first.value.done).toBe(false);
    expect(t.quarrel).not.toBeNull();
    reconcileQuarrel(w, 'B', t.id);
    expect(t.quarrel).toBeNull();
    expect(t.strands).toBeCloseTo(80 + 10 + 2 + 2);
    expect(getHouse(w, 'A').grudge).toBeCloseTo(8);
  });

  it('吵架刷不了：每吵一次都会亏一点，冷却内没有破镜重圆', () => {
    const { w, t } = pair({ quarrel: { lossRatio: 0.2, grudgeRatio: 0.5, reunionConvert: 0.2, reunionCooldownDays: 30 } });
    startQuarrel(w, t, 'risky');
    reconcileQuarrel(w, 'A', t.id);
    reconcileQuarrel(w, 'B', t.id);
    const before = t.strands;
    startQuarrel(w, t, 'risky');
    reconcileQuarrel(w, 'A', t.id);
    reconcileQuarrel(w, 'B', t.id);
    expect(t.strands).toBeLessThan(before);
    expect(getHouse(w, 'A').grudge).toBeGreaterThan(8);
  });

  it('超过期限没和好，散掉的就散了', () => {
    const { w, t } = pair({ quarrel: { lossRatio: 0.2, reconcileWindowDays: 3 } });
    startQuarrel(w, t, 'misunderstanding');
    reconcileQuarrel(w, 'A', t.id);
    hours(w, 4 * DAY);
    expect(t.quarrel).toBeNull();
    expect(reconcileQuarrel(w, 'B', t.id).ok).toBe(false);
    expect(t.strands).toBe(80);
  });

  it('NPC 线：玩家一和好就完成', () => {
    const w = world(calm);
    addHouse(w, { id: 'A' });
    const r = tieThread(w, 'A', { kind: 'npc', name: '散修' });
    if (!r.ok) throw new Error();
    addStrands(w, r.value, 50);
    startQuarrel(w, r.value, 'misunderstanding');
    const done = reconcileQuarrel(w, 'A', r.value.id);
    expect(done.ok && done.value.done).toBe(true);
  });

  it('关系紧张（刚吃过醋）时更容易误会', () => {
    const count = (tense: boolean) => {
      const w = world({ ...calm, quarrel: { baseChancePerDay: 0.05, tensionMultiplier: 4 } }, 3);
      let n = 0;
      w.listener = (e) => {
        if (e.type === 'quarrel') n++;
      };
      for (let i = 0; i < 300; i++) {
        addHouse(w, { id: `A${i}` });
        addHouse(w, { id: `B${i}` });
        const t = tie(w, `A${i}`, `B${i}`);
        addStrands(w, t, 50);
        if (tense) t.lastTensionAt = 1e9;
      }
      hours(w, DAY + 1);
      return n;
    };
    expect(count(true)).toBeGreaterThan(count(false) * 2);
  });

  it('冒险说法：成功时增长翻倍，有概率引发误会', () => {
    const grow = pair({ quarrel: { riskyChance: 0, riskyGainMultiplier: 2 } });
    interact(grow.w, 'A', grow.t.id);
    interact(grow.w, 'B', grow.t.id, { risky: true });
    expect(grow.t.strands).toBe(100 + 2 * grow.w.config.thread.interactionGain);

    const fight = pair({ quarrel: { riskyChance: 1 } });
    interact(fight.w, 'A', fight.t.id);
    interact(fight.w, 'B', fight.t.id, { risky: true });
    expect(fight.t.quarrel).not.toBeNull();
  });

  it('剪线会结束争执', () => {
    const { w, t } = pair();
    startQuarrel(w, t, 'misunderstanding');
    cutThread(w, 'A', t.id);
    expect(t.quarrel).toBeNull();
  });
});

describe('大互动', () => {
  function setup(config: DeepPartial<GameConfig> = {}) {
    const w = world({ ...calm, ...config });
    addHouse(w, { id: 'A', stones: 1000 });
    addHouse(w, { id: 'B' });
    const t = tie(w, 'A', 'B');
    return { w, t };
  }

  it('可以设关系等级门槛（默认没有），押注有下限', () => {
    const { w, t } = setup({ big: { minTier: 1 } });
    expect(bigInteract(w, 'A', t.id, 50).ok).toBe(false);
    addStrands(w, t, 30);
    expect(bigInteract(w, 'A', t.id, 5).ok).toBe(false);
    expect(bigInteract(w, 'A', t.id, 50).ok).toBe(true);
  });

  it('成功：押注全部化为情丝，比失败时最多损失的还多一点', () => {
    const { w, t } = setup({ big: { baseSuccess: 1, strandsPerStone: 0.1, successEdge: 0.1 } });
    addStrands(w, t, 30);
    const r = bigInteract(w, 'A', t.id, 100);
    expect(r.ok && r.value.success).toBe(true);
    expect(t.strands).toBeCloseTo(30 + 11);
    expect(getHouse(w, 'A').stones).toBe(900);
  });

  it('失败：随机损失押注的一部分，红线不变', () => {
    const { w, t } = setup({ big: { baseSuccess: 0, failLossMin: 0.5, failLossMax: 1 } });
    addStrands(w, t, 30);
    bigInteract(w, 'A', t.id, 100);
    const lost = 1000 - getHouse(w, 'A').stones;
    expect(lost).toBeGreaterThanOrEqual(50);
    expect(lost).toBeLessThanOrEqual(100);
    expect(t.strands).toBe(30);
  });

  it('真人搭档同时在场，成功率更高；NPC 线没有这个加成', () => {
    const rate = (present: boolean, npc: boolean) => {
      const w = world({ ...calm, big: { baseSuccess: 0.5, coPresenceBonus: 0.3 } }, 99);
      addHouse(w, { id: 'A', stones: 1e9 });
      addHouse(w, { id: 'B' });
      const r = npc ? tieThread(w, 'A', { kind: 'npc', name: '散修' }) : tieThread(w, 'A', { kind: 'friend', house: 'B' });
      if (!r.ok) throw new Error();
      addStrands(w, r.value, 100);
      let wins = 0;
      for (let i = 0; i < 2000; i++) {
        const res = bigInteract(w, 'A', r.value.id, 20, present);
        if (res.ok && res.value.success) wins++;
        r.value.strands = 100;
      }
      return wins / 2000;
    };
    expect(rate(true, false)).toBeGreaterThan(0.75);
    expect(rate(false, false)).toBeLessThan(0.55);
    expect(rate(true, true)).toBeLessThan(0.55);
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

describe('渡劫', () => {
  function ready(config: DeepPartial<GameConfig> = {}) {
    const w = world({ ...calm, ...config });
    const a = addHouse(w, { id: 'A', realm: 1, stones: 1000 });
    a.cultivationProgress = 1e6;
    return { w, a };
  }

  it('修为进度没攒满不能发起', () => {
    const w = world(calm);
    addHouse(w, { id: 'A' });
    expect(attemptTribulation(w, 'A').ok).toBe(false);
  });

  it('打坐会攒修为进度', () => {
    const w = world({ ...calm, tribulation: { progressPerHour: 2 } });
    addHouse(w, { id: 'A' });
    hours(w, 10);
    collectMeditation(w, 'A');
    expect(getHouse(w, 'A').cultivationProgress).toBe(20);
  });

  it('成功：境界 +1，扣掉这一级的进度，掉诡心', () => {
    const { w, a } = ready({ tribulation: { bossBaseStrength: 0, bossStrengthPerRealm: 0, heartsReward: 2 } });
    const r = attemptTribulation(w, 'A');
    expect(r.ok && r.value.success).toBe(true);
    expect(a.realm).toBe(2);
    expect(a.ghostHearts).toBe(2);
    expect(a.cultivationProgress).toBe(1e6 - w.config.tribulation.progressBase);
  });

  it('失败：境界不掉，按门被砸破处理，进入劫后余生，冷却期间不能再试', () => {
    const { w, a } = ready({ tribulation: { bossBaseStrength: 1e9, cooldownDays: 3 } });
    const r = attemptTribulation(w, 'A');
    expect(r.ok && r.value.success).toBe(false);
    expect(a.realm).toBe(1);
    expect(a.cultivationProgress).toBe(1e6);
    expect(a.graceActionsLeft).toBe(w.config.breach.graceActions);
    expect(w.events.some((e) => e.type === 'breach')).toBe(true);
    expect(attemptTribulation(w, 'A').ok).toBe(false);
    hours(w, 3 * DAY);
    expect(canAttemptTribulation(w, 'A').ok).toBe(true);
  });

  it('破境丹用诡心炼，渡劫时会吃掉一颗', () => {
    const { w, a } = ready();
    a.ghostHearts = 3;
    expect(brewBreakthroughPill(w, 'A').ok).toBe(true);
    expect(a.breakthroughPills).toBe(1);
    attemptTribulation(w, 'A');
    expect(a.breakthroughPills).toBe(0);
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
