import type { House, Person, Treasure } from './state';

export const GOODS: Readonly<Record<string, number>> = { 柴: 3, 时蔬: 5, 草药: 6, 兽皮: 14, 铁矿: 18, 古物: 40 };
export const FIREWOOD_PER_LOG = 7;
export type Owner = 'person' | 'house';
type Home = Pick<House, 'chest' | 'store' | 'treasures'>;
type Personal = Pick<Person, 'purse' | 'goods' | 'personalTreasures'>;
type Stock = Record<string, number>;

function positiveInt(n: number): boolean {
  return Number.isSafeInteger(n) && n > 0;
}

function takeGoods(stock: Stock, kind: string, count: number): boolean {
  const available = stock[kind] ?? 0;
  if (!positiveInt(count) || count > available) return false;
  if (count === available) delete stock[kind];
  else stock[kind] = available - count;
  return true;
}

export function unpackBag(person: Pick<Person, 'bag' | 'goods' | 'personalTreasures'>): void {
  for (const item of person.bag) {
    if (item.tre) person.personalTreasures.push({ n: item.n, v: item.v });
    else person.goods[item.n] = (person.goods[item.n] ?? 0) + 1;
  }
  person.bag = [];
}

export function splitFirewood(person: Pick<Personal, 'goods'>): number {
  person.goods.柴 = (person.goods.柴 ?? 0) + FIREWOOD_PER_LOG;
  return FIREWOOD_PER_LOG;
}

export function goodsValue(stock: Stock): number {
  return Object.entries(stock).reduce((sum, [kind, count]) => sum + (GOODS[kind] ?? 0) * count, 0);
}

function creditSale(house: Home, person: Personal, owner: Owner, value: number) {
  if (owner === 'house') house.chest += value;
  else person.purse += value;
}

export function sellOrdinary(house: Home, person: Personal, owner: Owner, kind: string, quantity: number | 'all'): number {
  const stock = owner === 'house' ? house.store : person.goods;
  const count = quantity === 'all' ? stock[kind] ?? 0 : quantity;
  const price = GOODS[kind];
  if (!price || !takeGoods(stock, kind, count)) return 0;
  const value = price * count;
  creditSale(house, person, owner, value);
  return value;
}

export function sellAllOrdinary(house: Home, person: Personal, owner: Owner): number {
  const stock = owner === 'house' ? house.store : person.goods;
  return Object.keys(stock).reduce((sum, kind) => sum + sellOrdinary(house, person, owner, kind, 'all'), 0);
}

export function sellTreasure(house: Home, person: Personal, owner: Owner, index: number): Treasure | null {
  const treasures = owner === 'house' ? house.treasures : person.personalTreasures;
  const item = treasures[index];
  if (!Number.isInteger(index) || !item) return null;
  treasures.splice(index, 1);
  creditSale(house, person, owner, item.v);
  return item;
}

export function shelveTreasure(house: Home, person: Personal, index: number): boolean {
  const item = person.personalTreasures[index];
  if (!Number.isInteger(index) || !item) return false;
  person.personalTreasures.splice(index, 1);
  house.treasures.push(item);
  return true;
}

export function storeBelongings(house: Home, person: Personal): void {
  for (const [kind, count] of Object.entries(person.goods)) {
    house.store[kind] = (house.store[kind] ?? 0) + count;
  }
  person.goods = {};
  house.treasures.push(...person.personalTreasures);
  person.personalTreasures = [];
}

export function depositCoins(house: Pick<Home, 'chest'>, person: Pick<Personal, 'purse'>, amount: number): boolean {
  if (!payPersonal(person, amount)) return false;
  house.chest += amount;
  return true;
}

export function settleEstate(house: Home, person: Personal): void {
  depositCoins(house, person, person.purse);
  storeBelongings(house, person);
}

export function quoteHome(house: Pick<Home, 'chest'>, person: Pick<Personal, 'purse'>, cost: number) {
  if (!positiveInt(cost)) throw new RangeError('家用价格应为正整数');
  const chest = Math.min(house.chest, cost);
  const purse = Math.min(person.purse, cost - chest);
  return { chest, purse, shortfall: cost - chest - purse };
}

export function payHome(house: Pick<Home, 'chest'>, person: Pick<Personal, 'purse'>, cost: number) {
  const payment = quoteHome(house, person, cost);
  if (payment.shortfall) return null;
  house.chest -= payment.chest;
  person.purse -= payment.purse;
  return payment;
}

export function payPersonal(person: Pick<Personal, 'purse'>, cost: number): boolean {
  if (!positiveInt(cost) || person.purse < cost) return false;
  person.purse -= cost;
  return true;
}

export function givePersonalGood(person: Pick<Personal, 'goods'>, kind: string): boolean {
  return takeGoods(person.goods, kind, 1);
}

export function useHerb(house: Pick<Home, 'store'>, person: Pick<Personal, 'goods'>): Owner | null {
  if (takeGoods(person.goods, '草药', 1)) return 'person';
  return takeGoods(house.store, '草药', 1) ? 'house' : null;
}
