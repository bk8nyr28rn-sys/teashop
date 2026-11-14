// 把网页原型打包成一个独立的 HTML 文件：dist/web/teashop.html
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/web/main.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = readFileSync('src/web/page.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
mkdirSync('dist/web', { recursive: true });
writeFileSync('dist/web/teashop.html', page);
console.log(`dist/web/teashop.html  ${(page.length / 1024).toFixed(1)} KB`);
