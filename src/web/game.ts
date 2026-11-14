/**
 * 网页原型的游戏控制层：建世界、两位机器人玩家、现实时间推进、离线结算、存档。
 * 规则全部来自 src/core，这里只负责“什么时候调用”。
 */
import {
  addHouse,
  addStrands,
  advanceHour,
  attemptTribulation,
  bigInteract,
  blockHouse,
  brewBreakthroughPill,
  brewHealingPill,
  checkIn,
  collectMeditation,
  createHeir,
  createWorld,
  cutThread,
  describeEvent,
  deserializeWorld,
  interact,
  proposeSnatch,
  reconcile,
  reconcileQuarrel,
  repairFormation,
  respondSnatch,
  serializeWorld,
  setHeirHomeByAgreement,
  signHeir,
  startRetreat,
  threadsOf,
  tieThread,
  upgradeFormation,
  type GameEvent,
  type Result,
  type Tone,
  type World,
} from '../core';
import { PROFILES, isOnline, playSession, startOfDay, type Agent } from '../sim/agents';

export const ME = 'me';
export const QING = 'qing';
export const BAILU = 'bailu';

export type Speed = 'pause' | 'real' | 'fast' | 'turbo';

/** 每毫秒现实时间推进多少游戏小时 */
export const SPEED_RATE: Record<Speed, number> = {
  pause: 0,
  real: 1 / 3_600_000,
  fast: 1 / 2000,
  turbo: 1 / 200,
};

export const SPEED_LABEL: Record<Speed, string> = {
  pause: '暂停',
  real: '实时',
  fast: '快进',
  turbo: '极速',
};

export interface LogEntry {
  hour: number;
  text: string;
  tone: Tone;
}

interface Saved {
  world: string;
  lastRealMs: number;
  speed: Speed;
  log: LogEntry[];
  qingBudget: number;
  lastCheckInHour: number;
}

const STORAGE_KEY = 'teashop-prototype-v1';
/** 离线结算最多补多少小时 */
const MAX_CATCHUP_HOURS = 14 * 24;
/** 两次上线之间至少隔多少游戏小时，才算新的一次上线（checkIn） */
const SESSION_GAP_HOURS = 6;

export class Game {
  world: World;
  speed: Speed = 'fast';
  log: LogEntry[] = [];
  /** 最近一次操作的提示（失败原因等） */
  notice: { text: string; tone: Tone } | null = null;
  qing: Agent;
  private lastCheckInHour = -Infinity;
  private acc = 0;
  private lastTick = Date.now();
  /** 正在补离线时间：这段时间里“我”不在线 */
  private catchingUp = false;

  constructor() {
    const loaded = this.load();
    if (loaded) {
      this.world = loaded.world;
      this.qing = makeQing(loaded.qingBudget);
      this.catchUpOffline(loaded.lastRealMs, loaded.speed);
    } else {
      this.world = newWorld();
      this.qing = makeQing(0);
      this.say('锣鼓响起，新的一出开台了。你和阿青已经牵上一根红线。前三天有新手保护，先收灵石、升符阵。', 'info');
    }
    this.attachListener();
    this.sessionCheckIn();
  }

  // ---------- 时间 ----------

  /** 每帧调用；返回这一帧是否推进了时间 */
  tick(): boolean {
    const now = Date.now();
    this.acc += (now - this.lastTick) * SPEED_RATE[this.speed];
    this.lastTick = now;
    let stepped = false;
    let budget = 72;
    while (this.acc >= 1 && budget-- > 0) {
      this.stepHour(this.isMeOnline());
      this.acc -= 1;
      stepped = true;
    }
    if (this.acc > 1) this.acc = 1;
    return stepped;
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
    this.lastTick = Date.now();
    this.save();
  }

  isMeOnline(): boolean {
    if (this.catchingUp || this.speed === 'pause') return false;
    return typeof document === 'undefined' || document.visibilityState === 'visible';
  }

  private stepHour(meOnline: boolean): void {
    const w = this.world;
    if (w.hour % 24 === 0) {
      startOfDay(w, this.qing);
      this.maybeBailuSnatch();
    }
    const qingOnline = isOnline(w, this.qing);
    if (qingOnline) playSession(w, this.qing, (id) => id === ME && meOnline, { decideHeirHome: false });
    advanceHour(w, (h) => (h.id === ME ? meOnline : h.id === QING ? qingOnline : false));
    if (w.hour % 6 === 0) this.save();
  }

  /** 白露偶尔来抢亲：只在你设了专一、并且已经牵着线时 */
  private maybeBailuSnatch(): void {
    const w = this.world;
    const me = w.houses.get(ME)!;
    if (me.openness !== 'devoted' || threadsOf(w, ME).length === 0) return;
    if ([...w.snatchProposals.values()].some((p) => p.target === ME)) return;
    if (w.rng.chance(0.05)) proposeSnatch(w, BAILU, ME, 'friend');
  }

  private catchUpOffline(lastRealMs: number, savedSpeed: Speed): void {
    const elapsed = Math.max(0, Date.now() - lastRealMs);
    const hours = Math.min(MAX_CATCHUP_HOURS, Math.floor(elapsed * SPEED_RATE[savedSpeed]));
    this.speed = savedSpeed === 'pause' ? 'pause' : savedSpeed;
    if (hours <= 0) return;
    this.catchingUp = true;
    this.attachListener();
    for (let i = 0; i < hours; i++) this.stepHour(false);
    this.catchingUp = false;
    this.say(`你离开了 ${hours} 个时辰（游戏小时），这期间的事都已结算。`, 'info');
  }

  /** 上线：两次上线之间隔够了才算新的一次（和好期限按它算） */
  sessionCheckIn(): void {
    if (this.world.hour - this.lastCheckInHour < SESSION_GAP_HOURS) return;
    checkIn(this.world, ME);
    this.lastCheckInHour = this.world.hour;
  }

  // ---------- 日志 ----------

  private attachListener(): void {
    this.world.listener = (e: GameEvent) => {
      const m = describeEvent(this.world, e, ME);
      if (m) this.say(m.text, m.tone);
    };
  }

  say(text: string, tone: Tone): void {
    this.log.unshift({ hour: this.world.hour, text, tone });
    if (this.log.length > 80) this.log.length = 80;
  }

  // ---------- 玩家操作 ----------

  /** 包一层：每次操作都算一次上线检查；失败时显示原因 */
  private act<T>(fn: () => Result<T>, ok?: (v: T) => string | null): void {
    this.sessionCheckIn();
    const r = fn();
    if (!r.ok) this.notice = { text: r.reason, tone: 'bad' };
    else {
      const msg = ok?.(r.value) ?? null;
      this.notice = msg ? { text: msg, tone: 'info' } : null;
    }
    this.save();
  }

  collect(): void {
    this.sessionCheckIn();
    const got = collectMeditation(this.world, ME);
    this.notice = { text: got > 0 ? `收得 ${Math.round(got)} 灵石，修为也涨了。` : '刚收过，再打会儿坐。', tone: 'info' };
    this.save();
  }

  upgrade = () => this.act(() => upgradeFormation(this.world, ME), () => '符阵升了一级。');
  repair = () => this.act(() => repairFormation(this.world, ME), (n) => `修好了 ${n} 处阵眼。`);
  healPill = () => this.act(() => brewHealingPill(this.world, ME), () => '疗伤丹服下，族人痊愈。');
  breakPill = () => this.act(() => brewBreakthroughPill(this.world, ME), () => '炼成一颗破境丹。');
  tribulation = () => this.act(() => attemptTribulation(this.world, ME), () => null);
  retreat = (days: number) => this.act(() => startRetreat(this.world, ME, days), () => `闭关 ${days} 天：红线冻结，鬼不登门。`);

  toggleOpenness(): void {
    const me = this.world.houses.get(ME)!;
    me.openness = me.openness === 'open' ? 'devoted' : 'open';
    this.notice = { text: me.openness === 'open' ? '你的 OC 改为“开放”。' : '你的 OC 改为“专一”。', tone: 'info' };
    this.save();
  }

  tieNpc(name: string): void {
    const n = name.trim() || '无名散修';
    this.act(() => tieThread(this.world, ME, { kind: 'npc', name: n }), () => `与散修${n}牵上了线。旧线会因心力分散变淡，要多维护。`);
  }

  talk = (threadId: string, risky: boolean) => this.act(() => interact(this.world, ME, threadId, { risky }), () => null);

  big(threadId: string, stake: number): void {
    const t = this.world.threads.get(threadId)!;
    const partnerPresent = t.b === QING && isOnline(this.world, this.qing);
    this.act(() => bigInteract(this.world, ME, threadId, stake, partnerPresent), () => null);
  }

  makeUp = (threadId: string) =>
    this.act(
      () => reconcileQuarrel(this.world, ME, threadId),
      (v) => (v.done ? null : '你先递了台阶，等 TA 也来和好。'),
    );

  cut = (threadId: string) => this.act(() => cutThread(this.world, ME, threadId), () => null);

  /** 复合：真人搭档（阿青）在期限内总会答应 */
  reunite(threadId: string): void {
    const t = this.world.threads.get(threadId)!;
    const consent = t.b ? [t.a, t.b] : [t.a];
    this.act(() => reconcile(this.world, threadId, consent), () => null);
  }

  block = (other: string) => this.act(() => blockHouse(this.world, ME, other), () => null);

  /** 签署结嫡传；阿青浓度够了也会签，双方都签了就结出来 */
  sign(threadId: string): void {
    this.act(
      () => {
        const s = signHeir(this.world, ME, threadId);
        if (!s.ok) return s;
        const made = createHeir(this.world, threadId);
        return { ok: true, value: made.ok };
      },
      (born) => (born ? null : '你签了，等 TA 也签。'),
    );
  }

  /** 第一版简化归属：两人商量，这里阿青总会同意你的提议 */
  setHome = (heirId: string, home: string) =>
    this.act(() => setHeirHomeByAgreement(this.world, heirId, home, [ME, QING]), () => null);

  answerSnatch = (proposalId: string, accept: boolean) =>
    this.act(() => respondSnatch(this.world, ME, proposalId, accept), (t) => (t ? '你随白露去了。旧线已剪。' : '你回绝了白露。'));

  newGame(): void {
    this.world = newWorld();
    this.qing = makeQing(0);
    this.log = [];
    this.notice = null;
    this.lastCheckInHour = -Infinity;
    this.attachListener();
    this.sessionCheckIn();
    this.say('新开一局。你和阿青已经牵上一根红线。前三天有新手保护，先收灵石、升符阵。', 'info');
    this.save();
  }

  // ---------- 存档 ----------

  save(): void {
    const data: Saved = {
      world: serializeWorld(this.world),
      lastRealMs: Date.now(),
      speed: this.speed,
      log: this.log,
      qingBudget: this.qing.loveBudget,
      lastCheckInHour: Number.isFinite(this.lastCheckInHour) ? this.lastCheckInHour : -1e9,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // 隐私模式等情况下存不了，游戏照常玩，只是关掉就没了
    }
  }

  private load(): (Omit<Saved, 'world'> & { world: World }) | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as Saved;
      const world = deserializeWorld(data.world);
      this.log = data.log ?? [];
      this.lastCheckInHour = data.lastCheckInHour ?? -Infinity;
      return { ...data, world };
    } catch {
      return null;
    }
  }
}

function newWorld(): World {
  const w = createWorld({ seed: Math.floor(Math.random() * 1e9), recordEvents: false });
  addHouse(w, { id: ME, name: '你', stones: 120, traits: ['文武生'] });
  addHouse(w, { id: QING, name: '阿青', openness: 'devoted', traits: ['正印花旦'] });
  addHouse(w, { id: BAILU, name: '白露', realm: 3, traits: ['武生'] });
  const t = tieThread(w, ME, { kind: 'friend', house: QING });
  if (t.ok) addStrands(w, t.value, 12);
  return w;
}

function makeQing(loveBudget: number): Agent {
  return {
    houseId: QING,
    archetype: 'couple',
    profile: { ...PROFILES.couple, sessionHours: [9, 13, 21], activeDayChance: 0.9 },
    activeToday: true,
    loveBudget,
  };
}
