import { describe, expect, it } from 'vitest';
import { beginNightLedger, nightPayout, planNightLoot, settleNightLedger, type NightPlan, type NightReceipt } from '../../src/core/loop/settlement';

const shelf = [{ n: '青玉', v: 80 }, { n: '旧铜钟', v: 40 }];
const home = () => ({
  houseId: 'old-house', lifeId: 'first-life', nightId: 6, day: 5, phase: 'home',
  purse: 109, chest: 53, treasures: [...shelf], receipts: {} as Record<string, NightReceipt>,
  nightPlan: null as NightPlan | null, nightReceipt: null as NightReceipt | null,
  held: 1, broken: 1, kills: 3, afterlife: null,
});
const battle = { won: false, kills: 5, coins: 16 };
const describeLoss = (r: NightReceipt) => [`钱袋 ${r.purseLost}，钱箱 ${r.chestLost}`];

describe('手守的夜账', () => {
  it('开打预抽两个口袋的成数和架上的宝物，战斗中读档沿用原签', () => {
    const purse = new Set<number>(), chest = new Set<number>(), picked = new Set<number | null>();
    for (let seed = 0; seed < 256; seed++) {
      const game = home();
      const plan = beginNightLedger(game, false, seed)!;
      const restored = JSON.parse(JSON.stringify(game)) as typeof game;
      expect(beginNightLedger(restored, false, seed + 999)).toEqual(plan);
      expect(plan).toMatchObject(planNightLoot(seed, shelf));
      expect(plan.nightId).toBe(7);
      purse.add(plan.purseTenths); chest.add(plan.chestTenths); picked.add(plan.treasureIndex);
    }
    expect(purse).toEqual(new Set([2, 3, 4]));
    expect(chest).toEqual(new Set([0, 1, 2]));
    expect(picked).toEqual(new Set([0, 1]));
  });

  it('余额向下取整；极少的钱可以抢零文，空架不丢宝', () => {
    const plan = planNightLoot(17, []);
    expect(nightPayout(plan, { purse: 1, chest: 1, treasures: [] }, false, 5))
      .toEqual({ purseLost: 0, chestLost: 0, lostTreasure: null, lostTreasureIndex: null, earnedMoney: 0 });
    const game = home();
    const expected = beginNightLedger(game, false, 43)!;
    const result = settleNightLedger(game, expected, battle, describeLoss)!;
    expect(result.purseLost).toBe(Math.floor(109 * expected.purseTenths / 10));
    expect(result.chestLost).toBe(Math.floor(53 * expected.chestTenths / 10));
    expect(game).toMatchObject({ purse: 109 - result.purseLost, chest: 53 - result.chestLost, broken: 2, kills: 3 });
    expect(result.lostTreasure).toEqual(expected.treasure);
    expect(game.treasures).toEqual(shelf.filter((_, i) => i !== expected.treasureIndex));
  });

  it('回执一旦入账，在结算页和天亮后重试，都不再扣款或发奖', () => {
    const game = home();
    const plan = beginNightLedger(game, false, 7)!;
    const first = settleNightLedger(game, plan, battle, describeLoss)!;
    expect(first.next).toBe('old');
    expect(game.receipts[7]).toBe(first);
    for (const phase of ['dawn', 'death', 'guard']) {
      game.phase = phase;
      const before = JSON.stringify(game);
      expect(settleNightLedger(game, plan, { ...battle, won: true }, () => ['第二份'])).toEqual(first);
      expect(JSON.stringify(game)).toBe(before);
    }
  });

  it('换户、换世、换日、换相或送错夜号，旧战斗无权入账', () => {
    for (const change of [{ houseId: 'different' }, { lifeId: 'second' }, { day: 1 }, { phase: 'guard' }, { nightId: 8 }]) {
      const game = home();
      const plan = beginNightLedger(game, false, 7)!;
      Object.assign(game, change);
      const before = JSON.stringify(game);
      expect(settleNightLedger(game, plan, battle, describeLoss)).toBeNull();
      expect(JSON.stringify(game)).toBe(before);
    }
  });

  it.each([false, true])('守住后纸钱进守夜人的钱袋，护家神另领夜号（护家神 %s）', guardian => {
    const game = home();
    if (guardian) game.phase = 'death';
    const plan = beginNightLedger(game, guardian, 53)!;
    const receipt = settleNightLedger(game, plan, { ...battle, won: true }, () => ['守住了'])!;
    expect(receipt).toMatchObject({ won: true, earnedMoney: 16, purseLost: 0, chestLost: 0, next: guardian ? 'reborn' : 'old' });
    expect(game).toMatchObject({ purse: 125, chest: 53, treasures: shelf, broken: 1, kills: 8, held: guardian ? 1 : 2 });
    expect(game.afterlife).toEqual(guardian ? { kind: 'guard', won: true } : null);
  });
});
