import { depositCoins, settleEstate, unpackBag } from './economy';
import { makeHouse, type House, type Loot, type Treasure } from './state';
import { BANK_CAP, makeDayBank, type DayBank } from './time';

type Fields = Record<string, unknown>;
type NightEntry = Fields & { nightId?: number };
type Portrait = Fields & { lifeId?: string };
type Stock = Record<string, number>;

interface Account extends Fields, DayBank {
  nightId: number;
  lastActiveDate?: string;
  riverGuide?: Fields;
}
export interface AbsencePeriod { firstNightId: number; lastNightId: number }
interface Resident extends Fields {
  houseId: string;
  lifeId: string;
  lifeNo: number;
  purse: number;
  bag: Loot[];
  goods: Stock;
  personalTreasures: Treasure[];
}
interface Household extends House {
  houseId: string;
  name: string;
  yard: { stone?: 'yard'; yardSlot?: number };
  ancestors: Portrait[];
  abandoned: boolean;
  nightPlan: NightEntry | null;
  receipts: Record<string, NightEntry>;
  pendingNightId: number | null;
  absencePeriods?: AbsencePeriod[];
  absenceReadThrough?: number;
}
export interface V4 {
  v: 4;
  account: Account;
  person: Resident;
  houses: Record<string, Household>;
}

// 保存新捏的脸时页面会展开 G。Symbol 键随展开保留，写 JSON 时自动跳过。
const otherHouses = Symbol('inactive households');
export interface HouseholdView extends Resident, House, DayBank {
  v: 4;
  fam: string;
  nightId: number;
  lastActiveDate?: string;
  absencePeriods?: AbsencePeriod[];
  absenceReadThrough?: number;
  nightPlan: NightEntry | null;
  nightReceipt: NightEntry | null;
  receipts: Record<string, NightEntry>;
  ancestors: Portrait[];
  river?: Fields;
  [otherHouses]?: V4['houses'];
}

const accountKeys = ['bankedDays', 'lastGrantDate', 'unlimitedDays', 'guideSeen', 'guideOff',
  'allFeatures', 'look', 'expression', 'history', 'nightId', 'worldId', 'lastActiveDate'];
const riverGuideKeys = ['record', 'hints', 'textOn'];
const houseKeys = ['houseId', 'fam', 'money', 'chest', 'door', 'traps', 'store', 'treasures',
  'ancestors', 'abandoned', 'nightPlan', 'receipts', 'nightReceipt', 'absencePeriods', 'absenceReadThrough'];
const candidateAssets = ['name', 'money', 'chest', 'store', 'door', 'crossbow', 'lamp', 'talisman',
  'traps', 'treasures', 'ancestors', 'yard'];

function isObject(value: unknown): value is Fields {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function object(value: unknown): Fields { return isObject(value) ? value : {}; }
function list<T>(value: unknown): T[] { return Array.isArray(value) ? value : []; }
function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function take(source: Fields, keys: string[]): Fields {
  const result: Fields = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = source[key];
    delete source[key];
  }
  return result;
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { makeDayBank(value); return true; } catch { return false; }
}

// 奈何桥的候选不能重抽。后人卡存原家的引用，别家卡保留当时展示的报价。
function ownCandidates(person: Fields): Fields[] {
  return list<unknown>(object(person.reborn).fams).filter((f): f is Fields => isObject(f) && f.own === true);
}
function candidateView(f: Fields, house: Household) {
  Object.assign(f, {
    name: house.name, houseId: house.houseId, money: house.chest, store: { ...house.store }, door: house.door,
    ...house.traps, treasures: [...house.treasures], ancestors: [...house.ancestors],
  });
}

export function fromView(raw: Fields, base?: V4 | null): V4 {
  const view = clone(raw);
  const accountFields = take(view, accountKeys);
  const h = take(view, houseKeys);
  const lifeNo = count(view.lifeNo) || 1;
  const prefix = typeof accountFields.worldId === 'string' ? accountFields.worldId + '/' : '';
  const lifeId = typeof view.lifeId === 'string' ? view.lifeId : prefix + 'life-' + lifeNo;
  const houseId = typeof h.houseId === 'string' ? h.houseId : prefix + 'house-' + lifeNo;
  const lastGrantDate = accountFields.lastGrantDate ?? base?.account.lastGrantDate;
  if (!validDate(lastGrantDate)) throw new RangeError('存档需要调用方提供有效的本地年月日');
  const account: Account = {
    ...accountFields, nightId: count(accountFields.nightId),
    bankedDays: Number.isInteger(accountFields.bankedDays) ? Math.min(BANK_CAP, count(accountFields.bankedDays)) : BANK_CAP,
    lastGrantDate,
    unlimitedDays: accountFields.unlimitedDays === true,
  };
  const yard: Household['yard'] = {};
  if (isObject(view.river)) {
    const guide = take(view.river, riverGuideKeys);
    if (Object.keys(guide).length) account.riverGuide = guide;
    if (view.river.stone === 'yard') {
      yard.stone = 'yard';
      yard.yardSlot = Number.isInteger(view.river.yardSlot) ? Number(view.river.yardSlot) : 1;
      delete view.river.stone;
    }
    delete view.river.yardSlot;
  }
  const house: Household = {
    houseId, name: typeof h.fam === 'string' ? h.fam : '林家',
    chest: count(h.chest ?? h.money), store: object(h.store) as Stock, door: count(h.door),
    traps: { ...makeHouse().traps, ...object(h.traps) },
    treasures: list<Treasure>(h.treasures), ancestors: list<Portrait>(h.ancestors), yard,
    abandoned: h.abandoned === true, nightPlan: isObject(h.nightPlan) ? h.nightPlan : null,
    receipts: object(h.receipts) as Household['receipts'], pendingNightId: null,
  };
  if (Array.isArray(h.absencePeriods)) house.absencePeriods = h.absencePeriods;
  if (typeof h.absenceReadThrough === 'number') house.absenceReadThrough = count(h.absenceReadThrough);
  if (isObject(h.nightReceipt)) {
    // v3 的旧回执已入账，只为原战报补编号。
    const nightId = count(h.nightReceipt.nightId) || account.nightId || 1;
    house.receipts[nightId] = { ...h.nightReceipt, houseId, lifeId, nightId,
      day: h.nightReceipt.day ?? (count(view.day) || 1), guardian: h.nightReceipt.guardian ?? (h.nightReceipt.next === 'reborn') };
    house.pendingNightId = nightId;
    account.nightId = Math.max(account.nightId, nightId);
  }
  for (const choice of ownCandidates(view)) {
    take(choice, candidateAssets);
    choice.houseId = houseId;
  }
  delete view.v;
  const person: Resident = { ...view, lifeId, houseId, lifeNo,
    purse: count(view.purse), goods: object(view.goods) as Stock,
    personalTreasures: list<Treasure>(view.personalTreasures), bag: list<Loot>(view.bag) };
  const inactive = (raw as HouseholdView)[otherHouses];
  const houses = { ...clone(base?.houses ?? {}), ...clone(inactive ?? {}), [houseId]: house };
  return { v: 4, account, person, houses };
}

export function toView(save: V4): HouseholdView {
  const { account, person, houses } = clone(save);
  const house = houses[person.houseId]!;
  delete houses[person.houseId];
  const { yard, pendingNightId, name, ...inventory } = house;
  const { riverGuide, ...accountFields } = account;
  const view: HouseholdView = { ...accountFields, ...person, ...inventory, v: 4, fam: name,
    nightReceipt: pendingNightId === null ? null : house.receipts[pendingNightId] ?? null };
  if (isObject(person.river) || riverGuide || yard.stone) {
    view.river = { ...object(person.river), ...riverGuide, ...yard };
  }
  for (const choice of ownCandidates(view)) candidateView(choice, house);
  view[otherHouses] = houses;
  return view;
}

function legacyPortrait(game: Fields): Portrait {
  const note = '第 ' + (count(game.lifeNo) || 1) + ' 世的你';
  for (const choice of ownCandidates(game)) {
    const match = list<Portrait>(choice.ancestors).find(p => p.note === note && p.name === game.name);
    if (match) return match;
  }
  return { name: game.name, look: game.look, expression: game.expression || 'calm', note };
}

export function migrateSave(raw: unknown, today: string): V4 | null {
  if (!isObject(raw)) return null;
  if (raw.v === 4) {
    if (!isObject(raw.account) || !isObject(raw.person) || !isObject(raw.houses) ||
        typeof raw.person.houseId !== 'string' || !Object.prototype.hasOwnProperty.call(raw.houses, raw.person.houseId) ||
        !isObject(raw.houses[raw.person.houseId])) return null;
    return clone(raw) as unknown as V4;
  }
  if (raw.v !== 2 && raw.v !== 3) return null;
  const flat = { ...raw, chest: count(raw.money), purse: 0, goods: {}, personalTreasures: [],
    lastGrantDate: validDate(raw.lastGrantDate) ? raw.lastGrantDate : today };
  const migrated = fromView(flat);
  if (raw.deathKind !== 'old' && raw.deathKind !== 'early') return migrated;
  const view = toView(migrated);
  finishLife(view, legacyPortrait(raw));
  return fromView(view);
}

export function addLifePortrait(g: HouseholdView, portrait: Portrait): void {
  if (g.ancestors.some(p => p.lifeId === g.lifeId)) return;
  // 一些奈何桥旧档已经挂了本世画像，只缺身份编号。
  const existing = g.ancestors.find(p => !p.lifeId && p.name === portrait.name &&
    p.note === '第 ' + g.lifeNo + ' 世的你');
  if (existing) existing.lifeId = g.lifeId;
  else g.ancestors.push({ ...clone(portrait), lifeId: g.lifeId });
}

export function finishLife(g: HouseholdView, portrait: Portrait): void {
  if (!g.estateSettled) {
    if (g.deathKind !== 'early') unpackBag(g);
    settleEstate(g, g);
    g.estateSettled = true;
  }
  addLifePortrait(g, portrait);
}

export function leaveGuardianReward(g: HouseholdView): void {
  // 遗产结清以后，钱袋里新增的是死后守门所得。奈何桥上也可能再收到离线纸钱。
  if (g.estateSettled) { depositCoins(g, g, g.purse); return; }
  if (g.guardianRewardStored) return;
  const receipt = Object.values(g.receipts).find(r => r.lifeId === g.lifeId && r.guardian === true && r.won === true);
  if (receipt && depositCoins(g, g, Math.min(g.purse, count(receipt.earnedMoney)))) g.guardianRewardStored = true;
}

export function nextLifeView(newFlat: Fields, previous: HouseholdView, own: boolean, loot?: Treasure | null): HouseholdView {
  // 在已停在奈何桥的旧档上同样能完成交接。
  leaveGuardianReward(previous);
  const prior = fromView(previous);
  const oldHouse = prior.houses[previous.houseId]!;
  oldHouse.abandoned = !own && list(previous.kids).length === 0;
  const lifeNo = previous.lifeNo + 1;
  const prefix = typeof prior.account.worldId === 'string' ? prior.account.worldId + '/' : '';
  let houseId = oldHouse.houseId;
  if (!own) {
    let serial = lifeNo;
    do { houseId = prefix + 'house-' + serial++; } while (prior.houses[houseId]);
  }
  const fresh = fromView({ ...newFlat, lastGrantDate: prior.account.lastGrantDate, lifeNo, houseId, lifeId: prefix + 'life-' + lifeNo,
    own, purse: loot ? 30 : 0, personalTreasures: loot ? [loot] : [], goods: {} });
  // 河埠在换世前初始化下一世的场景，可能顺带补上前世已经看过的进门提示。
  const riverGuide = { ...prior.account.riverGuide, ...fresh.account.riverGuide };
  fresh.account = prior.account;
  if (Object.keys(riverGuide).length) fresh.account.riverGuide = riverGuide;
  fresh.houses = { ...prior.houses, [houseId]: own ? oldHouse : fresh.houses[houseId]! };
  fresh.houses[houseId]!.pendingNightId = null;
  fresh.houses[houseId]!.nightPlan = null;
  return toView(fresh);
}
