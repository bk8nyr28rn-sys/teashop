import type { GameConfig } from './config';
import type { Rng } from './rng';

export type HouseId = string;
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
  /** #7 心力分散：键是“因为牵了别的线而造成分散”的那一方 */
  strain: Record<HouseId, number>;
  /** 一方发来、还没被回应的互动（#5） */
  pendingRequest: { from: HouseId; at: number } | null;
  /** 结族人的进度，单位“浓度·小时”（#9） */
  memberProgress: number;
  /** 嫡传签署（#9） */
  heirSignatures: HouseId[];
  heirId: HeirId | null;
  golden: boolean;
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
  | { type: 'golden'; hour: number; thread: ThreadId };

export type GrudgeSource = 'neglect' | 'strain' | 'cut' | 'spiritLost' | 'other';

export interface World {
  /** 现实时间，单位小时。第 0 小时是某个周一的 0 点 */
  hour: number;
  houses: Map<HouseId, House>;
  threads: Map<ThreadId, Thread>;
  heirs: Map<HeirId, Heir>;
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
