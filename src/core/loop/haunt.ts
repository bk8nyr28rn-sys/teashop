import { Rng } from '../rng';
import { TREASURES } from './field-config';
import type { Afterlife } from './rebirth';

// 当厉鬼：去砸别人家的门。两台弩机：等一会儿 → 亮红光 → 射。亮红光时躲开就射不中。
// 固定步长推进，所有随机走注入的随机数；画面由页面根据返回的事件来画。
export const HAUNT = {
  time: 25,
  door: 220, doorPerTier: 80, tiers: [1, 3] as const,
  bash: 8,
  souls: 3,
  /** 躲一次能躲多久；躲着的时候砸不了门 */
  dodge: 0.75,
  /** 亮红光多久就射。躲闪要比这个长，按了躲就一定躲得开 */
  charge: 0.65,
  wait: [1.6, 2.8] as const,
  /** 两台弩机的位置和第一次等多久 */
  bows: [{ x: 108, first: [1.4, 2] as const }, { x: 252, first: [2.6, 3.4] as const }],
  /** 砸开了：带进下一世的钱 */
  lootCoins: 30,
} as const;

export interface HauntBow { x: number; s: 'wait' | 'charge'; c: number }
export interface HauntState {
  tier: number;
  door: number;
  max: number;
  souls: number;
  t: number;
  dodge: number;
  over: boolean;
  result: 'win' | 'caught' | 'timeout' | null;
  bows: HauntBow[];
  rngState: number;
}
export type HauntEvent = { kind: 'charge'; bow: number } | { kind: 'shot'; bow: number; hit: boolean } | { kind: 'dodged-end' };

function draw(h: HauntState): Rng {
  const rng = new Rng(1);
  rng.setState(h.rngState);
  return rng;
}
function between(rng: Rng, [lo, hi]: readonly [number, number]): number {
  return lo + rng.next() * (hi - lo);
}
function finish(h: HauntState, result: NonNullable<HauntState['result']>): void {
  h.over = true;
  h.result = result;
}

/** 开始一晚。门档 1–3 随机（以后真人版换成那户人家真的门） */
export function startHaunt(seed: number, tier?: number): HauntState {
  const rng = new Rng(seed);
  const level = tier ?? rng.int(HAUNT.tiers[0], HAUNT.tiers[1]);
  const max = HAUNT.door + level * HAUNT.doorPerTier;
  const bows = HAUNT.bows.map(b => ({ x: b.x, s: 'wait' as const, c: between(rng, b.first) }));
  return { tier: level, door: max, max, souls: HAUNT.souls, t: HAUNT.time, dodge: 0, over: false, result: null, bows, rngState: rng.getState() };
}

/** 砸一下门。躲着的时候砸不了 */
export function hauntBash(h: HauntState): boolean {
  if (h.over || h.dodge > 0) return false;
  h.door -= HAUNT.bash;
  if (h.door <= 0) finish(h, 'win');
  return true;
}

export function hauntDodge(h: HauntState): boolean {
  if (h.over) return false;
  h.dodge = HAUNT.dodge;
  return true;
}

/** 推进 dt 秒，返回这段时间里发生的事 */
export function hauntStep(h: HauntState, dt: number): HauntEvent[] {
  if (h.over) return [];
  const events: HauntEvent[] = [];
  const rng = draw(h);
  h.t -= dt;
  if (h.dodge > 0) {
    h.dodge -= dt;
    if (h.dodge <= 0) events.push({ kind: 'dodged-end' });
  }
  h.bows.forEach((b, i) => {
    b.c -= dt;
    if (b.s === 'wait' && b.c <= 0) {
      b.s = 'charge'; b.c = HAUNT.charge;
      events.push({ kind: 'charge', bow: i });
    } else if (b.s === 'charge' && b.c <= 0) {
      b.s = 'wait'; b.c = between(rng, HAUNT.wait);
      const hit = h.dodge <= 0;
      if (hit) h.souls--;
      events.push({ kind: 'shot', bow: i, hit });
    }
  });
  h.rngState = rng.getState();
  if (h.souls <= 0) finish(h, 'caught');
  else if (h.t <= 0) finish(h, 'timeout');
  return events;
}

/** 这一晚的结果，记进因果分。砸开了随一件宝物和 30 文带进下一世 */
export function hauntOutcome(h: HauntState): Afterlife {
  if (h.result === 'win') {
    const rng = draw(h);
    const loot = { ...rng.pick(TREASURES) };
    h.rngState = rng.getState();
    return { kind: 'haunt', won: true, loot };
  }
  if (h.result === 'caught') return { kind: 'haunt', caught: true };
  return { kind: 'haunt' };
}
