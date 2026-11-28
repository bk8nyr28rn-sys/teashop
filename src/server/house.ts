import { autoLossLimit, defenseChance } from '../core/loop';
import { Rng } from '../core/rng';
import { addDays, daysBetween } from './clock';
import { SERVER } from './config';
import type { HouseDoc } from './model';
import type { Ctx } from './world';

/** 离开一段时间最多丢一次钱：上次丢钱以后有人守过夜，才能再丢 */
export function offlineLossAllowed(house: HouseDoc): boolean {
  return !house.lastOfflineLossDate
    || (house.lastGuardedDate !== null && house.lastGuardedDate > house.lastOfflineLossDate);
}

export function markGuarded(ctx: Ctx, house: HouseDoc): void {
  if (!house.guardedDates.includes(ctx.today)) house.guardedDates.push(ctx.today);
  house.lastGuardedDate = ctx.today;
}

/** 不在线时最多丢多少：房里真人里有一个不是第一世，第一世的保护就没了 */
export function houseLossLimit(ctx: Ctx, house: HouseDoc): number {
  const lifeNo = Math.max(0, ...ctx.realResidents(house).map(l => l.lifeNo));
  return autoLossLimit(house.chest, lifeNo);
}

/**
 * 有人打开这座房的时候，先把欠着的事补完：
 * ① 不在线的夜：按房算，一个现实日里房里的真人都没守过夜，就由机关守一次
 * ② 空位等了一个现实日没人来，先让 NPC 孩子占着
 */
export function touchHouse(ctx: Ctx, house: HouseDoc): void {
  const yesterday = addDays(ctx.today, -1);
  for (let date = addDays(house.settledThrough, 1); date <= yesterday; date = addDays(date, 1)) {
    const reals = ctx.realResidents(house);
    if (!reals.length || house.guardedDates.includes(date)) continue;
    const day = Math.max(...reals.map(l => l.person.day));
    const rng = new Rng(1);
    rng.setState(ctx.seed());
    const won = rng.chance(defenseChance(day, house.door, house.traps));
    const lost = !won && offlineLossAllowed(house) ? houseLossLimit(ctx, house) : 0;
    if (lost) {
      house.chest -= lost;
      house.lastOfflineLossDate = date;
      ctx.ledger(null, house.id, -lost, 0, `不在线的夜（${date}）`);
    }
    ctx.tell({ houseId: house.id }, 'offline', won ? `${date}：你们不在时，机关守住了家门。`
      : lost ? `${date}：你们不在时，机关没守住，钱箱少了 ${lost} 文。` : `${date}：你们不在时，机关没守住，好在钱一文没少。`);
  }
  if (house.settledThrough < yesterday) house.settledThrough = yesterday;
  house.guardedDates = house.guardedDates.filter(d => d > house.settledThrough).slice(-SERVER.keepGuardedDates);

  for (const cradle of house.cradles) {
    if (cradle.placeholder || daysBetween(cradle.openedDate, ctx.today) < SERVER.cradleWaitDays) continue;
    const bond = ctx.w.bonds[cradle.bondId];
    if (!bond) continue;
    cradle.placeholder = ctx.id('npc-kid');
    bond.kids.push(cradle.placeholder);
    ctx.tell({ houseId: house.id }, 'placeholder', '等了一天没人来投胎，先抱养了一个孩子。真人来了，会顶替这个孩子。');
  }
}
