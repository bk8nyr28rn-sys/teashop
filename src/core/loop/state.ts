import { CFG } from './base';

export type Item = 'sword' | 'bow' | 'lamp';
export interface Treasure { n: string; v: number }
export type Loot = { n: string; v?: number; tre?: false } | (Treasure & { tre: true });

export const FIRST_PERSON = { power: 1.05, friends: { wang: 26, li: 8, zhao: 0 } } as const;

export interface House {
  door: number;
  traps: { crossbow: number; lamp: number; talisman: number };
  chest: number;
  store: Record<string, number>;
  treasures: Treasure[];
}

export interface Person {
  day: number;
  time: number;
  hp: number;
  bag: Loot[];
  purse: number;
  goods: Record<string, number>;
  personalTreasures: Treasure[];
  item: Item;
  power: number;
  friends: Record<string, number>;
}

export function makeHouse(): House {
  return { door: 0, traps: { crossbow: 0, lamp: 0, talisman: 0 }, chest: 0, store: {}, treasures: [] };
}

export function makePerson(): Person {
  return {
    day: 1, time: CFG.dayStart, hp: CFG.hpMax, bag: [], purse: 0, goods: {}, personalTreasures: [], item: 'sword',
    power: FIRST_PERSON.power, friends: { ...FIRST_PERSON.friends },
  };
}
