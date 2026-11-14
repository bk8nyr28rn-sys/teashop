import {
  brewHealingPill,
  collectMeditation,
  createHeir,
  formationUpgradeCost,
  getHouse,
  minorAllowedNow,
  otherSide,
  repairFormation,
  setHeirHomeByAgreement,
  signHeir,
  startRetreat,
  threadsOf,
  tieThread,
  interact,
  upgradeFormation,
  attemptTribulation,
  brewBreakthroughPill,
  canAttemptTribulation,
  bigInteract,
  dayOf,
  type House,
  type Openness,
  type World,
} from '../core';

/** 模拟用的玩家类型。都是粗略的行为假设，用来对比不同人群的体验 */
export type Archetype = 'solo' | 'couple' | 'busy' | 'poly' | 'polyCasual' | 'minor';

export interface Profile {
  label: string;
  /** 每天在哪几个小时上线 */
  sessionHours: number[];
  /** 某一天会上线的概率 */
  activeDayChance: number;
  /** 上线时，每根线主动互动的概率 */
  interactChance: number;
  /** 上线时，回应搭档互动的概率 */
  respondChance: number;
  openness: Openness;
  isMinor: boolean;
  /** 真人搭档（同类型的另一个玩家）还是 NPC */
  partner: 'friend' | 'npc';
  /** 开局后第几天各再牵一根 NPC 线（多对象玩家） */
  extraNpcPartnerDays: number[];
  /** 每 30 天主动闭关几天（0 = 不用） */
  retreatDaysPerMonth: number;
}

export const PROFILES: Record<Archetype, Profile> = {
  solo: {
    label: '独自玩（NPC 线）',
    sessionHours: [9, 21],
    activeDayChance: 0.95,
    interactChance: 0.8,
    respondChance: 0.9,
    openness: 'open',
    isMinor: false,
    partner: 'npc',
    extraNpcPartnerDays: [],
    retreatDaysPerMonth: 0,
  },
  couple: {
    label: '好友一对一（专一）',
    sessionHours: [12, 21],
    activeDayChance: 0.95,
    interactChance: 0.8,
    respondChance: 0.9,
    openness: 'devoted',
    isMinor: false,
    partner: 'friend',
    extraNpcPartnerDays: [],
    retreatDaysPerMonth: 0,
  },
  busy: {
    label: '忙碌玩家（隔天上线，会闭关）',
    sessionHours: [22],
    activeDayChance: 0.5,
    interactChance: 0.6,
    respondChance: 0.8,
    openness: 'open',
    isMinor: false,
    partner: 'friend',
    extraNpcPartnerDays: [],
    retreatDaysPerMonth: 5,
  },
  polyCasual: {
    label: '多对象（和一对一同样投入）',
    sessionHours: [12, 21],
    activeDayChance: 0.95,
    interactChance: 0.8,
    respondChance: 0.9,
    openness: 'open',
    isMinor: false,
    partner: 'friend',
    extraNpcPartnerDays: [3, 7, 12],
    retreatDaysPerMonth: 0,
  },
  poly: {
    label: '多对象（高强度维护，每天 3 次）',
    sessionHours: [9, 13, 21],
    activeDayChance: 0.95,
    interactChance: 0.6,
    respondChance: 0.8,
    openness: 'open',
    isMinor: false,
    partner: 'friend',
    extraNpcPartnerDays: [3, 7, 12],
    retreatDaysPerMonth: 0,
  },
  minor: {
    label: '未成年（每周三小时）',
    sessionHours: [20],
    activeDayChance: 0.9,
    interactChance: 0.9,
    respondChance: 0.95,
    openness: 'open',
    isMinor: true,
    partner: 'friend',
    extraNpcPartnerDays: [],
    retreatDaysPerMonth: 0,
  },
};

export interface Agent {
  houseId: string;
  archetype: Archetype;
  profile: Profile;
  /** 今天是否会上线（每天早上掷一次） */
  activeToday: boolean;
  /** 留给大互动的灵石预算（收到的灵石按固定比例存进来，所有人分配方式一样） */
  loveBudget: number;
}

/** 这一小时这个玩家在不在线 */
export function isOnline(world: World, agent: Agent): boolean {
  const house = getHouse(world, agent.houseId);
  if (house.isMinor && !minorAllowedNow(world)) return false;
  if (house.retreatUntil > world.hour) return false;
  return agent.activeToday && agent.profile.sessionHours.includes(world.hour % 24);
}

/** 每天开始时：决定今天上不上线，以及要不要闭关、加新对象、境界成长 */
export function startOfDay(world: World, agent: Agent): void {
  const p = agent.profile;
  const day = dayOf(world.hour);
  agent.activeToday = world.rng.chance(p.activeDayChance);

  if (p.retreatDaysPerMonth > 0 && day % 30 === 10) {
    startRetreat(world, agent.houseId, p.retreatDaysPerMonth);
  }
  if (p.extraNpcPartnerDays.includes(day)) {
    tieThread(world, agent.houseId, { kind: 'npc', name: `散修${day}` });
  }
}

/** 收到的灵石有多少比例存进感情预算，其余留给阵法 */
export const LOVE_BUDGET_SHARE = 0.5;

/** 一次上线会话里玩家做的事。isPresent 判断真人搭档此刻在不在场 */
export function playSession(world: World, agent: Agent, isPresent: (houseId: string) => boolean = () => false): void {
  const house: House = getHouse(world, agent.houseId);
  const p = agent.profile;
  const rng = world.rng;

  agent.loveBudget += collectMeditation(world, house.id) * LOVE_BUDGET_SHARE;

  // 渡劫：修为攒满就去，能炼破境丹就先炼一颗
  if (canAttemptTribulation(world, house.id).ok) {
    if (house.breakthroughPills === 0) brewBreakthroughPill(world, house.id);
    attemptTribulation(world, house.id);
  }

  for (const thread of threadsOf(world, house.id)) {
    const other = otherSide(thread, house.id);
    const theyAsked = thread.pendingRequest !== null && thread.pendingRequest.from !== house.id;
    if (theyAsked) {
      if (rng.chance(p.respondChance)) interact(world, house.id, thread.id);
    } else if (rng.chance(p.interactChance)) {
      interact(world, house.id, thread.id);
    }

    // 嫡传：浓度够了就签；双方都签了就结出来，第一版由两人商量归属
    if (other && !thread.heirId && thread.strands >= world.config.heir.strandThreshold) {
      signHeir(world, house.id, thread.id);
      const made = createHeir(world, thread.id);
      if (made.ok) setHeirHomeByAgreement(world, made.value.id, rng.pick(made.value.parents), made.value.parents);
    }
  }

  // 阵法只能用预算以外的灵石
  const spare = () => house.stones - agent.loveBudget;
  if (house.formationDamage > 0 && spare() >= world.config.economy.repairCostPerDamage) repairFormation(world, house.id);
  else if (house.formationDamage === 0 && spare() >= formationUpgradeCost(world, house)) upgradeFormation(world, house.id);
  brewHealingPill(world, house.id);
  agent.loveBudget = Math.min(agent.loveBudget, house.stones);

  // 大互动：把感情预算全部押上，随机挑一根够格的线
  const eligible = threadsOf(world, house.id).filter((t) => t.tier >= world.config.big.minTier);
  const stake = Math.floor(agent.loveBudget);
  if (eligible.length > 0 && stake >= world.config.big.minStake) {
    const t = rng.pick(eligible);
    const partner = otherSide(t, house.id);
    const r = bigInteract(world, house.id, t.id, stake, partner !== null && isPresent(partner));
    if (r.ok) agent.loveBudget -= r.value.stonesLost;
  }
}
