export { BANK_CAP, makeDayBank, accrueDays, spendDawn } from './time';
// 页面需要给家、投胎、当厉鬼的规则传一个随机数
export { Rng } from '../rng';
export * from './household';
export * from './economy';
export * from './settlement';
export * from './auto-defense';
export * from './absence';
export * from './trade';
export * from './family';
export * from './rebirth';
export * from './haunt';
export * from './home';
// 「一起打」试玩页（docs/proto/coop）直接用规则核心守夜：主人的手机算，援兵的点击记进同一份记录
export { applyNightAction, ghostCenter, ghostAt, helpCandidates, lampHeld, nearestGhost, nightStep, revealed, startNight } from './night';
export { COOP, DOORS, GHOSTS, MULT, NIGHT, PERKS, TRAPS } from './night-config';
export { makeHouse, makePerson } from './state';
