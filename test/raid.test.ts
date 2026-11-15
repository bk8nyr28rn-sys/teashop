import { describe, expect, it } from 'vitest';
import {
  addHouse, addStrands, advanceHour, createWorld, finishRaid, guardLineup, raidRepair, raidReinforce, raidRewardsLeft,
  raidStep, raidTap, raidUpgrade, startRaid, tieThread, type DeepPartial, type GameConfig, type World,
} from '../src/core';

const quiet: DeepPartial<GameConfig> = {
  ghosts: { wildPerHour: 0, spiritPerHourPerGrudge: 0 },
  quarrel: { baseChancePerDay: 0 },
  rival: { chancePerDay: 0 },
};
const world = (config: DeepPartial<GameConfig> = {}, seed = 3): World => createWorld({ seed, config: { ...quiet, ...config } });

function raidOf(w: World, id = 'A') {
  const r = startRaid(w, id);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

describe('保底：开局收养的孩子', () => {
  it('每家开局收养两个孩子：一个剑修、一个丹修，资质固定', () => {
    const w = world();
    const a = addHouse(w, { id: 'A' });
    expect(a.members.map((m) => [m.adopted, m.path, m.root])).toEqual([
      [true, '剑修', 8],
      [true, '丹修', 8],
    ]);
  });

  it('收养的孩子不占新手期“前两位结得快”的名额', () => {
    const w = world({ newbie: { memberRatios: [0.002, 0.15] } });
    addHouse(w, { id: 'A', traits: ['符修'] });
    addHouse(w, { id: 'B' });
    const t = tieThread(w, 'A', { kind: 'friend', house: 'B' });
    if (!t.ok) throw new Error(t.reason);
    addStrands(w, t.value, 20);
    for (let i = 0; i < 24; i++) advanceHour(w);
    const born = w.houses.get('A')!.members.filter((m) => !m.adopted);
    expect(born.length).toBeGreaterThanOrEqual(1);
  });

  it('红线结出的孩子：资质 = 出生时的浓度，道途继承父母一方', () => {
    const w = world({ newbie: { memberRatios: [0.002], adoptedKids: 0 } });
    addHouse(w, { id: 'A', traits: ['符修'] });
    addHouse(w, { id: 'B', traits: ['御兽'] });
    const t = tieThread(w, 'A', { kind: 'friend', house: 'B' });
    if (!t.ok) throw new Error(t.reason);
    addStrands(w, t.value, 37);
    while (w.houses.get('A')!.members.length === 0) advanceHour(w);
    const kid = w.houses.get('A')!.members[0]!;
    expect(kid.root).toBeGreaterThan(30);
    expect(['符修', '御兽']).toContain(kid.path);
  });
});

describe('守夜局', () => {
  it('阵容：当家人 + 最多 6 个没受伤的孩子，强的在前', () => {
    const w = world({ newbie: { adoptedKids: 0 } });
    const a = addHouse(w, { id: 'A' });
    for (let i = 0; i < 8; i++) a.members.push({ id: `k${i}`, parents: ['A', 'B'], threadId: '', cultivation: i, injuredUntil: i === 7 ? 999 : 0, root: 10, path: '剑修' });
    const { guards, hurt } = guardLineup(w, 'A');
    expect(guards.map((m) => m.id)).toEqual(['k6', 'k5', 'k4', 'k3', 'k2', 'k1']);
    expect(hurt.map((m) => m.id)).toEqual(['k7']);
    const s = raidOf(w);
    expect(s.guards[0]!.id).toBe('self');
    expect(s.guards).toHaveLength(7);
  });

  it('同一个种子、同样的操作，结果完全一样（确定性）', () => {
    const run = () => {
      const w = world({}, 11);
      addHouse(w, { id: 'A' });
      const s = raidOf(w);
      while (!s.result) {
        raidStep(w, s, 0.1);
        const g = s.ghosts[0];
        if (g) raidTap(w, s, g.id);
      }
      return [s.result, s.t.toFixed(2), s.kills, s.doorHp.toFixed(3)];
    };
    expect(run()).toEqual(run());
  });

  it('光看不动手的新手会输：门被砸破', () => {
    const w = world();
    addHouse(w, { id: 'A' });
    const s = raidOf(w);
    while (!s.result) raidStep(w, s, 0.5);
    expect(s.result).toBe('lose');
    expect(s.doorHp).toBe(0);
  });

  it('点鬼真的掉血，打散给灵气；点得太快会被限速', () => {
    const w = world();
    addHouse(w, { id: 'A' });
    const s = raidOf(w);
    while (s.ghosts.length === 0) raidStep(w, s, 0.05);
    const g = s.ghosts[0]!;
    const hp = g.hp;
    expect(raidTap(w, s, g.id)).toBe(true);
    expect(g.hp).toBeLessThan(hp);
    expect(raidTap(w, s, g.id)).toBe(false); // 同一刻再点：限速
    const qi = s.qi;
    while (s.ghosts.some((x) => x.id === g.id)) {
      raidStep(w, s, 0.1);
      raidTap(w, s, g.id);
    }
    expect(s.qi).toBeGreaterThan(qi);
  });

  it('升级花灵气、等级上去；修门有冷却；加固门越来越贵', () => {
    const w = world();
    addHouse(w, { id: 'A' });
    const s = raidOf(w);
    s.qi = 1000;
    expect(raidUpgrade(w, s, 'self').ok).toBe(true);
    expect(s.guards[0]!.level).toBe(2);
    for (let i = 0; i < 3; i++) raidUpgrade(w, s, 'self');
    expect(raidUpgrade(w, s, 'self').ok).toBe(false); // 满级 5
    s.doorHp = s.doorMax / 2;
    expect(raidRepair(w, s).ok).toBe(true);
    expect(raidRepair(w, s).ok).toBe(false); // 冷却中
    const max = s.doorMax;
    const c1 = s.reinforceCost;
    expect(raidReinforce(w, s).ok).toBe(true);
    expect(s.doorMax).toBeGreaterThan(max);
    expect(s.reinforceCost).toBeGreaterThan(c1);
  });

  it('每天前两局有奖励，之后是练手局；第二天重新算', () => {
    const w = world();
    const a = addHouse(w, { id: 'A' });
    const win = () => {
      const s = raidOf(w);
      s.result = 'win';
      s.spiritKills = 1;
      return finishRaid(w, s);
    };
    const stones = a.stones;
    const kidCult = a.members[0]!.cultivation;
    const r1 = win();
    expect(r1.rewarded).toBe(true);
    expect(a.stones).toBe(stones + r1.stones);
    expect(a.ghostHearts).toBe(1);
    expect(a.members[0]!.cultivation).toBeGreaterThan(kidCult);
    expect(win().rewarded).toBe(true);
    expect(raidRewardsLeft(w, 'A')).toBe(0);
    const r3 = win();
    expect(r3.rewarded).toBe(false);
    expect(r3.stones).toBe(0);
    for (let i = 0; i < 24; i++) advanceHour(w);
    expect(raidRewardsLeft(w, 'A')).toBe(2);
  });

  it('输了按撑过的波数给一点灵石，不受伤、不掉东西', () => {
    const w = world();
    const a = addHouse(w, { id: 'A' });
    const s = raidOf(w);
    while (!s.result) raidStep(w, s, 0.5);
    const stones = a.stones;
    const r = finishRaid(w, s);
    expect(r.win).toBe(false);
    expect(a.stones).toBe(stones + r.stones);
    expect(a.members.every((m) => m.injuredUntil <= w.hour)).toBe(true);
  });
});
