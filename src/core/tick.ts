import { resolveKnock, rollKnock } from './defense';
import { dailyFamily, hourlyFamily } from './family';
import { dailyThreadUpdate } from './threads';
import type { House, World } from './types';
import { hourOfDay } from './world';

/**
 * 推进一个小时（现实时间）。
 * isOnline 告诉规则这一小时谁在线：在线时收到预兆可以准备（#11），离线时自动守。
 */
export function advanceHour(world: World, isOnline: (house: House) => boolean = () => false): void {
  if (world.hour > 0 && hourOfDay(world.hour) === 0) daily(world);

  for (const house of world.houses.values()) {
    const kind = rollKnock(world, house);
    if (kind) resolveKnock(world, house.id, kind, isOnline(house));
  }
  hourlyFamily(world);
  world.hour++;
}

function daily(world: World): void {
  for (const house of world.houses.values()) {
    house.grudgeToday = 0;
    house.ward *= 1 - world.config.door.wardDecayPerDay;
  }
  dailyThreadUpdate(world);
  dailyFamily(world);
}
