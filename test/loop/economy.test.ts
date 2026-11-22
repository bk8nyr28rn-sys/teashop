import { describe, expect, it } from 'vitest';
import {
  depositCoins, givePersonalGood, goodsValue, payHome, payPersonal, quoteHome, sellAllOrdinary,
  sellOrdinary, sellTreasure, settleEstate, shelveTreasure, splitFirewood, storeBelongings, unpackBag, useHerb,
} from '../../src/core/loop/economy';
import { makeHouse, makePerson } from '../../src/core/loop/state';

describe('家与人的两个口袋', () => {
  it('背回的货与宝先归自己，单卖、全卖和卖宝都进对应的钱袋或钱箱', () => {
    const house = makeHouse(), person = makePerson();
    person.bag = [{ n: '柴' }, { n: '柴' }, { n: '草药' }, { n: '古玉', v: 90, tre: true }];
    house.store = { 柴: 3, 兽皮: 2 }; house.treasures = [{ n: '珠', v: 120 }];
    unpackBag(person); unpackBag(person);
    expect(person).toMatchObject({ goods: { 柴: 2, 草药: 1 }, bag: [], personalTreasures: [{ n: '古玉', v: 90 }] });
    expect(sellOrdinary(house, person, 'person', '柴', 1)).toBe(3);
    expect(sellOrdinary(house, person, 'house', '柴', 'all')).toBe(9);
    expect(sellAllOrdinary(house, person, 'person')).toBe(9);
    expect(sellAllOrdinary(house, person, 'house')).toBe(28);
    expect([sellTreasure(house, person, 'person', 0)?.v, sellTreasure(house, person, 'house', 0)?.v]).toEqual([90, 120]);
    expect([person.purse, house.chest]).toEqual([102, 157]);
    expect([person.goods, house.store, person.personalTreasures, house.treasures]).toEqual([{}, {}, [], []]);
    expect(sellTreasure(house, person, 'person', 0)).toBeNull();
    expect(sellOrdinary(house, person, 'house', '柴', 1)).toBe(0);
  });

  it('归家后东西只能从家里出售；一件宝物可单独上架，全存会合并同名货', () => {
    const house = makeHouse(), person = makePerson();
    person.goods = { 草药: 2 }; house.store = { 草药: 1, 柴: 3 };
    person.personalTreasures = [{ n: '珠', v: 88 }, { n: '玉', v: 60 }];
    expect(shelveTreasure(house, person, -1)).toBe(false);
    expect(shelveTreasure(house, person, 1)).toBe(true);
    expect(person.personalTreasures).toEqual([{ n: '珠', v: 88 }]);
    storeBelongings(house, person); storeBelongings(house, person);
    expect(house.store).toEqual({ 草药: 3, 柴: 3 });
    expect(house.treasures).toEqual([{ n: '玉', v: 60 }, { n: '珠', v: 88 }]);
    expect(sellAllOrdinary(house, person, 'person')).toBe(0);
    expect(sellTreasure(house, person, 'person', 0)).toBeNull();
    expect(sellTreasure(house, person, 'house', 1)?.v).toBe(88);
    expect([house.chest, person.purse]).toEqual([88, 0]);
  });

  it('钱袋可部分存入钱箱，拒绝负数提款、超额、零与零头', () => {
    const house = makeHouse(), person = makePerson(); person.purse = 12;
    expect(depositCoins(house, person, 8)).toBe(true);
    for (const invalid of [-8, 5, 0, .5, NaN, Infinity]) expect(depositCoins(house, person, invalid)).toBe(false);
    expect([house.chest, person.purse]).toEqual([8, 4]);
    expect(payPersonal(person, 5)).toBe(false);
    expect([house.chest, person.purse]).toEqual([8, 4]);
  });

  it('预览和实际付款一致，先扣钱箱，不够动用钱袋，凑不够不扣', () => {
    const house = makeHouse(), person = makePerson(); house.chest = 42; person.purse = 9;
    expect(quoteHome(house, person, 52)).toEqual({ chest: 42, purse: 9, shortfall: 1 });
    expect(payHome(house, person, 52)).toBeNull();
    expect(payHome(house, person, 40)).toEqual({ chest: 40, purse: 0, shortfall: 0 });
    const quote = quoteHome(house, person, 9);
    expect(quote).toEqual({ chest: 2, purse: 7, shortfall: 0 });
    expect(payHome(house, person, 9)).toEqual(quote);
    expect([house.chest, person.purse]).toEqual([0, 2]);
  });

  it('送邻居只能用自己的一份货与钱；买个人物品不能从钱箱补差', () => {
    const house = makeHouse(), person = makePerson();
    house.chest = 100; house.store = { 柴: 5 }; person.purse = 10; person.goods = { 草药: 1 };
    expect(payPersonal(person, 11)).toBe(false);
    expect(payPersonal(person, 10)).toBe(true);
    expect(givePersonalGood(person, '柴')).toBe(false);
    expect(givePersonalGood(person, '草药')).toBe(true);
    expect(givePersonalGood(person, '草药')).toBe(false);
    expect([house.chest, house.store.柴, person.purse, person.goods]).toEqual([100, 5, 0, {}]);
  });

  it('疗伤先用自己的药，再用仓库里的药，无药时不扣', () => {
    const house = makeHouse(), person = makePerson();
    house.store = { 草药: 1 }; person.goods = { 草药: 1 };
    expect(useHerb(house, person)).toBe('person');
    expect(house.store.草药).toBe(1);
    expect(useHerb(house, person)).toBe('house');
    expect(useHerb(house, person)).toBeNull();
  });

  it('第一天的整根浮木劈柴，沿用每件 3 文的报价，卖一趟足够换门', () => {
    const house = makeHouse(), person = makePerson(); house.chest = 20;
    expect(splitFirewood(person)).toBe(7);
    expect(goodsValue(person.goods)).toBe(21);
    expect(sellAllOrdinary(house, person, 'person')).toBe(21);
    expect(payHome(house, person, 40)).toEqual({ chest: 20, purse: 20, shortfall: 0 });
    expect([house.chest, person.purse]).toEqual([0, 1]);
  });

  it('老死时剩余钱、货、宝全归家，重做不会重复入账', () => {
    const house = makeHouse(), person = makePerson();
    house.chest = 50; house.store = { 柴: 2 }; person.purse = 9;
    person.goods = { 柴: 2, 草药: 1 }; person.personalTreasures = [{ n: '珠', v: 80 }];
    settleEstate(house, person); settleEstate(house, person);
    expect(house).toMatchObject({ chest: 59, store: { 柴: 4, 草药: 1 }, treasures: [{ n: '珠', v: 80 }] });
    expect(person).toMatchObject({ purse: 0, goods: {}, personalTreasures: [] });
  });
});
