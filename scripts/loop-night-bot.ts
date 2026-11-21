import { Rng } from '../src/core/rng.js';
import {
  applyNightAction, ghostCenter, nearestGhost, nightStep, revealed, startNight, startWave,
} from '../src/core/loop/night.js';
import type { NightAction, NightGhost, NightState } from '../src/core/loop/night.js';
import type { GhostType, PerkId } from '../src/core/loop/night-config.js';
import { makeHouse, makePerson, type Item } from '../src/core/loop/state.js';

export const STEP = 0.05;
export const STEP_LIMIT = 8000;
export const equipment = { evil: 'sword', fly: 'bow', shade: 'lamp', armor: 'sword' } as const;
export type Strategy = 'smart' | 'commit' | 'sword' | 'firstNight';
export type Trial = { day: number; door: number; bows: number; trial: number; lamp?: number };

export function trialSeed(trial: number): number {
  return Math.imul(trial + 1, 2654435761);
}

// 与样机 freshLife(FIRST_FAMILY) 的良才、满血、一把剑一致。没有孩子、配偶或可求救的邻居。
export function inputs({ day, door, bows, lamp = 0 }: Omit<Trial, 'trial'>) {
  return {
    house: { ...makeHouse(), door, traps: { crossbow: bows, lamp, talisman: 0 }, chest: 20 },
    person: { ...makePerson(), day, time: 1080 },
  };
}

export function newTrial(trial: Trial, advancedItems = true, cosmeticSeed?: number): NightState {
  const { house, person } = inputs(trial);
  return startNight(house, person, { seed: trialSeed(trial.trial), cosmeticSeed, advancedItems, helpEnabled: false });
}

export type Replay = Array<{ step: number; actions: NightAction[] }>;
export type BotStats = ReturnType<typeof fight>;

// 每一步先走物理，再执行此帧的输入，和浏览器基线相同。回放记录只含按钮/坐标，不记录命中结论。
export function fight(n: NightState, trial: number, rate: number, strategy: Strategy, replay?: Replay) {
  let tapT = 0, taps = 0, switches = 0, wasted = 0, misses = 0, perks = 0, steps = 0;
  let pending: number | null = null;
  const visibleOnly = strategy === 'sword' || strategy === 'firstNight';
  const act = (action: NightAction) => {
    applyNightAction(n, action);
    if (replay) {
      const last = replay[replay.length - 1];
      if (last?.step === steps) last.actions.push(action);
      else replay.push({ step: steps, actions: [action] });
    }
  };
  while (!n.over && steps < STEP_LIMIT) {
    steps++;
    if (n.picking) {
      // 样机每次从三张中均匀随机选一张，选牌用独立事件流，不占用攻击机会。
      const seed = trialSeed(trial) + (n.wave + 1) * 65537 + 201 * 257;
      act({ type: 'perk', id: new Rng(seed).pick(n.offer) });
      perks++;
      continue;
    }
    nightStep(n);
    tapT += STEP;
    while (!n.over && tapT >= 1 / rate) {
      tapT -= 1 / rate;
      const locked: NightGhost | undefined = strategy === 'commit' ? n.ghosts.find(g => g.id === pending) : undefined;
      const target: NightGhost | null = locked ?? nearestGhost(n, visibleOnly);
      if (!target) break;
      const item = equipment[target.type];
      if (!visibleOnly && n.item !== item) {
        if (pending !== null) wasted++;
        pending = target.id;
        switches++;
        act({ type: 'item', item });
        tapT -= 0.3;
        continue;
      }
      const before = target.hp;
      act({ type: 'hitAt', ...ghostCenter(target) });
      taps++;
      if (target.hp === before) misses++;
      pending = null;
    }
  }
  if (!n.result) throw new Error('守夜机器人超出步数上限');
  return { result: n.result, steps, switches, taps, wasted, misses, perks, wave: n.wave + 1 };
}

// 仅供离线实验。清完一波直接排下一波，不提交玩家操作、不抽取加成、不写入家产。
export function trapsOnly(trial: Trial) {
  // 机关基线使用完整敌阵，角色全程持剑、没有输入，也不领取波间本事。
  const n = newTrial(trial);
  for (let tick = 0; !n.over && tick < STEP_LIMIT; tick++) {
    if (n.picking) startWave(n, n.wave + 1);
    else nightStep(n);
  }
  if (!n.result || Object.keys(n.pk).length !== 0) throw new Error('机关实验未正常结束');
  return { result: n.result, wave: n.wave + 1 };
}

// 打法验证在完整第一夜五波上进行。指定本事只可从实际发下的三张中选，没抽到的局也计入分母。
type Route = {
  trait: Exclude<GhostType, 'evil'>; name: string; item: Item; perk?: PerkId;
  passive?: 'crossbow' | 'burn'; lamp?: number;
};
export const routes: Route[] = [
  { trait: 'fly', name: '飞·手持弓', item: 'bow' },
  { trait: 'fly', name: '飞·剑气', item: 'sword', perk: 'qi' },
  { trait: 'fly', name: '飞·弩机', item: 'sword', passive: 'crossbow' },
  { trait: 'shade', name: '隐·提灯', item: 'lamp' },
  { trait: 'shade', name: '隐·墙灯显形后用剑', item: 'sword', lamp: 1 },
  { trait: 'shade', name: '隐·听声盲打', item: 'sword', perk: 'ear' },
  { trait: 'armor', name: '甲·重手', item: 'sword', perk: 'heavy' },
  { trait: 'armor', name: '甲·弩机', item: 'sword', passive: 'crossbow' },
  { trait: 'armor', name: '甲·灯光持续灼烧', item: 'lamp', passive: 'burn', perk: 'burn' },
];

// 避开会抢目标击杀的本事，使击杀来源可以从动作前后的生命值直接核对。
const cleanPerks: readonly PerkId[] = ['heavy', 'crit', 'slow', 'bolt', 'fix', 'soul', 'pierce', 'qi', 'coins', 'bowfast'];
export function demonstrate(route: Route, trial: number) {
  const n = newTrial({ day: 1, door: 2, bows: route.passive === 'crossbow' ? 2 : 0, lamp: route.lamp, trial });
  let qualifiedKills = 0, taps = 0, clock = 0, steps = 0, isolated = true;
  while (!n.over && steps++ < STEP_LIMIT) {
    if (n.picking) {
      const pick = [route.perk, ...cleanPerks].find((id): id is PerkId => !!id && n.offer.includes(id));
      // 三张都可能干扰归因时照常选一张并打完，但后续击杀不再充当这一路的证据。
      if (!pick) isolated = false;
      applyNightAction(n, { type: 'perk', id: pick ?? n.offer[0]! });
      continue;
    }
    const active = !route.perk || !!n.pk[route.perk];
    const passive = active ? route.passive : undefined;
    const before = passive && isolated ? n.ghosts.filter(g => g.type === route.trait) : [];
    nightStep(n);
    // 这两种打法从不点相应的鬼。被动击杀只能来自已装的弩或提灯灼烧。
    qualifiedKills += before.filter(g => g.hp <= 0).length;
    if (n.over || n.picking) continue;
    clock += STEP;
    if (clock < 0.25) continue;
    clock -= 0.25;
    const targets = n.ghosts.slice().sort((a, b) => b.y - a.y);
    const target = targets.find(g => {
      if (g.type !== route.trait || !active) return true;
      if (passive) return false;
      if (route.lamp) return g.y > 330;
      if (route.perk === 'ear') return g.flash <= 0;
      return true;
    });
    if (!target) {
      if (passive === 'burn' && n.item !== 'lamp') {
        applyNightAction(n, { type: 'item', item: 'lamp' });
        clock -= 0.3;
      }
      continue;
    }
    const relevant = active && target.type === route.trait;
    const item = relevant ? route.item : equipment[target.type];
    if (n.item !== item) {
      applyNightAction(n, { type: 'item', item });
      clock -= 0.3;
      continue;
    }
    const good = isolated && relevant && (route.perk === 'ear' ? !revealed(n, target) : revealed(n, target));
    const was = target.hp;
    applyNightAction(n, { type: 'hit', id: target.id });
    if (good && target.hp < was) {
      taps++;
      if (target.hp <= 0) qualifiedKills++;
    }
  }
  if (!n.result) throw new Error('打法验证超出步数上限');
  return { won: n.result.won, demonstrated: n.result.won && qualifiedKills > 0, qualifiedKills, taps };
}

// 样机基线的每一行都有相同的局号。单独保留胜局平均门血，避免把败局的零血混进去。
export function manualRow(day: number, door: number, bows: number, rate: number, strategy: Strategy, runs = 40) {
  const games = Array.from({ length: runs }, (_, trial) =>
    fight(newTrial({ day, door, bows, trial }, strategy !== 'firstNight'), trial, rate, strategy));
  const wins = games.filter(g => g.result.won);
  const sum = (key: 'switches' | 'taps' | 'wasted' | 'misses') => games.reduce((n, g) => n + g[key], 0);
  return {
    day, door, bows, rate, strategy, runs, wins: wins.length,
    hpWhenWon: wins.length ? wins.reduce((n, g) => n + g.result.door / g.result.doorMax, 0) / wins.length : null,
    switches: sum('switches'), wasted: sum('wasted'), taps: sum('taps'), misses: sum('misses'),
    winByTrial: games.map(g => g.result.won),
  };
}

export function trapRow(day: number, door: number, bows: number, lamp: number, runs = 40) {
  let wins = 0, kills = 0, wave = 0;
  for (let trial = 0; trial < runs; trial++) {
    const g = trapsOnly({ day, door, bows, lamp, trial });
    wins += Number(g.result.won);
    kills += g.result.kills;
    wave += g.wave;
  }
  return { day, door, bows, lamp, runs, wins, averageKills: kills / runs, averageLastWave: wave / runs };
}

