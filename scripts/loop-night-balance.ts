import { DOORS, TRAPS } from '../src/core/loop/night-config.js';
import { demonstrate, manualRow, routes, trapRow } from './loop-night-bot.js';

const manual = [];
for (const [day, cells] of [[1, [[0, 0]]], [3, [[0, 0], [1, 1]]],
  [5, [[0, 0], [1, 1], [2, 2], [3, 3]]]] as const) {
  for (const [door, bows] of cells) {
    for (const rate of [1.5, 2, 3, 4]) {
      const focus = day === 3 && door === 0 && rate <= 2;
      manual.push(manualRow(day, door, bows, rate, 'smart', focus ? 160 : 40));
      if (focus) manual.push(manualRow(day, door, bows, rate, 'commit', 160));
    }
  }
}
manual.push(manualRow(1, 0, 0, 4, 'sword'));
for (const rate of [2, 4]) manual.push(manualRow(1, 0, 0, rate, 'firstNight'));

const traps = [];
for (let day = 1; day <= 5; day++) {
  for (let door = 0; door < DOORS.length; door++) {
    for (let bows = 0; bows <= TRAPS.crossbow.max; bows++) {
      for (const lamp of [0, 1]) traps.push(trapRow(day, door, bows, lamp));
    }
  }
}

const traitProof = routes.map(route => {
  const games = Array.from({ length: 40 }, (_, trial) => demonstrate(route, trial));
  const demonstrated = games.filter(g => g.demonstrated);
  return { name: route.name, runs: games.length, wins: games.filter(g => g.won).length,
    demonstratedWins: demonstrated.length, killsInDemonstratedWins: demonstrated.reduce((sum, g) => sum + g.qualifiedKills, 0) };
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ manual, traps, traitProof }));
} else {
  const labels = { smart: '会换', sword: '只用剑', firstNight: '分天开放首夜只用剑', commit: '换后先打原目标' };
  console.log('亲手守门。每格固定局号，胜时门剩为胜局平均值。');
  for (const r of manual) {
    const hp = r.hpWhenWon === null ? '—' : (100 * r.hpWhenWon).toFixed(1) + '%';
    console.log(`day ${r.day} door ${DOORS[r.door]!.name} 弩${r.bows} ${r.rate}/s ${labels[r.strategy]}: 守住 ${r.wins}/${r.runs}，胜时门剩 ${hp}，每局换手 ${(r.switches / r.runs).toFixed(1)}，连换未打 ${r.wasted}/${r.switches}，未伤及目标 ${r.misses}/${r.taps}`);
  }
  console.log('零玩家输入。每格 40 局，用相同局号对照无灯／有一串灯。没有镇宅符、本事、家人、驰援和护家神。');
  console.log('天 门 弩  无灯胜数 有灯胜数  无灯平均打散 有灯平均打散  无灯平均末波 有灯平均末波');
  for (let i = 0; i < traps.length; i += 2) {
    const a = traps[i]!, b = traps[i + 1]!;
    console.log(`${a.day} ${DOORS[a.door]!.name} ${a.bows}  ${a.wins} ${b.wins}  ${a.averageKills.toFixed(1)} ${b.averageKills.toFixed(1)}  ${a.averageLastWave.toFixed(1)} ${b.averageLastWave.toFixed(1)}`);
  }
  console.log('打法验证。第一天、铁皮门、完整五波，每秒四次操作。有效胜局要求该局以指定途径打散目标特点的鬼。');
  for (const row of traitProof) {
    console.log(`${row.name}：有效胜局 ${row.demonstratedWins}/${row.runs}，其中用该法打散 ${row.killsInDemonstratedWins} 只；所有守住局数 ${row.wins}`);
  }
}
