import { mergeConfig, type DeepPartial, type GameConfig } from './config';
import { Rng } from './rng';
import type { GameEvent, House, HouseId, Openness, Result, Thread, World } from './types';

export const HOURS_PER_DAY = 24;

export function createWorld(
  opts: { seed?: number; config?: DeepPartial<GameConfig>; recordEvents?: boolean } = {},
): World {
  return {
    hour: 0,
    houses: new Map(),
    threads: new Map(),
    threadsByHouse: new Map(),
    heirs: new Map(),
    config: mergeConfig(opts.config),
    rng: new Rng(opts.seed ?? 1),
    events: [],
    recordEvents: opts.recordEvents ?? true,
    listener: null,
    nextId: 1,
  };
}

export function newId(world: World, prefix: string): string {
  return `${prefix}${world.nextId++}`;
}

export function emit(world: World, event: GameEvent): void {
  if (world.recordEvents) world.events.push(event);
  world.listener?.(event);
}

export function addHouse(
  world: World,
  init: { id?: HouseId; openness?: Openness; isMinor?: boolean; realm?: number; traits?: string[]; stones?: number } = {},
): House {
  const id = init.id ?? newId(world, 'h');
  if (world.houses.has(id)) throw new Error(`house ${id} already exists`);
  const house: House = {
    id,
    openness: init.openness ?? 'open',
    isMinor: init.isMinor ?? false,
    realm: init.realm ?? 1,
    traits: init.traits ?? [],
    stones: init.stones ?? 0,
    ghostHearts: 0,
    grudge: 0,
    grudgeToday: 0,
    formationLevel: 1,
    formationDamage: 0,
    ward: 0,
    guardianKnocks: 0,
    members: [],
    graceActionsLeft: 0,
    retreatUntil: 0,
    retreatWindowStart: 0,
    retreatDaysUsed: 0,
    blocked: [],
    lastMeditationCollect: world.hour,
    cultivationProgress: 0,
    breakthroughPills: 0,
    tribulationCooldownUntil: 0,
  };
  world.houses.set(id, house);
  return house;
}

export function getHouse(world: World, id: HouseId): House {
  const house = world.houses.get(id);
  if (!house) throw new Error(`unknown house ${id}`);
  return house;
}

export function getThread(world: World, id: string): Thread {
  const thread = world.threads.get(id);
  if (!thread) throw new Error(`unknown thread ${id}`);
  return thread;
}

export const dayOf = (hour: number): number => Math.floor(hour / HOURS_PER_DAY);
export const hourOfDay = (hour: number): number => hour % HOURS_PER_DAY;
/** 周一 = 0 … 周日 = 6 */
export const weekdayOf = (hour: number): number => dayOf(hour) % 7;

/** 一个家族的所有红线（默认只算 active 的） */
export function threadsOf(world: World, houseId: HouseId, onlyActive = true): Thread[] {
  const out: Thread[] = [];
  for (const id of world.threadsByHouse.get(houseId) ?? []) {
    const t = world.threads.get(id);
    if (!t || (onlyActive && t.state !== 'active')) continue;
    out.push(t);
  }
  return out;
}

/**
 * 回报递减：一家的 active 红线按浓度从高到低排，第 i 根（从 0 数）的权重 = diminishing^i。
 * 守门和结族人都用这个权重，多对象有回报但有天花板。
 */
export function rankedThreads(world: World, houseId: HouseId): { thread: Thread; weight: number }[] {
  const d = world.config.thread.diminishing;
  return threadsOf(world, houseId)
    .sort((x, y) => y.strands - x.strands || (x.id < y.id ? -1 : 1))
    .map((thread, i) => ({ thread, weight: Math.pow(d, i) }));
}

/** 红线另一端：玩家 id，或 null（NPC） */
export function otherSide(thread: Thread, houseId: HouseId): HouseId | null {
  return thread.a === houseId ? thread.b : thread.a;
}

/** #21 未成年人是否处在可玩时段 */
export function minorAllowedNow(world: World, hour = world.hour): boolean {
  const m = world.config.minors;
  const h = hourOfDay(hour);
  return m.allowedWeekdays.includes(weekdayOf(hour)) && h >= m.allowedHourStart && h < m.allowedHourEnd;
}

/** #5 #21 是否在闭关（主动闭关，或未成年人在禁玩时段自动闭关） */
export function isInRetreat(world: World, house: House, hour = world.hour): boolean {
  if (house.retreatUntil > hour) return true;
  return house.isMinor && !minorAllowedNow(world, hour);
}

/** 任意一方在闭关，这根线就冻结：不变淡、不生怨、冷落不计时（族人照常结） */
export function isThreadFrozen(world: World, thread: Thread): boolean {
  if (isInRetreat(world, getHouse(world, thread.a))) return true;
  return thread.b !== null && isInRetreat(world, getHouse(world, thread.b));
}

/** 玩家做了一次行动。劫后余生按行动次数倒数（#8 #11） */
export function spendAction(house: House): void {
  if (house.graceActionsLeft > 0) house.graceActionsLeft--;
}

/** #5 主动闭关，受每个周期天数上限约束；未成年人的自动闭关不走这里，不占额度（#21） */
export function startRetreat(world: World, houseId: HouseId, days: number): Result {
  const house = getHouse(world, houseId);
  const { daysPerWindow, windowDays } = world.config.retreat;
  if (days <= 0 || !Number.isInteger(days)) return { ok: false, reason: '闭关天数必须是正整数' };
  if (dayOf(world.hour) - house.retreatWindowStart >= windowDays) {
    house.retreatWindowStart = dayOf(world.hour);
    house.retreatDaysUsed = 0;
  }
  if (house.retreatDaysUsed + days > daysPerWindow) {
    return { ok: false, reason: `本周期闭关额度只剩 ${daysPerWindow - house.retreatDaysUsed} 天` };
  }
  house.retreatDaysUsed += days;
  house.retreatUntil = Math.max(house.retreatUntil, world.hour) + days * HOURS_PER_DAY;
  return { ok: true, value: undefined };
}

export function endRetreat(world: World, houseId: HouseId): void {
  const house = getHouse(world, houseId);
  house.retreatUntil = Math.min(house.retreatUntil, world.hour);
}

export const ok = (): Result => ({ ok: true, value: undefined });
export const fail = (reason: string): Result<never> => ({ ok: false, reason });
