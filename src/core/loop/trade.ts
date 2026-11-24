import { Rng } from '../rng';
import { GOODS, type Owner } from './economy';
import type { House, Person } from './state';
import { stoveCount } from './home';

// 第四阶段的一小块经营：院里的灶、每天的行情、邻居托付。
// 只用游戏里的天和这一世的编号定结果，不读现实的钟；同一天重算永远相同。
export const TRADE = {
  /** 当天价 = 基础价 × (1 ± swing)，第 1 天固定用基础价 */
  priceSwing: 0.2,
  /** 和基础价差到一成，集市里才标「今天贵 / 今天便宜」 */
  badgeAt: 0.1,
  recipes: {
    charcoal: { name: '木炭', input: { 柴: 3 }, output: '木炭', count: 1 },
    salve: { name: '金疮药', input: { 草药: 2 }, output: '金疮药', count: 1 },
  },
  /** 疗伤一次回几点体力 */
  heal: { 草药: 1, 金疮药: 2 } as Record<string, number>,
  request: {
    payRate: 1.5,
    friendship: 5,
    maxFriendship: 100,
    /** 接单当天算第 1 天，一共几天内要交 */
    days: 2,
    /** 托付的东西和数量范围：都是一两天能凑齐的 */
    wants: { 柴: [4, 6], 时蔬: [2, 3], 草药: [2, 3], 兽皮: [1, 1], 木炭: [1, 2], 金疮药: [1, 1] } as Record<string, [number, number]>,
  },
  /** 带路下第几天开放（全部开放时不看天数） */
  unlock: { prices: 2, stove: 3, requests: 4 },
} as const;

export type RecipeId = keyof typeof TRADE.recipes;
export type Prices = Record<string, number>;
type Stock = Record<string, number>;
type Home = Pick<House, 'chest' | 'store'>;
type Personal = Pick<Person, 'purse' | 'goods'>;

export interface StoveJob {
  jobId: string;
  recipe: RecipeId;
  owner: Owner;
  /** 放料的那一世和那一天。过完这一晚（第二天或换了一世）才算好 */
  lifeId: string;
  day: number;
}

export interface Request {
  id: string;
  lifeId: string;
  /** 这条托付是哪一天出现的；一天最多一条 */
  day: number;
  neighbor: string;
  kind: string;
  count: number;
  pay: number;
  status: 'offered' | 'accepted' | 'done' | 'expired';
  acceptedDay?: number;
  dueDay?: number;
}

export interface TradeHouse extends Home {
  /** 每口灶上的那一锅（见 stoveJobs） */
  stoves?: (StoveJob | null)[];
  /** 第四阶段的旧存档：只有一口灶 */
  stove?: StoveJob | null;
  request?: Request | null;
  yardLevel?: number;
}

function seedOf(text: string): number {
  let h = 2166136261;
  for (const ch of text) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function stream(lifeId: string, day: number, topic: string): Rng {
  return new Rng(seedOf(lifeId + '#' + day + '#' + topic));
}
function positiveInt(n: number): boolean {
  return Number.isSafeInteger(n) && n > 0;
}
function has(stock: Stock, input: Readonly<Record<string, number>>): boolean {
  return Object.entries(input).every(([kind, n]) => (stock[kind] ?? 0) >= n);
}
function take(stock: Stock, kind: string, n: number): void {
  const left = (stock[kind] ?? 0) - n;
  if (left > 0) stock[kind] = left;
  else delete stock[kind];
}
function add(stock: Stock, kind: string, n: number): void {
  stock[kind] = (stock[kind] ?? 0) + n;
}

// ---------------- 行情 ----------------

/** 这一世第 day 天的价钱。第 1 天固定基础价，保证第一天「卖柴换木门」那条路不被打断 */
export function dayPrices(lifeId: string, day: number): Prices {
  const prices: Prices = { ...GOODS };
  if (day <= 1) return prices;
  const rng = stream(lifeId, day, 'prices');
  for (const kind of Object.keys(GOODS)) {
    const mult = 1 - TRADE.priceSwing + rng.next() * 2 * TRADE.priceSwing;
    prices[kind] = Math.max(1, Math.round(GOODS[kind]! * mult));
  }
  return prices;
}

/** 'up' 今天贵，'down' 今天便宜，null 不标 */
export function priceTrend(prices: Prices, kind: string): 'up' | 'down' | null {
  const base = GOODS[kind];
  const price = prices[kind];
  if (!base || !price) return null;
  if (price >= base * (1 + TRADE.badgeAt)) return 'up';
  if (price <= base * (1 - TRADE.badgeAt)) return 'down';
  return null;
}

// ---------------- 灶台 ----------------
// 小院 1 口灶，中院 2 口，大宅 3 口（见 home.ts）。每口灶一次烧一锅。

/** 每口灶上正在烧的那一锅，长度等于灶的口数。第四阶段的旧存档只有 stove 一项 */
export function stoveJobs(house: TradeHouse): (StoveJob | null)[] {
  const jobs: (StoveJob | null)[] = (house.stoves ?? (house.stove ? [house.stove] : [])).map(j => j ?? null);
  while (jobs.length < stoveCount(house)) jobs.push(null);
  return jobs;
}
function saveJobs(house: TradeHouse, jobs: (StoveJob | null)[]) {
  house.stoves = jobs;
  delete house.stove;
}

export function stoveStatus(job: StoveJob | null | undefined, lifeId: string, day: number): 'empty' | 'cooking' | 'ready' {
  if (!job) return 'empty';
  return job.lifeId !== lifeId || day > job.day ? 'ready' : 'cooking';
}

/** 第一口空着的灶；都在烧就是 -1 */
export function freeStove(house: TradeHouse): number {
  return stoveJobs(house).indexOf(null);
}

/** 自己的或家里的料够不够再烧一锅（有空灶才算） */
export function canCook(house: TradeHouse, person: Pick<Person, 'goods'>, recipe: RecipeId, owner: Owner, index = freeStove(house)): boolean {
  const r = TRADE.recipes[recipe];
  if (!r || index < 0 || stoveJobs(house)[index] !== null) return false;
  return has(owner === 'house' ? house.store : person.goods, r.input);
}

/** 放料进灶。用谁的料，成品就是谁的。不指定哪口灶就用第一口空的 */
export function startStove(house: TradeHouse, person: Pick<Person, 'goods'>, recipe: RecipeId, owner: Owner,
  at: { lifeId: string; day: number }, index = freeStove(house)): StoveJob | null {
  if (!canCook(house, person, recipe, owner, index)) return null;
  const stock = owner === 'house' ? house.store : person.goods;
  for (const [kind, n] of Object.entries(TRADE.recipes[recipe].input)) take(stock, kind, n);
  const job: StoveJob = { jobId: at.lifeId + '/d' + at.day + '/s' + index, recipe, owner, lifeId: at.lifeId, day: at.day };
  const jobs = stoveJobs(house);
  jobs[index] = job;
  saveJobs(house, jobs);
  return job;
}

/** 过完一晚才能取。放料的人还在，成品归他；人走了，归家里的仓库。不指定哪口灶就取第一口好了的 */
export function collectStove(house: TradeHouse, person: Pick<Person, 'goods'>, at: { lifeId: string; day: number }, index?: number) {
  const jobs = stoveJobs(house);
  const i = index ?? jobs.findIndex(j => stoveStatus(j, at.lifeId, at.day) === 'ready');
  const job = jobs[i];
  if (!job || stoveStatus(job, at.lifeId, at.day) !== 'ready') return null;
  const r = TRADE.recipes[job.recipe];
  const owner: Owner = job.owner === 'person' && job.lifeId === at.lifeId ? 'person' : 'house';
  add(owner === 'person' ? person.goods : house.store, r.output, r.count);
  jobs[i] = null;
  saveJobs(house, jobs);
  return { kind: r.output, count: r.count, owner, index: i };
}

/** 疗伤：先用自己的，再用仓库的。返回用了谁的和回了几点 */
export function useHealing(house: Pick<House, 'store'>, person: Pick<Person, 'goods'>, kind: string) {
  const amount = TRADE.heal[kind];
  if (!amount) return null;
  for (const [owner, stock] of [['person', person.goods], ['house', house.store]] as const) {
    if ((stock[kind] ?? 0) > 0) { take(stock, kind, 1); return { owner: owner as Owner, amount }; }
  }
  return null;
}

// ---------------- 邻居托付 ----------------

/** 这一天会出现的那条托付（只看这一世和这一天，刷新不会变） */
export function offerFor(lifeId: string, day: number, neighbors: readonly string[]): Request | null {
  if (!neighbors.length) return null;
  const rng = stream(lifeId, day, 'request');
  const neighbor = rng.pick(neighbors);
  const kind = rng.pick(Object.keys(TRADE.request.wants));
  const [lo, hi] = TRADE.request.wants[kind]!;
  const count = rng.int(lo, hi);
  const pay = Math.round(GOODS[kind]! * count * TRADE.request.payRate);
  return { id: lifeId + '/r' + day, lifeId, day, neighbor, kind, count, pay, status: 'offered' };
}

/** 过期的托付标成 expired：不罚钱，不扣交情 */
export function refreshRequest(house: TradeHouse, lifeId: string, day: number): void {
  const r = house.request;
  if (r?.status === 'accepted' && (r.lifeId !== lifeId || day > r.dueDay!)) r.status = 'expired';
}

/** 集市里这一天看得到的：手上接着的那条，或者今天新出的那条 */
export function requestBoard(house: TradeHouse, lifeId: string, day: number, neighbors: readonly string[]) {
  refreshRequest(house, lifeId, day);
  const r = house.request;
  if (r?.status === 'accepted') return { active: r, offer: null };
  // 今天那条已经接过（交了或过期），今天就不再出新的
  if (r && r.lifeId === lifeId && r.day === day) return { active: null, offer: null };
  return { active: null, offer: offerFor(lifeId, day, neighbors) };
}

/** 接单：同时只能接一条，价钱在接单时定死 */
export function acceptRequest(house: TradeHouse, lifeId: string, day: number, neighbors: readonly string[]): Request | null {
  const { active, offer } = requestBoard(house, lifeId, day, neighbors);
  if (active || !offer) return null;
  house.request = { ...offer, status: 'accepted', acceptedDay: day, dueDay: day + TRADE.request.days - 1 };
  return house.request;
}

/** 交货时先用自己的，不够再用家里的 */
export function planDelivery(house: TradeHouse, person: Pick<Person, 'goods'>) {
  const r = house.request;
  if (!r || r.status !== 'accepted') return null;
  const mine = Math.min(person.goods[r.kind] ?? 0, r.count);
  const home = Math.min(house.store[r.kind] ?? 0, r.count - mine);
  return { person: mine, house: home, short: r.count - mine - home };
}

/** 交货：凑够才能交。钱按各自交了几件分别进钱袋和钱箱，交情 +5 */
export function deliverRequest(house: TradeHouse, person: Personal & Pick<Person, 'friends'>, at: { lifeId: string; day: number }) {
  refreshRequest(house, at.lifeId, at.day);
  const r = house.request;
  const plan = planDelivery(house, person);
  if (!r || !plan || plan.short > 0 || !positiveInt(r.count)) return null;
  take(person.goods, r.kind, plan.person);
  take(house.store, r.kind, plan.house);
  const purse = Math.floor(r.pay * plan.person / r.count);
  const chest = r.pay - purse;
  person.purse += purse;
  house.chest += chest;
  const T = TRADE.request;
  person.friends[r.neighbor] = Math.min(T.maxFriendship, (person.friends[r.neighbor] ?? 0) + T.friendship);
  r.status = 'done';
  return { purse, chest, friendship: T.friendship, neighbor: r.neighbor };
}
