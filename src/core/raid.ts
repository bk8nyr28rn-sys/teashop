/**
 * 守夜局：主动开的实时塔防（像“守自己的院子”）。
 *
 * - 孩子站在院子里的六个位置上自动打鬼；道途决定怎么出手，资质（出生时的红线浓度）和修为决定多强
 * - 当家人站在门边，自己也会打；玩家还能点鬼、升级孩子、修门、加固门
 * - 鬼从三个院门进来，沿路走到正门砸门；门破了算输，撑过所有波次算赢
 *
 * 和其他规则一样是纯函数式的确定性逻辑：随机数用局内自己的 Rng（开局时从世界的 Rng 取种子）。
 * 界面每帧调用 raidStep 推进，局内状态不进存档；结束时 finishRaid 把奖励写回世界。
 */
import { GUARD_PATHS } from './config';
import { doorPower } from './defense';
import { Rng } from './rng';
import type { HouseId, Result } from './types';
import type { World } from './types';
import { HOURS_PER_DAY, emit, fail, getHouse, ok } from './world';

/** 地图坐标（和界面的院子地图同一套，390 × 430） */
export const RAID_DOOR = { x: 195, y: 222 };
/** 三条路：左院门、右院门、下院门 → 正门 */
export const RAID_LANES: { x: number; y: number }[][] = [
  [{ x: 8, y: 256 }, { x: 90, y: 280 }, { x: 195, y: 222 }],
  [{ x: 382, y: 256 }, { x: 300, y: 280 }, { x: 195, y: 222 }],
  [{ x: 195, y: 436 }, { x: 214, y: 330 }, { x: 195, y: 222 }],
];
/** 孩子站的六个位置，和当家人的位置 */
export const RAID_SPOTS = [
  { x: 112, y: 286 },
  { x: 278, y: 286 },
  { x: 112, y: 344 },
  { x: 278, y: 344 },
  { x: 168, y: 392 },
  { x: 222, y: 392 },
];
export const RAID_SELF_SPOT = { x: 156, y: 222 };

export type RaidGhostKind = 'wild' | 'spirit' | 'imp' | 'boss';
export type GuardPath = (typeof GUARD_PATHS)[number] | '当家人';

/** 每种鬼的底子（血量、速度、每秒砸门伤害、打散给的灵气） */
const GHOSTS: Record<RaidGhostKind, { hp: number; speed: number; dps: number; qi: number }> = {
  wild: { hp: 26, speed: 26, dps: 5, qi: 3 },
  spirit: { hp: 60, speed: 20, dps: 9, qi: 6 },
  imp: { hp: 16, speed: 46, dps: 4, qi: 2 },
  boss: { hp: 520, speed: 12, dps: 22, qi: 40 },
};

/** 每种守卫的底子：每秒伤害、射程，以及额外本事 */
const GUARDS: Record<GuardPath, { dps: number; range: number; note: string }> = {
  当家人: { dps: 8, range: 130, note: '站在门边亲自出手' },
  剑修: { dps: 14, range: 110, note: '专打一只，伤害高' },
  符修: { dps: 5, range: 120, note: '定身符：被打中的鬼变慢' },
  阵修: { dps: 4, range: 100, note: '护门阵：门受到的伤害变少' },
  丹修: { dps: 3, range: 100, note: '回春丹：门慢慢回血' },
  器修: { dps: 4, range: 100, note: '聚灵器：灵气涨得更快' },
  御兽: { dps: 8, range: 110, note: '灵兽扑咬：打一片' },
};
export const GUARD_NOTES = Object.fromEntries(Object.entries(GUARDS).map(([k, v]) => [k, v.note])) as Record<GuardPath, string>;

/** 每波出什么鬼 */
const WAVES: Partial<Record<RaidGhostKind, number>>[] = [
  { wild: 5 },
  { wild: 6, spirit: 2 },
  { wild: 6, spirit: 3, imp: 3 },
  { wild: 8, spirit: 4, imp: 4 },
  { boss: 1, wild: 6, spirit: 3 },
];

const STEP = 0.05;
const FIRE_INTERVAL = 0.5;

export interface RaidGhost {
  id: number;
  kind: RaidGhostKind;
  lane: number;
  /** 沿路走了多远 */
  d: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  dps: number;
  slowUntil: number;
  atDoor: boolean;
}

export interface RaidGuard {
  /** 'self' 或孩子的 id */
  id: string;
  path: GuardPath;
  x: number;
  y: number;
  level: number;
  /** 强度倍数：资质和修为 */
  power: number;
  cooldown: number;
}

/** 给界面播特效用的一次性事件 */
export type RaidFx =
  | { type: 'shot'; from: string; to: number; x1: number; y1: number; x2: number; y2: number; path: GuardPath }
  | { type: 'tap'; ghost: number; x: number; y: number; dmg: number }
  | { type: 'kill'; ghost: number; kind: RaidGhostKind; x: number; y: number; qi: number }
  | { type: 'hitDoor'; dmg: number }
  | { type: 'wave'; wave: number }
  | { type: 'heal'; amount: number };

export interface RaidState {
  house: HouseId;
  realm: number;
  rngState: number;
  /** 开局后过了多少秒 */
  t: number;
  qi: number;
  doorHp: number;
  doorMax: number;
  /** 门受到伤害的减免（阵修） */
  armor: number;
  reinforceCost: number;
  repairReadyAt: number;
  lastTapAt: number;
  /** 当前（或下一个）波次，从 1 开始 */
  wave: number;
  spawns: { at: number; kind: RaidGhostKind; lane: number; wave: number }[];
  ghosts: RaidGhost[];
  guards: RaidGuard[];
  nextGhostId: number;
  kills: number;
  spiritKills: number;
  bossKilled: boolean;
  result: 'win' | 'lose' | null;
  /** 本次 raidStep 产生的特效事件（界面读完自己清） */
  fx: RaidFx[];
}

function laneLength(lane: number): number {
  const pts = RAID_LANES[lane]!;
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return len;
}
const LANE_LEN = RAID_LANES.map((_, i) => laneLength(i));

function pointOnLane(lane: number, d: number): { x: number; y: number } {
  const pts = RAID_LANES[lane]!;
  let left = d;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= seg) return { x: a.x + ((b.x - a.x) * left) / seg, y: a.y + ((b.y - a.y) * left) / seg };
    left -= seg;
  }
  return { ...pts[pts.length - 1]! };
}

/** 守夜的阵容：最多 6 个孩子，没在疗伤的按强弱排前面 */
export function guardLineup(world: World, houseId: HouseId) {
  const house = getHouse(world, houseId);
  const cfg = world.config.raid;
  const power = (m: (typeof house.members)[number]) => 1 + (m.root ?? 0) / cfg.perRoot + m.cultivation / cfg.perCultivation;
  const healthy = house.members.filter((m) => m.injuredUntil <= world.hour).sort((a, b) => power(b) - power(a));
  const hurt = house.members.filter((m) => m.injuredUntil > world.hour);
  return { guards: healthy.slice(0, RAID_SPOTS.length), hurt, power };
}

/** 今天还剩几局有奖励 */
export function raidRewardsLeft(world: World, houseId: HouseId): number {
  const house = getHouse(world, houseId);
  const today = Math.floor(world.hour / HOURS_PER_DAY);
  const used = house.raidDay === today ? house.raidRewardsToday ?? 0 : 0;
  return Math.max(0, world.config.raid.rewardedPerDay - used);
}

export function startRaid(world: World, houseId: HouseId): Result<RaidState> {
  const house = getHouse(world, houseId);
  const cfg = world.config.raid;
  const { guards, power } = guardLineup(world, houseId);
  const rng = new Rng(world.rng.int(1, 2 ** 31 - 1));
  const doorMax = cfg.doorBase + doorPower(world, house) * cfg.doorPerPower;

  const spawns: RaidState['spawns'] = [];
  WAVES.slice(0, cfg.waves).forEach((mix, wi) => {
    const kinds: RaidGhostKind[] = [];
    for (const [k, n] of Object.entries(mix) as [RaidGhostKind, number][]) for (let i = 0; i < n; i++) kinds.push(k);
    const start = cfg.prepSeconds + wi * cfg.waveGap;
    // 打乱顺序，大鬼固定在这一波开头
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
    }
    kinds.sort((a, b) => (a === 'boss' ? -1 : b === 'boss' ? 1 : 0));
    kinds.forEach((kind, i) => {
      spawns.push({ at: start + (kinds.length > 1 ? (cfg.spawnSpan * i) / (kinds.length - 1) : 0), kind, lane: rng.int(0, 2), wave: wi + 1 });
    });
  });

  const state: RaidState = {
    house: houseId,
    realm: house.realm,
    rngState: rng.getState(),
    t: 0,
    qi: cfg.startQi,
    doorHp: doorMax,
    doorMax,
    armor: 0,
    reinforceCost: cfg.reinforceCost,
    repairReadyAt: 0,
    lastTapAt: -1,
    wave: 1,
    spawns,
    ghosts: [],
    guards: [
      { id: 'self', path: '当家人', ...RAID_SELF_SPOT, level: 1, power: 1 + (house.realm - 1) * 0.35, cooldown: 0 },
      ...guards.map((m, i) => ({
        id: m.id,
        path: ((GUARD_PATHS as readonly string[]).includes(m.path ?? '') ? m.path : '剑修') as GuardPath,
        ...RAID_SPOTS[i]!,
        level: 1,
        power: power(m),
        cooldown: (i + 1) * 0.07,
      })),
    ],
    nextGhostId: 1,
    kills: 0,
    spiritKills: 0,
    bossKilled: false,
    result: null,
    fx: [],
  };
  updateArmor(state, cfg.levelBonus);
  return { ok: true, value: state };
}

const levelMult = (g: RaidGuard, bonus: number) => 1 + bonus * (g.level - 1);

function updateArmor(s: RaidState, bonus: number): void {
  let armor = 0;
  for (const g of s.guards) if (g.path === '阵修') armor += 0.1 * g.power * levelMult(g, bonus);
  s.armor = Math.min(0.6, armor);
}

function killGhost(s: RaidState, g: RaidGhost): void {
  const qi = GHOSTS[g.kind].qi;
  s.qi += qi;
  s.kills++;
  if (g.kind === 'spirit') s.spiritKills++;
  if (g.kind === 'boss') s.bossKilled = true;
  s.fx.push({ type: 'kill', ghost: g.id, kind: g.kind, x: g.x, y: g.y, qi });
}

/** 推进 dt 秒（内部按 0.05 秒一小步算，帧率高低结果一样） */
export function raidStep(world: World, s: RaidState, dt: number): void {
  if (s.result) return;
  const cfg = world.config.raid;
  const rng = new Rng(1);
  rng.setState(s.rngState);
  const scale = 1 + (s.realm - 1) * cfg.realmScale;
  let steps = Math.min(200, Math.round(dt / STEP));
  while (steps-- > 0 && !s.result) {
    s.t += STEP;
    // 出鬼
    while (s.spawns.length > 0 && s.spawns[0]!.at <= s.t) {
      const sp = s.spawns.shift()!;
      if (sp.wave > s.wave) {
        s.wave = sp.wave;
        s.fx.push({ type: 'wave', wave: sp.wave });
      }
      const base = GHOSTS[sp.kind];
      const hp = base.hp * scale * cfg.ghostHpScale * (sp.kind === 'boss' ? 1 : 1 + (sp.wave - 1) * cfg.waveHpScale);
      const p = pointOnLane(sp.lane, 0);
      s.ghosts.push({ id: s.nextGhostId++, kind: sp.kind, lane: sp.lane, d: 0, ...p, hp, maxHp: hp, speed: base.speed, dps: base.dps * scale * cfg.ghostDpsScale, slowUntil: 0, atDoor: false });
    }
    // 灵气、回门
    let qiRate = cfg.qiPerSecond;
    let heal = 0;
    for (const g of s.guards) {
      if (g.path === '器修') qiRate += 0.8 * g.power * levelMult(g, cfg.levelBonus);
      if (g.path === '丹修') heal += 1.5 * g.power * levelMult(g, cfg.levelBonus);
    }
    s.qi += qiRate * STEP;
    if (heal > 0 && s.doorHp < s.doorMax) s.doorHp = Math.min(s.doorMax, s.doorHp + heal * STEP);
    // 鬼走路、砸门
    for (const g of s.ghosts) {
      if (!g.atDoor) {
        const speed = g.speed * (g.slowUntil > s.t ? 0.55 : 1);
        g.d = Math.min(LANE_LEN[g.lane]!, g.d + speed * STEP);
        Object.assign(g, pointOnLane(g.lane, g.d));
        if (g.d >= LANE_LEN[g.lane]!) g.atDoor = true;
      } else {
        const dmg = g.dps * (1 - s.armor) * STEP;
        s.doorHp -= dmg;
      }
    }
    // 守卫出手
    for (const guard of s.guards) {
      guard.cooldown -= STEP;
      if (guard.cooldown > 0) continue;
      const spec = GUARDS[guard.path];
      let target: RaidGhost | null = null;
      for (const g of s.ghosts) {
        if (g.hp <= 0 || Math.hypot(g.x - guard.x, g.y - guard.y) > spec.range) continue;
        // 先打离门最近的
        if (!target || g.d / LANE_LEN[g.lane]! > target.d / LANE_LEN[target.lane]!) target = g;
      }
      if (!target) continue;
      guard.cooldown = FIRE_INTERVAL;
      const dmg = spec.dps * FIRE_INTERVAL * guard.power * levelMult(guard, cfg.levelBonus);
      target.hp -= dmg;
      if (guard.path === '符修') target.slowUntil = s.t + 1.5;
      if (guard.path === '御兽') {
        for (const g of s.ghosts) if (g !== target && Math.hypot(g.x - target.x, g.y - target.y) < 45) g.hp -= dmg * 0.6;
      }
      s.fx.push({ type: 'shot', from: guard.id, to: target.id, x1: guard.x, y1: guard.y, x2: target.x, y2: target.y, path: guard.path });
    }
    for (const g of s.ghosts) if (g.hp <= 0) killGhost(s, g);
    s.ghosts = s.ghosts.filter((g) => g.hp > 0);
    if (s.doorHp <= 0) {
      s.doorHp = 0;
      s.result = 'lose';
    } else if (s.spawns.length === 0 && s.ghosts.length === 0) {
      s.result = 'win';
    }
  }
  // 局内的随机数目前只用于开局排兵，留着状态以后加随机事件
  s.rngState = rng.getState();
}

/** 点鬼：真的掉血 */
export function raidTap(world: World, s: RaidState, ghostId: number): boolean {
  if (s.result) return false;
  const cfg = world.config.raid;
  if (s.t - s.lastTapAt < cfg.tapInterval) return false;
  const g = s.ghosts.find((x) => x.id === ghostId);
  if (!g) return false;
  s.lastTapAt = s.t;
  const dmg = cfg.tapBase + s.realm * cfg.tapPerRealm;
  g.hp -= dmg;
  s.fx.push({ type: 'tap', ghost: g.id, x: g.x, y: g.y, dmg });
  if (g.hp <= 0) {
    killGhost(s, g);
    s.ghosts = s.ghosts.filter((x) => x.id !== g.id);
  }
  return true;
}

export function raidUpgradeCost(world: World, guard: RaidGuard): number | null {
  return world.config.raid.upgradeCosts[guard.level] ?? null;
}

/** 升级一个守卫（孩子或当家人） */
export function raidUpgrade(world: World, s: RaidState, guardId: string): Result {
  if (s.result) return fail('这局已经结束了');
  const guard = s.guards.find((g) => g.id === guardId);
  if (!guard) return fail('没有这个守卫');
  const cost = raidUpgradeCost(world, guard);
  if (cost === null) return fail('已经满级了');
  if (s.qi < cost) return fail(`灵气不够（要 ${cost}）`);
  s.qi -= cost;
  guard.level++;
  updateArmor(s, world.config.raid.levelBonus);
  return ok();
}

/** 修门：回一截血，有冷却 */
export function raidRepair(world: World, s: RaidState): Result {
  const cfg = world.config.raid;
  if (s.result) return fail('这局已经结束了');
  if (s.t < s.repairReadyAt) return fail('刚修过，稍等');
  if (s.doorHp >= s.doorMax) return fail('门是满的');
  if (s.qi < cfg.repairCost) return fail(`灵气不够（要 ${cfg.repairCost}）`);
  s.qi -= cfg.repairCost;
  const amount = Math.min(s.doorMax - s.doorHp, s.doorMax * cfg.repairRatio);
  s.doorHp += amount;
  s.repairReadyAt = s.t + cfg.repairCooldown;
  s.fx.push({ type: 'heal', amount });
  return ok();
}

/** 加固门：最大血量变多，同时补上这一截 */
export function raidReinforce(world: World, s: RaidState): Result {
  const cfg = world.config.raid;
  if (s.result) return fail('这局已经结束了');
  const cost = Math.round(s.reinforceCost);
  if (s.qi < cost) return fail(`灵气不够（要 ${cost}）`);
  s.qi -= cost;
  const add = s.doorMax * cfg.reinforceRatio;
  s.doorMax += add;
  s.doorHp += add;
  s.reinforceCost *= cfg.reinforceGrowth;
  s.fx.push({ type: 'heal', amount: add });
  return ok();
}

export interface RaidReward {
  win: boolean;
  wave: number;
  rewarded: boolean;
  stones: number;
  hearts: number;
  cultivation: number;
}

/**
 * 结束一局（打完、门破，或中途撤退都调这个），把奖励写回世界。
 * 每天前 rewardedPerDay 局有奖励，之后是练手局。撤退按输算。
 */
export function finishRaid(world: World, s: RaidState): RaidReward {
  const cfg = world.config.raid;
  const house = getHouse(world, s.house);
  const win = s.result === 'win';
  const wave = win ? cfg.waves : Math.max(0, s.wave - 1);
  const rewarded = raidRewardsLeft(world, s.house) > 0;
  let stones = 0;
  let hearts = 0;
  let cultivation = 0;
  if (rewarded) {
    const today = Math.floor(world.hour / HOURS_PER_DAY);
    house.raidRewardsToday = house.raidDay === today ? (house.raidRewardsToday ?? 0) + 1 : 1;
    house.raidDay = today;
    stones = win ? cfg.winStones + cfg.winStonesPerRealm * house.realm : cfg.loseStonesPerWave * wave;
    hearts = win ? (s.spiritKills > 0 ? 1 : 0) + (s.bossKilled ? 1 : 0) : 0;
    cultivation = win ? cfg.winCultivation : cfg.loseCultivation;
    house.stones += stones;
    house.ghostHearts += hearts;
    const ids = new Set(s.guards.map((g) => g.id));
    for (const m of house.members) if (ids.has(m.id)) m.cultivation += cultivation;
  }
  emit(world, { type: 'raidEnded', hour: world.hour, house: s.house, win, wave, rewarded, stones, hearts });
  return { win, wave, rewarded, stones, hearts, cultivation };
}
