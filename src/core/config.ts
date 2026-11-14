/**
 * 所有可调数值。
 *
 * 方案 v2 “待定数值”表里的每一项都在这里。
 * 已按模拟校准的：成长节奏（一对认真的好友约 90 天到金缕、约 24 天结嫡传）、
 * 怨丝还原比例（< 1:1）、小互动和大互动的比例（忙碌玩家能追上）、多对象难度。
 * 其余仍是占位，要继续用模拟器调。
 * 注释里的 #N 对应 v2 文档“决定记录”的编号。
 */
export interface GameConfig {
  /** #12 每天新生的怨丝上限，超出的部分直接散掉 */
  grudge: {
    dailyCap: number;
  };

  /** 牵线、互动 */
  thread: {
    /** 一次小互动（了解对方）带来的情丝。成长主要靠大互动，小互动只是零头 */
    interactionGain: number;
    /** 浓度上限；到达即为“金缕” */
    goldenThreshold: number;
    /**
     * 回报递减：守门和结族人时，按浓度从高到低排，
     * 第 1 根线算 100%，第 2 根算本值，第 3 根算本值²……（多对象回报有天花板）
     * 默认 1 = 关闭：大互动的感情预算按时间累积，多对象要分摊，已经起到同样的作用。
     */
    diminishing: number;
  };

  /**
   * 关系分级：按浓度区间分级，每级解锁不同玩法；浓度掉到区间下限就降一级。
   * mins 是每一级的浓度下限，最后一级就是金缕。
   */
  tiers: {
    names: string[];
    mins: number[];
  };

  /**
   * 多对象吃醋：和一根线互动时，其他每根线都变淡并生怨丝。
   * 越亲密的线越在乎：变淡和生怨都乘以那根线的等级（相识 = 0 不在乎）。
   * 怨丝落在谁家沿用 #7：互动的人家里生；对方专一的话对方家也生。
   */
  jealousy: {
    dimPerTier: number;
    grudgePerTier: number;
    /** 大互动引起的吃醋是普通互动的几倍 */
    bigMultiplier: number;
  };

  /**
   * 大互动：押上灵石，随机大成功或大失败。
   * 成功：押注全部化为情丝，情丝 = 押注 × strandsPerStone × (1 + successEdge)，比失败时损失的略多
   * 失败：随机损失押注的 failLossMin–failLossMax，其余退回，红线不变
   * 真人搭档双方同时在场，成功率提高（鼓励真人组队）。付费道具永远不能用来押注。
   */
  big: {
    minTier: number;
    minStake: number;
    strandsPerStone: number;
    successEdge: number;
    baseSuccess: number;
    coPresenceBonus: number;
    failLossMin: number;
    failLossMax: number;
  };

  /** NPC 散修也要维护：回复有延迟，也会主动发来互动，不回就算冷落 */
  npc: {
    replyHours: number;
    requestChancePerDay: number;
    /**
     * NPC 散修也会投入：NPC 线大互动成功时，情丝乘以这个倍数。
     * 真人线是两个人各押各的预算，天然长得快；这个倍数用来拉近 NPC 线（#2）。
     */
    investMultiplier: number;
  };

  /** #2 陌生人匹配的等级门槛 */
  matching: {
    strangerRealmGate: number;
  };

  /** #3 #4 剪线与复合 */
  cut: {
    /** 剪线时转成怨丝的比例，其余直接散掉 */
    toGrudgeRatio: number;
    reconcileWindowDays: number;
    /** 复合时恢复到剪线前浓度的倍数（破镜重圆，> 1） */
    reconcileBonus: number;
  };

  /** #5 冷落 */
  neglect: {
    /** 搭档发来的互动超过几天没回才算冷落 */
    graceDays: number;
    /** 冷落期间每天红线变淡多少 */
    dimPerDay: number;
    /** 冷落期间每天生多少怨丝 */
    grudgePerDay: number;
    /** 冷落的怨丝落在谁家。文档没有明确定，默认双方都生（沿用 v1） */
    grudgeTo: 'both' | 'neglecter';
  };

  /** #5 #21 闭关 */
  retreat: {
    /** 每个统计周期内可以主动闭关的天数 */
    daysPerWindow: number;
    windowDays: number;
  };

  /** #7 多对象 */
  multiPartner: {
    /** 牵新线时，每根旧线增加的“心力分散” = 本值 × 已有线数 */
    strainPerExisting: number;
    /** 每点心力分散每天让旧线变淡多少 */
    dimPerStrain: number;
    /** 每点心力分散每天生多少怨丝 */
    grudgePerStrain: number;
    /** 在这根线上互动一次，抵消多少心力分散 */
    reliefPerInteraction: number;
    /** 每天自然消退的比例 */
    naturalDecayPerDay: number;
  };

  /** #11 #13 鬼 */
  ghosts: {
    /** 野鬼每小时来砸门的概率 */
    wildPerHour: number;
    wildBaseStrength: number;
    wildStrengthPerRealm: number;
    /** 怨灵每小时来砸门的概率 = 怨丝 × 本值，最高 spiritMaxPerHour */
    spiritPerHourPerGrudge: number;
    spiritMaxPerHour: number;
    /** 一只怨灵从怨丝池里带走多少怨丝 */
    spiritChunk: number;
    spiritBaseStrength: number;
    spiritStrengthPerGrudge: number;
    /** 怨丝达到多少时，怨灵来之前先出预兆 */
    omenGrudge: number;
    /** 在线时收到预兆，准备一下能加多少守门力 */
    omenPrepBonus: number;
  };

  /** 护宅大阵（门）的强度 */
  door: {
    base: number;
    perRealm: number;
    perMemberCultivation: number;
    perStrand: number;
    perFormationLevel: number;
    /** 来帮忙的搭档，按其红线浓度加成（合击） */
    helperPerStrand: number;
    /** 加固门（#14 没有线时）每天衰减的比例 */
    wardDecayPerDay: number;
  };

  /** #8 门被砸破 */
  breach: {
    stoneLossRatio: number;
    stoneLossCap: number;
    injuryDays: number;
    formationDamage: number;
    cultivationLossChance: number;
    cultivationLoss: number;
    /** 劫后余生：几次行动内不触发砸门 */
    graceActions: number;
  };

  /** #14 怨丝变回情丝，感化 */
  conversion: {
    /**
     * 打散怨灵时，情丝 = 怨丝 × (base + perChunk × 怨灵大小 / spiritChunk)：怨灵越强还原越多。
     * 比例必须 < 1，否则生怨反而“赚”，多对象会把怨丝当燃料（模拟发现的问题）。
     */
    defeatReturnBase: number;
    defeatReturnPerChunk: number;
    /** 守宅两人之间的红线浓度达到多少可以感化 */
    purifyThreshold: number;
    /** 感化时，情丝 = 怨丝 × 本值（比打散多，但不超过 1） */
    purifyReturn: number;
    /** 被感化的怨灵帮你守几次门 */
    purifiedGuardKnocks: number;
    /** #14 一根线都没有时，变回的情丝按这个比例加固门 */
    wardPerStrand: number;
  };

  /** #9 族人 */
  family: {
    /** 一根线累计多少“浓度·小时”结出一位族人 */
    memberStrandHours: number;
    maxMembers: number;
    memberStartCultivation: number;
    memberCultivationPerDay: number;
  };

  /** #9 #10 嫡传 */
  heir: {
    strandThreshold: number;
    consumeRatio: number;
  };

  /** 经济 */
  economy: {
    meditationPerHour: number;
    formationUpgradeBaseCost: number;
    /** 升级花费 = base × 当前等级^exponent */
    formationCostExponent: number;
    repairCostPerDamage: number;
    /** 第一版最简炼丹：疗伤丹要几颗诡心 */
    healingPillHearts: number;
  };

  /** #21 未成年人可玩时段（周一 = 0） */
  minors: {
    allowedWeekdays: number[];
    allowedHourStart: number;
    allowedHourEnd: number;
  };
}

export const defaultConfig: GameConfig = {
  grudge: { dailyCap: 30 },
  thread: { interactionGain: 0.5, goldenThreshold: 200, diminishing: 1 },
  npc: { replyHours: 12, requestChancePerDay: 0.5, investMultiplier: 1 },
  tiers: { names: ['相识', '知己', '倾心', '挚爱', '金缕'], mins: [0, 30, 60, 120, 200] },
  jealousy: { dimPerTier: 0.2, grudgePerTier: 0.2, bigMultiplier: 1.5 },
  big: {
    minTier: 0,
    minStake: 20,
    strandsPerStone: 0.05,
    successEdge: 0.1,
    baseSuccess: 0.5,
    coPresenceBonus: 0.15,
    failLossMin: 0.5,
    failLossMax: 1,
  },
  matching: { strangerRealmGate: 3 },
  cut: { toGrudgeRatio: 0.5, reconcileWindowDays: 7, reconcileBonus: 1.2 },
  neglect: { graceDays: 3, dimPerDay: 4, grudgePerDay: 3, grudgeTo: 'both' },
  retreat: { daysPerWindow: 7, windowDays: 30 },
  multiPartner: {
    strainPerExisting: 1,
    dimPerStrain: 1,
    grudgePerStrain: 1,
    reliefPerInteraction: 0.5,
    naturalDecayPerDay: 0.1,
  },
  ghosts: {
    wildPerHour: 0.02,
    wildBaseStrength: 30,
    wildStrengthPerRealm: 4,
    spiritPerHourPerGrudge: 0.002,
    spiritMaxPerHour: 0.15,
    spiritChunk: 10,
    spiritBaseStrength: 15,
    spiritStrengthPerGrudge: 2.5,
    omenGrudge: 20,
    omenPrepBonus: 10,
  },
  door: {
    base: 20,
    perRealm: 5,
    perMemberCultivation: 1,
    perStrand: 0.2,
    perFormationLevel: 8,
    helperPerStrand: 0.15,
    wardDecayPerDay: 0.05,
  },
  breach: {
    stoneLossRatio: 0.2,
    stoneLossCap: 200,
    injuryDays: 2,
    formationDamage: 1,
    cultivationLossChance: 0.3,
    cultivationLoss: 2,
    graceActions: 5,
  },
  conversion: {
    defeatReturnBase: 0.1,
    defeatReturnPerChunk: 0.2,
    purifyThreshold: 60,
    purifyReturn: 0.5,
    purifiedGuardKnocks: 3,
    wardPerStrand: 0.5,
  },
  family: {
    memberStrandHours: 30000,
    maxMembers: 12,
    memberStartCultivation: 1,
    memberCultivationPerDay: 0.5,
  },
  heir: { strandThreshold: 60, consumeRatio: 0.4 },
  economy: {
    meditationPerHour: 2,
    formationUpgradeBaseCost: 50,
    formationCostExponent: 2,
    repairCostPerDamage: 20,
    healingPillHearts: 2,
  },
  minors: { allowedWeekdays: [4, 5, 6], allowedHourStart: 20, allowedHourEnd: 21 },
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** 用部分覆盖生成一份完整配置（模拟器调参用） */
export function mergeConfig(overrides: DeepPartial<GameConfig> = {}): GameConfig {
  const out = structuredCloneConfig(defaultConfig);
  for (const section of Object.keys(overrides) as (keyof GameConfig)[]) {
    const patch = overrides[section];
    if (patch) Object.assign(out[section], patch);
  }
  return out;
}

function structuredCloneConfig(c: GameConfig): GameConfig {
  return JSON.parse(JSON.stringify(c)) as GameConfig;
}
