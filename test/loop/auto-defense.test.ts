import { describe, expect, it } from 'vitest';
import {
  autoLossLimit, chanceLabel, defenseChance, nightKarma, settleAutoNight,
  type AutoNightGame, type AutoNightOptions,
} from '../../src/core/loop/auto-defense';
import { DOORS, NIGHT, TRAPS, waveCounts } from '../../src/core/loop/night-config';
import { beginNightLedger, type NightPlan, type NightReceipt } from '../../src/core/loop/settlement';

const day = '2026-11-20';
const home = () => ({
  houseId: 'lin', lifeId: 'lin-2', lifeNo: 2, nightId: 5, day: 3, phase: 'home',
  door: 1, traps: { crossbow: 1, lamp: 0, talisman: 0 }, chest: 83, purse: 109,
  held: 1, broken: 1, kills: 3, hp: 2, bankedDays: 2, bag: [{ n: '野花' }],
  treasures: [{ n: '古镜', v: 100 }], afterlife: null,
  receipts: {} as Record<string, NightReceipt>, nightReceipt: null as NightReceipt | null,
  nightPlan: null as NightPlan | null, allFeatures: false,
} satisfies AutoNightGame & Record<string, unknown>);
const options = (overrides: Partial<AutoNightOptions> = {}): AutoNightOptions => ({
  mode: 'delegated', seed: 7, nightId: 6, realDate: day, progress: true, allowLoss: true, ...overrides,
});
const sameState = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('家宅把握', () => {
  it('五晚、五门、所有弩机/灯笼/镇宅符档位均在上下限内，每个有效升级严格增加把握', () => {
    for (let d = 1; d <= 5; d++) {
      for (let door = 0; door < DOORS.length; door++) {
        for (let crossbow = 0; crossbow <= TRAPS.crossbow.max; crossbow++) {
          for (let lamp = 0; lamp <= TRAPS.lamp.max; lamp++) {
            for (let talisman = 0; talisman <= TRAPS.talisman.max; talisman++) {
              const traps = { crossbow, lamp, talisman };
              const p = defenseChance(d, door, traps);
              expect(p).toBeGreaterThanOrEqual(0.05);
              expect(p).toBeLessThanOrEqual(0.95);
              if (d < 5) expect(defenseChance(d + 1, door, traps)).toBeLessThan(p);
              if (door < 4) expect(defenseChance(d, door + 1, traps)).toBeGreaterThan(p);
              for (const key of ['crossbow', 'lamp', 'talisman'] as const) {
                if (traps[key] < TRAPS[key].max)
                  expect(defenseChance(d, door, { ...traps, [key]: traps[key] + 1 })).toBeGreaterThan(p);
              }
            }
          }
        }
      }
    }
  });

  it.each([
    [1, 0, 0, 0, 0, 0.30, '三成'], [3, 1, 1, 0, 0, 0.50, '五成'],
    [5, 2, 2, 1, 0, 0.60, '六成'], [5, 3, 3, 1, 1, 0.85, '九成'],
  ] as const)('第 %i 天、门 %i、弩 %i、灯 %i、符 %i 符合目标档', (d, door, crossbow, lamp, talisman, target, label) => {
    const probability = defenseChance(d, door, { crossbow, lamp, talisman });
    expect(Math.abs(probability - target)).toBeLessThan(0.05);
    expect(chanceLabel(probability)).toBe(label);
  });

  it('极限仍有守住或砸破的余地', () => {
    expect(chanceLabel(0.05)).toBe('一成');
    expect(chanceLabel(0.95)).toBe('九成');
  });
});

describe('机关共用夜账', () => {
  it.each([7, 4, 0])('相同家底、夜号和种子 %i，托守与离线的胜负和钱箱损失一致', seed => {
    const active = home(), away = home();
    const first = settleAutoNight(active, options({ seed }))!;
    const second = settleAutoNight(away, options({ seed, mode: 'offline', progress: false }))!;
    expect(second).toMatchObject({ seed, won: first.won, chance: first.chance, earnedMoney: 0,
      chestLost: first.chestLost, purseLost: first.purseLost, mode: 'offline', realDate: day });
    expect(away.chest).toBe(active.chest);
    expect(away.purse).toBe(109);
    expect(away).toMatchObject({ phase: 'home', day: 3, bankedDays: 2, nightReceipt: null });
    expect(active).toMatchObject({ phase: 'dawn', day: 3, bankedDays: 2, nightReceipt: first });
    expect(second.paragraphs[0]).toContain('你不在时');
  });

  it('离线守住记一胜、给半份因果，钱袋维持原额，战报只报守住', () => {
    const game = { ...home(), held: 0, autoHeld: 0, broken: 0 };
    const receipt = settleAutoNight(game, options({ mode: 'offline', progress: false }))!;
    expect(receipt).toMatchObject({ won: true, earnedMoney: 0, paragraphs: ['你不在时，机关守住了家门。'] });
    expect(game).toMatchObject({ held: 1, autoHeld: 1, purse: 109 });
    expect(nightKarma(game.held, game.autoHeld, game.broken)).toBe(nightKarma(1) / 2);
  });

  it.each(['delegated', 'offline'] as const)('%s 下第一世整世都保护钱箱，第二世损失向下取整且封顶', mode => {
    for (const lifeNo of [1, 2]) {
      for (const [chest, expectedLoss] of [[0, 0], [9, 0], [83, 8], [199, 19], [200, 20], [990, 20]] as const) {
        const game = { ...home(), day: 5, chest, lifeNo };
        const lost = lifeNo === 1 ? 0 : expectedLoss;
        expect(autoLossLimit(chest, lifeNo)).toBe(lost);
        const receipt = settleAutoNight(game, options({ seed: 4, mode, progress: mode === 'delegated' }))!;
        expect(receipt).toMatchObject({ won: false, chestLost: lost, purseLost: 0, lostTreasureIndex: null,
          lostTreasure: null, earnedMoney: 0, next: 'old' });
        expect(game).toMatchObject({ chest: chest - lost, purse: 109, held: 1, autoBroken: 1, broken: 1,
          hp: 2, kills: 3, treasures: [{ n: '古镜', v: 100 }], bag: [{ n: '野花' }] });
        if (lifeNo === 1) expect(receipt.paragraphs[0]).toContain('新家有保护');
        else if (lost) expect(receipt.paragraphs[0]).toContain(`少了 ${lost} 文`);
      }
    }
  });

  it('调用方标记这段离开已扣过钱，仍记破门，一文不扣', () => {
    const game = home();
    const receipt = settleAutoNight(game, options({ mode: 'offline', progress: false, allowLoss: false, seed: 4 }))!;
    expect(receipt).toMatchObject({ won: false, chestLost: 0 });
    expect(game).toMatchObject({ autoBroken: 1, broken: 1, chest: 83, purse: 109 });
  });

  it('主动交给机关守住，纸钱按当晚全部鬼的基础掉落折半进钱袋', () => {
    for (const d of [1, 3, 5]) {
      for (const allFeatures of [false, true]) {
        const game = { ...home(), day: d, allFeatures };
        const manualBase = Array.from({ length: NIGHT.waves }, (_, wave) =>
          Object.values(waveCounts(d, wave, !allFeatures)).reduce((a, b) => a + b, 0) * NIGHT.weapon.playerCoins
        ).reduce((a, b) => a + b, 0);
        const receipt = settleAutoNight(game, options())!;
        expect(receipt).toMatchObject({ won: true, earnedMoney: Math.floor(manualBase / 2), chestLost: 0 });
        expect(game).toMatchObject({ held: 2, autoHeld: 1, broken: 1, purse: 109 + receipt.earnedMoney, chest: 83, kills: 3 });
      }
    }
  });

  it('守住首夜的机关因果为亲手的一半，破门只扣亲手分，守夜与收入共用家业上限', () => {
    expect(nightKarma(1, 1, 0)).toBe(nightKarma(1, 0, 0) / 2);
    expect(nightKarma(2, 1, 1, 39)).toBe(8 + 4 - 4 + 1);
    expect(nightKarma(1, undefined, 0)).toBe(8);
    expect(nightKarma(1, 1, 0, 400)).toBe(20);
    expect(nightKarma(200, 200, 0)).toBe(20);
  });

  it('读档重试沿用收据，旧日期、换人、换户、错模式及跳号不能再入账', () => {
    const original = home();
    const receipt = settleAutoNight(original, options())!;
    const game = sameState(original);
    const snapshot = sameState(game);
    expect(settleAutoNight(game, options({ seed: 4 }))).toEqual(receipt);
    expect(game).toEqual(snapshot);
    for (const change of [{ mode: 'offline' as const }, { day: 4 }, { lifeId: 'old' }, { houseId: 'other' },
      { realDate: '2026-11-18' }, { guardian: true }, { nightId: 8 }, { nightId: 7 }]) {
      expect(settleAutoNight(game, options(change))).toBeNull();
      expect(game).toEqual(snapshot);
    }
    game.phase = 'home'; game.day++; game.nightReceipt = null;
    const nextDay = sameState(game);
    expect(settleAutoNight(game, options({ day: 3 }))).toEqual(receipt);
    expect(game).toEqual(nextDay);
  });

  it('纯家宅来袭保留昨晚未看的战报和人物相位，刷新同一批来袭不重扣', () => {
    const game = home();
    const pending = settleAutoNight(game, options())!;
    const incoming = options({ mode: 'offline', realDate: '2026-11-21', nightId: 7, seed: 4, progress: false });
    const receipt = settleAutoNight(game, incoming)!;
    expect(receipt).toMatchObject({ won: false, chestLost: 8 });
    expect(game).toMatchObject({ phase: 'dawn', nightReceipt: pending, day: 3, bankedDays: 2, chest: 75 });
    const copy = sameState(game);
    expect(settleAutoNight(copy, incoming)).toEqual(receipt);
    expect(copy).toEqual(game);
  });

  it.each([false, true])('已登记的亲手夜只用原种子，拒绝抢号或错误身份（护家神 %s）', guardian => {
    const game = home();
    if (guardian) game.phase = 'death';
    const plan = beginNightLedger(game, guardian, 7)!;
    for (const change of [{ progress: false }, { guardian: !guardian }, { nightId: 7 }, { nightId: 5 }]) {
      const before = sameState(game);
      expect(settleAutoNight(game, options({ mode: 'offline', guardian, ...change }))).toBeNull();
      expect(game).toEqual(before);
    }
    const receipt = settleAutoNight(game, options({ mode: 'offline', seed: 4, guardian }))!;
    expect(receipt).toMatchObject({ nightId: plan.nightId, seed: plan.seed, won: true, next: guardian ? 'reborn' : 'morning' });
    expect(game).toMatchObject({ phase: 'dawn', nightReceipt: receipt, nightPlan: null, day: 3, bankedDays: 2 });
    if (guardian) expect(game.afterlife).toEqual({ kind: 'guard', won: true, automatic: true });
  });

  it('末夜普通转托接老死；无预抽结果的旧夜档可以隔日转托', () => {
    const game = { ...home(), phase: 'night', day: 5 };
    expect(settleAutoNight(game, options({ mode: 'offline' }))).toMatchObject({ next: 'old', nightId: 6 });
    expect(game).toMatchObject({ phase: 'dawn', day: 5 });
  });
});
