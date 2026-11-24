// 用规则核心模拟整辈子（样机 5 天）。几类玩家各跑几百世，只汇报数字，不调数。
//   npm run sim:life            默认每类 200 世
//   npm run sim:life -- --lives=500
import { Rng } from '../src/core/rng';
import { CFG } from '../src/core/loop/base';
import { payHome, sellAllOrdinary, splitFirewood } from '../src/core/loop/economy';
import { escapeDusk, fight as fieldFight, flee, gather, goHome, goOut, makeField, walkMin, walkTo, type FieldState } from '../src/core/loop/field';
import { SPOTS } from '../src/core/loop/field-config';
import { DOORS, TRAPS } from '../src/core/loop/night-config';
import { applyNightAction, ghostCenter, nearestGhost, nightStep, startNight, type NightState } from '../src/core/loop/night';
import { autoLossLimit, defenseChance, paperReward } from '../src/core/loop/auto-defense';
import { accompany, birth, dawnLove, match, takeDisciple, threadName, type Kin } from '../src/core/loop/family';
import { karmaRows, karmaTotal, tierOf, REBIRTH, type Afterlife } from '../src/core/loop/rebirth';
import { hauntBash, hauntDodge, hauntOutcome, hauntStep, startHaunt } from '../src/core/loop/haunt';
import {
  acceptRequest, canCook, collectStove, dayPrices, deliverRequest, planDelivery, requestBoard, startStove, type TradeHouse,
} from '../src/core/loop/trade';
import { makeHouse, makePerson } from '../src/core/loop/state';

type Kind = 'adventurer' | 'homebody' | 'social' | 'nightOnly';
const NAMES: Record<Kind, string> = { adventurer: '爱冒险的（常去禁地）', homebody: '宅家修院子的', social: '爱交朋友的', nightOnly: '只守夜的' };
const NEIGHBORS = ['wang', 'li', 'zhao'];
const LIVES = Number(process.argv.find(a => a.startsWith('--lives='))?.slice(8) ?? 200);
const STEP = 0.05;

// 白天去哪：冒险的第 3 天起独自进禁地；交朋友的叫上交情够的邻居去山林；宅家的只在近郊；只守夜的出门转一圈
function route(kind: Kind, day: number): number[] {
  if (kind === 'adventurer') return day >= 3 ? [6, 7] : [3, 4];
  if (kind === 'social') return [3, 4, 0];
  if (kind === 'homebody') return [1, 0, 2];
  return [1];
}

function dayOut(s: FieldState, kind: Kind, stats: { knocked: number }) {
  const down = (r: unknown) => { if (r && typeof r === 'object' && 'outcome' in r && ((r as { outcome: string }).outcome === 'knocked' || (r as { outcome: string }).outcome === 'dead')) stats.knocked++; };
  // 像会看钟的玩家：留够走回家的时间，再多留半个时辰
  const timeLeft = () => s.at !== 'home' && s.person.time + walkMin(s, s.at, 'home') + 60 < CFG.dusk;
  const buddy = kind === 'social'
    ? NEIGHBORS.filter(id => (s.person.friends[id] ?? 0) >= CFG.buddyAt).sort((a, b) => s.person.friends[b]! - s.person.friends[a]!)[0] ?? null
    : null;
  for (const id of route(kind, s.person.day)) {
    if (s.phase !== 'home' || s.person.time > CFG.dusk - 160) break;
    if (!goOut(s, buddy) || !walkTo(s, id)) { if (s.phase === 'map') goHome(s); continue; }
    for (let i = 0; i < 4 && s.phase === 'map'; i++) {
      if (!timeLeft() || !gather(s)) break;
      if (s.phase === 'danger') {
        // 冒险的硬打，其余的跑
        down(kind === 'adventurer' ? fieldFight(s) : flee(s));
      }
      if (s.phase === 'dusk') down(escapeDusk(s, 'carry'));
    }
    if (s.phase === 'danger') flee(s);
    if (s.phase === 'map') goHome(s);
    if (s.phase === 'dusk') down(escapeDusk(s, 'carry'));
  }
}

// 亲手守：每秒 3 下、按特点换东西、本事随机挑（和难度表的机器人一样）
function manualNight(n: NightState, rng: Rng) {
  const gear = { evil: 'sword', fly: 'bow', shade: 'lamp', armor: 'sword' } as const;
  let tap = 0;
  for (let steps = 0; !n.over && steps < 8000; steps++) {
    if (n.picking) { applyNightAction(n, { type: 'perk', id: rng.pick(n.offer) }); continue; }
    nightStep(n);
    tap += STEP;
    while (!n.over && tap >= 1 / 3) {
      tap -= 1 / 3;
      const target = nearestGhost(n, !n.advancedItems);
      if (!target) break;
      const item = n.advancedItems ? gear[target.type] : 'sword';
      if (n.item !== item) { applyNightAction(n, { type: 'item', item }); tap -= 0.3; continue; }
      applyNightAction(n, { type: 'hitAt', ...ghostCenter(target) });
    }
  }
  return n.result!;
}

function haunt(seed: number) {
  const h = startHaunt(seed);
  let tap = 0, react = -1;
  for (let i = 0; i < 2000 && !h.over; i++) {
    const charging = h.bows.some(b => b.s === 'charge');
    if (charging && react < 0) react = 0.35;
    if (!charging) react = -1;
    if (react >= 0) { react -= STEP; if (react < 0 && h.dodge <= 0) { hauntDodge(h); react = 99; } }
    hauntStep(h, STEP);
    tap += STEP;
    while (tap >= 1 / 3.5 && !h.over) { tap -= 1 / 3.5; hauntBash(h); }
  }
  return hauntOutcome(h);
}

function life(seed: number, kind: Kind) {
  const rng = new Rng(seed);
  const house: ReturnType<typeof makeHouse> & TradeHouse = { ...makeHouse(), chest: 20, stove: null, request: null };
  const person = makePerson();
  const s = makeField(seed * 7919, house, person);
  const lifeId = `sim/${kind}/${seed}`;
  const fam = { day: 1, time: CFG.dayStart, love: 0, spouse: null as unknown, kids: [] as Kin[], bornToday: null as number | null, held: 0, chest: 0, purse: 0 };
  const stats = { held: 0, autoHeld: 0, broken: 0, earned: 0, knocked: 0, early: false };
  const sync = () => { fam.day = person.day; fam.time = person.time; fam.held = stats.held; fam.chest = house.chest; fam.purse = person.purse; };
  const back = () => { person.time = fam.time; house.chest = fam.chest; person.purse = fam.purse; };
  for (let day = 1; day <= CFG.lifeDays; day++) {
    person.day = day; person.time = CFG.dayStart; s.phase = 'home'; s.at = 'home';
    if (day > 1) { person.hp = Math.min(CFG.hpMax, person.hp + 1); sync(); dawnLove(fam); birth(fam, rng); }
    const at = { lifeId, day };
    collectStove(house, person, at);
    // 第 3 天长大：宅家的和交朋友的牵红线；交朋友的天天陪伴
    sync();
    if (day >= 3 && (kind === 'social' || kind === 'homebody') && !fam.spouse) match(fam, { id: rng.next() });
    if (day >= 3 && kind === 'social') accompany(fam);
    back();
    if (day === 1) splitFirewood(person); else dayOut(s, kind, stats);
    if (s.phase === 'dead') { stats.early = true; break; }
    const prices = dayPrices(lifeId, day);
    // 托付（第 4 天起，交朋友的接）
    let keep: string | null = null;
    if (kind === 'social' && day >= 4) {
      const board = requestBoard(house, lifeId, day, NEIGHBORS);
      if (!board.active && board.offer) acceptRequest(house, lifeId, day, NEIGHBORS);
      if (house.request?.status === 'accepted') {
        if (planDelivery(house, person)!.short === 0) { const p = deliverRequest(house, person, at)!; stats.earned += p.purse + p.chest; }
        else keep = house.request.kind;
      }
    }
    // 灶（第 3 天起，宅家的烧）
    if (kind === 'homebody' && day >= 3 && day < CFG.lifeDays) {
      for (const r of ['salve', 'charcoal'] as const) if (canCook(house, person, r, 'person')) { startStove(house, person, r, 'person', at); break; }
    }
    const held = keep ? person.goods[keep] ?? 0 : 0;
    if (keep) delete person.goods[keep];
    stats.earned += sellAllOrdinary(house, person, 'person', prices);
    if (keep && held) person.goods[keep] = held;
    // 花钱：先换门，再装机关；交朋友的收徒弟
    const next = DOORS[house.door + 1];
    if (next && payHome(house, person, next.cost)) house.door++;
    if (day >= 2 && kind !== 'social' && house.traps.crossbow < TRAPS.crossbow.max && payHome(house, person, TRAPS.crossbow.cost)) house.traps.crossbow++;
    if (day >= 2 && kind === 'homebody' && !house.traps.lamp && payHome(house, person, TRAPS.lamp.cost)) house.traps.lamp = 1;
    if (kind === 'social' && day >= 3) { sync(); takeDisciple(fam); back(); }
    // 夜里：宅家的交给机关，其余亲手守
    if (kind === 'homebody') {
      if (rng.chance(defenseChance(day, house.door, house.traps))) {
        stats.held++; stats.autoHeld++;
        const coins = paperReward(day, day === 1); person.purse += coins; stats.earned += coins;
      } else house.chest -= autoLossLimit(house.chest, 2);
    } else {
      const n = startNight(house, person, { seed: rng.int(1, 2 ** 31), advancedItems: day >= 2, helpEnabled: false,
        spouse: !!fam.spouse, childPowers: fam.kids.map(k => k.power) });
      const r = manualNight(n, rng);
      if (r.won) { stats.held++; person.purse += r.earnedMoney; stats.earned += r.earnedMoney; }
      else {
        stats.broken++; person.purse -= r.purseLost; house.chest -= r.chestLost;
        if (r.lostTreasureIndex !== null) house.treasures.splice(r.lostTreasureIndex, 1);
      }
    }
  }
  // 老死以后：交朋友的当护家神，冒险的当厉鬼，其余直接投胎
  let afterlife: Afterlife | null = null;
  if (!stats.early && kind === 'social') {
    const n = startNight(house, person, { seed: rng.int(1, 2 ** 31), guardian: true, childPowers: fam.kids.map(k => k.power), helpEnabled: false });
    afterlife = { kind: 'guard', won: manualNight(n, rng).won };
  } else if (!stats.early && kind === 'adventurer') afterlife = haunt(rng.int(1, 2 ** 31));
  const rows = karmaRows({ held: stats.held, autoHeld: stats.autoHeld, broken: stats.broken, earned: stats.earned,
    friends: person.friends, kids: fam.kids, spouse: fam.spouse, love: fam.love, afterlife, deathKind: stats.early ? 'early' : 'old' }, NEIGHBORS);
  const total = karmaTotal(rows);
  return { ...stats, kids: fam.kids.length, thread: fam.spouse ? threadName(fam.love) : '没有', total, tier: tierOf(total) };
}

const pct = (n: number) => (100 * n / LIVES).toFixed(0) + '%';
const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
console.log(`整辈子模拟（样机一辈子 ${CFG.lifeDays} 天），每类 ${LIVES} 世。白天走规则核心的野外，夜里亲手守用每秒 3 下的机器人。\n`);
console.log('| 玩家 | 守住（亲手 / 机关） | 门破 | 赚的钱 | 野外倒下 | 禁地丢命 | 有后人 | 红线 | 因果分 | 档次（寻常 / 殷实 / 名门） |');
console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |');
for (const kind of Object.keys(NAMES) as Kind[]) {
  const rs = Array.from({ length: LIVES }, (_, i) => life(1000 + i, kind));
  const threads = ['没有', '相识', '知己', '倾心', '挚爱'].map(t => [t, rs.filter(r => r.thread === t).length] as const).filter(([, n]) => n)
    .map(([t, n]) => `${t} ${pct(n)}`).join('，');
  const tiers = [0, 1, 2].map(t => pct(rs.filter(r => r.tier === t).length)).join(' / ');
  console.log(`| ${NAMES[kind]} | ${avg(rs.map(r => r.held - r.autoHeld))} / ${avg(rs.map(r => r.autoHeld))} | ${avg(rs.map(r => r.broken))} | ${avg(rs.map(r => r.earned))} | ${avg(rs.map(r => r.knocked))} | ${pct(rs.filter(r => r.early).length)} | ${pct(rs.filter(r => r.kids > 0).length)} | ${threads} | ${avg(rs.map(r => r.total))} | ${tiers} |`);
}
console.log(`\n档次线：因果分 < ${REBIRTH.tierAt[0]} 寻常，< ${REBIRTH.tierAt[1]} 殷实，其余名门。`);
