/**
 * 网页原型的游戏控制层：建世界、两位机器人玩家、现实时间推进、离线结算、存档。
 * 规则全部来自 src/core，这里只负责“什么时候调用”。
 */
import {
  addHouse,
  addStrands,
  finishRaid,
  raidRepair,
  raidReinforce,
  raidStep,
  raidTap,
  raidUpgrade,
  startRaid,
  type RaidReward,
  type RaidState,
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
  updateProfile,
  upgradeFormation,
  type Appearance,
  type GameEvent,
  type Gender,
  type GhostKind,
  type Result,
  type Thread,
  type Tone,
  type World,
} from '../core';
import { PROFILES, isOnline, playSession, startOfDay, type Agent } from '../sim/agents';
import { migrateLook, migrateTraits } from './art';

export const ME = 'me';
export const QING = 'qing';
export const BAILU = 'bailu';

export type Speed = 'pause' | 'real' | 'fast' | 'turbo';
export const SPEEDS: Speed[] = ['pause', 'real', 'fast', 'turbo'];

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

export interface Notice {
  text: string;
  tone: Tone;
  at: number;
}

/** 屏幕中央弹出的大字：打散怨灵、关系升级、突破这些爽点 */
export interface Banner {
  id: number;
  title: string;
  sub: string;
  tone: Tone;
  /** 最早什么时候能显示（砸门的结果要等撞门演完） */
  readyAt: number;
  shownAt: number | null;
}

/** 砸门动画里，撞完三下、出结果的时刻（和 page.html 里 .m-badge 的 2.55 秒对齐） */
const KNOCK_RESULT_MS = 2550;

/** 场景里正在演的一次砸门（只用于画面） */
export interface KnockFx {
  kind: GhostKind;
  outcome: 'defended' | 'purified' | 'guarded' | 'breach';
  at: number;
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

const QING_LOOK: Appearance = { robe: '#52D6A6', trim: '#FFC24B', headdress: 'bun', skin: '#FFE4D6', hair: '#2B2233' };
const BAILU_LOOK: Appearance = { robe: '#7FA8FF', trim: '#E9ECFF', headdress: 'twin', skin: '#F6CFB4', hair: '#2B2233' };

export class Game {
  world: World;
  speed: Speed = 'fast';
  log: LogEntry[] = [];
  /** 最近一次操作的提示（失败原因等），界面显示几秒 */
  notice: Notice | null = null;
  /** 离开期间发生的事，回来时给玩家看一眼 */
  awayReport: LogEntry[] | null = null;
  awayHours = 0;
  qing: Agent;

  private knockFx: KnockFx | null = null;
  private pendingKnock: GhostKind | null = null;
  private grudgeBeforeKnock = 0;
  private banners: Banner[] = [];
  private bannerSeq = 0;
  private collectAt = 0;
  private tribFx: { success: boolean; at: number } | null = null;
  private bigFx: { threadId: string; success: boolean; strands: number; lost: number; at: number } | null = null;
  private lastCheckInHour = -Infinity;
  private acc = 0;
  private lastTick = Date.now();
  /** 正在补离线时间：这段时间里“我”不在线 */
  private catchingUp = false;
  private awayLog: LogEntry[] = [];

  constructor() {
    const loaded = this.load();
    if (loaded) {
      this.world = loaded.world;
      this.qing = makeQing(loaded.qingBudget);
      this.attachListener();
      this.catchUpOffline(loaded.lastRealMs, loaded.speed);
    } else {
      this.world = newWorld();
      this.qing = makeQing(0);
      this.attachListener();
      this.say('新的一局开始了。你和阿青已经牵上一根红线。前三天有新手保护，先收灵石、升符阵。', 'info');
    }
    this.sessionCheckIn();
  }

  // ---------- 时间 ----------

  /** 每帧调用，按流速推进游戏时间 */
  tick(): void {
    const now = Date.now();
    this.acc += (now - this.lastTick) * SPEED_RATE[this.speed];
    this.lastTick = now;
    let budget = 72;
    while (this.acc >= 1 && budget-- > 0) {
      this.stepHour(this.isMeOnline());
      this.acc -= 1;
    }
    if (this.acc > 1) this.acc = 1;
  }

  // ---------- 守夜局 ----------

  /** 正在打的守夜局（局内状态不进存档；关掉页面就算没打） */
  raid: RaidState | null = null;
  raidReward: RaidReward | null = null;
  private raidPrevSpeed: Speed | null = null;

  /** 开一局守夜：打的时候院子里的时间停住，免得同时还有鬼来砸门 */
  beginRaid(): boolean {
    if (this.raid) return true;
    const r = startRaid(this.world, ME);
    if (!r.ok) {
      this.tell(r.reason, 'bad');
      return false;
    }
    this.raid = r.value;
    this.raidReward = null;
    this.notice = null;
    this.raidPrevSpeed = this.speed;
    this.speed = 'pause';
    return true;
  }

  /** 每帧调用。打完了就结算 */
  raidFrame(dt: number): void {
    const s = this.raid;
    if (!s || this.raidReward) return;
    raidStep(this.world, s, dt);
    if (s.result) this.endRaid();
  }

  raidTap = (ghostId: number) => (this.raid ? raidTap(this.world, this.raid, ghostId) : false);
  raidUpgrade = (guardId: string) => this.raidTry(() => raidUpgrade(this.world, this.raid!, guardId));
  raidRepair = () => this.raidTry(() => raidRepair(this.world, this.raid!));
  raidReinforce = () => this.raidTry(() => raidReinforce(this.world, this.raid!));

  private raidTry(f: () => Result): boolean {
    if (!this.raid || this.raidReward) return false;
    const r = f();
    if (!r.ok) this.tell(r.reason, 'bad');
    return r.ok;
  }

  /** 中途撤退按输算 */
  retreatRaid(): void {
    if (!this.raid || this.raidReward) return;
    this.raid.result = 'lose';
    this.endRaid();
  }

  private endRaid(): void {
    if (!this.raid) return;
    this.raidReward = finishRaid(this.world, this.raid);
    this.save();
  }

  /** 看完结算，回院子 */
  closeRaid(): void {
    this.raid = null;
    this.raidReward = null;
    this.speed = this.raidPrevSpeed ?? 'fast';
    this.raidPrevSpeed = null;
    this.lastTick = Date.now();
    this.save();
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
    this.lastTick = Date.now();
    this.save();
  }

  cycleSpeed(): void {
    this.setSpeed(SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length] as Speed);
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
    this.speed = savedSpeed;
    if (hours <= 0) return;
    this.catchingUp = true;
    this.awayLog = [];
    for (let i = 0; i < hours; i++) this.stepHour(false);
    this.catchingUp = false;
    this.awayHours = hours;
    this.awayReport = this.awayLog.slice(0, 12);
  }

  dismissAway(): void {
    this.awayReport = null;
  }

  /** 上线：两次上线之间隔够了才算新的一次（和好期限按它算） */
  sessionCheckIn(): void {
    if (this.world.hour - this.lastCheckInHour < SESSION_GAP_HOURS) return;
    checkIn(this.world, ME);
    this.lastCheckInHour = this.world.hour;
  }

  // ---------- 事件：日志和画面效果 ----------

  private attachListener(): void {
    this.world.listener = (e: GameEvent) => {
      const m = describeEvent(this.world, e, ME);
      if (m) this.say(m.text, m.tone);
      if (!this.catchingUp) this.present(e);
    };
  }

  /** 把事件变成画面效果和弹字 */
  private present(e: GameEvent): void {
    const w = this.world;
    const me = w.houses.get(ME)!;
    const now = Date.now();
    const n1 = (x: number) => (Math.abs(x) >= 100 ? String(Math.round(x)) : x.toFixed(1).replace(/\.0$/, ''));
    const mineThread = (id: string) => {
      const t = w.threads.get(id);
      return t && (t.a === ME || t.b === ME) ? t : null;
    };
    const partner = (t: Thread) => {
      const other = t.a === ME ? t.b : t.a;
      return other ? w.houses.get(other)?.name ?? other : t.npcName ?? '散修';
    };

    switch (e.type) {
      case 'knock':
        if (e.house === ME) {
          this.pendingKnock = e.kind;
          this.grudgeBeforeKnock = me.grudge;
        }
        break;
      case 'defended':
      case 'guarded':
      case 'purified':
      case 'breach': {
        if (e.house !== ME) break;
        const kind = this.pendingKnock;
        this.pendingKnock = null;
        if (!kind) break; // 渡劫失败也会触发 breach，由渡劫自己的弹字负责
        this.knockFx = { kind, outcome: e.type, at: now };
        const cleared = Math.max(0, this.grudgeBeforeKnock - me.grudge);
        // 结果弹字等鬼撞完三下再出，不能抢在动画前面
        const later = KNOCK_RESULT_MS;
        if (e.type === 'breach') this.banner('大阵被破…', `灵石 -${e.stonesLost} · 进入劫后余生`, 'bad', later);
        else if (e.type === 'purified') this.banner('感化怨灵！', `净化 ${n1(cleared)} 缕怨丝 · 情丝 +${n1(e.strandsReturned)} · 它留下帮你守门`, 'good', later);
        else if (kind === 'wild') this.banner(e.type === 'guarded' ? '护宅怨灵挡下了！' : '击退野鬼！', '诡心 +1', 'good', later);
        else if (e.type === 'guarded') this.banner('护宅怨灵挡下了！', `净化 ${n1(cleared)} 缕怨丝`, 'good', later);
        else this.banner('打散怨灵！', `净化 ${n1(cleared)} 缕怨丝 · 情丝 +${n1(e.strandsReturned)}`, 'good', later);
        break;
      }
      case 'tierChanged': {
        const t = mineThread(e.thread);
        if (t && e.to > e.from) this.banner(`关系升级 · ${w.config.tiers.names[e.to] ?? ''}`, `你与${partner(t)}`, 'good');
        break;
      }
      case 'memberBorn': {
        const t = mineThread(e.thread);
        if (e.house === ME && t) this.banner('族人 +1', `你与${partner(t)}的情丝所结`, 'good');
        break;
      }
      case 'heirBorn': {
        const t = mineThread(e.thread);
        if (t) this.banner('嫡传降生！', `你与${partner(t)}的结晶`, 'good');
        break;
      }
      case 'golden': {
        const t = mineThread(e.thread);
        if (t) this.banner('金缕！', `你与${partner(t)}的红线化作金丝`, 'good');
        break;
      }
      case 'tribulation':
        if (e.house !== ME) break;
        this.tribFx = { success: e.success, at: now };
        if (e.success) this.banner('突破！', `境界升至 ${e.realm}`, 'good');
        else this.banner('渡劫失败…', '修为还在，3 天后再来', 'bad');
        break;
      case 'bigInteraction':
        if (e.by !== ME) break;
        this.bigFx = { threadId: e.thread, success: e.success, strands: e.strandsGained, lost: e.stonesLost, at: now };
        if (e.success) this.banner('满载而归！', `情丝 +${n1(e.strandsGained)}`, 'good');
        else this.banner('铩羽而归…', `折了 ${e.stonesLost} 灵石`, 'bad');
        break;
      case 'quarrel': {
        const t = mineThread(e.thread);
        if (t) this.banner('吵架了！', `你与${partner(t)}闹了别扭，快去和好`, 'drama');
        break;
      }
      case 'quarrelEnded': {
        const t = mineThread(e.thread);
        if (t && e.reconciled) this.banner(e.reunion ? '破镜重圆！' : '和好如初', `聚回 ${n1(e.restored)} 缕情丝`, 'good');
        break;
      }
      case 'rival': {
        const t = mineThread(e.thread);
        if (!t) break;
        if (e.outcome === 'lost') this.banner('情敌得逞…', `你与${partner(t)}的红线淡了`, 'bad');
        else this.banner('情敌退散！', e.outcome === 'purified' ? '你们情深，三言两语就化解了' : '红线更稳了', 'good');
        break;
      }
      default:
        break;
    }
  }

  private banner(title: string, sub: string, tone: Tone, delayMs = 0): void {
    // 极速时事件很密：最多排 3 条，旧的没来得及显示就丢掉
    while (this.banners.length >= 3) this.banners.splice(1, 1);
    this.banners.push({ id: ++this.bannerSeq, title, sub, tone, readyAt: Date.now() + delayMs, shownAt: null });
  }

  /** 现在该显示的弹字（每条显示 1.7 秒，排队播放；还没到时间的先让后面已就绪的播） */
  currentBanner(): Banner | null {
    const now = Date.now();
    this.banners = this.banners.filter((b) => b.shownAt === null || now - b.shownAt < 1700);
    const showing = this.banners.find((b) => b.shownAt !== null);
    if (showing) return showing;
    const next = this.banners.find((b) => b.readyAt <= now);
    if (!next) return null;
    next.shownAt = now;
    return next;
  }

  /** 刚收过灵石（用来让灵石数字跳一下） */
  justCollected(): boolean {
    return Date.now() - this.collectAt < 600;
  }

  say(text: string, tone: Tone): void {
    const entry = { hour: this.world.hour, text, tone };
    this.log.unshift(entry);
    if (this.log.length > 80) this.log.length = 80;
    if (this.catchingUp) this.awayLog.unshift(entry);
  }

  /** 正在演的砸门：飞进院子、砸三下、出结果，一共 4.8 秒 */
  activeKnock(): KnockFx | null {
    return this.knockFx && Date.now() - this.knockFx.at < 4800 ? this.knockFx : null;
  }

  activeTribulation(): { success: boolean } | null {
    return this.tribFx && Date.now() - this.tribFx.at < 5000 ? this.tribFx : null;
  }

  activeBig(threadId: string): { success: boolean; strands: number; lost: number } | null {
    return this.bigFx && this.bigFx.threadId === threadId && Date.now() - this.bigFx.at < 6000 ? this.bigFx : null;
  }

  activeNotice(): Notice | null {
    return this.notice && Date.now() - this.notice.at < 3200 ? this.notice : null;
  }

  // ---------- 玩家操作 ----------

  tell(text: string, tone: Tone = 'info'): void {
    this.notice = { text, tone, at: Date.now() };
  }

  /** 包一层：每次操作都算一次上线检查；失败时显示原因。返回是否成功 */
  private act<T>(fn: () => Result<T>, ok?: (v: T) => string | null): boolean {
    this.sessionCheckIn();
    const r = fn();
    if (!r.ok) this.tell(r.reason, 'bad');
    else {
      const msg = ok?.(r.value) ?? null;
      if (msg) this.tell(msg);
    }
    this.save();
    return r.ok;
  }

  /** 这位搭档此刻是否在线（原型里只有阿青是会上线的“真人”） */
  partnerOnline(t: Thread): boolean {
    return t.b === QING && isOnline(this.world, this.qing);
  }

  needsSetup(): boolean {
    return !this.world.houses.get(ME)!.appearance;
  }

  saveProfile(p: { name: string; gender: Gender; role: string; look: Appearance }): boolean {
    return this.act(
      () => updateProfile(this.world, ME, { name: p.name, gender: p.gender, traits: [p.role], appearance: p.look }),
      () => '形象已保存。',
    );
  }

  collect(): void {
    this.sessionCheckIn();
    const got = collectMeditation(this.world, ME);
    if (got > 0) this.collectAt = Date.now();
    this.tell(got > 0 ? `收得 ${Math.round(got)} 灵石，修为也涨了。` : '刚收过，再打会儿坐。');
    this.save();
  }

  upgrade = () => this.act(() => upgradeFormation(this.world, ME), () => '符阵升了一级。');
  repair = () => this.act(() => repairFormation(this.world, ME), (n) => `修好了 ${n} 处阵眼。`);
  healPill = () => this.act(() => brewHealingPill(this.world, ME), () => '疗伤丹服下，族人痊愈。');
  breakPill = () => this.act(() => brewBreakthroughPill(this.world, ME), () => '炼成一颗破境丹。');
  tribulation = (usePill: boolean) => this.act(() => attemptTribulation(this.world, ME, { usePill }), () => null);
  retreat = (days: number) => this.act(() => startRetreat(this.world, ME, days), () => `闭关 ${days} 天：红线冻结，鬼不登门。`);

  toggleOpenness(): void {
    const me = this.world.houses.get(ME)!;
    me.openness = me.openness === 'open' ? 'devoted' : 'open';
    this.tell(me.openness === 'open' ? '你的 OC 改为“开放”。' : '你的 OC 改为“专一”。白露可能会来抢亲。');
    this.save();
  }

  tieNpc(name: string): boolean {
    const n = name.trim() || '无名散修';
    return this.act(() => tieThread(this.world, ME, { kind: 'npc', name: n }), () => `与散修${n}牵上了线。旧线会心力分散，要多维护。`);
  }

  talk = (threadId: string, risky: boolean) => this.act(() => interact(this.world, ME, threadId, { risky }), () => null);

  big(threadId: string, stake: number): boolean {
    const t = this.world.threads.get(threadId)!;
    return this.act(() => bigInteract(this.world, ME, threadId, stake, this.partnerOnline(t)), () => null);
  }

  makeUp = (threadId: string) =>
    this.act(
      () => reconcileQuarrel(this.world, ME, threadId),
      (v) => (v.done ? null : '你先递了台阶，等 TA 也来和好。'),
    );

  cut = (threadId: string) => this.act(() => cutThread(this.world, ME, threadId), () => null);

  /** 复合：原型里搭档在期限内总会答应 */
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

  /** 第一版简化归属：两人商量，原型里阿青总会同意你的提议 */
  setHome = (heirId: string, home: string) =>
    this.act(() => setHeirHomeByAgreement(this.world, heirId, home, [ME, QING]), () => null);

  answerSnatch = (proposalId: string, accept: boolean) =>
    this.act(() => respondSnatch(this.world, ME, proposalId, accept), (t) => (t ? '你随白露去了，旧线已剪。' : '你回绝了白露。'));

  /** 新开一局：保留你捏好的形象 */
  newGame(): void {
    const old = this.world.houses.get(ME)!;
    this.world = newWorld();
    if (old.appearance) {
      updateProfile(this.world, ME, { name: old.name, gender: old.gender, traits: old.traits, appearance: old.appearance });
    }
    this.qing = makeQing(0);
    this.log = [];
    this.notice = null;
    this.awayReport = null;
    this.knockFx = null;
    this.banners = [];
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
      migrateWorld(world);
      this.log = data.log ?? [];
      this.lastCheckInHour = data.lastCheckInHour ?? -Infinity;
      return { ...data, world };
    } catch {
      return null;
    }
  }
}

/** 旧存档里的戏曲头饰和行当标签，读档时换成修仙款 */
function migrateWorld(w: World): void {
  for (const h of w.houses.values()) {
    if (h.appearance) h.appearance = migrateLook(h.appearance);
    h.traits = migrateTraits(h.traits);
  }
  for (const heir of w.heirs.values()) heir.traitKinds = migrateTraits(heir.traitKinds);
}

function newWorld(): World {
  const w = createWorld({ seed: Math.floor(Math.random() * 1e9), recordEvents: false });
  addHouse(w, { id: ME, name: '你', stones: 120, traits: ['剑修'] });
  addHouse(w, { id: QING, name: '阿青', openness: 'devoted', traits: ['丹修'], appearance: QING_LOOK });
  addHouse(w, { id: BAILU, name: '白露', realm: 3, traits: ['御兽'], appearance: BAILU_LOOK });
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
