// 把捏人台里的画人代码（// @@shared-begin 到 // @@shared-end）复制进用到它的样机页面。
// 样机是单个 HTML 文件，没法引用捏人台，所以靠这个脚本保持两边一致。
//   node scripts/sync-shared-draw.mjs          同步
//   node scripts/sync-shared-draw.mjs --check  只检查，不一致就报错退出
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'docs/art/creator/index.html';
const TARGETS = ['docs/proto/loop/index.html', 'docs/proto/coop/index.html'];
const BEGIN = '// @@shared-begin';
const END = '// @@shared-end';

function section(text, file) {
  const a = text.indexOf(BEGIN);
  const b = text.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error(`${file}: 找不到 ${BEGIN} / ${END}`);
  return [a, b];
}

const src = readFileSync(SOURCE, 'utf8');
const [sa, sb] = section(src, SOURCE);
const chunk = src.slice(sa, sb);
const check = process.argv.includes('--check');
let stale = 0;
for (const file of TARGETS) {
  const t = readFileSync(file, 'utf8');
  const [ta, tb] = section(t, file);
  const out = t.slice(0, ta) + chunk + t.slice(tb);
  if (out === t) { console.log(`${file}: 已是最新`); continue; }
  if (check) { console.error(`${file}: 画人代码和捏人台不一致，请运行 node scripts/sync-shared-draw.mjs`); stale++; continue; }
  writeFileSync(file, out);
  console.log(`${file}: 已同步`);
}
// 可直接打开的交接版使用同一份页面，只调整相邻捏人台及公共资源的位置。
for (const [source, target] of [[SOURCE, 'prototype/creator.html'], [TARGETS[0], 'prototype/loop.html'], [TARGETS[1], 'prototype/coop.html']]) {
  const page = readFileSync(source, 'utf8')
    .replaceAll('../../../assets/', '../assets/')
    .replace('data-editor="../../art/creator/index.html?', 'data-editor="./creator.html?');
  if (readFileSync(target, 'utf8') === page) continue;
  if (check) { console.error(`${target}: 离线页面需要同步`); stale++; }
  else { writeFileSync(target, page); console.log(`${target}: 已同步`); }
}
if (stale) process.exit(1);
