import {
  autoLossLimit, CFG, FAMILY, nightPayout, nightStep, planNightLoot, settleAutoNight, startDay, startNight,
  type House, type NightAction, type NightOptions, type NightState, type Person,
} from '../core/loop';
import { CLAN, SERVER } from './config';
import { markGuarded, touchHouse } from './house';
import type { HelpCall, HouseDoc, Life, NightDoc, NightOutcome } from './model';
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
  // 亲手守：弹给同族的人「正在被鬼砸门，去帮忙吗」
  let callId: string | null = null;
  if (kin.length) {
    const call: HelpCall = { id: ctx.id('help'), nightId: night.id, hostLifeId: life.id, houseId: house.id, realDate: ctx.today,
      kin: kin.map(k => k.id), answers: {}, used: null, status: 'open' };
    ctx.w.helpCalls[call.id] = call;
    night.helpCallId = callId = call.id;
    for (const k of kin) ctx.tell({ lifeId: k.id }, 'helpCall', `${life.name}家正在被鬼砸门！去帮忙吗？`);
  }
  // ready：现在就能喊（他设置了不在线时自动派人）；别的要等他点「去帮忙」
  return { nightId: night.id, seed, options, start: night.start, callId,
    kin: kin.map(k => ({ ...k, ready: canSend(ctx, k.id, {}) })) };
}

/** 同族、活着的真人，住哪座房都行 */
export function kinHelpers(ctx: Ctx, life: Life): Array<{ id: string; name: string }> {
  return Object.values(ctx.w.lives).filter(l => l.clanId === life.clanId && l.id !== life.id && l.accountId !== null
    && l.phase !== 'dead').map(l => ({ id: l.id, name: l.name }));
}

/** 他能不能来：他点了「去帮忙」，或者没回答、设置里开着「不在线时自动派我的人去」 */
function canSend(ctx: Ctx, lifeId: string, answers: HelpCall['answers']): boolean {
  if (answers[lifeId]) return answers[lifeId] === 'go';
  const accountId = ctx.w.lives[lifeId]?.accountId;
  return !!accountId && ctx.w.accounts[accountId]?.autoHelpKin !== false;
}

function openCall(ctx: Ctx, callId: string): HelpCall {
  const call = ctx.w.helpCalls[callId];
  if (!call || call.status !== 'open' || call.realDate !== ctx.today) fail('这一夜已经结束了');
  return call;
}

/** 族人看到弹窗：去帮忙（一起打），或者不去 */
export function answerHelp(ctx: Ctx, life: Life, callId: string, go: boolean) {
  const call = openCall(ctx, callId);
  if (!call.kin.includes(life.id)) fail('没有喊你');
  if (call.used === life.id) fail('你的人已经过去了');
  call.answers[life.id] = go ? 'go' : 'skip';
  return { answer: call.answers[life.id] };
}

/** 主人点「喊人」挑了谁：服务器当场定下，之后谁都改不了；重放时只认这一个族人 */
export function useHelp(ctx: Ctx, life: Life, callId: string, helperId: string) {
  const call = openCall(ctx, callId);
  if (call.hostLifeId !== life.id) fail('这不是你家的夜');
  if (call.used) fail('今晚已经喊过人了');
  if (!call.kin.includes(helperId) || !canSend(ctx, helperId, call.answers)) fail('他今晚来不了');
  call.used = helperId;
  return { helperId };
}

function closeCall(ctx: Ctx, night: NightDoc): HelpCall | null {
  const call = night.helpCallId ? ctx.w.helpCalls[night.helpCallId] : undefined;
  if (!call) return null;
  call.status = 'closed';
  return call;
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
  closeCall(ctx, night);
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
  // 族人只认主人当场喊定的那一个：他点了「去帮忙」→ 实时一起打（记录里的 join）；
  // 没回答、按设置自动派人 → 电脑操控他的人物（help）。记录里偷偷加别人，重放时那一下不算
  const call = closeCall(ctx, night);
  const live = call?.used && call.answers[call.used] === 'go' ? ctx.w.lives[call.used] ?? null : null;
  const auto = call?.used && !call.answers[call.used] ? call.used : null;
  const n = replayNight({ ...night.start, options: { ...night.start.options, kin: auto ? [auto] : [] } }, cleanJoins(log, live));
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
  // 一起打的援兵：门守住了，两个人都拿全份纸钱
  const guest = live && n.guests?.some(g => g.id === live.id) ? live : null;
  if (guest) {
    if (won) {
      guest.person.purse += pay.earnedMoney;
      ctx.ledger(guest.id, guest.houseId, 0, pay.earnedMoney, `和${life.name}一起守门`);
    }
    ctx.tell({ lifeId: guest.id }, 'fought', `你和${life.name}一起守门，` + (won ? `守住了，带回 ${pay.earnedMoney} 文。` : '可惜门还是破了。'));
  }
  // 族人派人来帮了忙（电脑操控）：他上线时看到；门守住了，他钱袋里多几文
  const helper = n.helper ? ctx.w.lives[n.helper] : undefined;
  if (helper) {
    if (won) {
      helper.person.purse += CLAN.helpReward;
      ctx.ledger(helper.id, helper.houseId, 0, CLAN.helpReward, `帮${life.name}守门`);
    }
    ctx.tell({ lifeId: helper.id }, 'helped', `你的人去帮${life.name}守门了，` + (won ? `门守住了，带回 ${CLAN.helpReward} 文。` : '可惜门还是破了。'));
  }
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

/** 援兵进来那一下：只认服务器喊定的那个人，强弱、体力、年纪用服务器记的（手机报的不算） */
function cleanJoins(log: NightLog, live: Life | null): NightLog {
  return log.map(([call, actions]) => [call, actions.flatMap((a): NightAction[] => {
    if (a.type !== 'join') return [a];
    if (!live || a.by !== live.id) return [];
    return [{ type: 'join', by: live.id, item: a.item, power: live.person.power, hp: live.person.hp, day: live.person.day }];
  })]);
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
