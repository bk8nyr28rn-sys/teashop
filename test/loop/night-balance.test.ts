import { describe, expect, it } from 'vitest';
import { manualRow, trapRow } from '../../scripts/loop-night-bot';
import { DOORS, TRAPS } from '../../src/core/loop/night-config';

// 规则版本 1 的固定种子回归。每格各跑 40 局；样机同期的 40 局另列在验收报告。
// 这些数记录迁移时的行为，后续产品调整难度时应重新记录基线。
describe('亲守五波的难度回归', () => {
  it.each([
    [1, 0, 0, 40, 40], [3, 0, 0, 27, 40], [3, 1, 1, 39, 40],
    [5, 0, 0, 5, 13], [5, 1, 1, 9, 21], [5, 2, 2, 20, 30], [5, 3, 3, 31, 40],
  ])('第 %i 天、门档 %i、%i 台弩机', (day, door, bows, wins3, wins4) => {
    expect(manualRow(day, door, bows, 3, 'smart').wins).toBe(wins3);
    expect(manualRow(day, door, bows, 4, 'smart').wins).toBe(wins4);
  });

  it('全开首夜只用剑仍是原版难度', () => {
    expect(manualRow(1, 0, 0, 4, 'sword').wins).toBe(12);
  });

  it.each([[1.5, 180], [2, 198], [3, 200], [4, 200]])(
    '带路首夜每秒 %i 下，固定 200 局守住 %i 局', (rate, wins) => {
      const r = manualRow(1, 0, 0, rate, 'firstNight', 200);
      expect(r.wins).toBe(wins);
      if (rate === 2) expect(100 * r.hpWhenWon!).toBeCloseTo(96.5, 1);
    });
});

describe('零输入机关基线', () => {
  // 每一行按弩机数量 0 到 4 排列，每组依次为五种门。
  const day1 = [
    [0, 0, 0, 0, 40], [0, 0, 0, 0, 40], [0, 0, 0, 2, 40],
    [0, 0, 0, 36, 40], [0, 0, 0, 40, 40],
  ];
  const day2 = [
    [0, 0, 0, 0, 1], [0, 0, 0, 0, 1], [0, 0, 0, 0, 22],
    [0, 0, 0, 0, 40], [0, 0, 0, 0, 40],
  ];
  it.each([1, 2, 3, 4, 5])('第 %i 天每项机关配置都跑 40 局', day => {
    for (const [door] of DOORS.entries()) {
      for (let bows = 0; bows <= TRAPS.crossbow.max; bows++) {
        expect(trapRow(day, door, bows, 0).wins).toBe(0);
        const expected = day === 1 ? day1[door]![bows] : day === 2 ? day2[door]![bows] : 0;
        expect(trapRow(day, door, bows, 1).wins).toBe(expected);
      }
    }
  });
});
