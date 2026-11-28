import { MULT, nearestGhost, nightStep, startNight, type Item, type NightAction, type NightOptions, type NightState } from '../../src/core/loop';
import { beijing, Server, type HauntLog, type NightLog, type Request, type Response } from '../../src/server';
import type { House, Person } from '../../src/core/loop';

/** 请求里除了账号和 opId 的部分（按每种请求分开 Omit，不然联合类型会塌成公共字段） */
type Body = Request extends infer R ? R extends unknown ? Omit<R, 'accountId' | 'opId'> & { opId?: string } : never : never;

/** 一台假手机：带着自己的 opId 计数，发请求给同一个服务器 */
export class Phone {
  private n = 0;
  constructor(readonly server: Server, readonly accountId: string) {}
  send(req: Body): Response {
    return this.server.handle({ accountId: this.accountId, opId: `${this.accountId}-${++this.n}`, ...req } as Request);
  }
  ok<T = any>(req: Body): T {
    const res = this.send(req);
    if (!res.ok) throw new Error(`${this.accountId} ${req.type}: ${res.error}`);
    return res.data as T;
  }
  login() { return this.ok({ type: 'login' }); }
  get life() { const w = this.server.world; return w.lives[w.accounts[this.accountId]!.lifeId]!; }
  get house() { return this.server.world.houses[this.life.houseId]!; }
}

/** 可以拨的钟 */
export function clock(date: string, hour = 12) {
  let now = beijing(date, hour);
  return { now: () => now, set(d: string, h = 12) { now = beijing(d, h); } };
}

/** 手机上打一夜：active 每步点最近的鬼、换克它的家伙，挑本事拿第一个；不 active 就站着不动 */
export function playNight(start: { house: House; person: Person; options: NightOptions }, active: boolean) {
  const n: NightState = startNight(JSON.parse(JSON.stringify(start.house)), JSON.parse(JSON.stringify(start.person)), start.options);
  const log: NightLog = [];
  for (let call = 0; call < 40000 && !n.over; call++) {
    const actions: NightAction[] = [];
    if (n.picking) actions.push({ type: 'perk', id: n.offer[0]! });
    else if (active) {
      // 隐身鬼也要盯着：换灯笼它就现形了
      const g = nearestGhost(n, false);
      if (g) {
        const best = (Object.keys(MULT) as Item[]).sort((a, b) => MULT[b][g.type] - MULT[a][g.type])[0]!;
        if (best !== n.item) actions.push({ type: 'item', item: best });
        actions.push({ type: 'hit', id: g.id });
      }
    }
    if (actions.length) log.push([call, actions]);
    nightStep(n, actions);
  }
  return { log, state: n };
}

/** 当厉鬼：一直砸，弩机亮红光就躲 */
export function bashAll(): HauntLog {
  const log: HauntLog = [];
  for (let call = 0; call < 600; call++) log.push([call, ['bash']]);
  return log;
}

/** 两个新账号，各自过完第 1 天（交给机关守），天亮到第 2 天，都成年了 */
export function twoAdults(server: Server) {
  const a = new Phone(server, 'a'), b = new Phone(server, 'b');
  for (const p of [a, b]) {
    p.login();
    p.ok({ type: 'dawn' });
    p.ok({ type: 'nightBegin', mode: 'delegated' });
    p.ok({ type: 'dawn' });
  }
  return { a, b };
}

/** 牵红线：a 提，b 答应 */
export function marry(a: Phone, b: Phone) {
  const { pending } = a.ok({ type: 'proposeBond', to: b.life.id });
  b.ok({ type: 'respond', askId: pending, accept: true });
}

/** b 搬进 a 的房（a 答应） */
export function moveTogether(a: Phone, b: Phone) {
  const { pending } = b.ok({ type: 'moveIn', houseId: a.life.houseId });
  a.ok({ type: 'respond', askId: pending, accept: true });
}
