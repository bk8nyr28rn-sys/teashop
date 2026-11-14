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
  dayOf,
  type House,
  type Openness,
  type World,
} from '../core';

/** 模拟用的玩家类型。都是粗略的行为假设，用来对比不同人群的体验 */
export type Archetype = 'solo' | 'couple' | 'busy' | 'poly' | 'minor';

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
  poly: {
    label: '多对象（1 真人 + 3 NPC）',
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
  // 渡劫还没实现：先用“每活跃一周境界 +1”代替
  if (day > 0 && day % 7 === 0 && agent.activeToday) getHouse(world, agent.houseId).realm++;
}

/** 一次上线会话里玩家做的事 */
export function playSession(world: World, agent: Agent): void {
  const house: House = getHouse(world, agent.houseId);
  const p = agent.profile;
  const rng = world.rng;

  collectMeditation(world, house.id);

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

  if (house.formationDamage > 0) repairFormation(world, house.id);
  else if (house.stones >= formationUpgradeCost(world, house)) upgradeFormation(world, house.id);
  brewHealingPill(world, house.id);
}
