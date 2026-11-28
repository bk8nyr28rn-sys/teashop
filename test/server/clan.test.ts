import { describe, expect, test } from 'vitest';
import { CFG, HAUNT } from '../../src/core/loop';
import { CLAN, Server } from '../../src/server';
import { bashAll, clock, marry, moveTogether, Phone, playNight, twoAdults } from './helpers';

function couple(date = '2026-12-01') {
  const c = clock(date);
  const s = new Server({ now: c.now, seed: 11 });
  const { a, b } = twoAdults(s);
  marry(a, b);
  return { c, s, a, b };
}

/** 红线够深、到了第 3 天，a 在自己住的房里开一个空位 */
function readyForKid(s: Server, a: Phone) {
  s.world.bonds[a.life.bondId!]!.love = 30;
  a.life.person.day = 3;
  return a.ok({ type: 'openCradle' }).cradleId as string;
}

describe('家族 → 房 → 人：住哪随你（11-28 定）', () => {
  test('成亲不用搬：各住各的也是一对', () => {
    const { a, b } = couple();
    expect(a.life.bondId).toBe(b.life.bondId);
    expect(a.life.houseId).not.toBe(b.life.houseId);
  });

  test('搬进伴侣的房要房里的人答应；搬走以后空房成了老宅', () => {
    const { s, a, b } = couple();
    const old = b.life.houseId;
    const { pending } = b.ok({ type: 'moveIn', houseId: a.life.houseId });
    expect(a.ok({ type: 'view' }).asks.map((x: { id: string }) => x.id)).toEqual([pending]);
    a.ok({ type: 'respond', askId: pending, accept: true });
    expect(a.house.residents).toEqual([a.life.id, b.life.id]);
    expect(s.world.houses[old]).toMatchObject({ residents: [], abandoned: true });
  });

  test('不是自己族里、也不是伴侣住的房，搬不进去', () => {
    const s = new Server({ now: clock('2026-12-01').now, seed: 11 });
    const { a, b } = twoAdults(s);
    expect(b.send({ type: 'moveIn', houseId: a.life.houseId })).toMatchObject({ ok: false });
  });

  test('孩子长大自立门户：房里的真人答应才行；分走的钱先起房，族还是同一个、祠堂还是同一个', () => {
    const { s, a, b } = couple();
    moveTogether(a, b);
    readyForKid(s, a);
    const kid = new Phone(s, 'kid');
    kid.login();
    kid.ok({ type: 'dawn' });
    kid.ok({ type: 'nightBegin', mode: 'delegated' });
    kid.ok({ type: 'dawn' });
    const home = a.house;
    home.chest = 300;
    const purse = kid.life.person.purse;
    expect(kid.send({ type: 'foundHouse', amount: 100 })).toMatchObject({ ok: false });
    const { pending } = kid.ok({ type: 'foundHouse', amount: 90 });
    expect(s.world.asks[pending]!.askers).toEqual([a.life.id, b.life.id]);
    expect(kid.life.houseId).toBe(home.id);
    b.ok({ type: 'respond', askId: pending, accept: true });
    const fresh = kid.house;
    expect(fresh.id).not.toBe(home.id);
    expect(fresh).toMatchObject({ clanId: home.clanId, chest: 90 - CLAN.houseCost, door: CLAN.newHouseDoor, residents: [kid.life.id] });
    expect(s.world.houses[home.id]!.chest).toBe(210);
    expect(kid.life.person.purse).toBe(purse);
    expect(s.world.clans[home.clanId]!.houses).toEqual([home.id, fresh.id]);
    expect(s.world.inbox.some(m => m.houseId === home.id && m.kind === 'found')).toBe(true);
    // 答应过的事不能再答应一次
    expect(a.send({ type: 'respond', askId: pending, accept: true }).ok).toBe(false);
  });

  test('搬进伴侣家的人自立门户：新房算他自己原来的家族（暂定）', () => {
    const { s, a, b } = couple();
    moveTogether(a, b);
    a.house.chest = 300;
    const { pending } = b.ok({ type: 'foundHouse', amount: 90 });
    a.ok({ type: 'respond', askId: pending, accept: true });
    expect(b.house.clanId).toBe(b.life.clanId);
    expect(b.house.clanId).not.toBe(a.house.clanId);
    expect(s.world.clans[b.life.clanId]!.houses).toContain(b.house.id);
  });

  test('房里的人不答应，就分不了家', () => {
    const { a, b } = couple();
    moveTogether(a, b);
    a.house.chest = 300;
    const { pending } = b.ok({ type: 'foundHouse', amount: 50 });
    a.ok({ type: 'respond', askId: pending, accept: false });
    expect(b.life.houseId).toBe(a.life.houseId);
    expect(a.house.chest).toBe(300);
  });

  test('一个人住，自立门户不用问谁；没成年不行', () => {
    const s = new Server({ now: clock('2026-12-01').now, seed: 11 });
    const kid = new Phone(s, 'k');
    kid.login();
    kid.ok({ type: 'dawn' });
    expect(kid.send({ type: 'foundHouse', amount: 0 })).toEqual({ ok: false, error: '长大了才能自立门户' });
    const { a } = twoAdults(s);
    a.house.chest = 200;
    a.life.person.purse = 0;
    expect(a.ok({ type: 'foundHouse', amount: 60 }).houseId).toBe(a.life.houseId);
    expect(a.house.chest).toBe(0);
  });
});

describe('族里互相帮着守门（11-28 定：能喊，但要给选项）', () => {
  test('同族的人不用交情就能喊，自己挑喊谁；被喊的人能在设置里关掉', () => {
    const { s, a, b } = couple();
    moveTogether(a, b);
    readyForKid(s, a);
    const kid = new Phone(s, 'kid');
    kid.login();
    kid.ok({ type: 'dawn' });
    const begin = kid.ok({ type: 'nightBegin', mode: 'hand' });
    // 娘家是别的族的伴侣不算族人
    expect(begin.kin.map((k: { id: string }) => k.id)).toEqual([a.life.id]);
    const local = playNight(begin.start, true, a.life.id);
    expect(local.state.helper).toBe(a.life.id);
    kid.ok({ type: 'nightEnd', nightId: begin.nightId, log: local.log });
    expect(s.world.inbox.at(-1)).toMatchObject({ lifeId: a.life.id, kind: 'helped' });
    // a 关掉「族人可以喊我去帮忙」，下一夜就喊不到他了
    a.ok({ type: 'settings', allowKinHelp: false });
    kid.ok({ type: 'dawn' });
    expect(kid.ok({ type: 'nightBegin', mode: 'hand' }).kin).toEqual([]);
  });
});

describe('空位和投胎', () => {
  test('新玩家投胎进真人的空位：孩子算这座房的家族，爹妈都记着', () => {
    const { s, a, b } = couple();
    readyForKid(s, a);
    const kid = new Phone(s, 'kid');
    kid.login();
    expect(kid.life.houseId).toBe(a.life.houseId);
    expect(kid.life.clanId).toBe(a.house.clanId);
    expect(kid.life.parents).toEqual([a.life.id, b.life.id]);
    expect(s.world.bonds[a.life.bondId!]!.kids).toEqual([kid.life.id]);
    expect(a.house.cradles).toEqual([]);
  });

  test('伴侣各住各的：孩子生在开空位的那座房，算那座房的家族', () => {
    const { s, a, b } = couple();
    readyForKid(s, b);
    const kid = new Phone(s, 'kid');
    kid.login();
    expect(kid.life.houseId).toBe(b.life.houseId);
    expect(kid.life.clanId).toBe(b.house.clanId);
  });

  test('等一个现实日没人来，NPC 孩子先占着；真人来了顶替它', () => {
    const { c, s, a } = couple();
    readyForKid(s, a);
    c.set('2026-12-02');
    a.login();
    const bond = () => s.world.bonds[a.life.bondId!]!;
    expect(bond().kids).toHaveLength(1);
    expect(bond().kids[0]).toMatch(/^npc-kid/);
    const kid = new Phone(s, 'kid');
    kid.login();
    expect(bond().kids).toEqual([kid.life.id]);
    expect(s.world.inbox.at(-1)!.text).toMatch(/顶替/);
  });
});

describe('老死、祠堂、投胎回自己家族', () => {
  test('钱袋进住的那座房的钱箱，画像挂进家族的祠堂；投胎可以挑族里的空位', () => {
    const { s, a, b } = couple();
    moveTogether(a, b);
    readyForKid(s, a);
    const chest = a.house.chest;
    Object.assign(a.life, { phase: 'old' });
    a.life.person.purse = 40;
    a.ok({ type: 'die' });
    expect(s.world.houses[b.life.houseId]!.chest).toBe(chest + 40);
    expect(s.world.clans[a.life.clanId]!.ancestors.map(x => x.lifeId)).toEqual([a.life.id]);
    expect(s.world.houses[b.life.houseId]!.residents).toEqual([b.life.id]);
    const cradle = s.world.houses[b.life.houseId]!.cradles[0]!;
    const out = a.ok({ type: 'reborn', cradleId: cradle.id });
    expect(out.houseId).toBe(b.life.houseId);
    expect(a.life.lifeNo).toBe(2);
    expect(a.life.parents).toContain(b.life.id);
  });
});

describe('真人厉鬼（暂定：不抢宝物，最多丢 20 文）', () => {
  function ghostAndVictim() {
    const s = new Server({ now: clock('2026-12-01').now, seed: 13 });
    const { a, b } = twoAdults(s);
    Object.assign(a.life, { phase: 'old' });
    a.ok({ type: 'die' });
    const house = b.house;
    Object.assign(house, { chest: 400, door: 2, treasures: [{ n: '古玉', v: 50 }] });
    b.life.lifeNo = 2;
    return { s, ghost: a, victim: b };
  }

  test('砸开别家的门：那座房最多丢 20 文、宝物不丢，主人能看到战报；厉鬼的战利品带进下一世', () => {
    const { s, ghost, victim } = ghostAndVictim();
    const begin = ghost.ok({ type: 'raidBegin' });
    expect(begin).toMatchObject({ tier: 2, houseName: victim.house.name });
    const end = ghost.ok({ type: 'raidEnd', raidId: begin.raidId, log: bashAll() });
    expect(end).toMatchObject({ won: true, chestLost: 20 });
    expect(victim.house.chest).toBe(380);
    expect(victim.house.treasures).toHaveLength(1);
    expect(s.world.inbox.at(-1)).toMatchObject({ houseId: victim.house.id, kind: 'raid' });
    ghost.ok({ type: 'reborn' });
    expect(ghost.life.person.purse).toBe(HAUNT.lootCoins);
    expect(ghost.life.person.personalTreasures).toEqual([end.loot]);
  });

  test('一座房一个现实日最多来一个厉鬼；没有能去的房就照单机打 NPC 人家', () => {
    const { s, ghost } = ghostAndVictim();
    ghost.ok({ type: 'raidBegin' });
    const other = new Phone(s, 'c');
    other.login();
    other.ok({ type: 'dawn' });
    Object.assign(other.life, { phase: 'old' });
    other.ok({ type: 'die' });
    // 能去的只有 victim 那一座，今天已经来过一个了
    expect(other.ok({ type: 'raidBegin' })).toEqual({ raidId: null });
    // 不会砸自己家族的房
    for (const raid of Object.values(s.world.raids)) {
      expect(s.world.houses[raid.houseId]!.clanId).not.toBe(s.world.lives[raid.ghostLifeId]!.clanId);
    }
  });

  test('只躲不砸：时间到了没砸开，被砸的房什么都不丢', () => {
    const { ghost, victim } = ghostAndVictim();
    const begin = ghost.ok({ type: 'raidBegin' });
    const end = ghost.ok({ type: 'raidEnd', raidId: begin.raidId, log: [] });
    expect(end.won).toBe(false);
    expect(victim.house.chest).toBe(400);
  });
});

test('一辈子的天数用完才会老', () => {
  expect(CFG.lifeDays).toBeGreaterThan(2);
});
