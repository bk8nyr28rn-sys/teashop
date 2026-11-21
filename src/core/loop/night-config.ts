// 与一日一夜样机同名。购买与安装归院子系统，这里只读取已装的机关。
export const DOORS = [
  { name: '柴门', hp: 140, cost: 0 },
  { name: '木门', hp: 220, cost: 40 },
  { name: '铁皮门', hp: 340, cost: 100 },
  { name: '朱漆铜钉门', hp: 500, cost: 200 },
  { name: '机关大门', hp: 720, cost: 360 },
] as const;

export const TRAPS = {
  crossbow: { name: '弩机', cost: 45, max: 4, desc: '每隔一会儿自动射最近的鬼' },
  lamp: { name: '灯笼串', cost: 30, max: 1, desc: '走到门口的隐身鬼会现形' },
  talisman: { name: '镇宅符', cost: 40, max: 2, desc: '门口的鬼走得慢' },
} as const;

export const GHOSTS = {
  evil: { name: '恶鬼', hp: 42, speed: 26, hit: 7, tag: null },
  fly: { name: '飞鬼', hp: 30, speed: 34, hit: 5, tag: ['飞', '#9CC9F0'] },
  shade: { name: '隐身鬼', hp: 34, speed: 24, hit: 8, tag: ['隐', '#B9A2E8'] },
  armor: { name: '铁甲鬼', hp: 70, speed: 18, hit: 11, tag: ['甲', '#B8BFC9'] },
} as const;
export type GhostType = keyof typeof GHOSTS;

export const MULT = {
  sword: { evil: 1.5, fly: 0.3, shade: 1, armor: 0.5 },
  bow: { evil: 0.9, fly: 2, shade: 0.9, armor: 0.5 },
  lamp: { evil: 0.6, fly: 0.6, shade: 1.5, armor: 0.4 },
} as const;

export const PERKS = {
  heavy: { n: '重手', d: '点一下伤害 +40%，铁甲也挡不住', stack: true },
  crit: { n: '会心一击', d: '每下有 25% 机会打出三倍伤害', stack: true },
  sweep: { n: '横扫', d: '点中一个鬼，旁边的鬼也挨一半', stack: false },
  qi: { n: '剑气', d: '剑能砍到天上的飞鬼', stack: false },
  pierce: { n: '穿云箭', d: '弓的伤害 +60%', stack: true },
  burn: { n: '灯光烧鬼', d: '提着灯时，灯光里的鬼一直掉血', stack: true },
  ear: { n: '听声辨位', d: '看不见的鬼也能打，伤害减半', stack: false },
  eye: { n: '火眼', d: '隐身鬼走到半路就现形', stack: false },
  lampstr: { n: '挂灯笼', d: '今晚墙上多挂一串灯笼，门口的隐身鬼现形', stack: false },
  bowplus: { n: '连弩', d: '每台弩机多射一个鬼；没有弩机就先送你一台', stack: true },
  bowfast: { n: '快弩', d: '弩机射得快一倍', stack: true },
  rain: { n: '剑雨', d: '每打散 5 个鬼，全场落一阵剑雨', stack: true },
  fix: { n: '连夜补门', d: '门马上回 40% 的血', stack: true },
  bolt: { n: '铁门栓', d: '门挨的打少三成', stack: true },
  slow: { n: '定身符', d: '门口的鬼走得更慢', stack: true },
  soul: { n: '吸魂', d: '每打散一个鬼，门回 3 点血', stack: true },
  coins: { n: '纸钱雨', d: '每打散一个鬼，多掉 3 文纸钱', stack: true },
} as const;
export type PerkId = keyof typeof PERKS;

export const NIGHT = {
  waves: 5, spread: 3.5, hpPerDay: 0.2, hpPerWave: 0.06, hitPerDay: 0.12,
  tap: 10, bowDmg: 12, bowCd: 1.4, allyDmg: 12,
  step: 0.05, waveDelay: 1.5, offerCount: 3, lossFraction: 0.3,
  counts: {
    firstNightEvil: [3, 4, 6, 7, 9],
    evilBase: 3, evilPerDay: 0.4, extraEvery: 3,
    flyWave: 1, flyOffset: 1, shadeDay: 2, shadeWave: 3, shadeOffset: 3,
    armorLastWave: 4, armorDay: 3, armorWave: 2, armorOffset: 5,
  },
  spawn: {
    lane: [-0.85, 0.85], y: [96, 122], gateXOffset: [-48, 48], gateYOffset: [-6, 4],
    speed: [0.85, 1.15], bashDelay: [0.2, 0.8], flyRise: 34, phase: [0, 6.28],
  },
  lane: {
    centerX: 180, gateY: 424, depthStart: 90, depthBase: 0.55, depthGain: 0.45,
    farWidth: 40, extraWidth: 114, widenFrom: 152, widenDistance: 262,
    mergeFrom: 0.72, mergeDistance: 0.28, flySwing: 22, flyFrequency: 2.2, flySettleDistance: 80,
    centerHeight: 44, hitRadius: 36, minHitScale: 0.8,
  },
  reveal: { lamp: 150, wall: 330, eye: 240, flashTime: 0.25 },
  gate: { slowFrom: 300, talismanFactor: 0.72, bashCd: 1 },
  weapon: { hurt: 0.85, badlyHurt: 0.6, playerCoins: 2, lampX: 122, lampY: 466, lampRadius: 330 },
  perk: {
    heavy: 0.4, qi: 1.3, pierce: 0.6, ear: 0.5, critChance: 0.25, critCap: 0.75, critDamage: 3,
    sweepRadius: 70, sweepFactor: 0.5, burnInterval: 0.5, burnMinY: 150, burnDamage: 2.5,
    rainKills: 5, rainDamage: 15, soul: 3, coins: 3, fix: 0.4, fixBelow: 0.8, bolt: 0.7, slow: 0.7,
  },
  bows: {
    x: [40, 320, 92, 268], y: 410, fromY: 150, firstCd: 1, stagger: 0.35,
    giftCd: 0.5, fastFactor: 0.5, minCd: 0.35, idleCd: 0.2,
  },
  family: {
    spouseDamage: 6, spouseCd: 1, spouseRate: 0.8, maxKids: 2,
    childBaseDamage: 4, childRate: 1.2, childCd: 1.2, childStagger: 0.3, idleCd: 0.2,
  },
  ally: { duration: 18, firstCd: 0.4, rate: 0.45, idleCd: 0.15, friendship: 2, maxFriendship: 100 },
  guardian: { power: 1.25, slow: 0.65 },
} as const;

export const NIGHT_CONFIG = { DOORS, TRAPS, GHOSTS, MULT, PERKS, NIGHT } as const;

// w 从零起算，最后一波的 w 是 4。不同鬼的增兵门槛与样机相同。
export function waveCounts(d: number, w: number, swordOnly = false): Record<GhostType, number> {
  const c = NIGHT.counts;
  if (d === 1 && swordOnly) return { evil: c.firstNightEvil[w]!, fly: 0, shade: 0, armor: 0 };
  return {
    evil: c.evilBase + w + Math.floor(c.evilPerDay * (d - 1)),
    fly: w >= c.flyWave ? 1 + Math.floor((d + w - c.flyOffset) / c.extraEvery) : 0,
    shade: d >= c.shadeDay || w >= c.shadeWave ? 1 + Math.floor(Math.max(0, d + w - c.shadeOffset) / c.extraEvery) : 0,
    armor: w === c.armorLastWave || (d >= c.armorDay && w >= c.armorWave)
      ? 1 + Math.floor(Math.max(0, d + w - c.armorOffset) / c.extraEvery) : 0,
  };
}
