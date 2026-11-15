/**
 * 数值模拟器命令行。
 *
 *   npm run sim
 *   npm run sim -- --players 500 --days 60 --seed 3
 *   npm run sim -- --set grudge.dailyCap=20 --set breach.graceActions=8
 *   npm run sim -- --json
 */
import type { DeepPartial, GameConfig } from '../core';
import { DEFAULT_SIM, simulate, type ArchetypeReport, type SimOptions } from './simulate';

function parseArgs(argv: string[]): { opts: Partial<SimOptions>; json: boolean } {
  const opts: Partial<SimOptions> = {};
  const config: Record<string, Record<string, unknown>> = {};
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${arg} 后面缺少值`);
      return v;
    };
    switch (arg) {
      case '--players':
        opts.playersPerArchetype = Number(next());
        break;
      case '--days':
        opts.days = Number(next());
        break;
      case '--seed':
        opts.seed = Number(next());
        break;
      case '--set': {
        const [path, raw] = next().split('=');
        const [section, key] = (path ?? '').split('.');
        if (!section || !key || raw === undefined) throw new Error('--set 的格式是 section.key=value');
        (config[section] ??= {})[key] = raw === 'true' || raw === 'false' ? raw === 'true' : isNaN(Number(raw)) ? raw : Number(raw);
        break;
      }
      case '--json':
        json = true;
        break;
      default:
        throw new Error(`不认识的参数：${arg}`);
    }
  }
  opts.config = config as DeepPartial<GameConfig>;
  return { opts, json };
}

const f1 = (x: number) => x.toFixed(1);
const f2 = (x: number) => x.toFixed(2);
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

function table(rows: ArchetypeReport[]): string {
  const cols: [string, (r: ArchetypeReport) => string][] = [
    ['玩家类型', (r) => r.label],
    ['人数', (r) => String(r.players)],
    ['砸门/周', (r) => f1(r.knocksPerWeek)],
    ['砸破/周', (r) => f2(r.breachesPerWeek)],
    ['离线砸破占比', (r) => pct(r.offlineBreachShare)],
    ['单次离线输≥2次', (r) => String(r.multiBreachAbsences)],
    ['感化/周', (r) => f2(r.purifiesPerWeek)],
    ['怨丝均值', (r) => f1(r.grudgeAvg)],
    ['怨丝P90', (r) => f1(r.grudgeP90)],
    ['每日散掉怨丝', (r) => f2(r.grudgeDissipatedPerDay)],
    ['恶性循环占比', (r) => pct(r.spiralShare)],
    ['单线浓度', (r) => f1(r.strandsAvg)],
    ['族人', (r) => f1(r.membersAvg)],
    ['嫡传/人', (r) => f2(r.heirsPerPlayer)],
    ['阵法等级', (r) => f1(r.formationAvg)],
    ['知己中位天', (r) => (r.tier1DayMedian === null ? '—' : f1(r.tier1DayMedian))],
    ['首位族人中位天', (r) => (r.firstMemberDayMedian === null ? '—' : f1(r.firstMemberDayMedian))],
    ['金缕占比', (r) => pct(r.goldenShare)],
    ['金缕中位天', (r) => (r.goldenDayMedian === null ? '—' : f1(r.goldenDayMedian))],
    ['嫡传中位天', (r) => (r.heirDayMedian === null ? '—' : f1(r.heirDayMedian))],
    ['情敌/周', (r) => f2(r.rivalsPerWeek)],
    ['情敌感化', (r) => pct(r.rivalPurifyShare)],
    ['情敌输', (r) => pct(r.rivalLostShare)],
    ['争执/周', (r) => f2(r.quarrelsPerWeek)],
    ['和好率', (r) => pct(r.reconcileRate)],
    ['境界', (r) => f1(r.realmAvg)],
    ['渡劫成功率', (r) => pct(r.tribulationSuccessRate)],
    ['到匹配门槛中位天', (r) => (r.strangerGateDayMedian === null ? '—' : f1(r.strangerGateDayMedian))],
  ];
  const lines = [
    `| ${cols.map((c) => c[0]).join(' | ')} |`,
    `| ${cols.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${cols.map((c) => c[1](r)).join(' | ')} |`),
  ];
  return lines.join('\n');
}

const { opts, json } = parseArgs(process.argv.slice(2));
const started = Date.now();
const rows = simulate(opts);
if (json) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const o = { ...DEFAULT_SIM, ...opts };
  console.log(`模拟 ${o.days} 天，每类 ${o.playersPerArchetype} 人，种子 ${o.seed}（${Date.now() - started} ms）\n`);
  console.log(table(rows));
  console.log(`\n恶性循环 = 最后 7 天怨丝都 ≥ ${o.spiralGrudge}。“单次离线输≥2次”应当永远是 0（#11）。`);
}
