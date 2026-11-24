// 敏感说法一键换词（见 docs/TERMS.md）。
//   node scripts/terms.mjs                      列出每个词在哪些文件里出现几次
//   node scripts/terms.mjs --apply 换词表.json   照表把玩家看得到的文件里的词全部换掉，然后重新打包
//   加 --root 目录 可以对另一份拷贝操作（测试用）
// 一次扫完、长词优先：「厉鬼」先换，不会被「鬼」换两遍。只改文字，不碰换行符。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const TERMS = ['厉鬼', '护家神', '阴间', '奈何桥', '投胎', '魂火', '葫芦', '显灵', '下一世', '前世', '鬼'];

const args = process.argv.slice(2);
const root = resolve(args.includes('--root') ? args[args.indexOf('--root') + 1] : '.');
const files = () => [
  'docs/proto/loop/index.html', 'assets/guidance.js', 'assets/riverside.js', 'assets/house-watch.js',
  ...readdirSync(join(root, 'src/core/loop')).filter(f => f.endsWith('.ts')).map(f => 'src/core/loop/' + f),
];
const pattern = keys => new RegExp(keys.slice().sort((a, b) => b.length - a.length).join('|'), 'g');

if (args.includes('--apply')) {
  const map = JSON.parse(readFileSync(resolve(args[args.indexOf('--apply') + 1]), 'utf8'));
  // 以下划线开头的是说明，不是要换的词
  const keys = Object.keys(map).filter(k => !k.startsWith('_') && typeof map[k] === 'string' && map[k] !== k);
  if (!keys.length) { console.log('换词表是空的'); process.exit(0); }
  const re = pattern(keys);
  let total = 0;
  for (const f of files()) {
    const path = join(root, f), text = readFileSync(path, 'utf8');
    let n = 0;
    const out = text.replace(re, m => { n++; return map[m]; });
    if (n) { writeFileSync(path, out); console.log(`${f}：换了 ${n} 处`); total += n; }
  }
  console.log(`一共换了 ${total} 处。重新打包：`);
  for (const script of ['scripts/build-loop-core.mjs', 'scripts/sync-shared-draw.mjs']) {
    const r = spawnSync(process.execPath, [script], { cwd: root, stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
} else {
  const re = pattern(TERMS);
  const rows = new Map(TERMS.map(t => [t, []]));
  for (const f of files()) {
    const counts = {};
    for (const m of readFileSync(join(root, f), 'utf8').match(re) ?? []) counts[m] = (counts[m] ?? 0) + 1;
    for (const [t, n] of Object.entries(counts)) rows.get(t).push(`${f.split('/').pop()} ${n}`);
  }
  for (const [t, where] of rows) console.log(`${t}\t${where.join('，') || '—'}`);
}
