import { describe, expect, it } from 'vitest';
import {
  applyNightAction, ghostAt, ghostCenter, nearestGhost, nightStep, perkAvailable, revealed, startNight, tapMult, waveCounts,
} from '../../src/core/loop/night.js';
import type { NightGhost, NightState } from '../../src/core/loop/night.js';
import { DOORS, GHOSTS, MULT, PERKS, type GhostType, type PerkId } from '../../src/core/loop/night-config.js';
import { fight, inputs, newTrial, STEP_LIMIT, type Replay } from '../../scripts/loop-night-bot.js';

const setup = { day: 3, door: 1, bows: 0, trial: 2 };
const make = () => newTrial(setup);
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// 由真实出生的鬼构造边界场景。远处保留一个未到时间的真实出生记录，避免检查效果时切到选牌。
function encounter(n = make()) {
  while (!n.ghosts.length) nightStep(n);
  const base = n.ghosts[0]!;
  n.ghosts = [];
  n.spawns = [{ at: 999, wave: n.wave, type: 'evil' }];
  function add(type: GhostType, overrides: Partial<NightGhost> = {}) {
    const g: NightGhost = { ...base, type, id: 100 + n.ghosts.length, hp: 100, max: 100, x: 180,
      y: 345, k: 1, ox: 0, tx: 180, ty: 424, speed: 0, hit: GHOSTS[type].hit, state: 'walk', flash: 0, ...overrides };
    n.ghosts.push(g);
    return g;
  }
  return { n, add };
}

function choose(n: NightState, id: PerkId) {
  n.picking = true;
  n.offer = [id];
  applyNightAction(n, { type: 'perk', id });
}
function hit(n: NightState, g: NightGhost) { applyNightAction(n, { type: 'hit', id: g.id }); }

describe('五波、目标和动作', () => {
  it('五波按天和波数开放四种鬼，越往后越多', () => {
    expect(Array.from({ length: 5 }, (_, w) => waveCounts(1, w))).toEqual([
      { evil: 3, fly: 0, shade: 0, armor: 0 }, { evil: 4, fly: 1, shade: 0, armor: 0 },
      { evil: 5, fly: 1, shade: 0, armor: 0 }, { evil: 6, fly: 2, shade: 1, armor: 0 },
      { evil: 7, fly: 2, shade: 1, armor: 1 },
    ]);
    expect(waveCounts(5, 4)).toEqual({ evil: 8, fly: 3, shade: 3, armor: 2 });
    expect(waveCounts(3, 2).armor).toBe(1);
    expect(waveCounts(2, 0).shade).toBe(1);
  });

  it('第一波在 1.5 秒开始并均匀排队，移动速度和血量按鬼种及天数计算', () => {
    const n = newTrial({ ...setup, day: 5 });
    expect(n.spawns.map(s => s.at)).toEqual(n.spawns.map((_, i) => 1.5 + i * 3.5 / n.spawns.length));
    for (let i = 0; i < 29; i++) nightStep(n);
    expect(n.ghosts).toHaveLength(0);
    nightStep(n);
    const g = n.ghosts[0]!;
    expect(g.max).toBeCloseTo(GHOSTS[g.type].hp * 1.8);
    expect(g.speed).toBeGreaterThanOrEqual(GHOSTS[g.type].speed * 0.85);
    expect(g.speed).toBeLessThanOrEqual(GHOSTS[g.type].speed * 1.15);
    const y = g.y;
    nightStep(n);
    expect(g.y - y).toBeCloseTo(g.speed * 0.05);
    n.ghosts = [];
    n.spawns = [];
    nightStep(n);
    applyNightAction(n, { type: 'perk', id: n.offer[0]! });
    while (!n.ghosts.length) nightStep(n);
    expect(n.ghosts[0]!.max).toBeCloseTo(GHOSTS[n.ghosts[0]!.type].hp * 1.8 * 1.06);
  });

  it('点坐标按最近中心判定，空处不耗攻击随机；空格可只选可见的最近目标', () => {
    const { n, add } = encounter();
    const a = add('evil', { x: 120, y: 220 }), b = add('fly', { x: 180, y: 230, ox: 10 });
    const shade = add('shade', { x: 260, y: 400 });
    expect(ghostAt(n, 190, 186)).toBe(b);
    expect(ghostAt(n, 226, 186)).toBeNull();
    expect(nearestGhost(n)).toBe(b);
    expect(nearestGhost(n, false)).toBe(shade);
    const rng = n.rngState;
    applyNightAction(n, { type: 'hitAt', x: 0, y: 0 });
    expect(n.rngState).toBe(rng);
    applyNightAction(n, { type: 'hitAt', ...ghostCenter(a) });
    expect(a.hp).toBeLessThan(a.max);
    expect(b.hp).toBe(b.max);
  });

  it('剑、弓、灯对每种鬼的基础倍率，重手 / 剑气 / 穿云箭按样机叠加', () => {
    const { n, add } = encounter();
    const kinds: GhostType[] = ['evil', 'fly', 'shade', 'armor'];
    const gs = kinds.map(t => add(t));
    const expected = [[1.5, 0.3, 1, 0.5], [0.9, 2, 0.9, 0.5], [0.6, 0.6, 1.5, 0.4]];
    for (const [i, item] of (['sword', 'bow', 'lamp'] as const).entries()) {
      applyNightAction(n, { type: 'item', item });
      expect(gs.map(g => tapMult(n, g))).toEqual(expected[i]);
      expect(kinds.map(k => MULT[item][k])).toEqual(expected[i]);
    }
    n.pk = { heavy: 2, qi: 1, pierce: 2 };
    applyNightAction(n, { type: 'item', item: 'bow' });
    expect(tapMult(n, gs[3]!)).toBeCloseTo(0.9 * 2.2 * 1.8);
    applyNightAction(n, { type: 'item', item: 'sword' });
    expect(tapMult(n, gs[1]!)).toBeCloseTo(1.3 * 1.8);
  });

  it('门口/半路/手中灯有不同显形边界，听声半伤后短暂显形', () => {
    const { n, add } = encounter();
    const g = add('shade');
    hit(n, g);
    expect(g.hp).toBe(100);
    n.pk.ear = 1;
    hit(n, g);
    expect(g.hp).toBe(95);
    expect(revealed(n, g)).toBeTruthy();
    for (let i = 0; i < 6; i++) nightStep(n);
    expect(revealed(n, g)).toBeFalsy();
    for (const [item, trap, eye, lampstr, y] of [
      ['lamp', 0, 0, 0, 150], ['sword', 1, 0, 0, 330], ['sword', 0, 1, 0, 240], ['sword', 0, 0, 1, 330],
    ] as const) {
      n.item = item; n.traps.lamp = trap; n.pk = { eye, lampstr }; g.y = y;
      expect(revealed(n, g)).toBeFalsy();
      g.y++;
      expect(revealed(n, g)).toBeTruthy();
    }
  });
});

describe('本事、机关和帮手', () => {
  it('三张不同的合法本事，停住战斗直到选牌；非堆叠、门血、带路和机关分别过滤', () => {
    const n = make();
    n.spawns = [];
    nightStep(n);
    expect(n.picking).toBe(true);
    expect(new Set(n.offer).size).toBe(3);
    expect(n.offer.every(id => perkAvailable(n, id))).toBe(true);
    const time = n.t;
    nightStep(n);
    applyNightAction(n, { type: 'perk', id: 'fix' });
    expect(n.picking).toBe(true);
    expect(n.t).toBe(time);
    const pick = n.offer[0]!;
    applyNightAction(n, { type: 'perk', id: pick });
    expect(n.pk[pick]).toBe(1);
    expect(n.wave).toBe(1);
    const limited = newTrial(setup, false);
    for (const id of ['pierce', 'burn', 'lampstr', 'bowplus', 'bowfast'] as const) expect(perkAvailable(limited, id)).toBe(false);
    applyNightAction(limited, { type: 'item', item: 'lamp' });
    expect(limited.item).toBe('sword');
    const fresh = make();
    expect(perkAvailable(fresh, 'bowfast')).toBe(false);
    fresh.traps.lamp = 1;
    expect(perkAvailable(fresh, 'lampstr')).toBe(false);
    expect(perkAvailable(fresh, 'fix')).toBe(false);
    fresh.door = fresh.doorMax * 0.8;
    expect(perkAvailable(fresh, 'fix')).toBe(true);
    for (const id of Object.keys(PERKS) as PerkId[]) {
      const init = newTrial({ ...setup, bows: 1 });
      init.door /= 2; init.pk[id] = 1;
      expect(perkAvailable(init, id), id).toBe(PERKS[id].stack);
    }
  });

  it('修门立刻加四成且不超上限；没有弩时连弩借一台，连弩叠加不会再送', () => {
    const n = make();
    n.door = 10;
    choose(n, 'fix');
    expect(n.door).toBeCloseTo(10 + 0.4 * n.doorMax);
    n.door = 0.79 * n.doorMax;
    choose(n, 'fix');
    expect(n.door).toBe(n.doorMax);
    choose(n, 'bowplus'); choose(n, 'bowplus');
    expect(n.bows).toHaveLength(1);
    expect(n.pk.bowplus).toBe(2);
  });

  it('祖传双弩首日照射；射程 y>150 且要可见，铁甲照扣 12，弩机各选离自己最近的目标', () => {
    const { n, add } = encounter(newTrial({ ...setup, day: 1, bows: 2 }, false));
    expect(n.bows).toHaveLength(2);
    const a = add('armor', { x: 40, y: 345, tx: 40, state: 'bash' });
    const b = add('evil', { x: 320, y: 345, tx: 320, state: 'bash' });
    const hidden = add('shade', { x: 40, y: 410, state: 'bash' });
    const far = add('fly', { x: 320, y: 150, state: 'bash' });
    n.bows.forEach(bow => { bow.cd = 0; });
    nightStep(n);
    expect([a.hp, b.hp, hidden.hp, far.hp]).toEqual([88, 88, 100, 100]);
    expect(n.bows.map(bow => bow.cd)).toEqual([1.4, 1.4]);
  });

  it('连弩多射目标，快弩每层冷却折半，最低 0.35 秒；找不到目标 0.2 秒再看', () => {
    const { n, add } = encounter(newTrial({ ...setup, bows: 1 }));
    const bow = n.bows[0]!;
    bow.cd = 0;
    nightStep(n);
    expect(bow.cd).toBe(0.2);
    const gs = [add('armor'), add('evil'), add('fly')];
    n.pk = { bowplus: 2, bowfast: 1 };
    bow.cd = 0; nightStep(n);
    expect(gs.map(g => g.hp)).toEqual([88, 88, 88]);
    expect(bow.cd).toBe(0.7);
    n.pk.bowfast = 4;
    bow.cd = 0; nightStep(n);
    expect(bow.cd).toBe(0.35);
  });

  it('镇宅符、定身符和护家神仅在 y>300 叠乘；到门后每秒攻击、按天与门栓减伤', () => {
    const { house, person } = inputs(setup);
    house.traps.talisman = 2;
    const { n, add } = encounter(startNight(house, person, { seed: 20, guardian: true }));
    const g = add('armor', { y: 300, speed: 100 });
    n.pk = { slow: 2, bolt: 2 };
    nightStep(n);
    expect(g.y).toBe(305);
    nightStep(n);
    expect(g.y - 305).toBeCloseTo(5 * 0.72 ** 2 * 0.7 ** 2 * 0.65);
    g.y = g.ty - 0.01;
    nightStep(n);
    expect(g.state).toBe('bash');
    g.bashT = 0.05;
    nightStep(n);
    const remaining = n.doorMax - 11 * (1 + 0.12 * 4) * 0.7 ** 2;
    expect(n.door).toBeCloseTo(remaining);
    for (let i = 0; i < 19; i++) nightStep(n);
    expect(n.door).toBeCloseTo(remaining);
    nightStep(n);
    expect(n.door).toBeLessThan(remaining);
  });

  it('横扫给近处可见的旁鬼一半伤害；剑雨第五杀触发且可连锁，不给被动击杀的 2 文', () => {
    const { n, add } = encounter();
    n.pk = { sweep: 1 };
    const a = add('evil', { x: 100 }), near = add('fly', { x: 169 }), far = add('evil', { x: 170 }), hidden = add('shade', { x: 100 });
    hit(n, a);
    expect([a.hp, near.hp, far.hp, hidden.hp]).toEqual([84, 92, 100, 100]);
    n.pk = { rain: 1, soul: 2, coins: 2 };
    n.door = n.doorMax - 15; n.rainCount = 4; a.hp = 1; hidden.hp = 10;
    hit(n, a);
    expect(n.kills).toBe(2);
    expect(n.coins).toBe(14);
    expect(n.door).toBe(n.doorMax - 3);
    expect(near.hp).toBe(77);
    expect(n.rainCount).toBe(1);
  });

  it('灯光烧鬼每半秒按层数扣血，仅作用于光圈中的鬼，手里换成剑便不烧', () => {
    const { n, add } = encounter();
    n.item = 'lamp'; n.pk = { burn: 2 }; n.burnT = 0.46;
    const close = add('shade', { y: 300, x: 140, state: 'bash' });
    const outside = add('evil', { y: 200, x: 360, state: 'bash' });
    nightStep(n);
    expect([close.hp, outside.hp]).toEqual([95, 100]);
    expect(n.burnT).toBe(0);
    n.item = 'sword'; n.burnT = 0.49;
    nightStep(n);
    expect(close.hp).toBe(95);
  });

  it('会心按层每次增加 25%，封顶 75%，伤害三倍；满血/受伤/重伤、年龄与护家神改变点伤', () => {
    for (const [day, hp, guardian, expected] of [
      [1, 3, false, 12], [3, 3, false, 15], [3, 2, false, 13], [3, 1, false, 9],
      [5, 3, false, 13], [5, 1, true, 15],
    ] as const) {
      const { house, person } = inputs({ ...setup, day });
      person.hp = hp; person.power = guardian ? 0.6 : 1;
      const { n, add } = encounter(startNight(house, person, { seed: 90, guardian }));
      const g = add('evil');
      hit(n, g);
      expect(100 - g.hp).toBe(expected);
    }
    const { n, add } = encounter();
    const g = add('evil', { hp: 50000 });
    const count = (stack: number) => {
      n.pk.crit = stack; n.rngState = 50;
      let crits = 0;
      for (let i = 0; i < 300; i++) {
        const before = g.hp;
        hit(n, g);
        const dmg = before - g.hp;
        expect([16, 47]).toContain(dmg);
        if (dmg === 47) crits++;
      }
      return crits;
    };
    const once = count(1), twice = count(2), thrice = count(3);
    expect(once).toBeGreaterThan(40); expect(once).toBeLessThan(110);
    expect(twice).toBeGreaterThan(once); expect(thrice).toBeGreaterThan(twice);
    expect(count(4)).toBe(thrice);
  });

  it('配偶和头两个后人按各自间隔攻击最近可见目标；护家神那夜配偶缺席', () => {
    const { house, person } = inputs(setup);
    const options = { seed: 19, spouse: true, childPowers: [1, 1.3, 9] };
    const { n, add } = encounter(startNight(house, person, options));
    expect(n.fam.map(({ dmg, rate }) => [dmg, rate])).toEqual([[6, 0.8], [4, 1.2], [5, 1.2]]);
    const near = add('evil', { y: 360 }), far = add('evil', { y: 200 }), hidden = add('shade', { y: 405 });
    n.fam.forEach(f => { f.cd = 0; });
    nightStep(n);
    expect([near.hp, far.hp, hidden.hp]).toEqual([85, 100, 100]);
    expect(n.fam.map(f => f.cd)).toEqual([0.8, 1.2, 1.2]);
    const guardian = startNight(house, person, { ...options, guardian: true });
    expect(guardian.d).toBe(5);
    expect(guardian.fam.map(f => f.dmg)).toEqual([4, 5]);
  });

  it('交情满 40 才能喊，取最高交情邻居，18 秒内一晚一次，帮手击杀不加手打纸钱', () => {
    const { house, person } = inputs(setup);
    person.friends.wang = 39;
    const noHelp = startNight(house, person, { seed: 1 });
    applyNightAction(noHelp, { type: 'help' });
    expect(noHelp.ally).toBeNull();
    person.friends.wang = 40; person.friends.li = 99;
    const gated = startNight(house, person, { seed: 1, helpEnabled: false });
    applyNightAction(gated, { type: 'help' });
    expect(gated.ally).toBeNull();
    const { n, add } = encounter(startNight(house, person, { seed: 1 }));
    applyNightAction(n, { type: 'help' });
    expect(n.ally).toMatchObject({ id: 'li', t: 18, cd: 0.4 });
    const g = add('armor', { hp: 12 });
    for (let i = 0; i < 9; i++) nightStep(n);
    expect(n.ghosts).not.toContain(g); expect(n.coins).toBe(0);
    expect(n.ally!.cd).toBeCloseTo(0.45, 1);
    for (let i = 0; i < 360; i++) nightStep(n);
    expect(n.ally).toBeNull();
    applyNightAction(n, { type: 'help' });
    expect(n.ally).toBeNull();
    n.spawns = []; n.wave = 4; nightStep(n);
    expect(n.result?.friendship).toEqual({ li: 1 });
    expect(person.friends.li).toBe(99);
  });
});

describe('结算和回放', () => {
  it.each([false, true])('赢 / 输的收据只算差额，重走输入不重复扣家产（护家神 %s）', guardian => {
    for (const win of [false, true]) {
      const { house, person } = inputs(setup);
      const family = { ...house, chest: 109, treasures: [{ n: '玉', v: 32 }, { n: '珠', v: 80 }], store: { wood: 3 } };
      const before = copy([family, person]);
      const n = startNight(family, person, { seed: 7, guardian });
      n.wave = 4; n.spawns = []; n.door = win ? 8 : 0; n.coins = 24; n.kills = 6;
      nightStep(n);
      expect(n.result).toMatchObject({ won: win, door: win ? 8 : 0, doorMax: DOORS[1]!.hp, coins: 24, kills: 6,
        held: Number(!guardian && win), broken: Number(!guardian && !win), earnedMoney: win ? 24 : 0,
        creditedKills: win ? 6 : 0, lostMoney: win ? 0 : 32 });
      if (win) expect(n.result?.lostTreasure).toBeNull();
      else expect(n.result?.lostTreasure).toEqual(family.treasures[n.result!.lostTreasureIndex!]);
      const finish = copy(n);
      nightStep(n, [{ type: 'help' }, { type: 'item', item: 'bow' }]);
      expect(n).toEqual(finish);
      expect([family, person]).toEqual(before);
    }
  });

  it('同种子同输入重放全状态；波中 JSON 读回后动作记录、钱和战果一致；换脸仍得同一收据', () => {
    const sample = { ...setup, day: 5, door: 3, bows: 3, trial: 2 };
    const n = newTrial(sample);
    const log: Replay = [];
    const expected = fight(n, sample.trial, 4, 'smart', log);
    expect(n.result?.won).toBe(true);
    expect(expected.perks).toBe(4);
    function replay(cosmeticSeed?: number, restore = false) {
      let state = newTrial(sample, true, cosmeticSeed), cursor = 0, restored = false;
      for (let step = 1; step <= expected.steps; step++) {
        if (!state.picking) nightStep(state);
        if (log[cursor]?.step === step) {
          for (const action of log[cursor++]!.actions) applyNightAction(state, action);
        }
        if (restore && !restored && state.wave === 2 && state.ghosts.length >= 2) {
          state = copy(state);
          restored = true;
        }
      }
      expect(cursor).toBe(log.length);
      expect(restored).toBe(restore);
      return state;
    }
    expect(replay()).toEqual(n);
    expect(replay(undefined, true)).toEqual(n);
    const differentFaces = replay(987654);
    expect(differentFaces).not.toEqual(n);
    expect(differentFaces.result).toEqual(n.result);
    expect(expected.steps).toBeLessThan(STEP_LIMIT);
  });
});
