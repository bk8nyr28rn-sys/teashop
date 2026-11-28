import {
  autoLossLimit, CFG, FAMILY, nightPayout, nightStep, planNightLoot, settleAutoNight, startDay, startNight,
  type House, type NightAction, type NightOptions, type NightState, type Person,
} from '../core/loop';
import { SERVER } from './config';
import { markGuarded, touchHouse } from './house';
import type { HouseDoc, Life, NightDoc, NightOutcome } from './model';
import { clone, fail, type Ctx } from './world';

/** 手机交上来的守夜记录：第几次调用 nightStep，那一步之前点了什么 */
export type NightLog = Array<[call: number, actions: NightAction[]]>;

function snapshot(house: HouseDoc): House {
  return { door: house.door, traps: { ...house.traps }, chest: house.chest, store: {}, treasures: clone(house.treasures) };
}

/** 从开打那一刻起，照记录一步一步重放。和手机用的是同一份规则核心 */
export function replayNight(start: NightDoc['start'], log: NightLog): NightState {
  const n = startNight(clone(start.house), clone(start.person), start.options);
  const byCall = new Map<number, NightAction[]>();
  let last = -1;
  for (const [call, actions] of log) {
    if (!Number.isSafeInteger(call) || call < 0 || !Array.isArray(actions)) fail('守夜记录格式不对');
    byCall.set(call, [...(byCall.get(call) ?? []), ...actions]);
    last = Math.max(last, call);
  }
  for (let call = 0; call <= last + SERVER.nightTailCalls && !n.over; call++) nightStep(n, byCall.get(call) ?? []);
  return n;
}

function afterNight(life: Life): void {
  life.openNightId = null;
  life.phase = life.person.day >= CFG.lifeDays ? 'old' : 'dawn';
}

/** 天黑点「守夜」。hand：手机打，打完交记录；delegated：交给机关，马上出结果 */
export function nightBegin(ctx: Ctx, life: Life, mode: 'hand' | 'delegated') {
  if (life.phase !== 'day' || life.openNightId) fail('现在不能守夜');
  const house = ctx.house(life.houseId);
  touchHouse(ctx, house);
  const seed = ctx.seed();
  const bond = life.bondId ? ctx.w.bonds[life.bondId] : null;
  const spouse = bond ? (bond.a === life.id ? bond.b : bond.a) : null;
  const kin = kinHelpers(ctx, life);
  const options: NightOptions = { seed, lossBase: house.chest, spouse: !!spouse && house.residents.includes(spouse),
    kin: kin.map(k => k.id) };
  const night: NightDoc = {
    id: ctx.id('night'), lifeId: life.id, houseId: house.id, realDate: ctx.today, day: life.person.day, seed,
    plan: planNightLoot(seed, house.treasures),
    // 开打那一刻房里还住着别的真人 → 谁输谁疼（11-28 定）
    lossMode: ctx.realResidents(house, life.id).length ? 'shared' : 'solo',
    start: { house: snapshot(house), person: clone(life.person), options }, status: 'open',
  };
  ctx.w.nights[night.id] = night;
  markGuarded(ctx, house);
  life.openNightId = night.id;
  life.phase = 'night';
  if (mode === 'delegated') return { nightId: night.id, outcome: settleByTraps(ctx, life, night, 'delegated') };
  // 手机拿 helpCandidates 列出能喊的人让玩家挑；族人的名字在这里
  return { nightId: night.id, seed, options, start: night.start, kin };
}

/** 同族、活着的真人，没在设置里关掉「族人可以喊我去帮忙」。住哪座房都行 */
export function kinHelpers(ctx: Ctx, life: Life): Array<{ id: string; name: string }> {
  return Object.values(ctx.w.lives).filter(l => l.clanId === life.clanId && l.id !== life.id && l.accountId !== null
    && l.phase !== 'dead' && ctx.w.accounts[l.accountId]?.allowKinHelp !== false).map(l => ({ id: l.id, name: l.name }));
}

/** 交给机关守，或者隔天才回来（当交给机关守，没有纸钱）。和单机一样用规则核心的 settleAutoNight */
export function settleByTraps(ctx: Ctx, life: Life, night: NightDoc, mode: 'delegated' | 'offline'): NightOutcome {
  const house = ctx.house(night.houseId);
  const game = {
    houseId: house.id, lifeId: life.id, lifeNo: life.lifeNo, nightId: life.nightId, day: life.person.day,
    door: house.door, traps: house.traps, chest: house.chest, purse: life.person.purse,
    held: life.held, broken: life.broken, phase: 'home', nightPlan: null, receipts: {}, allFeatures: true,
  };
  const receipt = settleAutoNight(game, { mode, seed: night.seed, nightId: life.nightId + 1, allowLoss: true,
    progress: true, realDate: night.realDate });
  if (!receipt) fail('这一夜的账对不上');
  house.chest = game.chest;
  life.person.purse = game.purse;
  life.held = game.held;
  life.nightId = game.nightId;
  ctx.ledger(life.id, house.id, -receipt.chestLost, receipt.earnedMoney, mode === 'delegated' ? '交给机关守' : '隔天才回来，当交给机关守');
  const outcome: NightOutcome = { won: receipt.won, kills: 0, earnedMoney: receipt.earnedMoney, purseLost: 0,
    chestLost: receipt.chestLost, lostTreasure: null, suspicious: false };
  night.status = 'settled';
  night.mode = mode;
  night.result = outcome;
  afterNight(life);
  return outcome;
}

/** 亲手守完，交上记录。服务器重放，结果以重放为准 */
export function nightEnd(ctx: Ctx, life: Life, nightId: string, log: NightLog, claim?: { won: boolean }) {
  const night = ctx.w.nights[nightId];
  if (!night || night.lifeId !== life.id || life.openNightId !== nightId) fail('没有这一夜');
  if (night.status !== 'open') fail('这一夜已经结过账了');
  // 打到一半离开：当天回来接着打；隔天才回来，那一夜当交给机关守（11-20 定）
  if (ctx.today !== night.realDate) return { outcome: settleByTraps(ctx, life, night, 'offline'), stale: true };
  const n = replayNight(night.start, log);
  if (!n.over || !n.result) fail('这一夜还没打完');
  const house = ctx.house(night.houseId);
  const won = n.result.won;
  const pay = nightPayout(night.plan, { purse: life.person.purse, chest: house.chest, treasures: house.treasures }, won, n.result.coins);
  let chestLost = pay.chestLost, lostIndex = pay.lostTreasureIndex;
  if (night.lossMode === 'shared' && !won) {
    // 谁输谁疼：钱袋照常被抢；钱箱按交给机关的上限，不丢宝物
    chestLost = Math.min(chestLost, autoLossLimit(house.chest, life.lifeNo));
    lostIndex = null;
  }
  const lostTreasure = lostIndex === null ? null : house.treasures.splice(lostIndex, 1)[0] ?? null;
  life.person.purse += pay.earnedMoney - pay.purseLost;
  house.chest -= chestLost;
  life.nightId++;
  if (won) { life.held++; life.kills += n.result.kills; } else life.broken++;
  for (const [id, gain] of Object.entries(n.result.friendship)) {
    life.person.friends[id] = (life.person.friends[id] ?? 0) + gain;
  }
  // 喊来帮忙的是族人：他上线时看到
  const helper = n.helper ? ctx.w.lives[n.helper] : undefined;
  if (helper) ctx.tell({ lifeId: helper.id }, 'helped', `${life.name}夜里喊你去帮忙守门，你去了。` + (won ? '门守住了。' : '可惜门还是破了。'));
  const suspicious = !!claim && claim.won !== won;
  if (suspicious) ctx.w.suspects.push({ opId: ctx.opId, lifeId: life.id, nightId, claimed: claim!.won, replayed: won, realDate: ctx.today });
  ctx.ledger(life.id, house.id, -chestLost, pay.earnedMoney - pay.purseLost, '亲手守夜');
  if (!won) {
    ctx.tell({ houseId: house.id }, 'broken', `${life.name}守夜没守住，门破了。` + (chestLost ? `钱箱少了 ${chestLost} 文` : '钱箱一文没少')
      + (lostTreasure ? `，${lostTreasure.n}被抢走了。` : '。'));
  }
  const outcome: NightOutcome = { won, kills: n.result.kills, earnedMoney: pay.earnedMoney, purseLost: pay.purseLost,
    chestLost, lostTreasure, suspicious };
  night.status = 'settled';
  night.mode = 'hand';
  night.result = outcome;
  afterNight(life);
  return { outcome, stale: false };
}

/** 隔天才回来，还开着的那一夜当交给机关守 */
export function settleStaleNight(ctx: Ctx, life: Life): void {
  const night = life.openNightId ? ctx.w.nights[life.openNightId] : null;
  if (night && night.status === 'open' && night.realDate < ctx.today) settleByTraps(ctx, life, night, 'offline');
}

/** 天亮：花一个攒的天，开始新的一天。红线天亮涨一次，一个现实日只涨一次 */
export function dawn(ctx: Ctx, life: Life, bank: Parameters<typeof startDay>[0]) {
  if (life.phase !== 'dawn') fail('还没到天亮');
  const person: Person = life.person;
  if (!startDay(bank, person, ctx.today, life.nightId === 0 ? 'first' : 'next')) fail('攒的天用完了，明天再来');
  const bond = life.bondId ? ctx.w.bonds[life.bondId] : null;
  if (bond && bond.lastDawnDate !== ctx.today) {
    bond.love = Math.min(FAMILY.maxLove, bond.love + FAMILY.dawnLove);
    bond.lastDawnDate = ctx.today;
  }
  life.phase = 'day';
  return { day: person.day };
}
