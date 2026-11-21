import { Rng } from '../rng';
import { AGE_FX, balanceAge, CFG, nextRandom, RULE_VERSION } from './base';
import { FIELD_CONFIG as F, HOME, RINGS, SPOTS, TREASURES, type Spot } from './field-config';
import { makeHouse, makePerson, type House, type Loot, type Person } from './state';

type Place = number | 'home';
type DuskReason = 'walk' | 'return' | 'gather' | 'mark' | 'flee';

interface FieldDay {
  day: number;
  clues: number[];
  visits: Record<number, number>;
  bonus: Record<number, true>;
  tomorrow: Record<number, true>;
}

export interface FieldState {
  ruleVersion: typeof RULE_VERSION;
  house: House;
  person: Person;
  rngState: number;
  phase: 'home' | 'map' | 'danger' | 'dusk' | 'dead';
  at: Place;
  buddy: string | null;
  today: FieldDay | null;
  encounter: string | null;
  duskReason: DuskReason | null;
  shareRemainder: Record<string, number>;
  /** 按地点存放，跨游戏日保留；其他玩家的访问由上层实现。 */
  ground: Record<number, Loot[]>;
}

export function makeField(seed: number, house = makeHouse(), person = makePerson()): FieldState {
  return {
    ruleVersion: RULE_VERSION, house, person, rngState: new Rng(seed).getState(),
    phase: 'home', at: 'home', buddy: null, today: null, encounter: null,
    duskReason: null, shareRemainder: {}, ground: {},
  };
}

export function goOut(s: FieldState, buddy: string | null = null): boolean {
  if (s.phase !== 'home' || s.person.time >= CFG.dusk) return false;
  if (buddy !== null && !((s.person.friends[buddy] ?? 0) >= CFG.buddyAt)) return false;
  s.buddy = buddy;
  s.phase = 'map';
  if (s.today?.day !== s.person.day) {
    const notes = s.today?.day === s.person.day - 1 ? s.today.tomorrow : {};
    s.today = {
      day: s.person.day, clues: SPOTS.map(sp => Math.floor(nextRandom(s) * sp.clues.length)),
      visits: {}, bonus: notes, tomorrow: {},
    };
  }
  return true;
}

export function bagCap(s: FieldState): number {
  return CFG.bag + (s.buddy ? CFG.bagBuddy : 0);
}

function spotAt(id: number): Spot {
  const spot = SPOTS[id];
  if (!spot) throw new RangeError('无此野外地点');
  return spot;
}

export function walkMin(s: FieldState, from: Place, to: Place): number {
  const a = from === 'home' ? HOME : spotAt(from);
  const b = to === 'home' ? HOME : spotAt(to);
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  return Math.round(distance * AGE_FX[balanceAge(s.person.day)].walk * (s.buddy ? 1 : F.soloWalk));
}

export function siteClue(s: FieldState, id: number) {
  if (!s.today) throw new Error('首次出门时抽取当日线索');
  return spotAt(id).clues[s.today.clues[id]!]!;
}

export function routeTo(s: FieldState, id: number) {
  const spot = spotAt(id);
  const minutes = walkMin(s, s.at, id);
  const arrive = s.person.time + minutes;
  const back = walkMin(s, id, 'home');
  return { minutes, arrive, back, late: arrive + spot.minutes[0] + back > CFG.dusk, clue: siteClue(s, id) };
}

function dusk(s: FieldState, reason: DuskReason) {
  s.phase = 'dusk';
  s.duskReason = reason;
}

export function walkTo(s: FieldState, id: number): boolean {
  if (s.phase !== 'map' || s.at === id || !SPOTS[id]) return false;
  const minutes = walkMin(s, s.at, id);
  // 出门途中遇暮用目的地的圈判定；回家途中遇暮仍用出发地的圈。
  s.at = id;
  s.person.time = Math.min(CFG.dusk, s.person.time + minutes);
  if (s.person.time >= CFG.dusk) dusk(s, 'walk');
  return true;
}

export function fieldWeights(s: FieldState, id: number): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const [name, weight] of Object.entries(spotAt(id).loot)) weights[name] = weight * F.baseWeightScale;
  const { focus } = siteClue(s, id);
  weights[focus] = (weights[focus] || 0) + F.clueWeight;
  return weights;
}

export function fieldAction(s: FieldState, id: number, rich = false) {
  const sp = spotAt(id), clue = siteClue(s, id);
  const solo = rich && sp.solo && !s.buddy;
  const index = rich ? 1 : 0;
  const risk = (sp.risk[index] + clue.extraRisk * (rich ? 1 : F.safeClueRisk)) * (s.buddy ? F.buddyRisk : 1);
  const level = risk < F.riskLevels[0] ? '低' : risk < F.riskLevels[1] ? '中' : '高';
  const visits = s.today!.visits[id] || 0;
  const factor = F.visitFactors[visits] || 0;
  const double = !!(s.buddy && s.today!.bonus[id]);
  const base: readonly [number, number] = rich ? F.richCount : [sp.safeCount ?? 1, sp.safeCount ?? 1];
  const multiplier = double ? F.markedYield : 1;
  return {
    name: rich ? (solo ? sp.solo + '（' + clue.focus + '）' : clue.action) : sp.safe,
    minutes: sp.minutes[index] - (solo ? F.soloShortcutMinutes : 0), risk, level, base, factor, double,
    lo: Math.floor(base[0] * factor) * multiplier, hi: Math.ceil(base[1] * factor) * multiplier,
  };
}

function rollLoot(s: FieldState, id: number): Loot {
  let roll = nextRandom(s) * 100, name = '';
  for (const [n, weight] of Object.entries(fieldWeights(s, id))) {
    name = n;
    if (roll < weight) break;
    roll -= weight;
  }
  if (name !== '宝物') return { n: name };
  const treasure = TREASURES[Math.floor(nextRandom(s) * TREASURES.length)]!;
  return { ...treasure, tre: true };
}

function collectLoot(s: FieldState, id: number, count: number) {
  const kept: Loot[] = [], shared: Loot[] = [];
  for (let i = 0; i < count; i++) {
    const due = s.buddy && s.shareRemainder[s.buddy] === F.buddyShareEvery - 1;
    if (!due && s.person.bag.length >= bagCap(s)) break;
    const item = rollLoot(s, id);
    if (due) shared.push(item);
    else { s.person.bag.push(item); kept.push(item); }
    if (s.buddy) s.shareRemainder[s.buddy] = due ? 0 : (s.shareRemainder[s.buddy] || 0) + 1;
  }
  return { kept, shared };
}

export function gather(s: FieldState, rich = false) {
  if (s.phase !== 'map' || s.at === 'home' || s.person.bag.length >= bagCap(s)) return null;
  const id = s.at, action = fieldAction(s, id, rich);
  if (!action.factor) return null;
  const [lo, hi] = action.base;
  const expected = (lo === hi ? lo : lo + Math.floor(nextRandom(s) * (hi - lo + 1))) * action.factor;
  const remainder = expected % 1;
  const count = Math.floor(expected) + (remainder && nextRandom(s) < remainder ? 1 : 0);
  const loot = collectLoot(s, id, count * (action.double ? F.markedYield : 1));
  if (action.double) delete s.today!.bonus[id];
  s.today!.visits[id] = (s.today!.visits[id] || 0) + 1;
  s.person.time += action.minutes;
  if (s.person.time >= CFG.dusk) dusk(s, 'gather');
  else if (nextRandom(s) < action.risk) {
    const foes = RINGS[spotAt(id).ring].foes;
    s.encounter = foes[Math.floor(nextRandom(s) * foes.length)]!;
    s.phase = 'danger';
  }
  return loot;
}

export function markSpot(s: FieldState): boolean {
  if (s.phase !== 'map' || s.at === 'home' || s.person.day >= CFG.lifeDays || s.today!.tomorrow[s.at]) return false;
  s.today!.tomorrow[s.at] = true;
  s.person.time += F.markMinutes;
  if (s.person.time >= CFG.dusk) dusk(s, 'mark');
  return true;
}

function chance(p: number) {
  return Math.min(F.chanceMax, Math.max(F.chanceMin, p));
}

export function fightChance(s: FieldState): number | null {
  if (s.phase !== 'danger' || s.at === 'home') return null;
  const ring = RINGS[spotAt(s.at).ring];
  return chance(ring.fight + (s.buddy ? F.buddyFight : 0) + AGE_FX[balanceAge(s.person.day)].fight
    - (s.person.hp < CFG.hpMax ? F.woundedFightPenalty : 0));
}

function arriveHome(s: FieldState) {
  for (const item of s.person.bag) {
    if (item.tre) s.house.treasures.push({ n: item.n, v: item.v });
    else s.house.store[item.n] = (s.house.store[item.n] || 0) + 1;
  }
  if (s.buddy) s.person.friends[s.buddy] = Math.min(F.maxFriendship, (s.person.friends[s.buddy] || 0) + F.returnFriendship);
  s.person.bag = [];
  s.buddy = null;
  s.at = 'home';
  s.phase = 'home';
  s.duskReason = null;
  s.encounter = null;
}

export function goHome(s: FieldState): boolean {
  if (s.phase !== 'map') return false;
  if (s.at === 'home') {
    // 在门口取消出行，没有一起走过路，不加交情。
    s.buddy = null;
    s.phase = 'home';
    return true;
  }
  const arrive = s.person.time + walkMin(s, s.at, 'home');
  if (arrive > CFG.dusk) {
    s.person.time = CFG.dusk;
    dusk(s, 'return');
  } else {
    s.person.time = arrive;
    arriveHome(s);
  }
  return true;
}

function dropBag(s: FieldState, id: number, start: number, count: number) {
  const lost = s.person.bag.splice(start, count);
  if (lost.length) (s.ground[id] ??= []).push(...lost);
  return lost;
}

function lossCount(s: FieldState) {
  return s.buddy ? Math.ceil(s.person.bag.length * F.buddyLossShare) : s.person.bag.length;
}

function knocked(s: FieldState, id: number) {
  const lost = dropBag(s, id, 0, lossCount(s));
  const death = RINGS[spotAt(id).ring].death;
  if (!s.buddy && death && nextRandom(s) < death) {
    s.phase = 'dead';
    return { outcome: 'dead' as const, lost };
  }
  const back = walkMin(s, id, 'home');
  s.person.time += s.buddy ? back : Math.round(back * F.crawlMinutesScale);
  s.person.hp = F.injuredHp;
  arriveHome(s);
  return { outcome: 'knocked' as const, lost };
}

export function fight(s: FieldState) {
  const probability = fightChance(s);
  if (probability === null || s.at === 'home') return null;
  s.phase = 'map';
  s.encounter = null;
  if (nextRandom(s) < probability) return { outcome: 'won' as const, ...collectLoot(s, s.at, 1) };
  s.person.hp -= F.fightInjury;
  if (s.person.hp <= 0) return knocked(s, s.at);
  return { outcome: 'hurt' as const };
}

export function flee(s: FieldState) {
  if (s.phase !== 'danger' || s.at === 'home') return null;
  s.encounter = null;
  s.phase = 'map';
  s.person.time += F.fleeMinutes;
  const bag = s.person.bag;
  const lost = bag.length && nextRandom(s) < F.fleeLossChance
    ? dropBag(s, s.at, Math.floor(nextRandom(s) * bag.length), 1) : [];
  if (s.person.time >= CFG.dusk) dusk(s, 'flee');
  return { lost };
}

export function escapeChance(s: FieldState): number | null {
  if (s.phase !== 'dusk' || s.at === 'home') return null;
  return chance(RINGS[spotAt(s.at).ring].escape + (s.buddy ? F.buddyEscape : 0));
}

export function escapeDusk(s: FieldState, choice: 'carry' | 'drop') {
  const probability = escapeChance(s);
  if (probability === null || s.at === 'home') return null;
  if (choice === 'drop') {
    const lost = dropBag(s, s.at, 0, s.person.bag.length);
    arriveHome(s);
    return { outcome: 'escaped' as const, lost };
  }
  if (nextRandom(s) < probability) {
    arriveHome(s);
    return { outcome: 'escaped' as const, lost: [] };
  }
  s.person.hp = Math.max(0, s.person.hp - F.duskInjury);
  if (s.person.hp <= 0) return knocked(s, s.at);
  const lost = dropBag(s, s.at, 0, lossCount(s));
  arriveHome(s);
  return { outcome: 'caught' as const, lost };
}
