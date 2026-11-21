import { Rng } from '../rng';

export const RULE_VERSION = 2;
export const CFG = {
  lifeDays: 5, dayStart: 360, dusk: 1080, hpMax: 3, bag: 6, bagBuddy: 3,
  buddyAt: 20, helpAt: 40,
} as const;

export const AGE_FX = {
  child: { dmg: 0.8, fight: -0.1, walk: 1 },
  adult: { dmg: 1, fight: 0, walk: 1 },
  elder: { dmg: 0.85, fight: -0.05, walk: 1.2 },
} as const;
export const AGE_LIMITS = { adult: 0.2, elder: 0.7 } as const;

export function balanceAge(day: number): keyof typeof AGE_FX {
  const fraction = (day - 1) / Math.max(1, CFG.lifeDays - 1);
  if (fraction < AGE_LIMITS.adult) return 'child';
  return fraction < AGE_LIMITS.elder ? 'adult' : 'elder';
}

// 存档只需保存随机流的整数状态，零也是合法的中间状态。
export function nextRandom(stream: { rngState: number }): number {
  const rng = new Rng(1);
  rng.setState(stream.rngState);
  const value = rng.next();
  stream.rngState = rng.getState();
  return value;
}
