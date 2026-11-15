import {
  addHouse,
  advanceHour,
  createWorld,
  getHouse,
  threadsOf,
  tieThread,
  type DeepPartial,
  type GameConfig,
  type GameEvent,
  type World,
} from '../core';
import { PROFILES, isOnline, playSession, startOfDay, type Agent, type Archetype } from './agents';

export interface SimOptions {
  /** 每种玩家类型模拟多少人（真人搭档类型会两两配对，取偶数） */
  playersPerArchetype: number;
  days: number;
  seed: number;
  archetypes: Archetype[];
  config?: DeepPartial<GameConfig>;
  /** 怨丝连续 7 天都不低于这个值，算“陷在恶性循环里” */
  spiralGrudge: number;
}

export interface ArchetypeReport {
  archetype: Archetype;
  label: string;
  players: number;
  knocksPerWeek: number;
  breachesPerWeek: number;
  /** 离线时被砸破占全部砸破的比例 */
  offlineBreachShare: number;
  /** 一次离线期间被砸破两次及以上的次数（应当为 0） */
  multiBreachAbsences: number;
  purifiesPerWeek: number;
  grudgeAvg: number;
  grudgeP90: number;
  /** 每人每天因每日上限散掉的怨丝 */
  grudgeDissipatedPerDay: number;
  spiralShare: number;
  strandsAvg: number;
  membersAvg: number;
  heirsPerPlayer: number;
  stonesAvg: number;
  formationAvg: number;
  /** 达到金缕的玩家占比，以及达到时是第几天（中位数，没人达到为 null） */
  goldenShare: number;
  goldenDayMedian: number | null;
  /** 结出第一位嫡传是第几天（中位数） */
  heirDayMedian: number | null;
  rivalsPerWeek: number;
  /** 情敌来袭的结果占比：感化 / 输 */
  rivalPurifyShare: number;
  rivalLostShare: number;
  quarrelsPerWeek: number;
  /** 争执里最后和好的比例 */
  reconcileRate: number;
  /** 第一根线到“知己”、结出第一位族人是第几天（中位数） */
  tier1DayMedian: number | null;
  firstMemberDayMedian: number | null;
  realmAvg: number;
  tribulationSuccessRate: number;
  /** 达到陌生人匹配门槛境界是第几天（中位数） */
  strangerGateDayMedian: number | null;
}

interface Counters {
  knocks: number;
  breaches: number;
  offlineBreaches: number;
  purifies: number;
  dissipated: number;
  heirs: number;
  breachesThisAbsence: number;
  multiBreachAbsences: number;
  wasOnline: boolean;
  grudgeHistory: number[];
  goldenHour: number | null;
  heirHour: number | null;
  tier1Hour: number | null;
  memberHour: number | null;
  quarrels: number;
  reconciled: number;
  rivals: number;
  rivalPurified: number;
  rivalLost: number;
  tribAttempts: number;
  tribSuccesses: number;
  gateHour: number | null;
}

export const DEFAULT_SIM: SimOptions = {
  playersPerArchetype: 200,
  days: 30,
  seed: 1,
  archetypes: ['solo', 'couple', 'busy', 'poly', 'polyCasual', 'minor'],
  spiralGrudge: 40,
};

export function simulate(opts: Partial<SimOptions> = {}): ArchetypeReport[] {
  const o: SimOptions = { ...DEFAULT_SIM, ...opts };
  const world = createWorld({ seed: o.seed, config: o.config, recordEvents: false });
  const agents = createAgents(world, o);
  const counters = new Map<string, Counters>(agents.map((a) => [a.houseId, emptyCounters()]));

  world.listener = (e) => count(e, counters, world);

  const hours = o.days * 24;
  for (let h = 0; h < hours; h++) {
    if (world.hour % 24 === 0) for (const a of agents) startOfDay(world, a);

    const online = new Set<string>();
    for (const a of agents) if (isOnline(world, a)) online.add(a.houseId);

    for (const a of agents) {
      const c = counters.get(a.houseId)!;
      const on = online.has(a.houseId);
      if (on && !c.wasOnline) {
        if (c.breachesThisAbsence >= 2) c.multiBreachAbsences++;
        c.breachesThisAbsence = 0;
      }
      c.wasOnline = on;
      if (on) playSession(world, a, (id) => online.has(id));
    }

    advanceHour(world, (house) => online.has(house.id));

    if (world.hour % 24 === 0) {
      for (const a of agents) counters.get(a.houseId)!.grudgeHistory.push(getHouse(world, a.houseId).grudge);
    }
  }

  return o.archetypes.map((arch) => report(world, arch, agents.filter((a) => a.archetype === arch), counters, o));
}

function emptyCounters(): Counters {
  return {
    knocks: 0,
    breaches: 0,
    offlineBreaches: 0,
    purifies: 0,
    dissipated: 0,
    heirs: 0,
    breachesThisAbsence: 0,
    multiBreachAbsences: 0,
    wasOnline: false,
    grudgeHistory: [],
    goldenHour: null,
    heirHour: null,
    tier1Hour: null,
    memberHour: null,
    quarrels: 0,
    reconciled: 0,
    rivals: 0,
    rivalPurified: 0,
    rivalLost: 0,
    tribAttempts: 0,
    tribSuccesses: 0,
    gateHour: null,
  };
}

function createAgents(world: World, o: SimOptions): Agent[] {
  const agents: Agent[] = [];
  for (const arch of o.archetypes) {
    const p = PROFILES[arch];
    const n = p.partner === 'friend' ? o.playersPerArchetype - (o.playersPerArchetype % 2) : o.playersPerArchetype;
    const group: Agent[] = [];
    for (let i = 0; i < n; i++) {
      const house = addHouse(world, {
        id: `${arch}-${i}`,
        openness: p.openness,
        isMinor: p.isMinor,
        traits: [world.rng.pick(['剑修', '丹修', '符修', '阵修', '器修', '御兽'])],
      });
      group.push({ houseId: house.id, archetype: arch, profile: p, activeToday: true, loveBudget: 0 });
    }
    for (let i = 0; i < group.length; i++) {
      const me = group[i]!;
      if (p.partner === 'npc') tieThread(world, me.houseId, { kind: 'npc', name: '散修' });
      else if (i % 2 === 0) tieThread(world, me.houseId, { kind: 'friend', house: group[i + 1]!.houseId });
    }
    agents.push(...group);
  }
  return agents;
}

function count(e: GameEvent, counters: Map<string, Counters>, world: World): void {
  switch (e.type) {
    case 'knock':
      counters.get(e.house)!.knocks++;
      break;
    case 'breach': {
      const c = counters.get(e.house)!;
      c.breaches++;
      if (!e.online) {
        c.offlineBreaches++;
        c.breachesThisAbsence++;
      }
      break;
    }
    case 'purified':
      counters.get(e.house)!.purifies++;
      break;
    case 'grudgeAdded':
      counters.get(e.house)!.dissipated += e.dissipated;
      break;
    case 'heirBorn': {
      const heir = world.heirs.get(e.heir)!;
      for (const p of heir.parents) {
        const c = counters.get(p)!;
        c.heirs++;
        c.heirHour ??= e.hour;
      }
      break;
    }
    case 'rival': {
      const c = counters.get(e.house)!;
      c.rivals++;
      if (e.outcome === 'purified') c.rivalPurified++;
      if (e.outcome === 'lost') c.rivalLost++;
      break;
    }
    case 'quarrel':
    case 'quarrelEnded': {
      const t = world.threads.get(e.thread)!;
      for (const p of [t.a, t.b]) {
        if (!p) continue;
        const c = counters.get(p)!;
        if (e.type === 'quarrel') c.quarrels++;
        else if (e.reconciled) c.reconciled++;
      }
      break;
    }
    case 'tribulation': {
      const c = counters.get(e.house)!;
      c.tribAttempts++;
      if (e.success) c.tribSuccesses++;
      if (e.realm >= world.config.matching.strangerRealmGate) c.gateHour ??= e.hour;
      break;
    }
    case 'tierChanged': {
      if (e.to < 1) break;
      const t = world.threads.get(e.thread)!;
      for (const p of [t.a, t.b]) if (p) counters.get(p)!.tier1Hour ??= e.hour;
      break;
    }
    case 'memberBorn':
      counters.get(e.house)!.memberHour ??= e.hour;
      break;
    case 'golden': {
      const t = world.threads.get(e.thread)!;
      for (const p of [t.a, t.b]) if (p) counters.get(p)!.goldenHour ??= e.hour;
      break;
    }
  }
}

function report(
  world: World,
  archetype: Archetype,
  agents: Agent[],
  counters: Map<string, Counters>,
  o: SimOptions,
): ArchetypeReport {
  const n = Math.max(1, agents.length);
  const weeks = o.days / 7;
  const cs = agents.map((a) => counters.get(a.houseId)!);
  const houses = agents.map((a) => getHouse(world, a.houseId));
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const grudges = houses.map((h) => h.grudge).sort((x, y) => x - y);
  const breaches = sum(cs.map((c) => c.breaches));
  const strands = houses.flatMap((h) => threadsOf(world, h.id).map((t) => t.strands));

  return {
    archetype,
    label: PROFILES[archetype].label,
    players: agents.length,
    knocksPerWeek: sum(cs.map((c) => c.knocks)) / n / weeks,
    breachesPerWeek: breaches / n / weeks,
    offlineBreachShare: breaches === 0 ? 0 : sum(cs.map((c) => c.offlineBreaches)) / breaches,
    multiBreachAbsences: sum(cs.map((c) => c.multiBreachAbsences + (c.breachesThisAbsence >= 2 ? 1 : 0))),
    purifiesPerWeek: sum(cs.map((c) => c.purifies)) / n / weeks,
    grudgeAvg: sum(grudges) / n,
    grudgeP90: grudges[Math.floor(grudges.length * 0.9)] ?? 0,
    grudgeDissipatedPerDay: sum(cs.map((c) => c.dissipated)) / n / o.days,
    spiralShare: cs.filter((c) => c.grudgeHistory.length >= 7 && c.grudgeHistory.slice(-7).every((g) => g >= o.spiralGrudge)).length / n,
    strandsAvg: strands.length ? sum(strands) / strands.length : 0,
    membersAvg: sum(houses.map((h) => h.members.length)) / n,
    heirsPerPlayer: sum(cs.map((c) => c.heirs)) / n,
    stonesAvg: sum(houses.map((h) => h.stones)) / n,
    formationAvg: sum(houses.map((h) => h.formationLevel)) / n,
    goldenShare: cs.filter((c) => c.goldenHour !== null).length / n,
    goldenDayMedian: medianDay(cs.map((c) => c.goldenHour)),
    heirDayMedian: medianDay(cs.map((c) => c.heirHour)),
    rivalsPerWeek: sum(cs.map((c) => c.rivals)) / n / weeks,
    rivalPurifyShare: sum(cs.map((c) => c.rivals)) === 0 ? 0 : sum(cs.map((c) => c.rivalPurified)) / sum(cs.map((c) => c.rivals)),
    rivalLostShare: sum(cs.map((c) => c.rivals)) === 0 ? 0 : sum(cs.map((c) => c.rivalLost)) / sum(cs.map((c) => c.rivals)),
    quarrelsPerWeek: sum(cs.map((c) => c.quarrels)) / n / weeks,
    reconcileRate: sum(cs.map((c) => c.quarrels)) === 0 ? 0 : sum(cs.map((c) => c.reconciled)) / sum(cs.map((c) => c.quarrels)),
    tier1DayMedian: medianDay(cs.map((c) => c.tier1Hour)),
    firstMemberDayMedian: medianDay(cs.map((c) => c.memberHour)),
    realmAvg: sum(houses.map((h) => h.realm)) / n,
    tribulationSuccessRate: sum(cs.map((c) => c.tribAttempts)) === 0 ? 0 : sum(cs.map((c) => c.tribSuccesses)) / sum(cs.map((c) => c.tribAttempts)),
    strangerGateDayMedian: medianDay(cs.map((c) => c.gateHour)),
  };
}

/** 只在超过一半的人达到时才给中位数，否则返回 null（“多数人没达到”） */
function medianDay(hours: (number | null)[]): number | null {
  const sorted = hours.map((h) => (h === null ? Infinity : h)).sort((x, y) => x - y);
  const mid = sorted[Math.floor(sorted.length / 2)];
  return mid === undefined || mid === Infinity ? null : mid / 24;
}
