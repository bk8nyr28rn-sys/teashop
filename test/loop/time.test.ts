import { describe, expect, it } from 'vitest';
import { AGE_FX, balanceAge, CFG, nextRandom } from '../../src/core/loop/base';
import { makeHouse, makePerson } from '../../src/core/loop/state';
import { accrueDays, daytime, makeDayBank, spendDawn, startDay } from '../../src/core/loop/time';
import { gather, goHome, goOut, LOOP_CONFIG, makeField, nightStep, startNight, walkTo } from '../../src/core/loop';

describe('攒天和时辰', () => {
  it('开局三天，第一天和下一天都是点天亮才扣一天', () => {
    const bank = makeDayBank('2026-11-20'), person = makePerson();
    expect(bank.bankedDays).toBe(3);
    expect(startDay(bank, person, '2026-11-20', 'first')).toBe(true);
    expect([bank.bankedDays, person.day]).toEqual([2, 1]);
    person.hp = 1;
    person.time = CFG.dusk;
    expect(startDay(bank, person, '2026-11-20', 'next')).toBe(true);
    expect([person.day, person.time, person.hp]).toEqual([2, 360, 2]);
    expect(startDay(bank, person, '2026-11-20', 'next')).toBe(true);
    const previous = JSON.stringify(person);
    expect(startDay(bank, person, '2026-11-20', 'next')).toBe(false);
    expect(JSON.stringify(person)).toBe(previous);
  });

  it('现实过日只补余额，不改变白天进度；封顶也记领取日期', () => {
    const bank = makeDayBank('2026-11-20'), person = makePerson();
    person.time = 625;
    expect(accrueDays(bank, '2026-11-27')).toBe(true);
    expect(bank).toMatchObject({ bankedDays: 3, lastGrantDate: '2026-11-27' });
    expect([person.day, person.time]).toEqual([1, 625]);
    spendDawn(bank, '2026-11-27');
    expect(accrueDays(bank, '2026-11-27')).toBe(false);
    expect(accrueDays(bank, '2026-11-19')).toBe(false);
    expect(bank.bankedDays).toBe(2);
    expect(accrueDays(bank, '2026-11-28')).toBe(true);
    expect(bank.bankedDays).toBe(3);
  });

  it.each([
    ['2026-03-07', '2026-03-09', 2], ['2026-10-31', '2026-11-02', 2],
    ['2024-02-28', '2024-03-01', 2], ['2100-02-28', '2100-03-01', 1],
    ['2025-12-31', '2026-01-01', 1],
  ] as const)('从 %s 到 %s 发 %i 天', (from, to, days) => {
    const bank = makeDayBank(from);
    bank.bankedDays = 0;
    accrueDays(bank, to);
    expect(bank.bankedDays).toBe(days);
  });

  it('无限天试玩仍按日赠天，关掉开关后继续花原余额', () => {
    const bank = makeDayBank('2026-11-20');
    bank.bankedDays = 0;
    bank.unlimitedDays = true;
    expect(spendDawn(bank, '2026-11-21')).toBe(true);
    expect(bank.bankedDays).toBe(1);
    bank.unlimitedDays = false;
    expect(spendDawn(bank, '2026-11-21')).toBe(true);
    expect(bank.bankedDays).toBe(0);
  });

  it('无效日期不改余额', () => {
    const bank = makeDayBank('2026-02-28');
    expect(() => spendDawn(bank, '2026-02-29')).toThrow(RangeError);
    expect(bank).toEqual(makeDayBank('2026-02-28'));
  });

  it('开局六个时辰，酉时 18:00 天黑，过了天黑剩余时辰为零', () => {
    expect(daytime(360)).toEqual({ shichen: '卯时', remainingShichen: 6, dark: false, fraction: 0 });
    expect(daytime(720)).toEqual({ shichen: '午时', remainingShichen: 3, dark: false, fraction: .5 });
    expect(daytime(1079).dark).toBe(false);
    expect(daytime(1080)).toEqual({ shichen: '酉时', remainingShichen: 0, dark: true, fraction: 1 });
    expect(daytime(1120).remainingShichen).toBe(0);
  });

  it('玩法年龄与样机一致，第二天开始按成年倍率，第四天开始按老年倍率', () => {
    expect([1, 2, 3, 4, 5].map(balanceAge)).toEqual(['child', 'adult', 'adult', 'elder', 'elder']);
    expect(AGE_FX[balanceAge(1)].dmg).toBe(.8);
    expect(AGE_FX[balanceAge(5)].walk).toBe(1.2);
  });

  it('新家和新人各自持有库存、背包和钱包', () => {
    const house = makeHouse(), person = makePerson();
    house.chest = 100; house.store.柴 = 3;
    person.purse = 17; person.bag.push({ n: '铁矿' });
    expect(JSON.parse(JSON.stringify({ house, person }))).toEqual({ house, person });
    expect(makeHouse()).toMatchObject({ chest: 0, store: {} });
    expect(makePerson()).toMatchObject({ purse: 0, bag: [] });
  });

  it('随机流在零状态也可以原样序列化并续跑', () => {
    const stream = { rngState: 0 };
    nextRandom(stream);
    const resumed = JSON.parse(JSON.stringify(stream));
    expect(nextRandom(resumed)).toBe(nextRandom(stream));
    expect(resumed).toEqual(stream);
  });

  it('用公开入口开第一天、采货归己，再把同一户人家的快照交给守夜', () => {
    const bank = makeDayBank('2026-11-20'), field = makeField(1);
    expect(startDay(bank, field.person, '2026-11-20', 'first')).toBe(true);
    expect(goOut(field)).toBe(true);
    expect(walkTo(field, 2)).toBe(true);
    expect(gather(field)?.kept).toHaveLength(2);
    expect(goHome(field)).toBe(true);
    expect(Object.values(field.person.goods).reduce((a, b) => a + b, 0)).toBe(2);
    expect(field.house.store).toEqual({});
    expect(field.person.bag).toEqual([]);
    field.person.time = CFG.dusk; // 在家歇到天黑。
    const before = JSON.stringify(field);
    const night = startNight(field.house, field.person, { seed: 7 });
    expect(night.ruleVersion).toBe(LOOP_CONFIG.RULE_VERSION);
    for (let i = 0; i < 8000 && !night.over; i++) nightStep(night);
    expect(night.result?.broken).toBe(1);
    expect(bank.bankedDays).toBe(2);
    expect(JSON.stringify(field)).toBe(before);
  });
});
