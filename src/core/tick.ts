import { resolveKnock, rollKnock } from './defense';
import { dailyFamily, hourlyFamily } from './family';
import { dailyRivals } from './rivals';
import { dailyThreadUpdate, hourlyThreadUpdate } from './threads';
import type { House, World } from './types';
import { hourOfDay, isInRetreat } from './world';

/**
 * 推进一个小时（现实时间）。
 * isOnline 告诉规则这一小时谁在线：在线时收到预兆可以准备（#11），离线时自动守。
 */
export function advanceHour(world: World, isOnline: (house: House) => boolean = () => false): void {
  if (world.hour > 0 && hourOfDay(world.hour) === 0) daily(world);

  const nb = world.config.newbie;
  for (const house of world.houses.values()) {
    // 新手期练手小鬼：保护期里来一只很弱的野鬼，让玩家先赢一次
    const born = (house.protectedUntil ?? -Infinity) - nb.protectionDays * 24;
    if (world.hour === born + nb.practiceHour && !isInRetreat(world, house)) {
      resolveKnock(world, house.id, 'wild', isOnline(house), { strength: nb.practiceStrength });
      continue;
    }
    const kind = rollKnock(world, house);
    if (kind) resolveKnock(world, house.id, kind, isOnline(house));
  }
  hourlyThreadUpdate(world);
  hourlyFamily(world);
  world.hour++;
}

function daily(world: World): void {
  for (const house of world.houses.values()) {
    house.grudgeToday = 0;
    house.ward *= 1 - world.config.door.wardDecayPerDay;
  }
  dailyThreadUpdate(world);
  dailyRivals(world);
  dailyFamily(world);
}
