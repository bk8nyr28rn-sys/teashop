// 把网页原型打包成一个独立的 HTML 文件：dist/web/teashop.html
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fontText, webBundle } from './font-text.mjs';

const bundle = await webBundle();
const template = readFileSync('src/web/page.html', 'utf8');
const fonts = JSON.parse(readFileSync('assets/fonts/manifest.json', 'utf8'));
if (fontText(bundle, template).sha256 !== fonts.textSha256) {
  throw new Error('界面用字已变化，请先运行 python scripts/subset-fonts.py（见 assets/fonts/README.md）。');
}
const css = fonts.faces.map(face => {
  const data = readFileSync(`assets/fonts/${face.file}`).toString('base64');
  return `@font-face{font-family:"${face.family}";font-style:normal;font-weight:${face.weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format("woff2");unicode-range:${face.unicodeRange};}`;
}).join('\n');
// OFL 允许嵌入和子集化；随单文件一并携带版权与授权文字。
const licenses = fonts.licenses.map(file => readFileSync(`assets/fonts/${file}`, 'utf8')).join('\n\n');
const js = bundle.replace(/<\/script/gi, '<\\/script');
const page = template.replace('/*__FONTS__*/', () => css)
  .replace('<!--__FONT_LICENSES__-->', () => `<!--\n${licenses}\n-->`)
  .replace('/*__BUNDLE__*/', () => js);
mkdirSync('dist/web', { recursive: true });
writeFileSync('dist/web/teashop.html', page);
console.log(`dist/web/teashop.html  ${(Buffer.byteLength(page) / 1024).toFixed(1)} KiB (含内嵌字体与授权)`);
