import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const target = 'assets/loop-core.js';
const { outputFiles } = await build({
  entryPoints: ['src/core/loop/browser.ts'],
  bundle: true, format: 'iife', globalName: 'LoopCore', target: 'es2020',
  charset: 'utf8', write: false,
  banner: { js: '// 由 npm run build:loop 生成。规则源文件位于 src/core/loop/。' },
});
const bundle = outputFiles[0].text;
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== bundle) throw new Error('样机规则包已过期，请运行 npm run build:loop');
  console.log(target + ' 已与规则源文件核对');
} else {
  await writeFile(target, bundle);
  console.log(target + ' 已生成');
}
