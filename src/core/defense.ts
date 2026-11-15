import { returnStrands } from './threads';
import type { GhostKind, House, HouseId, Result, Thread, World } from './types';
import { emit, fail, getHouse, isInRetreat, isProtected, ok, rankedThreads, spendAction, threadsOf } from './world';

/** 护宅大阵（门）当前的强度 */
export function doorPower(world: World, house: House): number {
  const d = world.config.door;
  let cultivation = 0;
  for (const m of house.members) if (m.injuredUntil <= world.hour) cultivation += m.cultivation;
  // 回报递减：最浓的线全额，其余依次打折
  let strands = 0;
  for (const { thread, weight } of rankedThreads(world, house.id)) strands += thread.strands * weight;
  const formation = Math.max(0, house.formationLevel - house.formationDamage);
  return (
    d.base +
    house.realm * d.perRealm +
    cultivation * d.perMemberCultivation +
    strands * d.perStrand +
    formation * d.perFormationLevel +
    house.ward
  );
}

/** #7 每次守宅最多一位搭档来帮：选红线最浓的那根 */
export function pickHelper(world: World, houseId: HouseId): Thread | null {
  let best: Thread | null = null;
  for (const t of threadsOf(world, houseId)) if (!best || t.strands > best.strands) best = t;
  return best && best.strands > 0 ? best : null;
}

/**
 * #11 这一小时有没有鬼来砸门（在线、离线都可能）。
 * 闭关期间（#5 #21）、劫后余生期间（#8）和新手保护期内不来。一小时最多一次，怨灵优先。
 */
export function rollKnock(world: World, house: House): GhostKind | null {
  if (isInRetreat(world, house) || house.graceActionsLeft > 0 || isProtected(world, house)) return null;
  const g = world.config.ghosts;
  if (house.grudge > 0) {
    const p = Math.min(g.spiritMaxPerHour, house.grudge * g.spiritPerHourPerGrudge);
    if (world.rng.chance(p)) return 'spirit';
  }
  return world.rng.chance(g.wildPerHour) ? 'wild' : null;
}

/** 结算一次砸门。离线时由符阵、族人和搭档快照自动守（#11） */
export function resolveKnock(
  world: World,
  houseId: HouseId,
  kind: GhostKind,
  online: boolean,
  opts: { strength?: number } = {},
): void {
  const house = getHouse(world, houseId);
  const g = world.config.ghosts;
  const c = world.config.conversion;
  const omen = kind === 'spirit' && house.grudge >= g.omenGrudge;
  emit(world, { type: 'knock', hour: world.hour, house: houseId, kind, online, omen });

  // 怨灵从怨丝池里带走一块怨丝
  const chunk = kind === 'spirit' ? Math.min(house.grudge, g.spiritChunk) : 0;
  house.grudge -= chunk;
  const helper = pickHelper(world, houseId);

  // 被感化过的怨灵留下来帮忙守门
  if (house.guardianKnocks > 0) {
    house.guardianKnocks--;
    if (kind === 'wild') house.ghostHearts++;
    else returnStrands(world, houseId, chunk * defeatRatio(world, chunk), helper);
    emit(world, { type: 'guarded', hour: world.hour, house: houseId, kind });
    return;
  }

  // 感化：守宅的两人之间红线够浓，不打也能赢；怨丝化回情丝，比打散多，但不掉诡心
  if (kind === 'spirit' && helper && helper.strands >= c.purifyThreshold) {
    const returned = chunk * c.purifyReturn;
    returnStrands(world, houseId, returned, helper);
    house.guardianKnocks += c.purifiedGuardKnocks;
    emit(world, { type: 'purified', hour: world.hour, house: houseId, helper: helper.id, strandsReturned: returned });
    return;
  }

  const strength =
    opts.strength ??
    (kind === 'wild'
      ? g.wildBaseStrength + house.realm * g.wildStrengthPerRealm
      : g.spiritBaseStrength + chunk * g.spiritStrengthPerGrudge);
  const power =
    doorPower(world, house) +
    (helper ? helper.strands * world.config.door.helperPerStrand : 0) +
    (omen && online ? g.omenPrepBonus : 0);

  if (world.rng.chance(power / (power + strength))) {
    let returned = 0;
    if (kind === 'wild') {
      house.ghostHearts++;
    } else {
      returned = chunk * defeatRatio(world, chunk);
      returnStrands(world, houseId, returned, helper);
    }
    emit(world, { type: 'defended', hour: world.hour, house: houseId, kind, helper: helper?.id ?? null, strandsReturned: returned });
    return;
  }

  // 输了：怨丝回到池子里（没能转回情丝），门被砸破
  house.grudge += chunk;
  applyBreach(world, house, kind, online);
}

/** 怨灵越强，打散后还原得越多 */
function defeatRatio(world: World, chunk: number): number {
  const c = world.config.conversion;
  return c.defeatReturnBase + (c.defeatReturnPerChunk * chunk) / world.config.ghosts.spiritChunk;
}

/** #8 门被砸破：损灵石（有上限）+ 一位族人疗伤 + 阵法受损 + 族人可能掉修为；然后进入劫后余生 */
export function applyBreach(world: World, house: House, kind: GhostKind, online: boolean): void {
  const b = world.config.breach;
  const stonesLost = Math.min(b.stoneLossCap, Math.floor(house.stones * b.stoneLossRatio));
  house.stones -= stonesLost;

  const healthy = house.members.filter((m) => m.injuredUntil <= world.hour);
  if (healthy.length > 0) world.rng.pick(healthy).injuredUntil = world.hour + b.injuryDays * 24;

  house.formationDamage = Math.min(house.formationLevel, house.formationDamage + b.formationDamage);

  if (house.members.length > 0 && world.rng.chance(b.cultivationLossChance)) {
    const m = world.rng.pick(house.members);
    m.cultivation = Math.max(0, m.cultivation - b.cultivationLoss);
  }
  // 当家人（house.realm）永远不掉修为，族人不会永久死亡
  house.graceActionsLeft = b.graceActions;
  emit(world, { type: 'breach', hour: world.hour, house: house.id, kind, online, stonesLost });
}

// ---- 玩家行动（每次都算一次行动，劫后余生按它倒数） ----

/** 收打坐产出：灵石和当家人的修为进度。返回收到的灵石 */
export function collectMeditation(world: World, houseId: HouseId): number {
  const house = getHouse(world, houseId);
  spendAction(house);
  const elapsed = world.hour - house.lastMeditationCollect;
  const gained = elapsed * world.config.economy.meditationPerHour;
  house.stones += gained;
  house.cultivationProgress += elapsed * world.config.tribulation.progressPerHour;
  house.lastMeditationCollect = world.hour;
  return gained;
}

/** 当前境界突破到下一境界需要的修为进度 */
export function tribulationRequirement(world: World, house: House): number {
  const t = world.config.tribulation;
  return t.progressBase * Math.pow(house.realm, t.progressExponent);
}

export function canAttemptTribulation(world: World, houseId: HouseId): Result {
  const house = getHouse(world, houseId);
  if (house.cultivationProgress < tribulationRequirement(world, house)) return fail('修为进度还没攒满');
  if (house.tribulationCooldownUntil > world.hour) return fail('上次渡劫失败，还在冷却');
  return ok();
}

/** 破境丹：诡心炼成，渡劫时吃一颗加胜算 */
export function brewBreakthroughPill(world: World, houseId: HouseId): Result {
  const house = getHouse(world, houseId);
  const cost = world.config.economy.breakthroughPillHearts;
  if (house.ghostHearts < cost) return fail('诡心不够');
  spendAction(house);
  house.ghostHearts -= cost;
  house.breakthroughPills++;
  return ok();
}

/** 渡劫的胜算和各项加成（界面显示和实际结算用同一份） */
export function tribulationOdds(
  world: World,
  houseId: HouseId,
  opts: { usePill?: boolean; helperThreadId?: string } = {},
): { door: number; helper: Thread | null; helperBonus: number; usePill: boolean; pillBonus: number; power: number; strength: number; chance: number } {
  const house = getHouse(world, houseId);
  const t = world.config.tribulation;
  const usePill = (opts.usePill ?? true) && house.breakthroughPills > 0;
  const helper = opts.helperThreadId
    ? threadsOf(world, houseId).find((x) => x.id === opts.helperThreadId) ?? null
    : pickHelper(world, houseId);
  const door = doorPower(world, house);
  const helperBonus = helper ? helper.strands * world.config.door.helperPerStrand : 0;
  const pillBonus = usePill ? t.pillBonus : 0;
  const power = door + helperBonus + pillBonus;
  const strength = t.bossBaseStrength + house.realm * t.bossStrengthPerRealm;
  return { door, helper, helperBonus, usePill, pillBonus, power, strength, chance: power / (power + strength) };
}

/**
 * 渡劫：玩家自选时机发起，打赢一只大鬼（野鬼）才算突破。
 * 可以叫一位搭档护法（默认红线最浓的那位），可以吃破境丹。
 * 成功：境界 +1，掉诡心。失败：按门被砸破处理，冷却几天，修为进度保留，当家人不掉境界。
 */
export function attemptTribulation(
  world: World,
  houseId: HouseId,
  opts: { usePill?: boolean; helperThreadId?: string } = {},
): Result<{ success: boolean }> {
  const check = canAttemptTribulation(world, houseId);
  if (!check.ok) return check;
  const house = getHouse(world, houseId);
  const t = world.config.tribulation;
  const odds = tribulationOdds(world, houseId, opts);
  const usePill = odds.usePill;
  spendAction(house);
  if (usePill) house.breakthroughPills--;
  const success = world.rng.chance(odds.chance);

  if (success) {
    house.cultivationProgress -= tribulationRequirement(world, house);
    house.realm++;
    house.ghostHearts += t.heartsReward;
  } else {
    house.tribulationCooldownUntil = world.hour + t.cooldownDays * 24;
    applyBreach(world, house, 'wild', true);
  }
  emit(world, { type: 'tribulation', hour: world.hour, house: houseId, success, realm: house.realm, usedPill: usePill });
  return { ok: true, value: { success } };
}

export function formationUpgradeCost(world: World, house: House): number {
  const e = world.config.economy;
  return e.formationUpgradeBaseCost * Math.pow(house.formationLevel, e.formationCostExponent);
}

export function upgradeFormation(world: World, houseId: HouseId): Result {
  const house = getHouse(world, houseId);
  if (house.formationDamage > 0) return fail('先把阵法修好');
  const cost = formationUpgradeCost(world, house);
  if (house.stones < cost) return fail('灵石不够');
  spendAction(house);
  house.stones -= cost;
  house.formationLevel++;
  return ok();
}

/** 修阵法，灵石不够时能修多少修多少 */
export function repairFormation(world: World, houseId: HouseId): Result<number> {
  const house = getHouse(world, houseId);
  if (house.formationDamage <= 0) return fail('阵法没有受损');
  const per = world.config.economy.repairCostPerDamage;
  const fixed = Math.min(house.formationDamage, Math.floor(house.stones / per));
  if (fixed <= 0) return fail('灵石不够');
  spendAction(house);
  house.stones -= fixed * per;
  house.formationDamage -= fixed;
  return { ok: true, value: fixed };
}

/** 第一版最简炼丹：诡心炼成疗伤丹，让一位疗伤中的族人立刻恢复 */
export function brewHealingPill(world: World, houseId: HouseId): Result {
  const house = getHouse(world, houseId);
  const cost = world.config.economy.healingPillHearts;
  const injured = house.members.find((m) => m.injuredUntil > world.hour);
  if (!injured) return fail('没有族人在疗伤');
  if (house.ghostHearts < cost) return fail('诡心不够');
  spendAction(house);
  house.ghostHearts -= cost;
  injured.injuredUntil = world.hour;
  return ok();
}
