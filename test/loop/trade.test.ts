import { describe, expect, it } from 'vitest';
import { GOODS, goodsValue, sellAllOrdinary, sellOrdinary } from '../../src/core/loop/economy';
import { finishLife, fromView, toView } from '../../src/core/loop/household';
import { makeHouse, makePerson } from '../../src/core/loop/state';
import {
  TRADE, acceptRequest, canCook, collectStove, dayPrices, deliverRequest, offerFor, planDelivery, priceTrend,
  requestBoard, startStove, stoveJobs, stoveStatus, useHealing, type TradeHouse,
} from '../../src/core/loop/trade';

const NEIGHBORS = ['wang', 'li', 'zhao'];
const LIFE = 'w/life-1';
const house = (): ReturnType<typeof makeHouse> & TradeHouse => ({ ...makeHouse(), request: null });

describe('行情', () => {
  it('第 1 天固定基础价；之后每样货每天在八成到一成二之间', () => {
    expect(dayPrices(LIFE, 1)).toEqual(GOODS);
    let moved = 0;
    for (let day = 2; day <= 60; day++) {
      const prices = dayPrices(LIFE, day);
      for (const [kind, base] of Object.entries(GOODS)) {
        const p = prices[kind]!;
        expect(Number.isInteger(p)).toBe(true);
        expect(p).toBeGreaterThanOrEqual(Math.max(1, Math.round(base * 0.8)));
        expect(p).toBeLessThanOrEqual(Math.round(base * 1.2));
        if (p !== base) moved++;
      }
    }
    expect(moved).toBeGreaterThan(100);
  });

  it('同一世同一天重算不变；换一天、换一世会变', () => {
    expect(dayPrices(LIFE, 4)).toEqual(dayPrices(LIFE, 4));
    const days = new Set(Array.from({ length: 8 }, (_, i) => JSON.stringify(dayPrices(LIFE, i + 2))));
    expect(days.size).toBeGreaterThan(1);
    expect(dayPrices('w/life-2', 4)).not.toEqual(dayPrices(LIFE, 4));
  });

  it('差到一成才标贵或便宜', () => {
    const prices = { ...GOODS, 兽皮: 16, 古物: 44, 铁矿: 15, 时蔬: 5 };
    expect(priceTrend(prices, '兽皮')).toBe('up');
    expect(priceTrend(prices, '古物')).toBe('up');
    expect(priceTrend(prices, '铁矿')).toBe('down');
    expect(priceTrend(prices, '时蔬')).toBeNull();
  });

  it('一件件卖五次和一次卖五件，钱一样；预估也用同一个价', () => {
    const prices = dayPrices(LIFE, 3);
    const a = house(), b = house(), pa = makePerson(), pb = makePerson();
    pa.goods = { 柴: 5, 兽皮: 2 }; pb.goods = { 柴: 5, 兽皮: 2 };
    const estimate = goodsValue(pa.goods, prices);
    let one = 0;
    for (let i = 0; i < 5; i++) one += sellOrdinary(a, pa, 'person', '柴', 1, prices);
    one += sellOrdinary(a, pa, 'person', '兽皮', 1, prices) + sellOrdinary(a, pa, 'person', '兽皮', 1, prices);
    const all = sellAllOrdinary(b, pb, 'person', prices);
    expect(one).toBe(all);
    expect(all).toBe(estimate);
    expect(pa.purse).toBe(pb.purse);
  });
});

describe('灶台：过一夜就好', () => {
  it('放料时扣一次；当天不好，过完一晚才好；取一次只进一次', () => {
    const h = house(), p = makePerson();
    p.goods = { 柴: 7 };
    expect(startStove(h, p, 'charcoal', 'person', { lifeId: LIFE, day: 3 })).toMatchObject({ recipe: 'charcoal', owner: 'person' });
    expect(p.goods).toEqual({ 柴: 4 });
    expect(stoveStatus(stoveJobs(h)[0], LIFE, 3)).toBe('cooking');
    // 现实里过多久都一样：只看游戏里的天
    expect(collectStove(h, p, { lifeId: LIFE, day: 3 })).toBeNull();
    expect(p.goods).toEqual({ 柴: 4 });
    expect(stoveStatus(stoveJobs(h)[0], LIFE, 4)).toBe('ready');
    expect(collectStove(h, p, { lifeId: LIFE, day: 4 })).toEqual({ kind: '木炭', count: 1, owner: 'person', index: 0 });
    expect(collectStove(h, p, { lifeId: LIFE, day: 4 })).toBeNull();
    expect(p.goods).toEqual({ 柴: 4, 木炭: 1 });
    expect(stoveJobs(h)).toEqual([null]);
  });

  it('用家里的料，成品进家里的仓库；料不够不能放；一次只能烧一锅', () => {
    const h = house(), p = makePerson();
    h.store = { 草药: 2, 柴: 3 }; p.goods = { 草药: 1 };
    expect(canCook(h, p, 'salve', 'person')).toBe(false);
    expect(startStove(h, p, 'salve', 'person', { lifeId: LIFE, day: 2 })).toBeNull();
    expect(startStove(h, p, 'salve', 'house', { lifeId: LIFE, day: 2 })).not.toBeNull();
    expect(h.store).toEqual({ 柴: 3 });
    expect(startStove(h, p, 'charcoal', 'house', { lifeId: LIFE, day: 2 })).toBeNull();
    expect(collectStove(h, p, { lifeId: LIFE, day: 3 })).toEqual({ kind: '金疮药', count: 1, owner: 'house', index: 0 });
    expect([h.store, p.goods]).toEqual([{ 柴: 3, 金疮药: 1 }, { 草药: 1 }]);
  });

  it('人走了，灶里那锅照样烧好，归家里的仓库', () => {
    const view = toView(fromView({ fam: '林家', lifeNo: 1, lastGrantDate: '2026-11-23', day: 5, chest: 0, purse: 0,
      goods: { 柴: 3 }, store: {}, treasures: [], personalTreasures: [], bag: [], deathKind: 'old', name: '林一' }));
    startStove(view, view, 'charcoal', 'person', { lifeId: view.lifeId, day: 5 });
    finishLife(view, { name: '林一' });
    const saved = fromView(view);
    expect(saved.houses[view.houseId]!.stoves?.[0]).toMatchObject({ recipe: 'charcoal', owner: 'person' });
    const h = saved.houses[view.houseId]!;
    const next = makePerson();
    expect(collectStove(h, next, { lifeId: 'life-2', day: 1 })).toEqual({ kind: '木炭', count: 1, owner: 'house', index: 0 });
    expect(h.store.木炭).toBe(1);
    expect(next.goods).toEqual({});
  });

  it('金疮药回 2 点，草药回 1 点；先用自己的，再用仓库的', () => {
    const h = house(), p = makePerson();
    p.goods = { 金疮药: 1 }; h.store = { 金疮药: 1, 草药: 1 };
    expect(useHealing(h, p, '金疮药')).toEqual({ owner: 'person', amount: 2 });
    expect(useHealing(h, p, '金疮药')).toEqual({ owner: 'house', amount: 2 });
    expect(useHealing(h, p, '金疮药')).toBeNull();
    expect(useHealing(h, p, '草药')).toEqual({ owner: 'house', amount: 1 });
    expect(useHealing(h, p, '柴')).toBeNull();
  });
});

describe('邻居托付', () => {
  it('每天最多一条，给的钱约是基础价的 1.5 倍，数量在范围里；同一天重算不变', () => {
    for (let day = 1; day <= 80; day++) {
      const r = offerFor(LIFE, day, NEIGHBORS)!;
      expect(r).toEqual(offerFor(LIFE, day, NEIGHBORS));
      expect(NEIGHBORS).toContain(r.neighbor);
      const [lo, hi] = TRADE.request.wants[r.kind]!;
      expect(r.count).toBeGreaterThanOrEqual(lo);
      expect(r.count).toBeLessThanOrEqual(hi);
      expect(r.pay).toBe(Math.round(GOODS[r.kind]! * r.count * 1.5));
    }
  });

  it('接单后价钱不变；同时只能接一条；交了以后今天不再出新的', () => {
    const h = house();
    const offered = requestBoard(h, LIFE, 4, NEIGHBORS).offer!;
    const taken = acceptRequest(h, LIFE, 4, NEIGHBORS)!;
    expect(taken).toMatchObject({ id: offered.id, pay: offered.pay, status: 'accepted', acceptedDay: 4, dueDay: 5 });
    expect(acceptRequest(h, LIFE, 4, NEIGHBORS)).toBeNull();
    expect(requestBoard(h, LIFE, 5, NEIGHBORS)).toEqual({ active: taken, offer: null });
    const p = makePerson();
    p.goods = { [taken.kind]: taken.count };
    expect(deliverRequest(h, p, { lifeId: LIFE, day: 4 })).not.toBeNull();
    expect(requestBoard(h, LIFE, 4, NEIGHBORS)).toEqual({ active: null, offer: null });
    expect(requestBoard(h, LIFE, 5, NEIGHBORS).offer?.day).toBe(5);
  });

  it('凑够才能交；自己的和家里的一起凑，钱按件数分进钱袋和钱箱，交情 +5，只交一次', () => {
    const h = house(), p = makePerson();
    h.request = { id: 'x', lifeId: LIFE, day: 4, neighbor: 'li', kind: '木炭', count: 2, pay: 42,
      status: 'accepted', acceptedDay: 4, dueDay: 5 };
    p.goods = { 木炭: 1 };
    expect(planDelivery(h, p)).toEqual({ person: 1, house: 0, short: 1 });
    expect(deliverRequest(h, p, { lifeId: LIFE, day: 4 })).toBeNull();
    expect(p.goods).toEqual({ 木炭: 1 });
    h.store = { 木炭: 3 };
    const friends = p.friends.li!;
    expect(deliverRequest(h, p, { lifeId: LIFE, day: 5 })).toEqual({ purse: 21, chest: 21, friendship: 5, neighbor: 'li' });
    expect([p.goods, h.store, p.purse, h.chest, p.friends.li]).toEqual([{}, { 木炭: 2 }, 21, 21, friends + 5]);
    expect(deliverRequest(h, p, { lifeId: LIFE, day: 5 })).toBeNull();
    expect(h.store).toEqual({ 木炭: 2 });
  });

  it('两天没交就过期：不罚钱、不扣交情，第二天照常出新的', () => {
    const h = house(), p = makePerson();
    const r = acceptRequest(h, LIFE, 2, NEIGHBORS)!;
    p.goods = { [r.kind]: r.count };
    const before = { ...p.friends };
    expect(requestBoard(h, LIFE, 4, NEIGHBORS).active).toBeNull();
    expect(h.request?.status).toBe('expired');
    expect(deliverRequest(h, p, { lifeId: LIFE, day: 4 })).toBeNull();
    expect([p.purse, h.chest, p.friends, p.goods]).toEqual([0, 0, before, { [r.kind]: r.count }]);
    expect(requestBoard(h, LIFE, 4, NEIGHBORS).offer?.day).toBe(4);
  });

  it('换了一世，上一世接的托付作废', () => {
    const h = house();
    acceptRequest(h, LIFE, 5, NEIGHBORS);
    expect(requestBoard(h, 'w/life-2', 1, NEIGHBORS).active).toBeNull();
    expect(h.request?.status).toBe('expired');
  });
});

describe('存档', () => {
  it('灶和托付存在家里，读写一圈不变', () => {
    const view = toView(fromView({ fam: '林家', lifeNo: 1, lastGrantDate: '2026-11-23', day: 3, chest: 20, purse: 0,
      goods: { 柴: 3 }, store: {}, treasures: [], personalTreasures: [], bag: [] }));
    startStove(view, view, 'charcoal', 'person', { lifeId: view.lifeId, day: 3 });
    acceptRequest(view, view.lifeId, 3, NEIGHBORS);
    const saved = fromView(view);
    expect(saved.houses[view.houseId]!.stoves?.[0]?.recipe).toBe('charcoal');
    expect(saved.houses[view.houseId]!.request?.status).toBe('accepted');
    expect('stoves' in saved.person).toBe(false);
    const again = toView(saved);
    expect([again.stoves, again.request]).toEqual([view.stoves, view.request]);
  });
});
