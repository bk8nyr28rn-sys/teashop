import { describe, expect, test } from 'vitest';
import { autoLossLimit } from '../../src/core/loop';
import { Server } from '../../src/server';
import { clock, marry, moveTogether, Phone, playNight, twoAdults } from './helpers';

function start(s: Server) {
  const p = new Phone(s, 'a');
  p.login();
  p.ok({ type: 'dawn' });
  return p;
}

describe('亲手守夜：服务器重放', () => {
  test('手机交上来的记录，服务器重放出一样的结果', () => {
    const s = new Server({ now: clock('2026-12-01').now, seed: 3 });
    const p = start(s);
    const purse = p.life.person.purse;
    const begin = p.ok({ type: 'nightBegin', mode: 'hand' });
    const local = playNight(begin.start, true);
    expect(local.state.result!.won).toBe(true);
    const end = p.ok({ type: 'nightEnd', nightId: begin.nightId, log: local.log, claim: { won: true } });
    expect(end.outcome).toMatchObject({ won: true, kills: local.state.result!.kills, earnedMoney: local.state.result!.coins, suspicious: false });
    expect(p.life.person.purse).toBe(purse + local.state.result!.coins);
    expect(p.life.phase).toBe('dawn');
  });

  test('报「守住了」，记录里其实没打：以重放为准，记一笔可疑', () => {
    const s = new Server({ now: clock('2026-12-01').now, seed: 3 });
    const p = start(s);
    const begin = p.ok({ type: 'nightBegin', mode: 'hand' });
    const end = p.ok({ type: 'nightEnd', nightId: begin.nightId, log: playNight(begin.start, false).log, claim: { won: true } });
    expect(end.outcome).toMatchObject({ won: false, suspicious: true });
    expect(s.world.suspects).toMatchObject([{ nightId: begin.nightId, claimed: true, replayed: false }]);
  });

  test('一夜只能结一次账；重试同一个 opId 拿到同一个回答', () => {
    const s = new Server({ now: clock('2026-12-01').now, seed: 3 });
    const p = start(s);
    const begin = p.ok({ type: 'nightBegin', mode: 'hand' });
    const log = playNight(begin.start, true).log;
    const req = { accountId: 'a', opId: 'end-1', type: 'nightEnd' as const, nightId: begin.nightId, log };
    const first = s.handle(req);
    expect(s.handle(req)).toEqual({ ...first, replayed: true });
    expect(p.send({ type: 'nightEnd', nightId: begin.nightId, log }).ok).toBe(false);
  });
});

describe('打到一半离开', () => {
  test('23:50 开打、00:10 交：还是同一天，照常重放', () => {
    const c = clock('2026-12-01', 23);
    const s = new Server({ now: c.now, seed: 3 });
    const p = start(s);
    const begin = p.ok({ type: 'nightBegin', mode: 'hand' });
    c.set('2026-12-02', 0);
    expect(p.ok({ type: 'nightEnd', nightId: begin.nightId, log: playNight(begin.start, true).log })).toMatchObject({ stale: false });
  });

  test('隔天（过了早上 5 点）才回来：那一夜当交给机关守，没有纸钱', () => {
    const c = clock('2026-12-01', 23);
    const s = new Server({ now: c.now, seed: 3 });
    const p = start(s);
    const purse = p.life.person.purse;
    p.ok({ type: 'nightBegin', mode: 'hand' });
    c.set('2026-12-02', 9);
    p.login();
    const night = Object.values(s.world.nights)[0]!;
    expect(night).toMatchObject({ status: 'settled', mode: 'offline' });
    expect(night.result!.earnedMoney).toBe(0);
    expect(p.life.person.purse).toBe(purse);
    expect(p.life.phase).toBe('dawn');
  });
});

describe('一座房里住着几个真人：谁输谁疼（11-28 定）', () => {
  function couple(seed: number) {
    const s = new Server({ now: clock('2026-12-01').now, seed });
    const { a, b } = twoAdults(s);
    marry(a, b);
    moveTogether(a, b);
    const house = a.house;
    house.chest = 300;
    house.treasures = [{ n: '古玉', v: 50 }, { n: '玉佩', v: 30 }];
    b.life.lifeNo = 2;
    b.life.person.purse = 100;
    return { s, a, b };
  }

  test('孩子（别的真人）守输了：钱袋照常被抢，钱箱最多丢 20 文，宝物一件不丢', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { b } = couple(seed);
      const begin = b.ok({ type: 'nightBegin', mode: 'hand' });
      const end = b.ok({ type: 'nightEnd', nightId: begin.nightId, log: playNight(begin.start, false).log });
      const plan = Object.values(b.server.world.nights).at(-1)!.plan;
      expect(Object.values(b.server.world.nights).at(-1)!.lossMode).toBe('shared');
      expect(end.outcome.won).toBe(false);
      expect(end.outcome.purseLost).toBe(Math.floor(100 * plan.purseTenths / 10));
      expect(end.outcome.chestLost).toBeLessThanOrEqual(autoLossLimit(300, 2));
      expect(end.outcome.lostTreasure).toBeNull();
      expect(b.house.treasures).toHaveLength(2);
    }
  });

  test('房里只住着自己一个真人：照亲手守的规矩丢钱箱和宝物', () => {
    const s = new Server({ now: clock('2026-12-01').now, seed: 9 });
    const p = start(s);
    p.house.chest = 300;
    p.house.treasures = [{ n: '古玉', v: 50 }];
    const begin = p.ok({ type: 'nightBegin', mode: 'hand' });
    const end = p.ok({ type: 'nightEnd', nightId: begin.nightId, log: playNight(begin.start, false).log });
    const night = Object.values(s.world.nights).at(-1)!;
    expect(night.lossMode).toBe('solo');
    expect(end.outcome.chestLost).toBe(Math.floor(300 * night.plan.chestTenths / 10));
    expect(end.outcome.lostTreasure).toEqual(night.plan.treasure);
  });
});

describe('不在线的夜：按房算', () => {
  test('一个现实日里房里没人守，机关守一次；离开一段时间最多丢一次钱', () => {
    const c = clock('2026-12-01');
    const s = new Server({ now: c.now, seed: 5 });
    const { a, b } = twoAdults(s);
    marry(a, b);
    moveTogether(a, b);
    const house = a.house;
    Object.assign(house, { chest: 500, door: 0, traps: { crossbow: 0, lamp: 0, talisman: 0 } });
    a.life.lifeNo = 2;
    a.life.person.day = 5;
    // 12-01 两人都守过（交给机关）。之后 12-02 到 12-05 都没人上线
    c.set('2026-12-06');
    a.login();
    const offline = s.world.inbox.filter(m => m.houseId === house.id && m.kind === 'offline');
    expect(offline.map(m => m.text.slice(0, 10))).toEqual(['2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05']);
    const losses = s.world.ledger.filter(l => l.houseId === house.id && l.why.startsWith('不在线'));
    expect(losses).toHaveLength(1);
    expect(500 - a.house.chest).toBe(20);
    // b 再登录，不会再补一遍
    b.login();
    expect(s.world.inbox.filter(m => m.houseId === house.id && m.kind === 'offline')).toHaveLength(4);
  });

  test('第一世的人家不丢钱；没人住的老宅不来鬼', () => {
    const c = clock('2026-12-01');
    const s = new Server({ now: c.now, seed: 5 });
    const p = start(s);
    Object.assign(p.house, { chest: 500, door: 0 });
    c.set('2026-12-05');
    p.login();
    expect(p.house.chest).toBe(500);
  });
});

describe('红线天亮涨，一个现实日只涨一次', () => {
  test('两个人同一个现实日各过一个天亮，红线只涨一份', () => {
    const s = new Server({ now: clock('2026-12-01').now });
    const { a, b } = twoAdults(s);
    marry(a, b);
    const bond = () => s.world.bonds[a.life.bondId!]!;
    const love = bond().love;
    for (const p of [a, b]) {
      p.ok({ type: 'nightBegin', mode: 'delegated' });
      p.ok({ type: 'dawn' });
    }
    expect(bond().love).toBe(love + 8);
  });
});
