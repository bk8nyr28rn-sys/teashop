import { addStrands, cutThread, isBlockedBetween, threadBetween, tieThread } from './threads';
import type { HouseId, Result, SnatchProposal, Thread, World } from './types';
import { HOURS_PER_DAY, emit, fail, getHouse, isProtected, isThreadFrozen, newId, otherSide, threadsOf } from './world';
import { doorPower } from './defense';

/**
 * NPC 情敌：每天对每根线掷一次。出现时，被“抢”的一方（真人线随机一方，NPC 线是玩家）
 * 迎来一只外来怨灵，这根线的另一方来帮忙。怨丝是外来的，不进怨丝池。
 */
export function dailyRivals(world: World): void {
  const r = world.config.rival;
  for (const thread of world.threads.values()) {
    if (thread.state !== 'active' || thread.strands <= 0 || isThreadFrozen(world, thread)) continue;
    if (!world.rng.chance(r.chancePerDay)) continue;
    const target = thread.b ? world.rng.pick([thread.a, thread.b]) : thread.a;
    const house = getHouse(world, target);
    if (house.graceActionsLeft > 0 || isProtected(world, house)) continue;
    resolveRival(world, thread, target);
  }
}

/** 结算一次情敌来袭。感化 → 打散 → 输，三种结果 */
export function resolveRival(world: World, thread: Thread, target: HouseId): 'purified' | 'defeated' | 'lost' {
  const r = world.config.rival;
  const c = world.config.conversion;
  const house = getHouse(world, target);
  let outcome: 'purified' | 'defeated' | 'lost';
  if (thread.strands >= c.purifyThreshold) {
    addStrands(world, thread, r.grudge * c.purifyReturn);
    house.guardianKnocks += c.purifiedGuardKnocks;
    outcome = 'purified';
  } else {
    const power = doorPower(world, house) + thread.strands * world.config.door.helperPerStrand;
    const strength = r.strengthBase + r.grudge * r.strengthPerGrudge;
    if (world.rng.chance(power / (power + strength))) {
      const ratio = c.defeatReturnBase + c.defeatReturnPerChunk * Math.min(1, r.grudge / world.config.ghosts.spiritChunk);
      addStrands(world, thread, r.grudge * ratio);
      outcome = 'defeated';
    } else {
      addStrands(world, thread, -r.dimOnLoss);
      thread.lastTensionAt = world.hour;
      outcome = 'lost';
    }
  }
  emit(world, { type: 'rival', hour: world.hour, thread: thread.id, house: target, outcome, strands: thread.strands });
  return outcome;
}

/**
 * 真人抢亲：向一位设了“专一”、已经有线的人递线。
 * 对方是开放的就直接递线（tieThread），用不着抢。陌生人要过等级门槛（#2）。
 */
export function proposeSnatch(world: World, by: HouseId, target: HouseId, kind: 'friend' | 'stranger'): Result<SnatchProposal> {
  if (by === target) return fail('不能抢自己');
  const t = getHouse(world, target);
  const me = getHouse(world, by);
  if (isBlockedBetween(world, by, target)) return fail('双方之间有拉黑');
  if (t.openness !== 'devoted') return fail('对方是开放的，直接递线就行');
  if (threadsOf(world, target).length === 0) return fail('对方还没有牵线，直接递线就行');
  if (threadBetween(world, by, target)) return fail('你们之间已经有线了');
  if (kind === 'stranger') {
    const gate = world.config.matching.strangerRealmGate;
    if (me.isMinor || t.isMinor) return fail('陌生人之间要求双方实名成年');
    if (me.realm < gate || t.realm < gate) return fail(`陌生人之间要求境界达到 ${gate}`);
  }
  const key = `${by}->${target}`;
  const last = world.snatchCooldowns.get(key);
  if (last !== undefined && world.hour - last < world.config.snatch.cooldownDays * HOURS_PER_DAY) {
    return fail('对同一个人抢亲有冷却');
  }
  const proposal: SnatchProposal = { id: newId(world, 'snatch'), by, target, kind, at: world.hour };
  world.snatchProposals.set(proposal.id, proposal);
  world.snatchCooldowns.set(key, world.hour);
  emit(world, { type: 'snatchProposed', hour: world.hour, proposal: proposal.id, by, target });
  return { ok: true, value: proposal };
}

/**
 * 被抢的人回应。同意：旧线按剪线处理（#3，两边各生怨），再和抢亲的人牵新线。
 * 拒绝：什么都不发生。过期的提议作废。
 */
export function respondSnatch(world: World, by: HouseId, proposalId: string, accept: boolean): Result<Thread | null> {
  const p = world.snatchProposals.get(proposalId);
  if (!p) return fail('提议不存在或已失效');
  if (p.target !== by) return fail('只有被抢的人能回应');
  world.snatchProposals.delete(proposalId);
  if (world.hour - p.at > world.config.snatch.proposalExpireDays * HOURS_PER_DAY) return fail('提议已经过期');
  if (!accept) {
    emit(world, { type: 'snatchResolved', hour: world.hour, proposal: p.id, accepted: false, from: null });
    return { ok: true, value: null };
  }
  if (isBlockedBetween(world, p.by, p.target)) return fail('双方之间有拉黑');
  const old = threadsOf(world, by);
  const from = old[0] ? otherSide(old[0], by) : null;
  for (const t of old) cutThread(world, by, t.id);
  const tied = tieThread(world, by, { kind: p.kind, house: p.by });
  if (!tied.ok) return tied;
  emit(world, { type: 'snatchResolved', hour: world.hour, proposal: p.id, accepted: true, from });
  return { ok: true, value: tied.value };
}
