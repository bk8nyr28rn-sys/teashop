import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { CFG, RULE_VERSION } from '../../src/core/loop/base';
import { FIELD_CONFIG, RINGS, SPOTS, TREASURES } from '../../src/core/loop/field-config';
import {
  bagCap, escapeChance, escapeDusk, fieldAction, fieldWeights, fight, fightChance, flee,
  gather, goHome, goOut, makeField, markSpot, routeTo, siteClue, walkMin, walkTo, type FieldState,
} from '../../src/core/loop/field';
import type { Loot } from '../../src/core/loop/state';

const reload = (s: FieldState): FieldState => JSON.parse(JSON.stringify(s));
const cargo: Loot[] = [{ n: '柴' }, { n: '古玉', v: 90, tre: true }, { n: '柴' }];

function atSite(id: number, buddy: string | null = null, day = 1, seed = 10) {
  const s = makeField(seed);
  s.person.day = day;
  expect(goOut(s, buddy)).toBe(true);
  expect(walkTo(s, id)).toBe(true);
  return s;
}

function inDanger(id: number, buddy: string | null = null, day = 1) {
  const s = atSite(id, buddy, day);
  s.today!.clues[id] = 1;
  s.rngState = 1;
  gather(s);
  expect(s.phase).toBe('danger');
  return s;
}

function nextDay(s: FieldState, days = 1) {
  expect(s.phase).toBe('home');
  s.person.day += days;
  s.person.time = CFG.dayStart;
}

describe('野外地图、时辰和线索', () => {
  it('只有首次出门抽当日线索；看路线和预览行动不耗时、不耗随机数', () => {
    const s = makeField(15);
    expect(s.ruleVersion).toBe(RULE_VERSION);
    expect(s.today).toBeNull();
    expect(goOut(s, 'nobody')).toBe(false);
    s.person.friends.li = 19;
    expect(goOut(s, 'li')).toBe(false);
    expect(s.rngState).toBe(15);
    s.person.friends.li++;
    expect(goOut(s, 'li')).toBe(true);
    expect(bagCap(s)).toBe(9);
    expect(s.today!.clues).toHaveLength(8);
    const initial = reload(s);
    for (const { id } of SPOTS) {
      expect(routeTo(s, id).clue).toEqual(siteClue(s, id));
      fieldAction(s, id, true);
    }
    expect(s).toEqual(initial);
    expect(goHome(s)).toBe(true);
    expect(s.person.friends.li).toBe(20);
    expect(goOut(s)).toBe(true);
    expect(bagCap(s)).toBe(6);
    expect(s.rngState).toBe(initial.rngState);
    expect(s.today).toEqual(initial.today);
    expect(s.person.time).toBe(CFG.dayStart);
  });

  it('三圈八处按实际路程计时，独行省两成，老年路程多两成', () => {
    expect(SPOTS.map(s => [s.name, RINGS[s.ring].name])).toEqual([
      ['河边', '近郊'], ['竹林', '近郊'], ['菜地', '近郊'], ['松林', '山林'],
      ['猎场', '山林'], ['矿洞', '山林'], ['古墓', '禁地'], ['乱葬岗', '禁地'],
    ]);
    const s = atSite(0);
    expect(s.person.time).toBe(360 + 51);
    const route = routeTo(s, 1);
    expect(route.minutes).toBe(Math.round(64 * Math.sqrt(3) * .8));
    expect(route.back).toBe(51);
    expect(route.late).toBe(false);
    expect(walkTo(s, 1)).toBe(true);
    expect(s.person.time).toBe(route.arrive);
    expect(walkTo(s, 1)).toBe(false);
    s.person.time = CFG.dusk - 80;
    expect(routeTo(s, 6).late).toBe(true);
    expect(atSite(6, 'wang', 4).person.time).toBe(360 + Math.round(158 * 1.2));
    expect(atSite(6, null, 5).person.time).toBe(360 + Math.round(158 * 1.2 * .8));
  });

  it('逐一核实十六条线索的行动、权重和实际采样，含矿洞线索新增的兽皮', () => {
    for (const sp of SPOTS) {
      expect(sp.clues).toHaveLength(2);
      expect(sp.clues[0]!.action).not.toBe(sp.clues[1]!.action);
      for (const [c, clue] of sp.clues.entries()) {
        const s = atSite(sp.id, 'wang');
        s.today!.clues[sp.id] = c;
        const weights: Record<string, number> = {};
        for (const [n, w] of Object.entries(sp.loot)) weights[n] = w * .7;
        weights[clue.focus] = (weights[clue.focus] ?? 0) + 30;
        expect(fieldWeights(s, sp.id)).toEqual(weights);
        expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
        expect(fieldAction(s, sp.id, true).name).toBe(clue.action);
        expect(fieldAction(s, sp.id).name).toBe(sp.safe);
        expect(fieldAction(s, sp.id, true).risk).toBeCloseTo((sp.risk[1] + clue.extraRisk) * .6);
        expect(fieldAction(s, sp.id).risk).toBeCloseTo((sp.risk[0] + clue.extraRisk * .25) * .6);
        const found = new Set<string>();
        for (let seed = 1; seed <= 64; seed++) {
          const trial = reload(s);
          trial.rngState = seed;
          let roll = new Rng(seed).next() * 100;
          const expected = Object.keys(weights).find(n => {
            if (roll < weights[n]!) return true;
            roll -= weights[n]!;
            return false;
          });
          const first = gather(trial)!.kept[0]!;
          const name = first.tre ? '宝物' : first.n;
          expect(name).toBe(expected);
          found.add(name);
          if (first.tre) expect(TREASURES).toContainEqual({ n: first.n, v: first.v });
        }
        expect([...found].sort()).toEqual(Object.keys(weights).sort());
      }
    }
  });

  it('猎场和古墓可独自潜入，深入比结伴少花十分；其他地点、普通采集照常', () => {
    for (const sp of SPOTS) {
      const solo = atSite(sp.id), buddy = atSite(sp.id, 'wang');
      const a = fieldAction(solo, sp.id, true), b = fieldAction(buddy, sp.id, true);
      expect(a.minutes).toBe(b.minutes - ([4, 6].includes(sp.id) ? 10 : 0));
      expect(fieldAction(solo, sp.id).minutes).toBe(fieldAction(buddy, sp.id).minutes);
      expect(b.risk).toBeCloseTo(a.risk * .6);
      if (sp.solo) expect(a.name).toContain(sp.solo);
    }
  });
});

describe('采集、标记、分货和归家', () => {
  it('菜地每次少些，每地一天最多三次，满包或采尽时不消耗时间和随机数', () => {
    const s = atSite(2);
    const time = s.person.time;
    const ranges = [[2, 2], [1, 1], [0, 1]];
    for (const [lo, hi] of ranges) {
      expect(fieldAction(s, 2)).toMatchObject({ lo, hi });
      s.rngState = 10;
      expect(gather(s)).not.toBeNull();
    }
    expect(s.person.time).toBe(time + 75);
    expect(s.person.bag.length).toBe(3);
    const exhausted = reload(s);
    expect(gather(s, true)).toBeNull();
    expect(s).toEqual(exhausted);
    expect(walkTo(s, 1)).toBe(true);
    s.person.bag = Array.from({ length: 6 }, () => ({ n: '柴' }));
    const full = reload(s);
    expect(gather(s)).toBeNull();
    expect(s).toEqual(full);
    goHome(s);
    nextDay(s);
    goOut(s);
    expect(s.today!.visits).toEqual({});
    expect(fieldAction(s, 2)).toMatchObject({ lo: 2, hi: 2 });
  });

  it('隔日结伴首采翻倍且只兑现一次，独行保留记号，失约或最后一天不会再留记号', () => {
    const s = atSite(2);
    let time = s.person.time;
    expect(markSpot(s)).toBe(true);
    expect(s.person.time).toBe(time + 10);
    expect(markSpot(s)).toBe(false);
    expect(s.person.bag).toEqual([]);
    goHome(s);
    nextDay(s);
    goOut(s);
    walkTo(s, 2);
    expect(fieldAction(s, 2).double).toBe(false);
    s.rngState = 10;
    gather(s);
    expect(s.today!.bonus[2]).toBe(true);
    goHome(s);
    goOut(s, 'wang');
    walkTo(s, 2);
    expect(fieldAction(s, 2)).toMatchObject({ double: true, lo: 2, hi: 2 });
    s.rngState = 10;
    expect(gather(s)!.kept).toHaveLength(2);
    expect(s.today!.bonus[2]).toBeUndefined();
    expect(markSpot(s)).toBe(true);
    goHome(s);
    nextDay(s, 2);
    goOut(s, 'wang');
    expect(s.today!.bonus).toEqual({});
    goHome(s);
    nextDay(s);
    goOut(s);
    walkTo(s, 2);
    time = s.person.time;
    expect(markSpot(s)).toBe(false);
    expect(s.person.time).toBe(time);
  });

  it('有零头时先抽取件数再翻倍，背包满时只允许已经轮到的伙伴份额', () => {
    const s = atSite(0, 'wang');
    s.today!.visits[0] = 1;
    s.today!.bonus[0] = true;
    s.person.bag = Array.from({ length: 8 }, () => ({ n: '柴' }));
    s.shareRemainder.wang = 1;
    const empty = reload(s);
    empty.rngState = 2; // 首个数大于 0.5，此次无收获，记号仍然用掉。
    expect(gather(empty)).toEqual({ kept: [], shared: [] });
    expect(empty.today!.bonus[0]).toBeUndefined();
    s.rngState = 9;
    const got = gather(s)!;
    expect(got.kept).toHaveLength(1);
    expect(got.shared).toHaveLength(1);
    expect(s.person.bag).toHaveLength(9);
    expect(s.shareRemainder.wang).toBe(0);
  });

  it('分成按各伙伴累计，带回的货宝分开入库，自己和家里的钱都不变', () => {
    const s = atSite(2, 'wang');
    s.person.purse = 12;
    s.house.chest = 37;
    s.rngState = 10;
    expect(gather(s)!.kept).toHaveLength(2);
    expect(s.shareRemainder.wang).toBe(2);
    goHome(s);
    expect(s.person.friends.wang).toBe(31);
    s.person.friends.li = 98;
    goOut(s, 'li');
    walkTo(s, 1);
    s.rngState = 10;
    expect(gather(s)!.shared).toEqual([]);
    goHome(s);
    expect(s.person.friends.li).toBe(100);
    expect(s.shareRemainder).toEqual({ wang: 2, li: 1 });
    const resumed = reload(s);
    goOut(resumed, 'wang');
    walkTo(resumed, 7);
    resumed.today!.clues[7] = 0;
    resumed.rngState = 13;
    expect(gather(resumed)).toEqual({ kept: [], shared: [{ n: '青铜剑', tre: true, v: 110 }] });
    expect(resumed.phase).toBe('danger');
    resumed.rngState = 7;
    expect(fight(resumed)).toMatchObject({ outcome: 'won', kept: [{ n: '夜行衣', tre: true, v: 80 }] });
    goHome(resumed);
    expect(resumed.person.bag).toEqual([]);
    expect(resumed.house.treasures).toEqual([{ n: '夜行衣', v: 80 }]);
    expect(Object.values(resumed.house.store).reduce((a, b) => a + b, 0)).toBe(3);
    expect([resumed.person.purse, resumed.house.chest]).toEqual([12, 37]);
  });
});

describe('遇险、倒下和遇暮', () => {
  it('必须先解决当前遇险；打赢当场分战利，输了扣一点体力，概率受年龄和伤势影响', () => {
    const s = inDanger(3, 'wang', 2);
    expect(fightChance(s)).toBeCloseTo(.8);
    const time = s.person.time, blocked = reload(s);
    expect(gather(s)).toBeNull();
    expect(markSpot(s)).toBe(false);
    expect(walkTo(s, 1)).toBe(false);
    expect(goHome(s)).toBe(false);
    expect(s).toEqual(blocked);
    s.shareRemainder.wang = 2;
    s.rngState = 7;
    expect(fight(s)).toMatchObject({ outcome: 'won', kept: [], shared: [{ n: expect.any(String) }] });
    expect(s.phase).toBe('map');
    expect(s.encounter).toBeNull();
    expect(s.person.time).toBe(time);
    expect(fight(s)).toBeNull();
    const hurt = inDanger(3);
    expect(fightChance(hurt)).toBeCloseTo(.5);
    hurt.person.hp--;
    expect(fightChance(hurt)).toBeCloseTo(.4);
    hurt.person.day = 5;
    expect(fightChance(hurt)).toBeCloseTo(.45);
    hurt.rngState = 4;
    expect(fight(hurt)).toEqual({ outcome: 'hurt' });
    expect(hurt.person.hp).toBe(1);
    expect(fightChance(inDanger(0, 'wang', 2))).toBe(.95);
  });

  it('跑一定脱战，花三十分，有五成机会掉一件随机物品；过暮直接遇鬼', () => {
    const s = inDanger(3);
    s.person.bag = [...cargo];
    const normal = reload(s);
    normal.rngState = 4;
    expect(flee(normal)).toEqual({ lost: [] });
    expect(normal.person.time).toBe(s.person.time + 30);
    s.person.time = CFG.dusk - 10;
    s.rngState = 8;
    expect(flee(s)).toEqual({ lost: [cargo[1]] });
    expect(s.person.bag).toEqual([cargo[0], cargo[2]]);
    expect(s.ground[3]).toEqual([cargo[1]]);
    expect(s.encounter).toBeNull();
    expect(s.phase).toBe('dusk');
    expect(s.duskReason).toBe('flee');
    expect(s.person.time).toBe(CFG.dusk + 20);
    expect(flee(s)).toBeNull();
  });

  it.each([0, 3, 6])('结伴在地点 %i 倒下：损失前半向上取整，剩余入库，人由伙伴扛回', id => {
    const s = inDanger(id, 'wang');
    s.person.bag = [...cargo];
    s.person.hp = 1;
    const time = s.person.time, back = walkMin(s, id, 'home');
    s.rngState = 4;
    expect(fight(s)).toEqual({ outcome: 'knocked', lost: cargo.slice(0, 2) });
    expect(s.person.hp).toBe(1);
    expect(s.person.time).toBe(time + back);
    expect(s.ground[id]).toEqual(cargo.slice(0, 2));
    expect(s.house.store).toEqual({ 柴: 1 });
    expect(s.house.treasures).toEqual([]);
    expect(s.phase).toBe('home');
    expect(s.person.friends.wang).toBe(31);
  });

  it.each([0, 3, 6])('独行在地点 %i 倒下生还：物品留在现场，爬回耗时一倍六，次日仍可查到掉落', id => {
    const s = inDanger(id);
    s.person.bag = [...cargo];
    s.person.hp = 1;
    s.ground[id] = [{ n: '草药' }];
    const time = s.person.time, back = walkMin(s, id, 'home');
    // 第一个数 0.924 使战败；前两圈不掷死亡，禁地用第二个随机数。
    s.rngState = id === 6 ? 10 : 4;
    expect(fight(s)).toEqual({ outcome: 'knocked', lost: cargo });
    expect(s.person.time).toBe(time + Math.round(back * 1.6));
    expect(s.person.hp).toBe(1);
    expect(s.person.bag).toEqual([]);
    expect(s.house.store).toEqual({});
    const recovered = reload(s);
    nextDay(recovered);
    goOut(recovered);
    expect(recovered.ground[id]).toEqual([{ n: '草药' }, ...cargo]);
  });

  it('独自在禁地倒下可丢命；死亡前记下原地掉落；结束后不能继续行动', () => {
    const s = inDanger(6);
    s.person.bag = [...cargo];
    s.person.hp = 1;
    s.rngState = 4;
    expect(fight(s)).toEqual({ outcome: 'dead', lost: cargo });
    expect(s).toMatchObject({ phase: 'dead', at: 6, ground: { 6: cargo }, person: { hp: 0, bag: [] } });
    const end = reload(s);
    expect(goOut(s)).toBe(false);
    expect(goHome(s)).toBe(false);
    expect(escapeDusk(s, 'drop')).toBeNull();
    expect(s).toEqual(end);
  });

  it('恰在酉时外出到站要遇鬼，恰在 18:00 到家可进门，迟一分仍在返程起点圈', () => {
    const s = makeField(1);
    goOut(s);
    s.person.time = CFG.dusk - walkMin(s, 'home', 6);
    walkTo(s, 6);
    expect(s).toMatchObject({ at: 6, phase: 'dusk', duskReason: 'walk' });
    expect(escapeChance(s)).toBe(.2);
    const back = atSite(3);
    back.person.time = CFG.dusk - walkMin(back, 3, 'home');
    const late = reload(back);
    goHome(back);
    expect(back.phase).toBe('home');
    expect(back.person.time).toBe(CFG.dusk);
    expect(goOut(back)).toBe(false);
    late.person.time++;
    goHome(late);
    expect(late).toMatchObject({ at: 3, phase: 'dusk', duskReason: 'return' });
    expect(late.person.time).toBe(CFG.dusk);
  });

  it('标记或采集跨过黄昏照记耗时和所得，不再触发白天野兽', () => {
    const s = atSite(1);
    s.person.time = CFG.dusk - 5;
    const marked = reload(s);
    markSpot(marked);
    expect(marked).toMatchObject({ phase: 'dusk', duskReason: 'mark', person: { time: CFG.dusk + 5 } });
    s.rngState = 1;
    expect(gather(s)!.kept).toHaveLength(1);
    expect(s).toMatchObject({ phase: 'dusk', duskReason: 'gather', encounter: null, person: { time: CFG.dusk + 15 } });
    expect(markSpot(s)).toBe(false);
  });

  it('天黑扔包一定能跑，背包跑可全保住；失败扣两点，尚有体力就带着余物进门', () => {
    const s = atSite(0, 'wang');
    s.person.bag = [...cargo];
    s.person.time = CFG.dusk - 1;
    goHome(s);
    expect(escapeChance(s)).toBe(.95);
    const carry = reload(s);
    carry.rngState = 7;
    expect(escapeDusk(carry, 'carry')).toEqual({ outcome: 'escaped', lost: [] });
    expect(carry.house.store).toEqual({ 柴: 2 });
    expect(carry.house.treasures).toEqual([{ n: '古玉', v: 90 }]);
    expect(carry.person.hp).toBe(3);
    const seed = s.rngState;
    expect(escapeDusk(s, 'drop')).toEqual({ outcome: 'escaped', lost: cargo });
    expect(s.ground[0]).toEqual(cargo);
    expect(s.rngState).toBe(seed);
    expect(s.person.hp).toBe(3);
    expect(s.house.store).toEqual({});
    for (const buddy of [null, 'wang']) {
      const caught = atSite(6, buddy);
      caught.person.bag = [...cargo];
      caught.person.time = CFG.dusk - 1;
      goHome(caught);
      expect(escapeChance(caught)).toBeCloseTo(buddy ? .45 : .2);
      caught.rngState = 4;
      const lost = buddy ? cargo.slice(0, 2) : cargo;
      expect(escapeDusk(caught, 'carry')).toEqual({ outcome: 'caught', lost });
      expect(caught.person.hp).toBe(1);
      expect(caught.ground[6]).toEqual(lost);
      expect(caught.phase).toBe('home');
      expect(escapeDusk(caught, 'carry')).toBeNull();
    }
  });

  it('带伤在暮色中被追倒，同样只对禁地独行者掷死亡', () => {
    for (const buddy of [null, 'wang']) {
      const s = atSite(6, buddy);
      s.person.hp = 2;
      s.person.bag = [...cargo];
      s.person.time = CFG.dusk - 1;
      goHome(s);
      s.rngState = 4;
      expect(escapeDusk(s, 'carry')!.outcome).toBe(buddy ? 'knocked' : 'dead');
      expect(s.ground[6]).toEqual(buddy ? cargo.slice(0, 2) : cargo);
    }
  });

  it('同种子从出门到归家完整重放；遇险中断续跑及额外预览完全一致', () => {
    const run = (resume: boolean, inspect: boolean) => {
      let s = atSite(7, 'wang', 1, 22);
      const gathered = gather(s, true);
      expect(s.phase).toBe('danger');
      if (resume) s = reload(s);
      if (inspect) for (const sp of FIELD_CONFIG.SPOTS) { routeTo(s, sp.id); fieldWeights(s, sp.id); }
      const event = fight(s);
      expect(markSpot(s)).toBe(true);
      expect(goHome(s)).toBe(true);
      return { s, gathered, event };
    };
    expect(run(false, false)).toEqual(run(false, false));
    expect(run(true, true)).toEqual(run(false, false));
  });
});
