import { describe, expect, test } from 'vitest';
import { dayPrices, RULE_VERSION } from '../../src/core/loop';
import { beijing, realDate, Server } from '../../src/server';
import { clock, marry, moveTogether, Phone, twoAdults } from './helpers';

describe('现实里的一天', () => {
  test('北京时间早上 5 点换天，不看手机的钟', () => {
    expect(realDate(beijing('2026-12-01', 4, 59))).toBe('2026-11-30');
    expect(realDate(beijing('2026-12-01', 5, 0))).toBe('2026-12-01');
    // 23:50 开打、00:10 回来，还是同一天
    expect(realDate(beijing('2026-12-01', 23, 50))).toBe(realDate(beijing('2026-12-02', 0, 10)));
  });
});

describe('一次操作', () => {
  test('新账号没有空位可投，就生在一户新人家：一个家族、一座房', () => {
    const s = new Server({ now: clock('2026-12-01').now });
    const p = new Phone(s, 'a');
    const v = p.login();
    expect(v.life.phase).toBe('dawn');
    expect(v.clan.houses).toEqual([v.house.id]);
    expect(v.house.residents).toEqual([v.life.id]);
    expect(v.bank.bankedDays).toBe(3);
  });

  test('改东西要带 opId；规则版本对不上不收', () => {
    const s = new Server({ now: clock('2026-12-01').now });
    new Phone(s, 'a').login();
    expect(s.handle({ accountId: 'a', type: 'dawn' })).toEqual({ ok: false, error: '缺少 opId' });
    expect(s.handle({ accountId: 'a', opId: 'x', ruleVersion: RULE_VERSION + 1, type: 'dawn' }).ok).toBe(false);
  });

  test('价钱服务器自己算；网络重试同一个 opId 只算一次', () => {
    const s = new Server({ now: clock('2026-12-01').now });
    const p = new Phone(s, 'a');
    p.login();
    p.ok({ type: 'dawn' });
    p.life.person.goods = { 柴: 4 };
    const req = { accountId: 'a', opId: 'sell-1', type: 'batch' as const, ops: [{ type: 'sell' as const, owner: 'person' as const, kind: '柴', quantity: 4 }] };
    const first = s.handle(req);
    const again = s.handle(req);
    expect(first.ok && again.ok).toBe(true);
    expect(again).toMatchObject({ replayed: true });
    expect(p.life.person.purse).toBe(dayPrices(p.life.id, 1)['柴']! * 4);
    expect(s.world.ledger.filter(l => l.opId === 'sell-1')).toHaveLength(1);
  });

  test('一批里有一条不合法，整批都不算', () => {
    const s = new Server({ now: clock('2026-12-01').now });
    const p = new Phone(s, 'a');
    p.login();
    p.ok({ type: 'dawn' });
    p.life.person.goods = { 柴: 2 };
    const before = JSON.stringify(s.world.houses[p.life.houseId]);
    const res = p.send({ type: 'batch', ops: [{ type: 'sell', owner: 'person', kind: '柴', quantity: 2 }, { type: 'buyDoor' }, { type: 'buyDoor' }, { type: 'buyDoor' }, { type: 'buyDoor' }, { type: 'buyDoor' }] });
    expect(res.ok).toBe(false);
    expect(p.life.person.goods).toEqual({ 柴: 2 });
    expect(JSON.stringify(s.world.houses[p.life.houseId])).toBe(before);
  });

  test('两个人同时花钱箱：后到的按最新的钱箱重算，钱不够就退回', () => {
    const s = new Server({ now: clock('2026-12-01').now });
    const { a, b } = twoAdults(s);
    marry(a, b);
    moveTogether(a, b);
    const house = a.house;
    house.chest = 120;
    a.life.person.purse = 0;
    b.life.person.purse = 10;
    const rev = house.rev;
    // 两台手机都以为钱箱里有 120 文
    const ra = a.send({ type: 'batch', baseRev: rev, ops: [{ type: 'expandYard' }] });
    const rb = b.send({ type: 'batch', baseRev: rev, ops: [{ type: 'buyTrap', trap: 'crossbow' }] });
    expect(ra.ok).toBe(true);
    expect(rb).toEqual({ ok: false, error: '钱不够' });
    expect(a.house.chest).toBe(0);
    expect(a.house.traps.crossbow).toBe(0);
    expect(a.house.rev).toBe(rev + 1);
    // 带旧 rev 来，会告诉手机「按最新的重算了」
    b.life.person.purse = 100;
    expect(b.send({ type: 'batch', baseRev: rev, ops: [{ type: 'buyTrap', trap: 'crossbow' }] })).toMatchObject({ ok: true, rebased: true });
  });
});
