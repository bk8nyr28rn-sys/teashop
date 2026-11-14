import type { GameConfig } from './config';
import type { Rng } from './rng';

export type HouseId = string;

/** 互动请求里代表“NPC 这一方”的标记 */
export const NPC_SIDE = '@npc';
export type ThreadId = string;
export type HeirId = string;

/** OC 的设定：专一 / 开放 */
export type Openness = 'open' | 'devoted';

export type GhostKind = 'wild' | 'spirit';

/** 族人：由某根红线结出，记录父母（#9） */
export interface ClanMember {
  id: string;
  /** 结出这位族人的两方：玩家家族 id，或 NPC 的名字 */
  parents: [string, string];
  threadId: ThreadId;
  cultivation: number;
  /** 疗伤到第几个小时（#8） */
  injuredUntil: number;
}

/** 一个玩家的家族（当家人就是玩家的 OC） */
export interface House {
  id: HouseId;
  openness: Openness;
  isMinor: boolean;
  /** 当家人的境界。永远不会因失败而下降（#8） */
  realm: number;
  /** OC 的特质种类，嫡传继承用（#10） */
  traits: string[];

  stones: number;
  ghostHearts: number;
  /** 怨丝池（#7 #12） */
  grudge: number;
  /** 今天已经新生的怨丝，用于每日上限 */
  grudgeToday: number;

  formationLevel: number;
  formationDamage: number;
  /** #14 没有线时，变回的情丝用来加固门 */
  ward: number;
  /** 被感化后留下来帮忙守门的次数 */
  guardianKnocks: number;
  members: ClanMember[];

  /** 劫后余生：还剩几次行动内不触发砸门（#8） */
  graceActionsLeft: number;
  /** 主动闭关到第几个小时（#5） */
  retreatUntil: number;
  retreatWindowStart: number;
  retreatDaysUsed: number;
  /** 拉黑了谁（#4） */
  blocked: HouseId[];
  lastMeditationCollect: number;
  /** 累计上线次数（checkIn），和好期限按它算 */
  sessions: number;
  /** 渡劫：当家人的修为进度、破境丹、冷却到第几个小时 */
  cultivationProgress: number;
  breakthroughPills: number;
  tribulationCooldownUntil: number;
}

export type ThreadState = 'active' | 'cut' | 'severed';

/**
 * 一根红线 = 一段关系。浓度 = 线上的情丝。
 * b 为 null 表示另一方是 NPC 散修（#1）。
 */
export interface Thread {
  id: ThreadId;
  a: HouseId;
  b: HouseId | null;
  npcName: string | null;
  strands: number;
  /** active 正常；cut 剪线后可复合；severed 拉黑，不可逆 */
  state: ThreadState;
  cutAt: number | null;
  strandsAtCut: number;
  /** 剪线时每边生的怨丝（复合时破镜重圆用） */
  grudgeAtCut: number;
  /** #7 心力分散：键是“因为牵了别的线而造成分散”的那一方 */
  strain: Record<HouseId, number>;
  /** 一方发来、还没被回应的互动（#5）。from 为 NPC_SIDE 表示 NPC 发来的 */
  pendingRequest: { from: HouseId; at: number } | null;
  /** 结族人的进度，两边各算各的，单位“浓度·小时”（#9） */
  memberProgress: Record<HouseId, number>;
  /** 嫡传签署（#9） */
  heirSignatures: HouseId[];
  heirId: HeirId | null;
  golden: boolean;
  /** 关系等级，下标对应 config.tiers.names */
  tier: number;
  /** 争执中：散掉了多少、每边生了多少怨丝、从第几个小时开始、谁已经和好了、开始时双方的上线次数 */
  quarrel: { lost: number; grudge: number; since: number; reconciled: HouseId[]; sessionsAtStart: Record<HouseId, number> } | null;
  /** 上一次破镜重圆的时间（冷却用） */
  lastReunionAt: number | null;
  /** 最近一次吃醋或被冷落的时间（判断关系是否紧张） */
  lastTensionAt: number | null;
  createdAt: number;
}

/** 嫡传（#9 #10 #6 #15） */
export interface Heir {
  id: HeirId;
  threadId: ThreadId;
  parents: [HouseId, HouseId];
  /** 只继承特质种类，不继承数值（#10） */
  traitKinds: string[];
  /** 灵根，出生时锁定（#6 #10） */
  spiritualRoot: number;
  /** 记在哪家；null = 还没定 */
  home: HouseId | null;
  /** 陪伴值，表态时看谁陪得多 */
  companionship: Record<HouseId, number>;
  /** #15 成年时已经重新表态过 */
  adulthoodDone: boolean;
  bornAt: number;
}

export type GameEvent =
  | { type: 'knock'; hour: number; house: HouseId; kind: GhostKind; online: boolean; omen: boolean }
  | { type: 'defended'; hour: number; house: HouseId; kind: GhostKind; helper: ThreadId | null; strandsReturned: number }
  | { type: 'purified'; hour: number; house: HouseId; helper: ThreadId; strandsReturned: number }
  | { type: 'guarded'; hour: number; house: HouseId; kind: GhostKind }
  | { type: 'breach'; hour: number; house: HouseId; kind: GhostKind; online: boolean; stonesLost: number }
  | { type: 'grudgeAdded'; hour: number; house: HouseId; amount: number; dissipated: number; source: GrudgeSource }
  | { type: 'neglect'; hour: number; thread: ThreadId; neglecter: HouseId }
  | { type: 'cut'; hour: number; thread: ThreadId; by: HouseId }
  | { type: 'reconciled'; hour: number; thread: ThreadId }
  | { type: 'severed'; hour: number; by: HouseId; other: HouseId }
  | { type: 'memberBorn'; hour: number; house: HouseId; thread: ThreadId }
  | { type: 'heirBorn'; hour: number; heir: HeirId; thread: ThreadId }
  | { type: 'heirHomeSet'; hour: number; heir: HeirId; home: HouseId; reason: 'agreed' | 'breakup' | 'adulthood' }
  | { type: 'golden'; hour: number; thread: ThreadId }
  | { type: 'quarrel'; hour: number; thread: ThreadId; cause: 'misunderstanding' | 'risky'; lost: number }
  | { type: 'quarrelEnded'; hour: number; thread: ThreadId; reconciled: boolean; restored: number; reunion: boolean }
  | { type: 'rival'; hour: number; thread: ThreadId; house: HouseId; outcome: 'purified' | 'defeated' | 'lost'; strands: number }
  | { type: 'snatchProposed'; hour: number; proposal: string; by: HouseId; target: HouseId }
  | { type: 'snatchResolved'; hour: number; proposal: string; accepted: boolean; from: HouseId | null }
  | { type: 'tribulation'; hour: number; house: HouseId; success: boolean; realm: number; usedPill: boolean }
  | { type: 'tierChanged'; hour: number; thread: ThreadId; from: number; to: number }
  | { type: 'bigInteraction'; hour: number; thread: ThreadId; by: HouseId; stake: number; success: boolean; stonesLost: number; strandsGained: number; coPresent: boolean };

export type GrudgeSource = 'neglect' | 'strain' | 'jealousy' | 'quarrel' | 'cut' | 'spiritLost' | 'other';

/** 真人抢亲的提议 */
export interface SnatchProposal {
  id: string;
  by: HouseId;
  target: HouseId;
  kind: 'friend' | 'stranger';
  at: number;
}

export interface World {
  /** 现实时间，单位小时。第 0 小时是某个周一的 0 点 */
  hour: number;
  houses: Map<HouseId, House>;
  threads: Map<ThreadId, Thread>;
  /** 索引：每家参与的红线 id（含已剪、已拉黑的） */
  threadsByHouse: Map<HouseId, ThreadId[]>;
  heirs: Map<HeirId, Heir>;
  snatchProposals: Map<string, SnatchProposal>;
  /** 抢亲冷却：键是“发起人->对象”，值是上次发起的时间 */
  snatchCooldowns: Map<string, number>;
  config: GameConfig;
  rng: Rng;
  events: GameEvent[];
  /** 为 false 时不记录事件（大规模模拟时省内存） */
  recordEvents: boolean;
  /** 每个事件发生时都会调用（模拟器用它统计） */
  listener: ((event: GameEvent) => void) | null;
  nextId: number;
}

/** 规则拒绝某个操作时返回的结果 */
export type Result<T = void> = { ok: true; value: T } | { ok: false; reason: string };
