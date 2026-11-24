// 依次跑所有样机浏览器测试；任何一个失败就以 1 退出。截图在 $PROTO_OUT（默认系统临时目录下的 teashop-proto）
const { spawnSync } = require('child_process');
const path = require('path');
const tests = [
  'creator.test.cjs', 'creator-fold.test.cjs', 'creator-draw.test.cjs',
  'creator-embed.test.cjs', 'creator-layers.test.cjs',
  'guidance.test.cjs', 'first-night.test.cjs', 'day-bank.test.cjs', 'day-field.test.cjs', 'riverside.test.cjs', 'day-market.test.cjs',
  'pockets-mobile.test.cjs', 'trade.test.cjs', 'loop-family.test.cjs', 'loop-gate.test.cjs', 'night-receipt.test.cjs', 'auto-watch.test.cjs', 'afterlife.test.cjs', 'terms.test.cjs', 'loop.test.cjs',
];
let bad = 0;
for (const t of tests) {
  console.log(`\n=== ${t} ===`);
  const r = spawnSync(process.execPath, [path.join(__dirname, t)], { stdio: 'inherit' });
  if (r.status !== 0) { bad++; console.log(`!!! ${t} 失败`); }
}
console.log(bad ? `\n${bad} 个测试文件失败` : '\n全部通过');
process.exit(bad ? 1 : 0);
