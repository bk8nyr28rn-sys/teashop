import type { GrudgeSource, HouseId, World } from './types';
import { emit, getHouse } from './world';

/**
 * 往一家的怨丝池里加新生的怨丝。
 * #12 每天新生的怨丝有上限，超出的部分直接散掉。返回实际加进去的量。
 */
export function addGrudge(world: World, houseId: HouseId, amount: number, source: GrudgeSource): number {
  if (amount <= 0) return 0;
  const house = getHouse(world, houseId);
  const room = Math.max(0, world.config.grudge.dailyCap - house.grudgeToday);
  const added = Math.min(amount, room);
  house.grudge += added;
  house.grudgeToday += added;
  emit(world, { type: 'grudgeAdded', hour: world.hour, house: houseId, amount: added, dissipated: amount - added, source });
  return added;
}
