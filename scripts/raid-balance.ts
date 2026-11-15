/**
 * 守夜局难度校准：几种玩家 × 两种打法（光看 / 认真操作），每种跑多个种子。
 * 用法：npx tsx scripts/raid-balance.ts [--set raid.qiPerSecond=4]
 */
import {
  addHouse, addStrands, createWorld, finishRaid, raidRepair, raidStep, raidTap, raidUpgrade, raidUpgradeCost, startRaid, tieThread,
  type DeepPartial, type GameConfig, type RaidState, type World,
} from '../src/core';

const overrides: DeepPartial<GameConfig> = {};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] !== '--set') continue;
  const [k, v] = args[++i]!.split('=');
  const keys = k!.split('.');
  let o: Record<string, unknown> = overrides as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) o = (o[key] ??= {}) as Record<string, unknown>;
  o[keys[keys.length - 1]!] = Number(v);
}

interface Profile { name: string; realm: number; kids: { root: number; cult: number; path: string }[]; strands: number; formation: number }
const P: Profile[] = [
  { name: '第 1 天（2 个收养的孩子）', realm: 1, strands: 12, formation: 1, kids: [{ root: 8, cult: 1, path: '剑修' }, { root: 8, cult: 1, path: '丹修' }] },
  { name: '第 3 天（+1 个红线孩子）', realm: 1, strands: 25, formation: 1, kids: [{ root: 8, cult: 2, path: '剑修' }, { root: 8, cult: 2, path: '丹修' }, { root: 20, cult: 1, path: '符修' }] },
  { name: '第 3 周（境界 2，5 个孩子）', realm: 2, strands: 60, formation: 2, kids: [{ root: 8, cult: 10, path: '剑修' }, { root: 8, cult: 10, path: '丹修' }, { root: 25, cult: 9, path: '符修' }, { root: 40, cult: 6, path: '剑修' }, { root: 55, cult: 3, path: '御兽' }] },
  { name: '第 2 月（境界 3，满 6 个）', realm: 3, strands: 130, formation: 3, kids: [{ root: 90, cult: 20, path: '剑修' }, { root: 80, cult: 22, path: '御兽' }, { root: 70, cult: 25, path: '符修' }, { root: 60, cult: 26, path: '阵修' }, { root: 50, cult: 28, path: '丹修' }, { root: 40, cult: 29, path: '剑修' }] },
];

function setup(p: Profile, seed: number): World {
  const w = createWorld({ seed, config: { ...overrides, newbie: { adoptedKids: 0, ...(overrides.newbie ?? {}) } } });
  const me = addHouse(w, { id: 'me', realm: p.realm });
  addHouse(w, { id: 'qing' });
  const t = tieThread(w, 'me', { kind: 'friend', house: 'qing' });
  if (t.ok) addStrands(w, t.value, p.strands);
  me.formationLevel = p.formation;
  p.kids.forEach((k, i) => me.members.push({ id: `k${i}`, parents: ['me', 'qing'], threadId: '', cultivation: k.cult, injuredUntil: 0, root: k.root, path: k.path }));
  return w;
}

function play(w: World, s: RaidState, active: boolean): number {
  let tapAcc = 0;
  let low = 1;
  while (!s.result && s.t < 600) {
    raidStep(w, s, 0.1);
    low = Math.min(low, s.doorHp / s.doorMax);
    if (!active) continue;
    // 认真操作：每秒点 4 下离门最近的鬼；门低于 45% 就修；灵气够就升最便宜的守卫（留 20 修门）
    tapAcc += 0.1 * 4;
    while (tapAcc >= 1) {
      tapAcc--;
      const target = [...s.ghosts].sort((a, b) => b.d - a.d)[0];
      if (target) raidTap(w, s, target.id);
    }
    if (s.doorHp < s.doorMax * 0.45) raidRepair(w, s);
    const cheapest = [...s.guards].map((g) => ({ g, c: raidUpgradeCost(w, g) })).filter((x) => x.c !== null).sort((a, b) => a.c! - b.c!)[0];
    if (cheapest && s.qi - cheapest.c! >= 20) raidUpgrade(w, s, cheapest.g.id);
  }
  return low;
}

const SEEDS = 20;
console.log('| 玩家 | 打法 | 赢 | 平均撑到第几波 | 门最低剩（赢的局） | 用时（秒） |\n| --- | --- | --- | --- | --- | --- |');
for (const p of P) {
  for (const active of [false, true]) {
    let wins = 0, waves = 0, hpLeft = 0, time = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const w = setup(p, seed);
      const r = startRaid(w, 'me');
      if (!r.ok) throw new Error(r.reason);
      const low = play(w, r.value, active);
      const res = finishRaid(w, r.value);
      if (res.win) { wins++; hpLeft += low; }
      waves += res.win ? 5 : r.value.wave;
      time += r.value.t;
    }
    console.log(`| ${p.name} | ${active ? '认真操作' : '光看'} | ${Math.round((wins / SEEDS) * 100)}% | ${(waves / SEEDS).toFixed(1)} | ${wins ? Math.round((hpLeft / wins) * 100) + '%' : '—'} | ${Math.round(time / SEEDS)} |`);
  }
}
