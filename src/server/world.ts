import { balanceAge, makePerson } from '../core/loop';
import { Rng } from '../core/rng';
import { addDays } from './clock';
import { GIVEN, SURNAMES } from './config';
import type { Account, Clan, HouseDoc, Life, World } from './model';

/** 不合规的请求：整批不算，回给手机一句话 */
export class Fail extends Error {}
export function fail(message: string): never {
  throw new Fail(message);
}

/** 一次请求的上下文。处理函数只改 w（请求开始时复制出来的那一份），出错就整份丢掉 */
export class Ctx {
  constructor(readonly w: World, readonly today: string, readonly opId: string) {}

  id(prefix: string): string {
    return `${prefix}-${++this.w.seq}`;
  }

  /** 服务器的随机数。种子只在这里抽，手机拿不到下一次 */
  rng(): Rng {
    const rng = new Rng(1);
    rng.setState(this.w.rngState);
    return rng;
  }
  private keep(rng: Rng): void {
    this.w.rngState = rng.getState();
  }
  seed(): number {
    const rng = this.rng();
    const seed = rng.int(1, 0xfffffffe);
    this.keep(rng);
    return seed;
  }
  pick<T>(items: readonly T[]): T {
    const rng = this.rng();
    const item = rng.pick(items);
    this.keep(rng);
    return item;
  }
  /** 用服务器的随机流跑一段（例如 newFamily） */
  draw<T>(fn: (rng: Rng) => T): T {
    const rng = this.rng();
    const out = fn(rng);
    this.keep(rng);
    return out;
  }

  account(id: string): Account {
    return this.w.accounts[id] ?? fail('没有这个账号');
  }
  life(id: string): Life {
    return this.w.lives[id] ?? fail('没有这个人');
  }
  house(id: string): HouseDoc {
    return this.w.houses[id] ?? fail('没有这座房');
  }
  clan(id: string): Clan {
    return this.w.clans[id] ?? fail('没有这个家族');
  }
  me(accountId: string): { account: Account; life: Life } {
    const account = this.account(accountId);
    return { account, life: this.life(account.lifeId) };
  }

  /** 住在房里、活着的真人 */
  realResidents(house: HouseDoc, except?: string): Life[] {
    return house.residents.map(id => this.w.lives[id]).filter((l): l is Life =>
      !!l && l.accountId !== null && l.phase !== 'dead' && l.id !== except);
  }

  ledger(lifeId: string | null, houseId: string, chest: number, purse: number, why: string): void {
    if (!chest && !purse) return;
    this.w.ledger.push({ opId: this.opId, lifeId, houseId, chest, purse, why, realDate: this.today });
  }

  tell(to: { houseId?: string; lifeId?: string }, kind: string, text: string): void {
    this.w.inbox.push({ id: this.id('msg'), ...to, kind, text, realDate: this.today });
  }

  newClan(): Clan {
    const clan: Clan = { id: this.id('clan'), name: this.pick(SURNAMES), houses: [], ancestors: [] };
    this.w.clans[clan.id] = clan;
    return clan;
  }

  newHouse(clan: Clan, name: string, door: number): HouseDoc {
    const house: HouseDoc = {
      id: this.id('house'), clanId: clan.id, name, rev: 0,
      door, traps: { crossbow: 0, lamp: 0, talisman: 0 }, chest: 0, store: {}, treasures: [],
      yardLevel: 0, decor: [null, null, null], plaque: false,
      residents: [], cradles: [], guardedDates: [], settledThrough: addDays(this.today, -1),
      lastGuardedDate: null, lastOfflineLossDate: null, lastRaidDate: null, abandoned: false,
    };
    this.w.houses[house.id] = house;
    clan.houses.push(house.id);
    return house;
  }

  /** 新的一世：在 dawn 阶段，点「天亮」才开始第 1 天（花一个攒的天） */
  newLife(accountId: string | null, clan: Clan, house: HouseDoc, lifeNo: number, parents: string[] = []): Life {
    const life: Life = {
      id: this.id('life'), accountId, clanId: clan.id, houseId: house.id, lifeNo,
      name: clan.name + this.pick(GIVEN) + this.pick(GIVEN), phase: 'dawn', person: makePerson(),
      bondId: null, parents, nightId: 0, held: 0, broken: 0, kills: 0, openNightId: null, afterlife: null,
    };
    this.w.lives[life.id] = life;
    house.residents.push(life.id);
    house.abandoned = false;
    return life;
  }

  /** 搬出一座房；房里没人了就成了老宅 */
  leave(life: Life): void {
    const house = this.house(life.houseId);
    house.residents = house.residents.filter(id => id !== life.id);
    if (!house.residents.length) house.abandoned = true;
  }
}

export function isAdult(life: Life): boolean {
  return balanceAge(life.person.day) !== 'child';
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
