// 第四阶段：看几种玩法一辈子（样机 5 天）大概赚多少钱。只汇报，不调数。
// 白天用规则核心的野外规则真的走一遍（近郊和山林、遇险就跑、天黑前回家），
// 晚上不算守夜纸钱，只比较「货怎么变成钱」。
import { CFG } from '../src/core/loop/base';
import { sellAllOrdinary, splitFirewood } from '../src/core/loop/economy';
import { escapeDusk, flee, gather, goHome, goOut, makeField, walkTo, type FieldState } from '../src/core/loop/field';
import { makeHouse, makePerson } from '../src/core/loop/state';
import {
  TRADE, acceptRequest, canCook, collectStove, dayPrices, deliverRequest, planDelivery, requestBoard, startStove,
  type RecipeId, type TradeHouse,
} from '../src/core/loop/trade';

type Strategy = 'sell' | 'craft' | 'request' | 'both';
const NEIGHBORS = ['wang', 'li', 'zhao'];
const LIVES = Number(process.argv.find(a => a.startsWith('--lives='))?.slice(8) ?? 200);
// 每天出门的路线：第 2 天起近郊三处加松林（样机带路第 2 天开地图）
const ROUTE = [1, 0, 2, 3];

function dayOut(s: FieldState) {
  for (const id of ROUTE) {
    if (s.person.time > CFG.dusk - 150) break;
    if (!goOut(s) || !walkTo(s, id)) { goHome(s); continue; }
    for (let i = 0; i < 6 && s.phase === 'map'; i++) {
      if (s.person.time > CFG.dusk - 90) break;
      if (!gather(s)) break;
      if (s.phase === 'danger') flee(s);
      if (s.phase === 'dusk') escapeDusk(s, 'carry');
    }
    if (s.phase === 'danger') flee(s);
    if (s.phase === 'dusk') escapeDusk(s, 'carry');
    if (s.phase === 'map') goHome(s);
    if (s.phase === 'dusk') escapeDusk(s, 'carry');
  }
}

function life(seed: number, strategy: Strategy) {
  const house: ReturnType<typeof makeHouse> & TradeHouse = { ...makeHouse(), stove: null, request: null };
  const person = makePerson();
  const s = makeField(seed, house, person);
  const lifeId = 'sim/life-' + seed;
  let income = 0, crafted = 0, delivered = 0;
  const crafts = strategy === 'craft' || strategy === 'both';
  const requests = strategy === 'request' || strategy === 'both';
  for (let day = 1; day <= CFG.lifeDays; day++) {
    person.day = day; person.time = CFG.dayStart; person.hp = Math.min(CFG.hpMax, person.hp + 1);
    s.phase = 'home'; s.at = 'home';
    const at = { lifeId, day };
    if (collectStove(house, person, at)) crafted++;
    if (day === 1) splitFirewood(person); // 第一天从河埠搬回一根浮木
    else dayOut(s);
    if (s.phase === 'dead') break;
    const prices = dayPrices(lifeId, day);
    // 托付：第 4 天开放。先接，凑够就交
    let keep: string | null = null;
    if (requests && day >= TRADE.unlock.requests) {
      const board = requestBoard(house, lifeId, day, NEIGHBORS);
      if (!board.active && board.offer) acceptRequest(house, lifeId, day, NEIGHBORS);
      if (house.request?.status === 'accepted') {
        if (planDelivery(house, person)!.short === 0) {
          const paid = deliverRequest(house, person, at)!;
          income += paid.purse + paid.chest; delivered++;
        } else keep = house.request.kind;
      }
    }
    // 灶：第 3 天开放。哪样多赚烧哪样
    if (crafts && day >= TRADE.unlock.stove && !house.stove && day < CFG.lifeDays) {
      const options = (Object.keys(TRADE.recipes) as RecipeId[]).filter(r => canCook(house, person, r, 'person'));
      const gain = (r: RecipeId) => {
        const recipe = TRADE.recipes[r];
        return prices[recipe.output]! - Object.entries(recipe.input).reduce((a, [k, n]) => a + prices[k]! * n, 0);
      };
      const best = options.sort((a, b) => gain(b) - gain(a))[0];
      if (best && gain(best) > 0) startStove(house, person, best, 'person', at);
    }
    // 剩下的货今天就卖；托付要的那样留着
    const held = keep ? person.goods[keep] ?? 0 : 0;
    if (keep) delete person.goods[keep];
    income += sellAllOrdinary(house, person, 'person', prices);
    if (keep && held) person.goods[keep] = held;
  }
  return { income, crafted, delivered };
}

const rows: string[] = [];
const base = { sell: 0 } as Record<Strategy, number>;
for (const strategy of ['sell', 'craft', 'request', 'both'] as Strategy[]) {
  const results = Array.from({ length: LIVES }, (_, i) => life(1000 + i, strategy));
  const incomes = results.map(r => r.income).sort((a, b) => a - b);
  const avg = incomes.reduce((a, n) => a + n, 0) / LIVES;
  base[strategy] = avg;
  const mean = (k: 'crafted' | 'delivered') => (results.reduce((a, r) => a + r[k], 0) / LIVES).toFixed(1);
  rows.push(`| ${{ sell: '只直接卖', craft: '常烧木炭和金疮药', request: '常接托付', both: '又烧又接托付' }[strategy]} | ${avg.toFixed(0)} | ${incomes[Math.floor(LIVES * 0.1)]}–${incomes[Math.floor(LIVES * 0.9)]} | ${strategy === 'sell' ? '—' : '+' + ((avg / base.sell - 1) * 100).toFixed(0) + '%'} | ${mean('crafted')} | ${mean('delivered')} |`);
}
console.log(`一辈子（${CFG.lifeDays} 天）卖货和托付收入，每种玩法 ${LIVES} 世：\n`);
console.log('| 玩法 | 平均（文） | 中间八成 | 比只直接卖 | 平均烧了几锅 | 平均交了几单 |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const row of rows) console.log(row);
