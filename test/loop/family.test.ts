import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { CFG } from '../../src/core/loop/base';
import {
  FAMILY, accompany, birth, canBirth, dawnLove, discipleGrade, gradeFor, match, takeDisciple, threadName,
  type FamilyState,
} from '../../src/core/loop/family';
import { HAUNT, hauntBash, hauntDodge, hauntOutcome, hauntStep, startHaunt } from '../../src/core/loop/haunt';
import { REBIRTH, carryFriends, karmaRows, karmaTotal, newFamily, strangerTiers, tierOf, type LifeRecord } from '../../src/core/loop/rebirth';

const NEIGHBORS = ['wang', 'li', 'zhao'];
const fam = (o: Partial<FamilyState & { chest: number; purse: number }> = {}) =>
  ({ day: 3, time: CFG.dayStart, love: 0, spouse: null, kids: [], bornToday: null, held: 0, chest: 0, purse: 0, ...o });

describe('红线和孩子', () => {
  it('红线四级；孩子品级跟着红线走，强弱最多差三成', () => {
    expect([0, 19, 20, 44, 45, 69, 70, 100].map(threadName)).toEqual(['相识', '相识', '知己', '知己', '倾心', '倾心', '挚爱', '挚爱']);
    const powers = Object.values(FAMILY.grades).map(([, p]) => p);
    expect(Math.max(...powers) / Math.min(...powers)).toBeLessThanOrEqual(1.3);
    expect(gradeFor(50)).toEqual(['上等', 1.1]);
  });

  it('牵红线从 10 起；已有伴侣不能再牵；陪伴花 1 个时辰、红线 +12，天快黑不能陪；早上 +8，最多 100', () => {
    const s = fam();
    expect(match(s, { name: '甲' })).toBe(true);
    expect(match(s, { name: '乙' })).toBe(false);
    expect(s.love).toBe(10);
    expect(accompany(s)).toBe(true);
    expect([s.time, s.love]).toEqual([CFG.dayStart + 120, 22]);
    s.time = CFG.dusk - 100;
    expect(accompany(s)).toBe(false);
    s.love = 95; dawnLove(s);
    expect(s.love).toBe(100);
  });

  it('红线到知己、第 3 天起才生；一天最多一个，最多两个孩子，徒弟不算', () => {
    const rng = new Rng(7);
    const s = fam({ spouse: { name: '甲' }, love: 19, day: 3, kids: [{ kind: '徒', grade: '寻常', power: 1 }] });
    expect(birth(s, rng)).toBeNull();
    s.love = 50;
    expect(birth(s, rng)).toMatchObject({ grade: '上等', power: 1.1 });
    expect(birth(s, rng)).toBeNull();
    s.day = 4;
    expect(birth(s, rng)).not.toBeNull();
    s.day = 5;
    expect(canBirth(s)).toBe(false);
    expect(s.kids.filter(k => k.kind !== '徒')).toHaveLength(2);
    expect(fam({ spouse: {}, love: 50, day: 2 }).day < FAMILY.birth.fromDay).toBe(true);
  });

  it('同一个种子生出来的一样', () => {
    const a = fam({ spouse: {}, love: 80 }), b = fam({ spouse: {}, love: 80 });
    expect(birth(a, new Rng(3))).toEqual(birth(b, new Rng(3)));
  });

  it('收徒：先用钱箱再用钱袋，钱不够不行，最多两个；品级看守住几夜', () => {
    expect([discipleGrade(0), discipleGrade(1), discipleGrade(3)]).toEqual([['寻常', 1], ['良才', 1.05], ['上等', 1.1]]);
    const s = fam({ chest: 20, purse: 50, held: 2 });
    expect(takeDisciple(s)).toMatchObject({ kin: { kind: '徒', grade: '良才' }, payment: { chest: 20, purse: 10 } });
    expect(takeDisciple(s)).not.toBeNull();
    expect(takeDisciple(s)).toBeNull();
    expect([s.chest, s.purse]).toEqual([0, 10]);
    expect(takeDisciple(fam({ chest: 10, purse: 10 }))).toBeNull();
  });
});

describe('因果分和投胎', () => {
  const life = (o: Partial<LifeRecord> = {}): LifeRecord =>
    ({ held: 3, autoHeld: 1, broken: 1, earned: 120, friends: { wang: 45, li: 20, zhao: 5 }, kids: [], spouse: null, love: 0, ...o });

  it('各项照规则算：家业、交情、养育（封顶 40）、红线、护家神、厉鬼、早逝', () => {
    const rows = karmaRows(life({ kids: Array(5).fill({ kind: '子', grade: '寻常', power: 1 }), spouse: {}, love: 72,
      afterlife: { kind: 'guard', won: true }, deathKind: 'early' }), NEIGHBORS);
    const by = Object.fromEntries(rows.map(r => [r[0], r[2]]));
    expect(by).toEqual({ 家业: 20, 交情: 7, 养育: 40, 红线: 25, 当护家神: 20, 英年早逝: -5 });
    expect(karmaTotal(rows)).toBe(107);
    const caught = karmaRows(life({ afterlife: { kind: 'haunt', caught: true } }), NEIGHBORS);
    expect(caught.at(-1)).toEqual(['当厉鬼', '被收进葫芦', -10]);
    // 机关替护家神守的那一晚不算护家神分
    expect(karmaRows(life({ afterlife: { kind: 'guard', won: true, automatic: true } }), NEIGHBORS).some(r => r[0] === '当护家神')).toBe(false);
  });

  it('分档：<30 寻常，<70 殷实，其余名门', () => {
    expect([0, 29, 30, 69, 70, 120].map(tierOf)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(REBIRTH.tierNames[2]).toBe('名门望族');
  });

  it('各档人家的家底在范围里；同一个种子随出来的一样', () => {
    for (const tier of [0, 1, 2] as const) {
      const R = REBIRTH.families[tier];
      for (let seed = 1; seed < 60; seed++) {
        const f = newFamily(tier, new Rng(seed));
        expect(f.door).toBeGreaterThanOrEqual(R.door[0]); expect(f.door).toBeLessThanOrEqual(R.door[1]);
        expect(f.money).toBeGreaterThanOrEqual(R.money[0]); expect(f.money).toBeLessThanOrEqual(R.money[1]);
        expect(f.treasures.length).toBeLessThanOrEqual(R.treasures[1]);
        expect(REBIRTH.threads[tier]).toContain(f.thread);
      }
    }
    expect(newFamily(2, new Rng(9))).toEqual(newFamily(2, new Rng(9)));
  });

  it('候选人家：有后人时两户（本档和低一档），没有后人三户', () => {
    expect(strangerTiers(2, 1)).toEqual([2, 1]);
    expect(strangerTiers(0, 0)).toEqual([0, 0, 0]);
    expect(strangerTiers(1, 0)).toEqual([1, 1, 0]);
  });

  it('交情到驰援的下一世留一半，其余重新认识（0–15）', () => {
    const f = carryFriends({ wang: 45, li: 39, zhao: 100 }, NEIGHBORS, new Rng(4));
    expect(f.wang).toBe(22); expect(f.zhao).toBe(50);
    expect(f.li).toBeGreaterThanOrEqual(0); expect(f.li).toBeLessThanOrEqual(15);
  });
});

describe('当厉鬼', () => {
  it('门血按门档；砸一下 8；躲着砸不了；砸开就赢，带走一件宝物', () => {
    const h = startHaunt(1, 1);
    expect([h.door, h.max, h.souls]).toEqual([300, 300, 3]);
    hauntDodge(h);
    expect(hauntBash(h)).toBe(false);
    h.dodge = 0;
    for (let i = 0; i < 37; i++) hauntBash(h);
    expect(h.over).toBe(false);
    hauntBash(h);
    expect([h.over, h.result]).toEqual([true, 'win']);
    const out = hauntOutcome(h);
    expect(out).toMatchObject({ kind: 'haunt', won: true });
    expect(out.loot?.v).toBeGreaterThan(0);
  });

  it('亮红光时按躲就一定躲得开（躲闪比红光长）；不躲就少一团魂火，三团没了被捉', () => {
    expect(HAUNT.dodge).toBeGreaterThan(HAUNT.charge);
    const dodger = startHaunt(5, 3), sitter = startHaunt(5, 3);
    let hitsWhileDodging = 0;
    for (let i = 0; i < 600 && !dodger.over; i++) {
      if (dodger.bows.some(b => b.s === 'charge') && dodger.dodge <= 0) hauntDodge(dodger);
      for (const e of hauntStep(dodger, 0.05)) if (e.kind === 'shot' && e.hit) hitsWhileDodging++;
    }
    expect(hitsWhileDodging).toBe(0);
    expect(dodger.result).toBe('timeout');
    for (let i = 0; i < 600 && !sitter.over; i++) hauntStep(sitter, 0.05);
    expect(sitter.result).toBe('caught');
    expect(hauntOutcome(sitter)).toEqual({ kind: 'haunt', caught: true });
  });

  it('同一个种子、同样的操作，结果一样', () => {
    const run = () => {
      const h = startHaunt(42);
      const log: string[] = [];
      for (let i = 0; i < 600 && !h.over; i++) {
        if (i % 3 === 0) hauntBash(h);
        if (h.bows.some(b => b.s === 'charge') && h.dodge <= 0) hauntDodge(h);
        log.push(...hauntStep(h, 0.05).map(e => e.kind));
      }
      return { h, log };
    };
    expect(run()).toEqual(run());
  });

  it('难度：门档 1 每秒 4 下大多能砸开，门档 3 很难（看到红光 0.3 秒后才躲）', () => {
    const play = (tier: number, rate: number, seed: number) => {
      const h = startHaunt(seed, tier);
      let tap = 0, react = -1;
      for (let i = 0; i < 2000 && !h.over; i++) {
        const charging = h.bows.some(b => b.s === 'charge');
        if (charging && react < 0) react = 0.3;
        if (!charging) react = -1;
        if (react >= 0) { react -= 0.05; if (react < 0 && h.dodge <= 0) { hauntDodge(h); react = 99; } }
        hauntStep(h, 0.05);
        tap += 0.05;
        while (tap >= 1 / rate && !h.over) { tap -= 1 / rate; hauntBash(h); }
      }
      return h.result;
    };
    const wins = (tier: number) => Array.from({ length: 40 }, (_, s) => play(tier, 4, s + 1)).filter(r => r === 'win').length;
    expect(wins(1)).toBeGreaterThanOrEqual(30);
    expect(wins(3)).toBeLessThan(wins(1));
  });
});
