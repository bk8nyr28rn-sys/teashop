import { Rng } from '../rng';
import { CFG } from './base';
import type { Treasure } from './state';

export interface NightLootPlan {
  seed: number;
  purseTenths: number;
  chestTenths: number;
  treasureIndex: number | null;
  treasure: Treasure | null;
}

interface NightKey {
  houseId: string;
  lifeId: string;
  day: number;
  guardian: boolean;
  nightId: number;
}

export type NightPlan = NightKey & NightLootPlan;
interface NightAssets { purse: number; chest: number; treasures: Treasure[] }
interface BattleEnd { won: boolean; kills: number; coins: number }

export function planNightLoot(seed: number, shelf: readonly Treasure[]): NightLootPlan {
  // 掉宝独立取流；打斗、捏脸、刷新都不会推进这条随机流。
  const rng = new Rng(seed ^ 0xa511e9b3);
  const purseTenths = rng.int(2, 4);
  const chestTenths = rng.int(0, 2);
  const treasureIndex = shelf.length ? rng.int(0, shelf.length - 1) : null;
  return { seed: seed >>> 0, purseTenths, chestTenths, treasureIndex,
    treasure: treasureIndex === null ? null : { ...shelf[treasureIndex]! } };
}

export function nightPayout(plan: NightLootPlan, assets: NightAssets, won: boolean, coins: number) {
  let index = -1;
  if (!won && plan.treasure && plan.treasureIndex !== null) {
    const planned = plan.treasure;
    const same = (t: Treasure | undefined) => t?.n === planned.n && t.v === planned.v;
    index = same(assets.treasures[plan.treasureIndex]) ? plan.treasureIndex : assets.treasures.findIndex(same);
  }
  return {
    earnedMoney: won ? coins : 0,
    purseLost: won ? 0 : Math.floor(assets.purse * plan.purseTenths / 10),
    chestLost: won ? 0 : Math.floor(assets.chest * plan.chestTenths / 10),
    lostTreasureIndex: index < 0 ? null : index,
    lostTreasure: index < 0 ? null : { ...assets.treasures[index]! },
  };
}

export interface NightReceipt extends NightKey, ReturnType<typeof nightPayout> {
  won: boolean;
  next: 'morning' | 'old' | 'reborn';
  paragraphs: string[];
}

interface NightLedger extends NightAssets {
  houseId: string;
  lifeId: string;
  nightId: number;
  day: number;
  phase: string;
  nightPlan: NightPlan | null;
  nightReceipt?: NightReceipt | null;
  receipts: Record<string, NightReceipt>;
  afterlife: unknown;
  held: number;
  broken: number;
  kills: number;
}

export function sameNight(a: NightKey, b: NightKey): boolean {
  return a.houseId === b.houseId && a.lifeId === b.lifeId && a.nightId === b.nightId
    && a.day === b.day && a.guardian === b.guardian;
}

/** 开战登记和最终收据都由调用方在同一存档锁下持久化。 */
export function beginNightLedger(game: NightLedger, guardian: boolean, seed: number): NightPlan | null {
  const phase = guardian ? 'guard' : 'night';
  if (game.nightReceipt) return null;
  if (game.nightPlan) {
    const plan = game.nightPlan;
    return game.phase === phase && sameNight(plan, { ...game, guardian }) ? plan : null;
  }
  // v2/v3 打到一半的档还没有预抽结果。第一次恢复时补登，此后直接沿用。
  if (game.phase !== phase && game.phase !== (guardian ? 'death' : 'home')) return null;
  const plan = { houseId: game.houseId, lifeId: game.lifeId, day: game.day, guardian,
    nightId: game.nightId + 1, ...planNightLoot(seed, game.treasures) };
  game.nightId = plan.nightId;
  game.nightPlan = plan;
  game.phase = phase;
  return plan;
}

/** 同一请求重试返回家中原件；已换世、换相或已天亮时不会改动新的进度。 */
export function settleNightLedger(game: NightLedger, expected: NightKey, battle: BattleEnd,
  describe: (receipt: NightReceipt) => string[]): NightReceipt | null {
  const prior = game.receipts[expected.nightId];
  if (prior && sameNight(prior, expected)) return prior;
  const plan = game.nightPlan;
  if (!plan || !sameNight(plan, expected) || !sameNight(plan, { ...game, guardian: expected.guardian })
      || game.phase !== (plan.guardian ? 'guard' : 'night') || game.nightReceipt) return null;
  const payout = nightPayout(plan, game, battle.won, battle.coins);
  const receipt: NightReceipt = {
    houseId: plan.houseId, lifeId: plan.lifeId, nightId: plan.nightId, day: plan.day, guardian: plan.guardian,
    won: battle.won, ...payout, paragraphs: [],
    next: plan.guardian ? 'reborn' : game.day >= CFG.lifeDays ? 'old' : 'morning',
  };
  receipt.paragraphs = describe(receipt);
  game.purse += receipt.earnedMoney - receipt.purseLost;
  game.chest -= receipt.chestLost;
  if (receipt.lostTreasureIndex !== null) game.treasures.splice(receipt.lostTreasureIndex, 1);
  if (battle.won) game.kills += battle.kills;
  if (plan.guardian) game.afterlife = { kind: 'guard', won: battle.won };
  else if (battle.won) game.held++;
  else game.broken++;
  game.receipts[plan.nightId] = receipt;
  game.nightReceipt = receipt;
  game.nightPlan = null;
  game.phase = 'dawn';
  return receipt;
}
