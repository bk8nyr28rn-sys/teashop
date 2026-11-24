import { Rng } from '../rng';
import { CFG } from './base';
import { nightKarma } from './auto-defense';
import { TREASURES } from './field-config';
import { threadName, type Kin, type ThreadName } from './family';
import type { Treasure } from './state';

// 投胎：一世走完算因果分，按分数给三户人家挑。回自家的那几张卡由 household.ts 处理。

/** 产品开关：老死以后要不要先当一晚鬼（护家神 / 厉鬼）。关掉就直接去下一世；万一审核不让写阴间，改这里 */
export const AFTERLIFE = { night: true } as const;
export const REBIRTH = {
  /** 因果分 < 30 寻常人家，< 70 殷实人家，其余名门望族 */
  tierAt: [30, 70] as const,
  tierNames: ['寻常人家', '殷实人家', '名门望族'] as const,
  /** 各档人家的家底范围 */
  families: [
    { door: [0, 1], money: [10, 40], crossbow: [0, 0], lamp: 0, talisman: 0, treasures: [0, 0] },
    { door: [1, 2], money: [50, 110], crossbow: [1, 1], lamp: 0, talisman: 0, treasures: [0, 1] },
    { door: [2, 4], money: [120, 240], crossbow: [2, 3], lamp: 1, talisman: 1, treasures: [1, 2] },
  ] as const,
  /** 各档人家爹娘的红线 */
  threads: [['相识', '知己'], ['知己', '倾心'], ['倾心', '挚爱']] as const,
  karma: {
    friendsPer: 10,
    kinEach: 10, kinCap: 40,
    thread: { 相识: 0, 知己: 5, 倾心: 15, 挚爱: 25 } as Record<ThreadName, number>,
    guardWin: 20, guardLose: 5,
    hauntWin: 5, hauntCaught: -10,
    early: -5,
  },
  /** 回自家投胎时，爹娘（上一世的后人）红线在这个范围里随 */
  ownLove: [20, 60] as const,
  /** 交情深的邻居下一世还记得你（留一半）；其余随机重新认识 */
  friends: { keepAt: CFG.helpAt, keepShare: 0.5, fresh: [0, 15] as const },
} as const;

export type KarmaRow = [label: string, detail: string, points: number];
export interface Afterlife { kind: 'guard' | 'haunt'; won?: boolean; caught?: boolean; automatic?: boolean; loot?: Treasure }
export interface LifeRecord {
  held: number;
  autoHeld?: number;
  broken: number;
  earned: number;
  friends: Record<string, number>;
  kids: Kin[];
  spouse: unknown | null;
  love: number;
  afterlife?: Afterlife | null;
  deathKind?: string | null;
}

/** 这一世的因果分，一行一项。页面直接拿来列表 */
export function karmaRows(g: LifeRecord, neighbors: readonly string[]): KarmaRow[] {
  const K = REBIRTH.karma;
  const autoHeld = g.autoHeld ?? 0;
  const friends = neighbors.reduce((a, id) => a + (g.friends[id] ?? 0), 0);
  const rows: KarmaRow[] = [
    ['家业', `亲守 ${g.held - autoHeld} 夜，机关守住 ${autoHeld} 夜，亲守破门 ${g.broken} 次，赚 ${g.earned} 文`,
      nightKarma(g.held, autoHeld, g.broken, g.earned)],
    ['交情', `合计 ${friends}`, Math.floor(friends / K.friendsPer)],
    ['养育', `${g.kids.length} 个孩子或徒弟`, Math.min(K.kinCap, g.kids.length * K.kinEach)],
    ['红线', g.spouse ? threadName(g.love) : '没有', g.spouse ? K.thread[threadName(g.love)] : 0],
  ];
  const A = g.afterlife;
  if (A?.kind === 'guard' && !A.automatic) rows.push(['当护家神', A.won ? '守住了' : '没守住', A.won ? K.guardWin : K.guardLose]);
  if (A?.kind === 'haunt') rows.push(['当厉鬼', A.won ? '得手了' : A.caught ? '被收进葫芦' : '没砸开', A.won ? K.hauntWin : A.caught ? K.hauntCaught : 0]);
  if (g.deathKind === 'early') rows.push(['英年早逝', '', K.early]);
  return rows;
}

export function karmaTotal(rows: readonly KarmaRow[]): number {
  return rows.reduce((a, r) => a + r[2], 0);
}

export function tierOf(total: number): 0 | 1 | 2 {
  return total < REBIRTH.tierAt[0] ? 0 : total < REBIRTH.tierAt[1] ? 1 : 2;
}

/** 按档次随一户人家的家底。名字由页面起（外观随机不影响家底） */
export function newFamily(tier: 0 | 1 | 2, rng: Rng) {
  const R = REBIRTH.families[tier];
  const between = ([lo, hi]: readonly [number, number]) => rng.int(lo, hi);
  return {
    door: between(R.door), money: between(R.money), crossbow: between(R.crossbow), lamp: R.lamp as number, talisman: R.talisman as number,
    thread: rng.pick(REBIRTH.threads[tier]) as ThreadName,
    treasures: Array.from({ length: between(R.treasures) }, () => ({ ...rng.pick(TREASURES), tre: true as const })),
  };
}

/** 三户候选：有后人时前面是回自家的卡（页面加），后面两户按因果分档和低一档 */
export function strangerTiers(tier: 0 | 1 | 2, heirs: number): Array<0 | 1 | 2> {
  return heirs ? [tier, Math.max(0, tier - 1) as 0 | 1 | 2] : [tier, tier, Math.max(0, tier - 1) as 0 | 1 | 2];
}

/** 回自家投胎：爹娘的红线 */
export function ownThread(rng: Rng): ThreadName {
  return threadName(rng.int(REBIRTH.ownLove[0], REBIRTH.ownLove[1]));
}

/** 下一世还记得谁：交情到驰援的留一半，其余重新认识 */
export function carryFriends(prev: Record<string, number>, neighbors: readonly string[], rng: Rng): Record<string, number> {
  const F = REBIRTH.friends;
  const out: Record<string, number> = {};
  for (const id of neighbors) {
    const v = prev[id] ?? 0;
    out[id] = v >= F.keepAt ? Math.floor(v * F.keepShare) : rng.int(F.fresh[0], F.fresh[1]);
  }
  return out;
}
