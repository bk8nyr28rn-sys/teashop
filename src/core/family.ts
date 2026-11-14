import { addStrands } from './threads';
import type { ClanMember, Heir, HeirId, HouseId, Result, Thread, ThreadId, World } from './types';
import { emit, fail, getHouse, getThread, newId, ok, rankedThreads, spendAction } from './world';

const blockedBetween = (world: World, x: HouseId, y: HouseId): boolean =>
  getHouse(world, x).blocked.includes(y) || getHouse(world, y).blocked.includes(x);

/**
 * #9 每小时调用：红线按浓度慢慢结出族人，两边各结各的（回报递减默认关闭）。
 * 闭关不影响结族人：冻结只负责保护（不变淡、不生怨、冷落不计时、鬼不来），不停止成长。
 */
export function hourlyFamily(world: World): void {
  const need = world.config.family.memberStrandHours;
  for (const house of world.houses.values()) {
    for (const { thread, weight } of rankedThreads(world, house.id)) {
      if (thread.strands <= 0) continue;
      let progress = (thread.memberProgress[house.id] ?? 0) + thread.strands * weight;
      while (progress >= need) {
        progress -= need;
        birthMember(world, house.id, thread);
      }
      thread.memberProgress[house.id] = progress;
    }
  }
}

function birthMember(world: World, houseId: HouseId, thread: Thread): void {
  const house = getHouse(world, houseId);
  const cfg = world.config.family;
  if (house.members.length >= cfg.maxMembers) return;
  const member: ClanMember = {
    id: newId(world, 'm'),
    parents: [thread.a, thread.b ?? thread.npcName ?? 'NPC'],
    threadId: thread.id,
    cultivation: cfg.memberStartCultivation,
    injuredUntil: 0,
  };
  house.members.push(member);
  emit(world, { type: 'memberBorn', hour: world.hour, house: houseId, thread: thread.id });
}

/** 每天结算：没在疗伤的族人修为慢慢涨 */
export function dailyFamily(world: World): void {
  const per = world.config.family.memberCultivationPerDay;
  for (const house of world.houses.values()) {
    for (const m of house.members) if (m.injuredUntil <= world.hour) m.cultivation += per;
  }
}

/** #9 嫡传要双方都签署 */
export function signHeir(world: World, by: HouseId, threadId: ThreadId): Result {
  const thread = getThread(world, threadId);
  if (!thread.b) return fail('NPC 线结不出嫡传');
  if (thread.state !== 'active') return fail('这根线不在了');
  if (thread.a !== by && thread.b !== by) return fail('不是这根线的一方');
  if (thread.heirId) return fail('一段关系最多一位嫡传');
  if (!thread.heirSignatures.includes(by)) thread.heirSignatures.push(by);
  return ok();
}

export function canCreateHeir(world: World, threadId: ThreadId): Result {
  const thread = getThread(world, threadId);
  if (!thread.b) return fail('NPC 线结不出嫡传');
  if (thread.state !== 'active') return fail('这根线不在了');
  if (thread.heirId) return fail('一段关系最多一位嫡传');
  if (thread.strands < world.config.heir.strandThreshold) return fail('红线浓度还没到门槛');
  if (!thread.heirSignatures.includes(thread.a) || !thread.heirSignatures.includes(thread.b)) {
    return fail('需要双方都签署');
  }
  return ok();
}

/**
 * #9 #10 结出嫡传：继承双方特质的种类（不继承数值），消耗这根线的一部分浓度。
 * 灵根按消耗前的浓度算，出生时锁定。归属先空着（第一版由两人商量）。
 */
export function createHeir(world: World, threadId: ThreadId): Result<Heir> {
  const check = canCreateHeir(world, threadId);
  if (!check.ok) return check;
  const thread = getThread(world, threadId);
  const b = thread.b as HouseId;
  const before = thread.strands;
  addStrands(world, thread, -before * world.config.heir.consumeRatio);
  const traitKinds = [...new Set([...getHouse(world, thread.a).traits, ...getHouse(world, b).traits])];
  const heir: Heir = {
    id: newId(world, 'heir'),
    threadId,
    parents: [thread.a, b],
    traitKinds,
    spiritualRoot: before,
    home: null,
    companionship: { [thread.a]: 0, [b]: 0 },
    adulthoodDone: false,
    bornAt: world.hour,
  };
  world.heirs.set(heir.id, heir);
  thread.heirId = heir.id;
  thread.heirSignatures = [];
  emit(world, { type: 'heirBorn', hour: world.hour, heir: heir.id, thread: threadId });
  return { ok: true, value: heir };
}

function getHeir(world: World, id: HeirId): Heir {
  const heir = world.heirs.get(id);
  if (!heir) throw new Error(`unknown heir ${id}`);
  return heir;
}

/** 第一版简化归属：两人商量好，双方都同意就定 */
export function setHeirHomeByAgreement(world: World, heirId: HeirId, home: HouseId, consenting: HouseId[]): Result {
  const heir = getHeir(world, heirId);
  if (!heir.parents.includes(home)) return fail('只能记在父母其中一家');
  if (!heir.parents.every((p) => consenting.includes(p))) return fail('需要双方都同意');
  heir.home = home;
  emit(world, { type: 'heirHomeSet', hour: world.hour, heir: heirId, home, reason: 'agreed' });
  return ok();
}

/** 探望嫡传，攒陪伴值。#6 拉黑后，不住在自己家的一方不能再探望 */
export function visitHeir(world: World, by: HouseId, heirId: HeirId): Result {
  const heir = getHeir(world, heirId);
  if (!heir.parents.includes(by)) return fail('不是这位嫡传的父母');
  const [p, q] = heir.parents;
  if (heir.home !== by && blockedBetween(world, p, q)) return fail('双方之间有拉黑，不能去对方岛上');
  spendAction(getHouse(world, by));
  heir.companionship[by] = (heir.companionship[by] ?? 0) + 1;
  return ok();
}

/** 孩子的表态：谁陪得多偏向谁，一样多时随机 */
export function heirLean(world: World, heir: Heir): HouseId {
  const [p, q] = heir.parents;
  const cp = heir.companionship[p] ?? 0;
  const cq = heir.companionship[q] ?? 0;
  if (cp === cq) return world.rng.pick(heir.parents);
  return cp > cq ? p : q;
}

/** #6 分手时，归属还没定的嫡传按当时的表态直接定；已定的不变 */
export function settleHeirOnBreakup(world: World, thread: Thread): void {
  if (!thread.heirId) return;
  const heir = getHeir(world, thread.heirId);
  if (heir.home !== null) return;
  heir.home = heirLean(world, heir);
  emit(world, { type: 'heirHomeSet', hour: world.hour, heir: heir.id, home: heir.home, reason: 'breakup' });
}

/**
 * #15 成年时再表态一次，之后就定了。拉黑了的不再重选。
 * 哪个境界算成年还没定（要晚于第一次归属的触发点），由调用方决定何时调用。
 */
export function heirAdulthoodChoice(world: World, heirId: HeirId): Result<HouseId> {
  const heir = getHeir(world, heirId);
  if (heir.adulthoodDone) return fail('已经在成年时表过态了');
  heir.adulthoodDone = true;
  const [p, q] = heir.parents;
  if (blockedBetween(world, p, q)) {
    if (heir.home === null) heir.home = heirLean(world, heir);
    return { ok: true, value: heir.home };
  }
  heir.home = heirLean(world, heir);
  emit(world, { type: 'heirHomeSet', hour: world.hour, heir: heir.id, home: heir.home, reason: 'adulthood' });
  return { ok: true, value: heir.home };
}
