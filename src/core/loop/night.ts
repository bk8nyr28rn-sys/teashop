import { Rng } from '../rng';
import { AGE_FX, balanceAge, CFG, nextRandom, RULE_VERSION } from './base';
import { COOP, DOORS, GHOSTS, MULT, NIGHT, PERKS, waveCounts } from './night-config';
import type { GhostType, PerkId } from './night-config';
import type { House, Item, Person, Treasure } from './state';
import { nightPayout, planNightLoot, type NightLootPlan } from './settlement';

export { waveCounts } from './night-config';

export interface NightOptions {
  seed: number;
  cosmeticSeed?: number;
  guardian?: boolean;
  // 外部可限制可选道具或驰援。带路的开放时间由页面决定。
  advancedItems?: boolean;
  helpEnabled?: boolean;
  spouse?: boolean;
  childPowers?: readonly number[];
  /** 同族能喊来帮忙的人，不用攒交情（多人版由服务器给；他自己能在设置里关掉）。单机样机不给 */
  kin?: readonly string[];
  // 兼容第一阶段模拟器的显式钱箱余额。
  lossBase?: number;
}

/**
 * by：谁点的。不填是主人；填援兵的 id 就是援兵点的（两个人一起打，主人的手机把援兵的点击也记进记录）。
 * join：援兵进来了，带着他自己的家伙和强弱；以后的波次鬼变多
 */
export type NightAction =
  | { type: 'hit'; id: number; by?: string }
  | { type: 'hitAt'; x: number; y: number; by?: string }
  | { type: 'item'; item: Item; by?: string }
  | { type: 'perk'; id: PerkId; by?: string }
  | { type: 'join'; by: string; item?: Item; power?: number; hp?: number; day?: number }
  /** 喊人帮忙。id 是自己挑的那个人（见 helpCandidates）；不给就喊交情最深的邻居 */
  | { type: 'help'; id?: string };

export interface NightGhost {
  id: number;
  type: GhostType;
  hp: number;
  max: number;
  lane: number;
  x: number;
  y: number;
  ox: number;
  k: number;
  tx: number;
  ty: number;
  speed: number;
  state: 'walk' | 'bash';
  bashT: number;
  ph: number;
  hit: number;
  flash: number;
  name: string;
  lookSeed: number;
}

interface Spawn { at: number; type: GhostType; wave: number }
interface Crossbow { x: number; y: number; cd: number }
interface FamilyHelper { dmg: number; rate: number; cd: number }
interface Ally { id: string; t: number; cd: number }
/** 一起打的援兵：他自己的家伙、强弱、体力、年纪 */
export interface NightGuest { id: string; item: Item; power: number; hp: number; d: number }

export interface NightResult {
  won: boolean;
  // 当晚击杀与掉落，含破门前发生的。样机只在胜利时把两者计入生涯。
  kills: number;
  coins: number;
  door: number;
  doorMax: number;
  creditedKills: number;
  earnedMoney: number;
  lostMoney: number;
  purseLost: number;
  chestLost: number;
  lostTreasureIndex: number | null;
  lostTreasure: Treasure | null;
  held: number;
  broken: number;
  friendship: Record<string, number>;
}

export interface NightState {
  ruleVersion: 1 | typeof RULE_VERSION;
  seed: number;
  rngState: number;
  cosmeticSeedState: number;
  nextId: number;
  spawnedInWave: number;
  d: number;
  guardian: boolean;
  advancedItems: boolean;
  helpEnabled: boolean;
  hp: number;
  power: number;
  item: Item;
  traps: House['traps'];
  lossBase: number;
  purse: number;
  lootPlan: NightLootPlan;
  treasures: Treasure[];
  friends: Record<string, number>;
  friendship: Record<string, number>;
  t: number;
  door: number;
  doorMax: number;
  wave: number;
  spawns: Spawn[];
  ghosts: NightGhost[];
  pk: Partial<Record<PerkId, number>>;
  offer: PerkId[];
  picking: boolean;
  bows: Crossbow[];
  fam: FamilyHelper[];
  ally: Ally | null;
  helpUsed: boolean;
  /** 同族能喊的人。旧的打到一半的快照没有这一项 */
  kin?: string[];
  /** 这一夜喊来的是谁 */
  helper?: string | null;
  /** 一起打的援兵（旧快照没有） */
  guests?: NightGuest[];
  /** 这一轮挑本事要等谁挑完（主人是 'host'），谁已经挑了 */
  pickers?: string[];
  pickedBy?: string[];
  rainCount: number;
  burnT: number;
  kills: number;
  coins: number;
  over: boolean;
  result: NightResult | null;
}

const ghostTypes = Object.keys(GHOSTS) as GhostType[];
const perkIds = Object.keys(PERKS) as PerkId[];
const equipmentPerks: readonly PerkId[] = ['pierce', 'burn', 'lampstr', 'bowplus', 'bowfast'];
const neighbors = ['wang', 'li', 'zhao'];
const surnames = [...'孙周吴郑冯陈褚卫蒋沈韩杨朱秦许何吕施张孔'];
const given = ['太爷爷', '老祖宗', '大娘', '三叔', '二姑奶奶', '老太公', '大伯', '小姑', '老掌柜', '大侠', '书生', '镖头'];

// 每波、每次出怪和每次发本事各自取流，手速变化不会重抽本应相同的敌人。
// 分段种子与样机的 night-balance 脚本一致；战斗判定则使用可存档的 rngState。
function eventRng(seed: number, wave: number, event: number): Rng {
  const rng = new Rng(seed);
  rng.setState(seed + (wave + 1) * 65537 + event * 257);
  return rng;
}

// 样机用随机比较器排短牌池，抽签有偏，而且比较次序依赖浏览器。
// 固定本版 Chromium 的短数组插入抽法，使回放与运行引擎无关。
export function orderNightDeck<T>(items: T[], draw: () => number): T[] {
  if (items.length < 2) return items;
  // 连续抽到同一方向的前缀先整段保留或反转；第一次相反的抽签也消耗。
  let end = 1;
  if (items.length > 16) {
    const reversePrefix = draw() < 0.5;
    end = 2;
    while (end < items.length && (draw() < 0.5) === reversePrefix) end++;
    if (reversePrefix) {
      for (let left = 0, right = end - 1; left < right; left++, right--) {
        [items[left], items[right]] = [items[right]!, items[left]!];
      }
    }
  }
  // 剩余每张牌从当前序列的中间开始，逐次抽左右半边，直至确定插入位置。
  for (let i = end; i < items.length; i++) {
    const item = items[i]!;
    let lo = 0, hi = i;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (draw() < 0.5) hi = mid;
      else lo = mid + 1;
    }
    items.copyWithin(lo + 1, lo, i);
    items[lo] = item;
  }
  return items;
}

function familyHelpers(options: NightOptions): FamilyHelper[] {
  const cfg = NIGHT.family;
  const helpers: FamilyHelper[] = [];
  if (options.spouse && !options.guardian) {
    helpers.push({ dmg: cfg.spouseDamage, rate: cfg.spouseRate, cd: cfg.spouseCd });
  }
  for (const [i, power] of (options.childPowers ?? []).slice(0, cfg.maxKids).entries()) {
    helpers.push({ dmg: Math.round(cfg.childBaseDamage * power), rate: cfg.childRate, cd: cfg.childCd + i * cfg.childStagger });
  }
  return helpers;
}

/** 复制开战所需的家产与人物数值；打到一半可直接把返回的普通对象转成 JSON。 */
export function startNight(house: House, person: Person, options: NightOptions): NightState {
  const door = DOORS[house.door];
  if (!door) throw new RangeError('未知的院门等级');
  const guardian = options.guardian ?? false;
  const advancedItems = options.advancedItems ?? true;
  const bows = NIGHT.bows.x.slice(0, house.traps.crossbow).map((x, i) =>
    ({ x, y: NIGHT.bows.y, cd: NIGHT.bows.firstCd + i * NIGHT.bows.stagger }));
  const state: NightState = {
    ruleVersion: RULE_VERSION, seed: options.seed >>> 0, rngState: options.seed >>> 0,
    cosmeticSeedState: (options.cosmeticSeed ?? (options.seed ^ 0x9e3779b9)) >>> 0,
    nextId: 1, spawnedInWave: 0, d: guardian ? CFG.lifeDays : person.day, guardian,
    advancedItems, helpEnabled: options.helpEnabled ?? true,
    hp: person.hp, power: person.power, item: advancedItems ? person.item : 'sword',
    traps: { ...house.traps }, lossBase: options.lossBase ?? house.chest,
    purse: person.purse, lootPlan: planNightLoot(options.seed, house.treasures),
    treasures: house.treasures.map(t => ({ ...t })),
    friends: { ...person.friends }, friendship: {}, t: 0, door: door.hp, doorMax: door.hp,
    wave: -1, spawns: [], ghosts: [], pk: {}, offer: [], picking: false,
    bows, fam: familyHelpers(options), ally: null, helpUsed: false, kin: [...(options.kin ?? [])], helper: null,
    rainCount: 0, burnT: 0, kills: 0, coins: 0, over: false, result: null,
  };
  startWave(state, 0);
  return state;
}

export function startWave(n: NightState, wave: number): void {
  if (n.over || wave !== n.wave + 1 || wave >= NIGHT.waves || (wave > 0 && !n.picking)) return;
  // 旧版打到一半的快照继续使用原来的五波。
  const swordOnly = n.ruleVersion >= 2 && !n.guardian && !n.advancedItems;
  const counts = waveCounts(n.d, wave, swordOnly);
  // 援兵到了：这一波起鬼变多，打得更热闹
  if (n.guests?.length) for (const type of ghostTypes) counts[type] = Math.round(counts[type] * COOP.ghostScale);
  const types = ghostTypes.flatMap(type => Array<GhostType>(counts[type]).fill(type));
  const draw = eventRng(n.seed, wave, 0);
  orderNightDeck(types, () => draw.next());
  n.spawns = types.map((type, i) => ({ at: n.t + NIGHT.waveDelay + i * NIGHT.spread / types.length, type, wave }));
  n.wave = wave;
  n.spawnedInWave = 0;
  n.offer = [];
  n.picking = false;
  if (n.pickers) { n.pickers = []; n.pickedBy = []; }
}

export function perkAvailable(n: NightState, id: PerkId): boolean {
  if ((!n.advancedItems && equipmentPerks.includes(id)) || (n.pk[id] && !PERKS[id].stack)) return false;
  if (id === 'bowfast') return n.bows.length > 0;
  if (id === 'lampstr') return !n.traps.lamp;
  if (id === 'fix') return n.door <= n.doorMax * NIGHT.perk.fixBelow;
  return true;
}

function offerPerks(n: NightState): void {
  const pool = perkIds.filter(id => perkAvailable(n, id));
  const draw = eventRng(n.seed, n.wave, 200);
  n.offer = orderNightDeck(pool, () => draw.next()).slice(0, NIGHT.offerCount);
  n.picking = true;
  // 两个人一起打：守住一波，两个人各挑一个本事
  if (n.guests?.length) { n.pickers = ['host', ...n.guests.map(g => g.id)]; n.pickedBy = []; }
}

function choosePerk(n: NightState, id: PerkId, by?: string): void {
  if (!n.picking || !n.offer.includes(id)) return;
  const who = by ?? 'host';
  if (n.pickers?.length) {
    // 不能叠的本事，同一轮另一个人已经挑了，就挑别的
    if (!n.pickers.includes(who) || n.pickedBy!.includes(who) || (n.pk[id] && !PERKS[id].stack)) return;
    n.pickedBy!.push(who);
  } else if (by !== undefined) return;
  n.pk[id] = (n.pk[id] ?? 0) + 1;
  if (id === 'fix') n.door = Math.min(n.doorMax, n.door + n.doorMax * NIGHT.perk.fix);
  if (id === 'bowplus' && !n.bows.length) {
    n.bows.push({ x: NIGHT.bows.x[0], y: NIGHT.bows.y, cd: NIGHT.bows.giftCd });
  }
  if (n.pickers?.length && n.pickers.some(p => !n.pickedBy!.includes(p))) return;
  startWave(n, n.wave + 1);
}

function spawnGhost(n: NightState, sp: Spawn): void {
  const rng = eventRng(n.seed, sp.wave, ++n.spawnedInWave);
  const between = ([lo, hi]: readonly [number, number]) => lo + rng.next() * (hi - lo);
  const cfg = NIGHT.spawn;
  const ghost = GHOSTS[sp.type];
  const max = ghost.hp * ((1 + NIGHT.hpPerDay * (n.d - 1)) * (1 + NIGHT.hpPerWave * sp.wave));
  const look = new Rng(n.cosmeticSeedState);
  look.setState(n.cosmeticSeedState);
  const name = look.pick(surnames) + '家的' + look.pick(given);
  const lookSeed = look.int(0, 0xffffffff);
  n.cosmeticSeedState = look.getState();
  const g: NightGhost = {
    id: n.nextId++, type: sp.type, hp: max, max, lane: between(cfg.lane),
    x: NIGHT.lane.centerX, y: between(cfg.y), ox: 0, k: NIGHT.lane.depthBase,
    tx: NIGHT.lane.centerX + between(cfg.gateXOffset),
    ty: NIGHT.lane.gateY + between(cfg.gateYOffset) - (sp.type === 'fly' ? cfg.flyRise : 0),
    speed: ghost.speed * between(cfg.speed), state: 'walk', bashT: between(cfg.bashDelay),
    ph: 0, hit: ghost.hit, flash: 0, name, lookSeed,
  };
  // 相位会影响命中位置。样机固定从出怪流第九抽取相位，第七和第八抽原供姓名占用。
  // 保留相位槽位；现在姓名、脸型及其生成步骤都可独立改变。
  rng.next();
  rng.next();
  g.ph = between(cfg.phase);
  n.ghosts.push(g);
}

export function ghostCenter(g: NightGhost): { x: number; y: number } {
  return { x: g.x + g.ox, y: g.y - NIGHT.lane.centerHeight * g.k };
}

export function ghostAt(n: NightState, x: number, y: number): NightGhost | null {
  let nearest: NightGhost | null = null;
  let distance = Infinity;
  for (const ghost of n.ghosts) {
    const c = ghostCenter(ghost);
    const d = Math.hypot(x - c.x, y - c.y);
    if (d < distance && d < NIGHT.lane.hitRadius * Math.max(ghost.k, NIGHT.lane.minHitScale)) {
      nearest = ghost;
      distance = d;
    }
  }
  return nearest;
}

/** 有人手里拿着灯（主人或援兵）。一个拿灯照隐身鬼，另一个就能放心打别的 */
export function lampHeld(n: NightState): boolean {
  return n.item === 'lamp' || !!n.guests?.some(g => g.item === 'lamp');
}

export function revealed(n: NightState, g: NightGhost): boolean {
  return g.type !== 'shade' || (lampHeld(n) && g.y > NIGHT.reveal.lamp)
    || (!!(n.traps.lamp || n.pk.lampstr) && g.y > NIGHT.reveal.wall)
    || (!!n.pk.eye && g.y > NIGHT.reveal.eye) || g.flash > 0;
}

/** 离院门最近按 y 判，平手时仍选先出现的鬼。弩机单独按距炮台的实际距离选。 */
export function nearestGhost(n: NightState, visibleOnly = true): NightGhost | null {
  let nearest: NightGhost | null = null;
  for (const ghost of n.ghosts) {
    if ((!visibleOnly || revealed(n, ghost)) && (!nearest || ghost.y > nearest.y)) nearest = ghost;
  }
  return nearest;
}

export function tapMult(n: NightState, g: NightGhost, item: Item = n.item): number {
  let multiplier: number = MULT[item][g.type];
  if (g.type === 'armor' && n.pk.heavy) multiplier = MULT[item].evil;
  if (g.type === 'fly' && item === 'sword' && n.pk.qi) multiplier = NIGHT.perk.qi;
  if (item === 'bow') multiplier *= 1 + NIGHT.perk.pierce * (n.pk.pierce ?? 0);
  return multiplier * (1 + NIGHT.perk.heavy * (n.pk.heavy ?? 0));
}

function hurtGhost(n: NightState, g: NightGhost, dmg: number, byPlayer = false): void {
  if (g.hp <= 0) return;
  g.hp -= dmg;
  g.flash = NIGHT.reveal.flashTime;
  if (g.hp > 0) return;
  n.ghosts.splice(n.ghosts.indexOf(g), 1);
  n.kills++;
  n.coins += (byPlayer ? NIGHT.weapon.playerCoins : 0) + NIGHT.perk.coins * (n.pk.coins ?? 0);
  if (n.pk.soul) n.door = Math.min(n.doorMax, n.door + NIGHT.perk.soul * n.pk.soul);
  if (n.pk.rain && ++n.rainCount >= NIGHT.perk.rainKills) {
    n.rainCount = 0;
    for (const other of n.ghosts.slice()) hurtGhost(n, other, NIGHT.perk.rainDamage * n.pk.rain);
  }
}

function hit(n: NightState, g: NightGhost | null, guest?: NightGuest): void {
  if (!g) return;
  const hidden = !revealed(n, g);
  if (hidden && !n.pk.ear) return;
  const multiplier = tapMult(n, g, guest?.item ?? n.item) * (hidden ? NIGHT.perk.ear : 1);
  const hp = guest?.hp ?? n.hp;
  const guardian = !guest && n.guardian;
  const hurt = guardian || hp >= CFG.hpMax ? 1 : hp <= 1 ? NIGHT.weapon.badlyHurt : NIGHT.weapon.hurt;
  const age = guardian ? AGE_FX.child : AGE_FX[balanceAge(guest?.d ?? n.d)];
  const power = guardian ? NIGHT.guardian.power : (guest ? guest.power : n.power) || 1;
  const crit = nextRandom(n) < Math.min(NIGHT.perk.critCap, NIGHT.perk.critChance * (n.pk.crit ?? 0));
  const dmg = Math.max(1, Math.round(NIGHT.tap * multiplier * age.dmg * hurt * power * (crit ? NIGHT.perk.critDamage : 1)));
  const center = ghostCenter(g);
  hurtGhost(n, g, dmg, true);
  if (!n.pk.sweep) return;
  for (const other of n.ghosts.slice()) {
    if (other === g || !revealed(n, other)) continue;
    const c = ghostCenter(other);
    if (Math.hypot(c.x - center.x, c.y - center.y) < NIGHT.perk.sweepRadius) {
      hurtGhost(n, other, Math.max(1, Math.round(dmg * NIGHT.perk.sweepFactor)), true);
    }
  }
}

/** 这一夜还能喊谁：交情到驰援的邻居（交情深的在前），再加上同族的人。喊过一次就空了 */
export function helpCandidates(n: NightState): string[] {
  if (!n.helpEnabled || n.helpUsed) return [];
  // 交情相同仍按样机面板的王、李、赵顺序。
  const friends = neighbors.filter(id => (n.friends[id] ?? 0) >= CFG.helpAt)
    .sort((a, b) => n.friends[b]! - n.friends[a]!);
  return [...friends, ...(n.kin ?? []).filter(id => !friends.includes(id))];
}

function callHelp(n: NightState, choice?: string): void {
  const list = helpCandidates(n);
  const id = choice === undefined ? list[0] : list.includes(choice) ? choice : undefined;
  if (!id) return;
  n.helpUsed = true;
  n.helper = id;
  n.ally = { id, t: NIGHT.ally.duration, cd: NIGHT.ally.firstCd };
  // 帮一次涨交情只算邻居；族人本来就不用交情
  if (neighbors.includes(id)) n.friendship[id] = Math.min(NIGHT.ally.friendship, NIGHT.ally.maxFriendship - n.friends[id]!);
}

/** 援兵进来：最多一个；护家神的夜不来援兵 */
function join(n: NightState, a: Extract<NightAction, { type: 'join' }>): void {
  n.guests ??= [];
  if (n.guardian || n.guests.length >= COOP.maxGuests || n.guests.some(g => g.id === a.by) || a.by === 'host') return;
  const item = a.item && (n.advancedItems || a.item === 'sword') ? a.item : 'sword';
  n.guests.push({ id: a.by, item, power: a.power ?? 1, hp: a.hp ?? CFG.hpMax, d: a.day ?? n.d });
}

/** 输入按调用次序立即生效，不推进墙钟或游戏时钟。挑本事时战斗暂停。 */
export function applyNightAction(n: NightState, action: NightAction): void {
  if (n.over) return;
  if (action.type === 'join') return join(n, action);
  // 援兵点的：找不到这个援兵（没进来、被服务器拦下）就不算
  const by = 'by' in action ? action.by : undefined;
  const guest = by === undefined ? undefined : n.guests?.find(g => g.id === by);
  if (by !== undefined && !guest) return;
  if (action.type === 'perk') return choosePerk(n, action.id, by);
  if (n.picking) return;
  switch (action.type) {
    case 'hit': return hit(n, n.ghosts.find(g => g.id === action.id) ?? null, guest);
    case 'hitAt': return hit(n, ghostAt(n, action.x, action.y), guest);
    case 'item':
      if (n.advancedItems || action.item === 'sword') {
        if (guest) guest.item = action.item;
        else n.item = action.item;
      }
      return;
    case 'help': return callHelp(n, action.id);
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// 巷子的透视、横移会改变横扫、点中和弩机的目标，属于玩法坐标。
function advanceGhosts(n: NightState): void {
  const dt = NIGHT.step, lane = NIGHT.lane;
  const slowNear = NIGHT.gate.talismanFactor ** n.traps.talisman * NIGHT.perk.slow ** (n.pk.slow ?? 0)
    * (n.guardian ? NIGHT.guardian.slow : 1);
  for (const g of n.ghosts) {
    g.flash = Math.max(0, g.flash - dt);
    if (g.state === 'bash') {
      g.bashT -= dt;
      if (g.bashT <= 0) {
        g.bashT = NIGHT.gate.bashCd;
        n.door -= g.hit * (1 + NIGHT.hitPerDay * (n.d - 1)) * NIGHT.perk.bolt ** (n.pk.bolt ?? 0);
      }
      continue;
    }
    const slow = g.y > NIGHT.gate.slowFrom ? slowNear : 1;
    g.y = Math.min(g.ty, g.y + g.speed * slow * dt);
    const progress = clamp01((g.y - lane.depthStart) / (g.ty - lane.depthStart));
    const halfWidth = lane.farWidth + lane.extraWidth * clamp01((g.y - lane.widenFrom) / lane.widenDistance);
    const merge = clamp01((progress - lane.mergeFrom) / lane.mergeDistance);
    g.x = lane.centerX + g.lane * halfWidth * (1 - merge) + (g.tx - lane.centerX) * merge;
    if (g.y >= g.ty) g.state = 'bash';
    g.ox = g.type === 'fly'
      ? Math.sin(n.t * lane.flyFrequency + g.ph) * lane.flySwing * clamp01((g.ty - g.y) / lane.flySettleDistance)
      : 0;
    g.k = lane.depthBase + lane.depthGain * clamp01((g.y - lane.depthStart) / (lane.gateY - lane.depthStart));
  }
}

function fireBows(n: NightState): void {
  const cfg = NIGHT.bows;
  for (const b of n.bows) {
    b.cd -= NIGHT.step;
    if (b.cd > 0) continue;
    const distance = (g: NightGhost) => Math.hypot(g.x - b.x, g.y - b.y);
    const targets = n.ghosts.filter(g => revealed(n, g) && g.y > cfg.fromY)
      .sort((a, c) => distance(a) - distance(c)).slice(0, 1 + (n.pk.bowplus ?? 0));
    if (!targets.length) {
      b.cd = cfg.idleCd;
      continue;
    }
    b.cd = Math.max(cfg.minCd, NIGHT.bowCd * cfg.fastFactor ** (n.pk.bowfast ?? 0));
    for (const target of targets) hurtGhost(n, target, NIGHT.bowDmg);
  }
}

function burnGhosts(n: NightState): void {
  if (!n.pk.burn || !lampHeld(n)) return;
  n.burnT += NIGHT.step;
  if (n.burnT < NIGHT.perk.burnInterval) return;
  n.burnT = 0;
  for (const g of n.ghosts.slice()) {
    const c = ghostCenter(g);
    if (c.y > NIGHT.perk.burnMinY && Math.hypot(c.x - NIGHT.weapon.lampX, c.y - NIGHT.weapon.lampY) < NIGHT.weapon.lampRadius) {
      hurtGhost(n, g, NIGHT.perk.burnDamage * n.pk.burn);
    }
  }
}

function helpDefend(n: NightState): void {
  for (const member of n.fam) {
    member.cd -= NIGHT.step;
    if (member.cd > 0) continue;
    const target = nearestGhost(n);
    member.cd = target ? member.rate : NIGHT.family.idleCd;
    if (target) hurtGhost(n, target, member.dmg);
  }
  const ally = n.ally;
  if (!ally) return;
  ally.t -= NIGHT.step;
  ally.cd -= NIGHT.step;
  if (ally.cd <= 0) {
    const target = nearestGhost(n);
    ally.cd = target ? NIGHT.ally.rate : NIGHT.ally.idleCd;
    if (target) hurtGhost(n, target, NIGHT.allyDmg);
  }
  if (ally.t <= 0) n.ally = null;
}

function endNight(n: NightState, won: boolean): void {
  n.over = true;
  if (!won) n.door = 0;
  // 第一阶段的战斗快照只有 seed 与旧钱箱；首次恢复同样用独立流补齐。
  const plan = n.lootPlan ?? planNightLoot(n.seed, n.treasures);
  const payout = nightPayout(plan, { purse: n.purse ?? 0, chest: n.lossBase, treasures: n.treasures }, won, n.coins);
  n.result = {
    won, kills: n.kills, coins: n.coins, door: n.door, doorMax: n.doorMax,
    creditedKills: won ? n.kills : 0, ...payout,
    lostMoney: payout.purseLost + payout.chestLost,
    held: won && !n.guardian ? 1 : 0, broken: !won && !n.guardian ? 1 : 0,
    friendship: { ...n.friendship },
  };
}

/** 每次调用正好推进一个固定步（暂停或终局除外）。同一 tick 的动作按数组顺序处理。 */
export function nightStep(n: NightState, actions: readonly NightAction[] = []): NightState {
  for (const action of actions) applyNightAction(n, action);
  if (n.over || n.picking) return n;
  n.t += NIGHT.step;
  while (n.spawns.length && n.spawns[0]!.at <= n.t) spawnGhost(n, n.spawns.shift()!);
  advanceGhosts(n);
  fireBows(n);
  burnGhosts(n);
  helpDefend(n);
  // 与样机一样，整步伤害和吸魂回血都结算后，再判门破；门破优先于清场。
  if (n.door <= 0) endNight(n, false);
  else if (!n.ghosts.length && !n.spawns.length) {
    if (n.wave === NIGHT.waves - 1) endNight(n, true);
    else offerPerks(n);
  }
  return n;
}
