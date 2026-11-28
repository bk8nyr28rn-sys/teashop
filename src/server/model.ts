import type { Afterlife, DayBank, DecorKind, House, NightLootPlan, NightOptions, Person, Treasure } from '../core/loop';

// 服务器上存的东西。三层：家族（clans）→ 房（houses）→ 人（lives），见 docs/SERVER_SPEC.md 第二、七节。

export interface Account {
  id: string;
  bank: DayBank;
  /** 现在这一世；走完了、还没投胎时指向走完的那一世 */
  lifeId: string;
}

/** 一个人这一辈子走到哪了 */
export type LifePhase = 'day' | 'night' | 'dawn' | 'old' | 'dead';

export interface Life {
  id: string;
  /** null = NPC 占位（没有真人来的孩子） */
  accountId: string | null;
  clanId: string;
  /** 现在住哪座房 */
  houseId: string;
  lifeNo: number;
  name: string;
  phase: LifePhase;
  person: Person;
  bondId: string | null;
  parents: string[];
  nightId: number;
  held: number;
  broken: number;
  kills: number;
  openNightId: string | null;
  afterlife: Afterlife | null;
}

export interface Cradle {
  id: string;
  bondId: string;
  openedDate: string;
  /** 等了一个现实日没人来，先让 NPC 孩子占着；真人来了顶替它 */
  placeholder: string | null;
}

export interface HouseDoc extends House {
  id: string;
  clanId: string;
  name: string;
  /** 每次改动 +1。手机带着它来，对不上就按服务器的最新状态重算 */
  rev: number;
  yardLevel: number;
  decor: (DecorKind | null)[];
  plaque: boolean;
  /** 住在这里的活人（真人和 NPC） */
  residents: string[];
  cradles: Cradle[];
  /** 有人亲手守或交给机关守过的现实日（不在线的夜按这个补） */
  guardedDates: string[];
  /** 不在线的夜补算到哪天（含） */
  settledThrough: string;
  lastGuardedDate: string | null;
  /** 不在线时丢过钱的那天。离开一段时间最多丢一次（11-20 定），真人厉鬼也算在里面 */
  lastOfflineLossDate: string | null;
  lastRaidDate: string | null;
  abandoned: boolean;
}

export interface Portrait { lifeId: string; name: string; lifeNo: number; diedDate: string }

export interface Clan {
  id: string;
  name: string;
  houses: string[];
  /** 祠堂归家族 */
  ancestors: Portrait[];
}

export interface Bond {
  id: string;
  a: string;
  b: string;
  love: number;
  /** 天亮涨红线，一个现实日只涨一次（两个真人各过各的天，不然会涨两份） */
  lastDawnDate: string | null;
  /** 生下来的孩子（真人的 lifeId，或 NPC 占位的 id） */
  kids: string[];
}

export interface NightDoc {
  id: string;
  lifeId: string;
  houseId: string;
  realDate: string;
  day: number;
  seed: number;
  plan: NightLootPlan;
  /** 开打时房里还住着别的真人 → shared：谁输谁疼（11-28 定） */
  lossMode: 'solo' | 'shared';
  /** 开打那一刻的门、机关和人，重放从这里开始 */
  start: { house: House; person: Person; options: NightOptions };
  status: 'open' | 'settled';
  mode?: 'hand' | 'delegated' | 'offline';
  result?: NightOutcome;
}

export interface NightOutcome {
  won: boolean;
  kills: number;
  earnedMoney: number;
  purseLost: number;
  chestLost: number;
  lostTreasure: Treasure | null;
  /** 手机报的和服务器重放的对不上 */
  suspicious: boolean;
}

export interface RaidDoc {
  id: string;
  ghostLifeId: string;
  houseId: string;
  realDate: string;
  seed: number;
  tier: number;
  status: 'open' | 'settled';
  won?: boolean;
  chestLost?: number;
}

/** 要别人答应的事：分家、搬进别人的房、牵红线 */
export interface Ask {
  id: string;
  kind: 'found' | 'moveIn' | 'bond';
  from: string;
  /** found：从哪座房分；moveIn：搬进哪座房 */
  houseId?: string;
  amount?: number;
  /** bond：牵谁 */
  to?: string;
  /** 谁能答应（其中一个答应就算） */
  askers: string[];
  status: 'open' | 'accepted' | 'declined' | 'failed';
}

export interface InboxItem {
  id: string;
  houseId?: string;
  lifeId?: string;
  kind: string;
  text: string;
  realDate: string;
}

export interface LedgerEntry {
  opId: string;
  lifeId: string | null;
  houseId: string;
  chest: number;
  purse: number;
  why: string;
  realDate: string;
}

export interface World {
  seq: number;
  rngState: number;
  accounts: Record<string, Account>;
  lives: Record<string, Life>;
  houses: Record<string, HouseDoc>;
  clans: Record<string, Clan>;
  bonds: Record<string, Bond>;
  nights: Record<string, NightDoc>;
  raids: Record<string, RaidDoc>;
  asks: Record<string, Ask>;
  inbox: InboxItem[];
  ledger: LedgerEntry[];
  /** 可疑的事（手机报的结果和重放对不上）。先不封号，看看有多少 */
  suspects: Array<{ opId: string; lifeId: string; nightId: string; claimed: boolean; replayed: boolean; realDate: string }>;
  /** 处理过的 opId → 当时的回复。网络重试直接回这个，不重复扣钱 */
  ops: Record<string, unknown>;
}

export function emptyWorld(seed = 1): World {
  return { seq: 0, rngState: seed >>> 0 || 1, accounts: {}, lives: {}, houses: {}, clans: {}, bonds: {},
    nights: {}, raids: {}, asks: {}, inbox: [], ledger: [], suspects: [], ops: {} };
}
