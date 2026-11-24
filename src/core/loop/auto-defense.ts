import { Rng } from '../rng';
import { CFG } from './base';
import { DOORS, NIGHT, TRAPS, waveCounts } from './night-config';
import { sameNight, type NightPlan, type NightReceipt } from './settlement';
import type { House } from './state';

export const AUTO_DEFENSE = {
  floor: 0.05, ceiling: 0.95, startingScore: -0.96,
  door: 1.5, crossbow: 0.85, lamp: 0.24, talisman: 0.48,
  day: 0.17, daySquared: 0.065, lossFraction: 0.1, lossCap: 20,
  paperShare: 0.5, heldKarma: 8, brokenKarma: 4, coinsPerKarma: 20, estateKarmaCap: 20,
} as const;

type Traps = Partial<House['traps']>;
const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const;

function level(value: number | undefined, maximum: number): number {
  return Math.min(maximum, Math.max(0, Math.floor(value ?? 0)));
}

/** 门用院子里的档位编号，强度取对应门血。已安装的机关在第一晚也生效。 */
export function defenseChance(day: number, door: number, traps: Traps): number {
  const c = AUTO_DEFENSE;
  const elapsed = Math.max(0, day - 1);
  const hp = DOORS[level(door, DOORS.length - 1)]!.hp;
  const defense = c.startingScore + c.door * Math.log(hp / DOORS[0].hp)
    + c.crossbow * level(traps.crossbow, TRAPS.crossbow.max)
    + c.lamp * level(traps.lamp, TRAPS.lamp.max)
    + c.talisman * level(traps.talisman, TRAPS.talisman.max);
  const threat = c.day * elapsed + c.daySquared * elapsed ** 2;
  return c.floor + (c.ceiling - c.floor) / (1 + Math.exp(threat - defense));
}

export function chanceLabel(probability: number): string {
  if (probability <= 0) return '零成';
  if (probability >= 1) return '十成';
  return digits[Math.max(1, Math.min(9, Math.round(probability * 10)))] + '成';
}

export function autoLossLimit(chest: number, lifeNo: number): number {
  return lifeNo <= 1 ? 0 : Math.min(AUTO_DEFENSE.lossCap, Math.floor(Math.max(0, chest) * AUTO_DEFENSE.lossFraction));
}

/** 家业是同一项：守住、亲手破门及经营收入先合算，再封顶。 */
export function nightKarma(held: number, autoHeld = 0, broken = 0, earned = 0): number {
  const c = AUTO_DEFENSE;
  const heldScore = (held - Math.min(held, autoHeld) / 2) * c.heldKarma;
  return Math.min(c.estateKarmaCap, heldScore - broken * c.brokenKarma + Math.floor(earned / c.coinsPerKarma));
}

export interface AutoNightOptions {
  mode: 'delegated' | 'offline';
  seed: number;
  nightId: number;
  guardian?: boolean;
  allowLoss: boolean;
  progress: boolean;
  realDate: string;
  houseId?: string;
  lifeId?: string;
  day?: number;
}

export interface AutoNightReceipt extends NightReceipt {
  mode: AutoNightOptions['mode'];
  realDate: string;
  seed: number;
  chance: number;
}

export interface AutoNightGame {
  houseId: string;
  lifeId: string;
  lifeNo: number;
  nightId: number;
  day: number;
  door: number;
  traps: Traps;
  chest: number;
  purse: number;
  held: number;
  broken: number;
  autoHeld?: number;
  autoBroken?: number;
  phase: string;
  nightPlan: NightPlan | null;
  nightReceipt?: NightReceipt | null;
  receipts: Record<string, NightReceipt>;
  allFeatures?: boolean;
  afterlife?: unknown;
}

function isAutoReceipt(receipt: NightReceipt): receipt is AutoNightReceipt {
  return 'mode' in receipt && (receipt.mode === 'delegated' || receipt.mode === 'offline');
}

/** 只查当晚五波的数量表。每只鬼按亲手打散的基础纸钱折半，不模拟战斗或本事。 */
export function paperReward(day: number, guided: boolean): number {
  let ghosts = 0;
  for (let wave = 0; wave < NIGHT.waves; wave++) {
    for (const count of Object.values(waveCounts(day, wave, guided))) ghosts += count;
  }
  return Math.floor(ghosts * NIGHT.weapon.playerCoins * AUTO_DEFENSE.paperShare);
}

/** 接受已登记的守夜，也能直接登记新夜。调用方持存档锁提交回执、余额及夜号。 */
export function settleAutoNight(game: AutoNightGame, options: AutoNightOptions): AutoNightReceipt | null {
  const { mode, nightId, realDate, progress } = options;
  const guardian = options.guardian ?? false;
  if ((options.houseId !== undefined && options.houseId !== game.houseId)
    || (options.lifeId !== undefined && options.lifeId !== game.lifeId)) return null;
  const prior = game.receipts[nightId];
  if (prior) {
    return isAutoReceipt(prior) && prior.houseId === game.houseId && prior.lifeId === game.lifeId
      && prior.guardian === guardian && prior.mode === mode && prior.realDate === realDate
      && (options.day === undefined || prior.day === options.day) ? prior : null;
  }
  if (!Number.isSafeInteger(nightId) || (options.day !== undefined && options.day !== game.day)) return null;
  const plan = game.nightPlan;
  const fightPhase = guardian ? 'guard' : 'night';
  if (plan) {
    if (!progress || game.phase !== fightPhase || game.nightId !== nightId
      || !sameNight(plan, { ...game, guardian, nightId })) return null;
  } else if (nightId !== game.nightId + 1) return null;
  if (progress && (game.nightReceipt || (game.phase !== fightPhase && (guardian || game.phase !== 'home')))) return null;

  const day = guardian ? CFG.lifeDays : game.day;
  const chance = defenseChance(day, game.door, game.traps);
  const seed = (plan?.seed ?? options.seed) >>> 0;
  const rng = new Rng(1);
  rng.setState(seed);
  const won = rng.chance(chance);
  const chestLost = !won && options.allowLoss ? autoLossLimit(game.chest, game.lifeNo) : 0;
  const earnedMoney = won && mode === 'delegated' ? paperReward(day, !guardian && !game.allFeatures) : 0;
  const subject = mode === 'offline' ? '你不在时，机关' : '机关';
  let report: string;
  if (won && mode === 'offline') report = '你不在时，机关守住了家门。';
  else if (won) report = `${subject}守住了家门，${earnedMoney} 文纸钱已放进钱袋。`;
  else if (game.lifeNo <= 1) report = `${subject}没守住，好在新家有保护，没丢东西。`;
  else if (chestLost > 0) report = `${subject}没守住，钱箱少了 ${chestLost} 文。`;
  else report = `${subject}没守住，钱箱里的钱一文没少。`;
  const receipt: AutoNightReceipt = {
    houseId: game.houseId, lifeId: game.lifeId, nightId, day: game.day, guardian, mode, realDate, seed, chance, won,
    earnedMoney, chestLost, purseLost: 0, lostTreasureIndex: null, lostTreasure: null,
    next: guardian ? 'reborn' : game.day >= CFG.lifeDays ? 'old' : 'morning', paragraphs: [report],
  };
  game.chest -= chestLost;
  game.purse += earnedMoney;
  if (won) {
    game.held++;
    game.autoHeld = (game.autoHeld ?? 0) + 1;
  } else game.autoBroken = (game.autoBroken ?? 0) + 1;
  game.nightId = nightId;
  game.receipts[nightId] = receipt;
  if (progress) {
    if (guardian) game.afterlife = { kind: 'guard', won, automatic: true };
    game.nightPlan = null;
    game.nightReceipt = receipt;
    game.phase = 'dawn';
  }
  return receipt;
}
