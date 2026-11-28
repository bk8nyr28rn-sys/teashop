import { hauntBash, hauntDodge, hauntOutcome, hauntStep, HAUNT, startHaunt, type HauntState } from '../core/loop';
import { SERVER } from './config';
import { houseLossLimit, offlineLossAllowed, touchHouse } from './house';
import type { Life, RaidDoc } from './model';
import { fail, type Ctx } from './world';

/** 当厉鬼的记录：第几步之前点了砸门还是躲 */
export type HauntLog = Array<[call: number, actions: Array<'bash' | 'dodge'>]>;

export function replayHaunt(seed: number, tier: number, log: HauntLog): HauntState {
  const h = startHaunt(seed, tier);
  const byCall = new Map<number, Array<'bash' | 'dodge'>>();
  for (const [call, actions] of log) {
    if (!Number.isSafeInteger(call) || call < 0 || !Array.isArray(actions)) fail('砸门记录格式不对');
    byCall.set(call, [...(byCall.get(call) ?? []), ...actions]);
  }
  const calls = Math.ceil(HAUNT.time / SERVER.hauntStep) + 2;
  for (let call = 0; call < calls && !h.over; call++) {
    for (const action of byCall.get(call) ?? []) {
      if (action === 'bash') hauntBash(h);
      else hauntDodge(h);
    }
    hauntStep(h, SERVER.hauntStep);
  }
  return h;
}

/**
 * 老死以后选当厉鬼：服务器挑一座真人的房（不是自己家族的、今天没来过厉鬼、有人住），
 * 按那座房当时的门定强弱。没有能去的房，就照单机那样打一户 NPC 人家
 */
export function raidBegin(ctx: Ctx, ghost: Life) {
  if (ghost.phase !== 'dead' || ghost.afterlife) fail('现在不能当厉鬼');
  if (Object.values(ctx.w.raids).some(r => r.ghostLifeId === ghost.id)) fail('已经去过了');
  const targets = Object.values(ctx.w.houses).filter(h => !h.abandoned && h.clanId !== ghost.clanId
    && h.lastRaidDate !== ctx.today && ctx.realResidents(h).length);
  if (!targets.length) return { raidId: null };
  const house = ctx.pick(targets);
  touchHouse(ctx, house);
  house.lastRaidDate = ctx.today;
  const raid: RaidDoc = { id: ctx.id('raid'), ghostLifeId: ghost.id, houseId: house.id, realDate: ctx.today,
    seed: ctx.seed(), tier: Math.min(HAUNT.tiers[1], Math.max(HAUNT.tiers[0], house.door)), status: 'open' };
  ctx.w.raids[raid.id] = raid;
  return { raidId: raid.id, seed: raid.seed, tier: raid.tier, houseName: house.name };
}

/** 打完交记录。被砸的那座房：最多丢 20 文、不丢宝物（暂定，第四节第 3 条）；厉鬼的战利品是新生成的 */
export function raidEnd(ctx: Ctx, ghost: Life, raidId: string, log: HauntLog) {
  const raid = ctx.w.raids[raidId];
  if (!raid || raid.ghostLifeId !== ghost.id || raid.status !== 'open') fail('没有这一趟');
  const h = replayHaunt(raid.seed, raid.tier, log);
  const outcome = hauntOutcome(h);
  ghost.afterlife = outcome;
  const house = ctx.house(raid.houseId);
  touchHouse(ctx, house);
  let lost = 0;
  if (outcome.won && offlineLossAllowed(house)) {
    lost = houseLossLimit(ctx, house);
    if (lost) {
      house.chest -= lost;
      house.lastOfflineLossDate = ctx.today;
      ctx.ledger(null, house.id, -lost, 0, `${ghost.name}的厉鬼`);
    }
  }
  ctx.tell({ houseId: house.id }, 'raid', outcome.won
    ? `${ghost.name}的厉鬼砸开了门。` + (lost ? `钱箱少了 ${lost} 文，宝物一件没丢。` : '钱和宝物一样没少。')
    : `${ghost.name}的厉鬼来砸门，被赶跑了。`);
  raid.status = 'settled';
  raid.won = !!outcome.won;
  raid.chestLost = lost;
  return { won: !!outcome.won, caught: !!outcome.caught, chestLost: lost, loot: outcome.loot ?? null };
}
