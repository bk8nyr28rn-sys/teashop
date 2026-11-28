import { accrueDays, makeDayBank, RULE_VERSION } from '../core/loop';
import { die, foundHouse, moveIn, newFamilyLife, bornInto, openCradle, openCradles, proposeBond, reborn, respond } from './clan';
import { realDate } from './clock';
import { runDayOps, type DayOp } from './day';
import { touchHouse } from './house';
import { emptyWorld, type World } from './model';
import { dawn, nightBegin, nightEnd, settleStaleNight, type NightLog } from './night';
import { raidBegin, raidEnd, type HauntLog } from './raid';
import { clone, Ctx, Fail, fail } from './world';

/** 手机发来的一次请求。改东西的请求都要带 opId，网络重试时用同一个 */
export type Request = { accountId: string; opId?: string; ruleVersion?: number; baseRev?: number } & (
  | { type: 'login' }
  | { type: 'view' }
  | { type: 'batch'; ops: DayOp[] }
  | { type: 'nightBegin'; mode: 'hand' | 'delegated' }
  | { type: 'nightEnd'; nightId: string; log: NightLog; claim?: { won: boolean } }
  | { type: 'dawn' }
  | { type: 'settings'; allowKinHelp: boolean }
  | { type: 'foundHouse'; amount: number }
  | { type: 'moveIn'; houseId: string }
  | { type: 'proposeBond'; to: string }
  | { type: 'respond'; askId: string; accept: boolean }
  | { type: 'openCradle' }
  | { type: 'die' }
  | { type: 'reborn'; cradleId?: string }
  | { type: 'raidBegin' }
  | { type: 'raidEnd'; raidId: string; log: HauntLog }
);

export type Response =
  | { ok: true; data: unknown; rev?: number; rebased?: boolean; replayed?: boolean }
  | { ok: false; error: string };

const READ_ONLY = new Set(['login', 'view']);

/**
 * 本地假服务器（S0）。每个请求：复制一份世界 → 交给处理函数 → 出错整份丢掉，成功才换上。
 * 真服务器换成数据库的事务，处理函数不用改（docs/SERVER_SPEC.md 第八节）。
 */
export class Server {
  world: World;
  private readonly now: () => number;

  constructor(options: { now?: () => number; seed?: number; world?: World } = {}) {
    this.now = options.now ?? Date.now;
    this.world = options.world ?? emptyWorld(options.seed ?? 1);
  }

  today(): string {
    return realDate(this.now());
  }

  handle(req: Request): Response {
    if (req.ruleVersion !== undefined && req.ruleVersion !== RULE_VERSION) return { ok: false, error: '游戏有新版本，请更新' };
    const mutating = !READ_ONLY.has(req.type);
    if (mutating && !req.opId) return { ok: false, error: '缺少 opId' };
    if (req.opId && req.opId in this.world.ops) return { ...(this.world.ops[req.opId] as Response), replayed: true } as Response;
    const draft = clone(this.world);
    const ctx = new Ctx(draft, this.today(), req.opId ?? 'read');
    let response: Response;
    try {
      const before = req.accountId in draft.accounts ? draft.houses[draft.lives[draft.accounts[req.accountId]!.lifeId]!.houseId] : undefined;
      const rebased = req.baseRev !== undefined && before !== undefined && before.rev !== req.baseRev;
      const data = route(ctx, req);
      this.bumpRevs(draft);
      const account = draft.accounts[req.accountId];
      const house = account ? draft.houses[draft.lives[account.lifeId]!.houseId] : undefined;
      response = { ok: true, data, rev: house?.rev, ...(rebased ? { rebased } : {}) };
    } catch (error) {
      if (!(error instanceof Fail)) throw error;
      response = { ok: false, error: error.message };
      // 失败也记下 opId：同一个请求重试，还是同一个回答
      if (req.opId) this.world.ops[req.opId] = response;
      return response;
    }
    if (req.opId) draft.ops[req.opId] = response;
    this.world = draft;
    return response;
  }

  /** 改过的房 rev +1。手机带着旧 rev 来，就知道别的家人刚改过 */
  private bumpRevs(draft: World): void {
    for (const [id, house] of Object.entries(draft.houses)) {
      const old = this.world.houses[id];
      if (!old) continue;
      const strip = (h: typeof house) => JSON.stringify({ ...h, rev: 0 });
      if (strip(old) !== strip(house)) house.rev = old.rev + 1;
    }
  }
}

function route(ctx: Ctx, req: Request): unknown {
  if (req.type === 'login') return login(ctx, req.accountId);
  const { account, life } = ctx.me(req.accountId);
  switch (req.type) {
    case 'view': return view(ctx, req.accountId);
    case 'batch': runDayOps(ctx, life, req.ops); return view(ctx, req.accountId);
    case 'nightBegin': return nightBegin(ctx, life, req.mode);
    case 'nightEnd': return nightEnd(ctx, life, req.nightId, req.log, req.claim);
    case 'dawn': return dawn(ctx, life, account.bank);
    case 'settings':
      if (typeof req.allowKinHelp !== 'boolean') fail('设置不对');
      account.allowKinHelp = req.allowKinHelp;
      return { allowKinHelp: account.allowKinHelp };
    case 'foundHouse': return foundHouse(ctx, life, req.amount);
    case 'moveIn': return moveIn(ctx, life, req.houseId);
    case 'proposeBond': return proposeBond(ctx, life, req.to);
    case 'respond': return respond(ctx, life, req.askId, req.accept);
    case 'openCradle': return openCradle(ctx, life);
    case 'die': return die(ctx, life);
    case 'reborn': return reborn(ctx, account, req.cradleId);
    case 'raidBegin': return raidBegin(ctx, life);
    case 'raidEnd': return raidEnd(ctx, life, req.raidId, req.log);
  }
  return fail('不认识的请求');
}

/** 进游戏：新账号先找个空位投胎（没有就一户新人家）；老账号补攒天、补不在线的夜、补隔天才回来的那一夜 */
function login(ctx: Ctx, accountId: string) {
  let account = ctx.w.accounts[accountId];
  if (!account) {
    const cradles = openCradles(ctx);
    const pick = cradles.length ? ctx.pick(cradles) : null;
    account = { id: accountId, bank: makeDayBank(ctx.today), lifeId: '' };
    ctx.w.accounts[accountId] = account;
    account.lifeId = (pick ? bornInto(ctx, accountId, 1, pick.house, pick.cradle) : newFamilyLife(ctx, accountId, 1)).id;
  }
  accrueDays(account.bank, ctx.today);
  const life = ctx.life(account.lifeId);
  settleStaleNight(ctx, life);
  if (life.phase !== 'dead') touchHouse(ctx, ctx.house(life.houseId));
  return view(ctx, accountId);
}

function view(ctx: Ctx, accountId: string) {
  const { account, life } = ctx.me(accountId);
  const house = ctx.house(life.houseId);
  return {
    bank: account.bank, life, house, clan: ctx.clan(life.clanId),
    inbox: ctx.w.inbox.filter(m => m.houseId === house.id || m.lifeId === life.id).slice(-20),
    asks: Object.values(ctx.w.asks).filter(a => a.status === 'open' && a.askers.includes(life.id)),
  };
}
