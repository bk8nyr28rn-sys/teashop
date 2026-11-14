import { settleHeirOnBreakup } from './family';
import { addGrudge } from './grudge';
import { NPC_SIDE, type HouseId, type Result, type Thread, type ThreadId, type World } from './types';
import {
  HOURS_PER_DAY,
  emit,
  fail,
  getHouse,
  getThread,
  isThreadFrozen,
  newId,
  ok,
  otherSide,
  spendAction,
  threadsOf,
} from './world';

export type Partner =
  | { kind: 'friend'; house: HouseId }
  | { kind: 'stranger'; house: HouseId }
  | { kind: 'npc'; name: string };

export function isBlockedBetween(world: World, x: HouseId, y: HouseId): boolean {
  return getHouse(world, x).blocked.includes(y) || getHouse(world, y).blocked.includes(x);
}

/** 两家之间还在的线（active 或可复合的 cut） */
export function threadBetween(world: World, x: HouseId, y: HouseId): Thread | null {
  for (const t of threadsOf(world, x, false)) {
    if (t.state !== 'severed' && (t.a === y || t.b === y)) return t;
  }
  return null;
}

/**
 * 牵线。调用前双方都已经确认（邀请、确认的流程由界面层负责）。
 * #1 好友不受门槛限制；#2 陌生人要过等级门槛且双方都是成年人；NPC 随时可以。
 * #7 每牵一根新线，已有的每根线都增加“心力分散”，已有线越多，加得越多。
 */
export function tieThread(world: World, a: HouseId, partner: Partner): Result<Thread> {
  const houseA = getHouse(world, a);
  let b: HouseId | null = null;
  let npcName: string | null = null;

  if (partner.kind === 'npc') {
    npcName = partner.name;
  } else {
    b = partner.house;
    if (b === a) return fail('不能和自己牵线');
    const houseB = getHouse(world, b);
    if (isBlockedBetween(world, a, b)) return fail('双方之间有拉黑');
    const existing = threadBetween(world, a, b);
    if (existing) return fail(existing.state === 'cut' ? '已剪线，请走复合' : '已经牵着线了');
    if (partner.kind === 'stranger') {
      const gate = world.config.matching.strangerRealmGate;
      if (houseA.isMinor || houseB.isMinor) return fail('陌生人匹配要求双方实名成年');
      if (houseA.realm < gate || houseB.realm < gate) return fail(`陌生人匹配要求境界达到 ${gate}`);
    }
  }

  addStrain(world, a);
  if (b) addStrain(world, b);

  const thread: Thread = {
    id: newId(world, 't'),
    a,
    b,
    npcName,
    strands: 0,
    state: 'active',
    cutAt: null,
    strandsAtCut: 0,
    grudgeAtCut: 0,
    strain: {},
    pendingRequest: null,
    memberProgress: {},
    heirSignatures: [],
    heirId: null,
    golden: false,
    tier: 0,
    quarrel: null,
    lastTensionAt: null,
    lastReunionAt: null,
    createdAt: world.hour,
  };
  world.threads.set(thread.id, thread);
  for (const side of b ? [a, b] : [a]) {
    const list = world.threadsByHouse.get(side);
    if (list) list.push(thread.id);
    else world.threadsByHouse.set(side, [thread.id]);
  }
  return { ok: true, value: thread };
}

/** #7 牵新线前调用：给这一方已有的每根线加心力分散 */
function addStrain(world: World, houseId: HouseId): void {
  const existing = threadsOf(world, houseId);
  if (existing.length === 0) return;
  const amount = world.config.multiPartner.strainPerExisting * existing.length;
  for (const t of existing) t.strain[houseId] = (t.strain[houseId] ?? 0) + amount;
}

/** 浓度对应的关系等级（下标对应 config.tiers.names） */
export function tierOf(world: World, strands: number): number {
  const mins = world.config.tiers.mins;
  let tier = 0;
  for (let i = 0; i < mins.length; i++) if (strands >= mins[i]!) tier = i;
  return tier;
}

/**
 * 加（或减）情丝，夹在 [0, 金缕] 之间。
 * 跨过等级区间时发 tierChanged（吃醋掉到下限就降级）；第一次到达金缕时发全服通报事件。
 */
export function addStrands(world: World, thread: Thread, amount: number): void {
  const cap = world.config.thread.goldenThreshold;
  thread.strands = Math.min(cap, Math.max(0, thread.strands + amount));
  const tier = tierOf(world, thread.strands);
  if (tier !== thread.tier) {
    emit(world, { type: 'tierChanged', hour: world.hour, thread: thread.id, from: thread.tier, to: tier });
    thread.tier = tier;
  }
  if (!thread.golden && thread.strands >= cap) {
    thread.golden = true;
    emit(world, { type: 'golden', hour: world.hour, thread: thread.id });
  }
}

/**
 * 多对象吃醋：by 和某根线互动时，by 的其他每根线都按等级变淡、生怨。
 * 怨丝落在 by 家；那根线的搭档专一的话，搭档家也生（沿用 #7）。
 */
function applyJealousy(world: World, by: HouseId, except: Thread, multiplier: number): void {
  const j = world.config.jealousy;
  for (const t of threadsOf(world, by)) {
    if (t === except || t.tier === 0 || isThreadFrozen(world, t)) continue;
    addStrands(world, t, -j.dimPerTier * t.tier * multiplier);
    t.lastTensionAt = world.hour;
    const grudge = j.grudgePerTier * t.tier * multiplier;
    addGrudge(world, by, grudge, 'jealousy');
    const partner = otherSide(t, by);
    if (partner && getHouse(world, partner).openness === 'devoted') addGrudge(world, partner, grudge, 'jealousy');
  }
}

/**
 * 互动（选项式回复）。
 * 对方（真人或 NPC）有未回的互动 → 这次算回应，涨情丝；否则算主动发起，等对方回应。
 * NPC 过几个小时才回（hourlyThreadUpdate），也会主动发来互动，不回一样算冷落。
 * 任何一次互动都会抵消自己这一方造成的心力分散（#7 高强度维护）。
 */
export function interact(world: World, by: HouseId, threadId: ThreadId, opts: { risky?: boolean } = {}): Result {
  const thread = getThread(world, threadId);
  if (thread.state !== 'active') return fail('这根线不在了');
  if (thread.a !== by && thread.b !== by) return fail('不是这根线的一方');
  spendAction(getHouse(world, by));

  const cfg = world.config;
  relieveStrain(world, thread, by);
  applyJealousy(world, by, thread, 1);

  const other = otherSide(thread, by) ?? NPC_SIDE;
  if (thread.pendingRequest && thread.pendingRequest.from === other) {
    thread.pendingRequest = null;
    emit(world, { type: 'interaction', hour: world.hour, thread: thread.id, by, kind: 'reply' });
    if (opts.risky && !thread.quarrel && world.rng.chance(cfg.quarrel.riskyChance)) {
      startQuarrel(world, thread, 'risky');
    } else {
      addStrands(world, thread, cfg.thread.interactionGain * (opts.risky ? cfg.quarrel.riskyGainMultiplier : 1));
    }
  } else if (!thread.pendingRequest) {
    thread.pendingRequest = { from: by, at: world.hour };
    emit(world, { type: 'interaction', hour: world.hour, thread: thread.id, by, kind: 'request' });
  }
  return ok();
}

/** 开始一场争执：一部分浓度散成怨丝（两边各生），头像变脸 */
export function startQuarrel(world: World, thread: Thread, cause: 'misunderstanding' | 'risky'): void {
  if (thread.quarrel || thread.state !== 'active') return;
  const qc = world.config.quarrel;
  const lost = thread.strands * qc.lossRatio;
  const grudge = lost * qc.grudgeRatio;
  addStrands(world, thread, -lost);
  addGrudge(world, thread.a, grudge, 'quarrel');
  if (thread.b) addGrudge(world, thread.b, grudge, 'quarrel');
  const sessionsAtStart: Record<HouseId, number> = { [thread.a]: getHouse(world, thread.a).sessions };
  if (thread.b) sessionsAtStart[thread.b] = getHouse(world, thread.b).sessions;
  thread.quarrel = { lost, grudge, since: world.hour, reconciled: [], sessionsAtStart };
  thread.lastTensionAt = world.hour;
  emit(world, { type: 'quarrel', hour: world.hour, thread: thread.id, cause, lost });
}

/**
 * 和好：期限内两人都和好，散掉的原数聚回。
 * 破镜重圆（冷却内只有一次）：这次争执生的怨丝有一小部分转化回红线，并从怨丝池清掉。
 * NPC 在玩家和好后自动跟着和好。
 */
export function reconcileQuarrel(world: World, by: HouseId, threadId: ThreadId): Result<{ done: boolean }> {
  const thread = getThread(world, threadId);
  const q = thread.quarrel;
  if (!q) return fail('没有在争执');
  if (thread.a !== by && thread.b !== by) return fail('不是这根线的一方');
  spendAction(getHouse(world, by));
  if (!q.reconciled.includes(by)) q.reconciled.push(by);
  const needed = thread.b ? [thread.a, thread.b] : [thread.a];
  if (!needed.every((id) => q.reconciled.includes(id))) {
    emit(world, { type: 'interaction', hour: world.hour, thread: thread.id, by, kind: 'makeup' });
    return { ok: true, value: { done: false } };
  }
  const reunionOk = reunionReady(world, thread);
  const restored = q.lost - q.grudge + reunionConvert(world, thread, needed, q.grudge);
  addStrands(world, thread, restored);
  const reunion = reunionOk;
  thread.quarrel = null;
  emit(world, { type: 'quarrelEnded', hour: world.hour, thread: thread.id, reconciled: true, restored, reunion });
  return { ok: true, value: { done: true } };
}

function expireQuarrel(world: World, thread: Thread): void {
  thread.quarrel = null;
  emit(world, { type: 'quarrelEnded', hour: world.hour, thread: thread.id, reconciled: false, restored: 0, reunion: false });
}

/**
 * 玩家上线时调用一次。和好期限按双方各自上线的次数算：
 * 两边都各上线够了 reconcileWindowSessions 次还没和好，争执就结束，散掉的就散了。
 */
export function checkIn(world: World, houseId: HouseId): void {
  const house = getHouse(world, houseId);
  house.sessions++;
  const limit = world.config.quarrel.reconcileWindowSessions;
  for (const thread of threadsOf(world, houseId)) {
    const q = thread.quarrel;
    if (!q) continue;
    const sides = thread.b ? [thread.a, thread.b] : [thread.a];
    const allUsedUp = sides.every((s) => getHouse(world, s).sessions - (q.sessionsAtStart[s] ?? 0) > limit);
    if (allUsedUp) expireQuarrel(world, thread);
  }
}

function reunionReady(world: World, thread: Thread): boolean {
  const cd = world.config.quarrel.reunionCooldownDays * HOURS_PER_DAY;
  return thread.lastReunionAt === null || world.hour - thread.lastReunionAt >= cd;
}

/**
 * 破镜重圆：冷却内只有一次。每一方把这次生的怨丝（每边 grudgePerSide）的一小部分
 * 从怨丝池里清掉、转回红线。返回转回的情丝总量。
 */
function reunionConvert(world: World, thread: Thread, sides: HouseId[], grudgePerSide: number): number {
  if (!reunionReady(world, thread)) return 0;
  let total = 0;
  for (const side of sides) {
    const house = getHouse(world, side);
    const converted = Math.min(house.grudge, grudgePerSide * world.config.quarrel.reunionConvert);
    house.grudge -= converted;
    total += converted;
  }
  thread.lastReunionAt = world.hour;
  return total;
}

/** 大互动的成功率：真人搭档同时在场有加成，NPC 线没有 */
export function bigSuccessChance(world: World, thread: Thread, partnerPresent: boolean): number {
  const b = world.config.big;
  return Math.min(1, b.baseSuccess + (partnerPresent && thread.b !== null ? b.coPresenceBonus : 0));
}

function relieveStrain(world: World, thread: Thread, by: HouseId): void {
  const relief = world.config.multiPartner.reliefPerInteraction;
  if (thread.strain[by]) thread.strain[by] = Math.max(0, thread.strain[by]! - relief);
}

/**
 * 大互动：押上灵石，随机大成功或大失败（规则见 config.big）。
 * partnerPresent：真人搭档此刻也在场（由界面层或模拟器判断），成功率提高；NPC 线没有这个加成。
 */
export function bigInteract(
  world: World,
  by: HouseId,
  threadId: ThreadId,
  stake: number,
  partnerPresent = false,
): Result<{ success: boolean; stonesLost: number; strandsGained: number }> {
  const thread = getThread(world, threadId);
  const house = getHouse(world, by);
  const b = world.config.big;
  if (thread.state !== 'active') return fail('这根线不在了');
  if (thread.a !== by && thread.b !== by) return fail('不是这根线的一方');
  if (thread.tier < b.minTier) return fail(`关系达到「${world.config.tiers.names[b.minTier]}」才能大互动`);
  if (stake < b.minStake) return fail(`押注至少 ${b.minStake} 灵石`);
  if (house.stones < stake) return fail('灵石不够');
  spendAction(house);
  relieveStrain(world, thread, by);
  applyJealousy(world, by, thread, world.config.jealousy.bigMultiplier);

  const coPresent = partnerPresent && thread.b !== null;
  const success = world.rng.chance(bigSuccessChance(world, thread, partnerPresent));
  let stonesLost: number;
  let strandsGained = 0;
  if (success) {
    stonesLost = stake;
    strandsGained = stake * b.strandsPerStone * (1 + b.successEdge) * (thread.b ? 1 : world.config.npc.investMultiplier);
    addStrands(world, thread, strandsGained);
  } else {
    const ratio = b.failLossMin + world.rng.next() * (b.failLossMax - b.failLossMin);
    stonesLost = Math.round(stake * ratio);
  }
  house.stones -= stonesLost;
  emit(world, { type: 'bigInteraction', hour: world.hour, thread: thread.id, by, stake, success, stonesLost, strandsGained, coPresent });
  return { ok: true, value: { success, stonesLost, strandsGained } };
}

/**
 * #3 剪线：这根线的情丝按比例转成怨丝（两边各生），其余散掉。
 * #4 期限内双方同意可以复合。
 */
export function cutThread(world: World, by: HouseId, threadId: ThreadId): Result {
  const thread = getThread(world, threadId);
  if (thread.state !== 'active') return fail('这根线不在了');
  if (thread.a !== by && thread.b !== by) return fail('不是这根线的一方');
  spendAction(getHouse(world, by));

  const grudge = thread.strands * world.config.cut.toGrudgeRatio;
  addGrudge(world, thread.a, grudge, 'cut');
  if (thread.b) addGrudge(world, thread.b, grudge, 'cut');

  thread.strandsAtCut = thread.strands;
  thread.grudgeAtCut = grudge;
  thread.strands = 0;
  thread.tier = 0;
  thread.state = 'cut';
  thread.cutAt = world.hour;
  thread.pendingRequest = null;
  thread.strain = {};
  thread.quarrel = null;
  thread.heirSignatures = [];
  emit(world, { type: 'cut', hour: world.hour, thread: thread.id, by });
  settleHeirOnBreakup(world, thread);
  return ok();
}

/**
 * #4 复合：期限内、双方都同意。没变成怨丝的部分原数恢复；
 * 变成怨丝的部分按破镜重圆规则转化一小部分（和争执共用冷却）。
 */
export function reconcile(world: World, threadId: ThreadId, consenting: HouseId[]): Result {
  const thread = getThread(world, threadId);
  if (thread.state !== 'cut' || thread.cutAt === null) return fail('只有剪掉的线才能复合');
  const { reconcileWindowDays, toGrudgeRatio } = world.config.cut;
  if (world.hour - thread.cutAt > reconcileWindowDays * HOURS_PER_DAY) return fail('已经过了复合期限');
  const needed = thread.b ? [thread.a, thread.b] : [thread.a];
  if (!needed.every((id) => consenting.includes(id))) return fail('复合需要双方都同意');
  if (thread.b && isBlockedBetween(world, thread.a, thread.b)) return fail('双方之间有拉黑');

  thread.state = 'active';
  thread.cutAt = null;
  const restored = thread.strandsAtCut * (1 - toGrudgeRatio) + reunionConvert(world, thread, needed, thread.grudgeAtCut);
  addStrands(world, thread, restored);
  emit(world, { type: 'reconciled', hour: world.hour, thread: thread.id });
  return ok();
}

/**
 * #4 拉黑：安全工具，零代价、即时生效、不可逆。
 * 两家之间的线浓度归零、不生怨丝、不能复合；对方再也找不到你。
 */
export function blockHouse(world: World, by: HouseId, other: HouseId): Result {
  if (by === other) return fail('不能拉黑自己');
  const house = getHouse(world, by);
  getHouse(world, other);
  if (!house.blocked.includes(other)) house.blocked.push(other);

  for (const t of threadsOf(world, by, false)) {
    const between = t.a === other || t.b === other;
    if (!between || t.state === 'severed') continue;
    t.strands = 0;
    t.tier = 0;
    t.state = 'severed';
    t.pendingRequest = null;
    t.strain = {};
    t.quarrel = null;
    t.heirSignatures = [];
    settleHeirOnBreakup(world, t);
  }
  emit(world, { type: 'severed', hour: world.hour, by, other });
  return ok();
}

/**
 * #14 怨丝变回的情丝回到哪：
 * 谁陪你打就回到和谁的线上；一个人打的平均分到所有线上；一根线都没有就加固门。
 */
export function returnStrands(world: World, houseId: HouseId, amount: number, helper: Thread | null): void {
  if (amount <= 0) return;
  if (helper && helper.state === 'active') {
    addStrands(world, helper, amount);
    return;
  }
  const threads = threadsOf(world, houseId);
  if (threads.length > 0) {
    for (const t of threads) addStrands(world, t, amount / threads.length);
    return;
  }
  getHouse(world, houseId).ward += amount * world.config.conversion.wardPerStrand;
}

/** 每天结算一次：冷落（#5）和心力分散（#7） */
export function dailyThreadUpdate(world: World): void {
  const cfg = world.config;
  for (const thread of world.threads.values()) {
    if (thread.state !== 'active') continue;

    // #5 #21 闭关时线冻结：冷落不计时，心力分散不生效
    if (isThreadFrozen(world, thread)) {
      if (thread.pendingRequest) thread.pendingRequest.at += HOURS_PER_DAY;
      continue;
    }

    // #5 冷落：只有搭档主动发来的互动超过几天没回才算
    // 玩家发给 NPC 的请求，NPC 一定会回（hourlyThreadUpdate），所以只看“发给玩家的”
    const req = thread.pendingRequest;
    const neglecter = req ? (req.from === NPC_SIDE ? thread.a : otherSide(thread, req.from)) : null;
    if (req && neglecter && world.hour - req.at >= cfg.neglect.graceDays * HOURS_PER_DAY) {
      addStrands(world, thread, -cfg.neglect.dimPerDay);
      thread.lastTensionAt = world.hour;
      addGrudge(world, neglecter, cfg.neglect.grudgePerDay, 'neglect');
      if (cfg.neglect.grudgeTo === 'both' && req.from !== NPC_SIDE) {
        addGrudge(world, req.from, cfg.neglect.grudgePerDay, 'neglect');
      }
      emit(world, { type: 'neglect', hour: world.hour, thread: thread.id, neglecter });
    }

    // 争执：过了兜底天数还没和好就算了；没在争执的线可能随机误会，关系紧张时更容易
    const qc = cfg.quarrel;
    if (thread.quarrel) {
      if (world.hour - thread.quarrel.since >= qc.reconcileMaxDays * HOURS_PER_DAY) expireQuarrel(world, thread);
    } else {
      const tense = thread.lastTensionAt !== null && world.hour - thread.lastTensionAt <= qc.tensionDays * HOURS_PER_DAY;
      if (thread.strands > 0 && world.rng.chance(qc.baseChancePerDay * (tense ? qc.tensionMultiplier : 1))) {
        startQuarrel(world, thread, 'misunderstanding');
      }
    }

    // NPC 散修也会主动发来互动
    if (!thread.b && !thread.pendingRequest && world.rng.chance(cfg.npc.requestChancePerDay)) {
      thread.pendingRequest = { from: NPC_SIDE, at: world.hour };
      emit(world, { type: 'interaction', hour: world.hour, thread: thread.id, by: NPC_SIDE, kind: 'request' });
    }

    // #7 心力分散：旧线变淡；怨丝落在牵新线的一方，旧搭档专一的话两边都生
    for (const [causer, value] of Object.entries(thread.strain)) {
      if (value <= 1e-6) continue;
      addStrands(world, thread, -value * cfg.multiPartner.dimPerStrain);
      addGrudge(world, causer, value * cfg.multiPartner.grudgePerStrain, 'strain');
      const partner = otherSide(thread, causer);
      if (partner && getHouse(world, partner).openness === 'devoted') {
        addGrudge(world, partner, value * cfg.multiPartner.grudgePerStrain, 'strain');
      }
      thread.strain[causer] = value * (1 - cfg.multiPartner.naturalDecayPerDay);
    }
  }
}

/** 每小时调用：NPC 过了回复延迟，回应玩家发来的互动 */
export function hourlyThreadUpdate(world: World): void {
  const delay = world.config.npc.replyHours;
  for (const thread of world.threads.values()) {
    if (thread.state !== 'active' || thread.b !== null) continue;
    const req = thread.pendingRequest;
    if (req && req.from === thread.a && world.hour - req.at >= delay && !isThreadFrozen(world, thread)) {
      thread.pendingRequest = null;
      addStrands(world, thread, world.config.thread.interactionGain);
      emit(world, { type: 'interaction', hour: world.hour, thread: thread.id, by: NPC_SIDE, kind: 'reply' });
    }
  }
}
