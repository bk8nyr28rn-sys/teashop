import { Rng } from '../rng';
import { CFG } from './base';
import { payHome, quoteHome } from './economy';

// 家：牵红线、陪伴、生孩子、收徒弟。名字和长相是外观，由页面给；这里只管规则。
export const FAMILY = {
  /** 红线到多少算哪一级。一辈子之内最多到挚爱 */
  threads: [[0, '相识'], [20, '知己'], [45, '倾心'], [70, '挚爱']] as const,
  /** 爹娘红线 → 孩子品级和强弱。品级主要给面子，强弱最多差三成 */
  grades: { 相识: ['寻常', 1], 知己: ['良才', 1.05], 倾心: ['上等', 1.1], 挚爱: ['奇才', 1.2] } as Record<ThreadName, readonly [string, number]>,
  maxLove: 100,
  /** 刚牵上红线 */
  matchLove: 10,
  /** 有伴侣时每天早上 */
  dawnLove: 8,
  /** 陪伴：花 1 个时辰 */
  accompany: { minutes: 120, love: 12 },
  /** 红线到知己、第 3 天起，一天最多生一个，最多两个孩子 */
  birth: { minLove: 20, maxKids: 2, fromDay: 3 },
  /** 收徒：家里的事，先用钱箱。品级看这一世守住了几夜 */
  disciple: { cost: 30, max: 2, grades: [[3, '上等', 1.1], [1, '良才', 1.05], [0, '寻常', 1]] as const },
} as const;

export type ThreadName = '相识' | '知己' | '倾心' | '挚爱';
export interface Kin { kind: '子' | '女' | '徒'; grade: string; power: number; [cosmetic: string]: unknown }
export interface FamilyState {
  day: number;
  time: number;
  love: number;
  spouse: unknown | null;
  kids: Kin[];
  bornToday?: number | null;
  held: number;
}

export function threadName(love: number): ThreadName {
  let name: ThreadName = '相识';
  for (const [min, n] of FAMILY.threads) if (love >= min) name = n;
  return name;
}

export function gradeFor(love: number): readonly [string, number] {
  return FAMILY.grades[threadName(love)];
}

/** 牵红线。已经有伴侣就不行 */
export function match(s: FamilyState, spouse: unknown): boolean {
  if (s.spouse || !spouse) return false;
  s.spouse = spouse;
  s.love = FAMILY.matchLove;
  return true;
}

/** 陪伴：花 1 个时辰，天黑前不够时辰就不行 */
export function canAccompany(s: FamilyState): boolean {
  return !!s.spouse && s.time + FAMILY.accompany.minutes <= CFG.dusk;
}
export function accompany(s: FamilyState): boolean {
  if (!canAccompany(s)) return false;
  s.time += FAMILY.accompany.minutes;
  s.love = Math.min(FAMILY.maxLove, s.love + FAMILY.accompany.love);
  return true;
}

/** 每天早上红线自己涨一点 */
export function dawnLove(s: FamilyState): void {
  if (s.spouse) s.love = Math.min(FAMILY.maxLove, s.love + FAMILY.dawnLove);
}

export function canBirth(s: FamilyState): boolean {
  const B = FAMILY.birth;
  const kids = s.kids.filter(k => k.kind !== '徒').length;
  return !!s.spouse && s.love >= B.minLove && kids < B.maxKids && s.day >= B.fromDay && s.bornToday !== s.day;
}

/** 天亮时可能生孩子。品级看爹娘现在的红线；儿子还是女儿由随机数定 */
export function birth(s: FamilyState, rng: Rng): Kin | null {
  if (!canBirth(s)) return null;
  const [grade, power] = gradeFor(s.love);
  const kid: Kin = { kind: rng.chance(0.5) ? '子' : '女', grade, power };
  s.kids.push(kid);
  s.bornToday = s.day;
  return kid;
}

export function discipleGrade(held: number): readonly [string, number] {
  const row = FAMILY.disciple.grades.find(([min]) => held >= min)!;
  return [row[1], row[2]];
}

export function canTakeDisciple(s: FamilyState & { chest: number; purse: number }): boolean {
  return s.kids.filter(k => k.kind === '徒').length < FAMILY.disciple.max && !quoteHome(s, s, FAMILY.disciple.cost).shortfall;
}

/** 收徒弟：先用钱箱，不够再用钱袋。最多两个徒弟 */
export function takeDisciple(s: FamilyState & { chest: number; purse: number }) {
  if (s.kids.filter(k => k.kind === '徒').length >= FAMILY.disciple.max) return null;
  const payment = payHome(s, s, FAMILY.disciple.cost);
  if (!payment) return null;
  const [grade, power] = discipleGrade(s.held);
  const kin: Kin = { kind: '徒', grade, power };
  s.kids.push(kin);
  return { kin, payment };
}
