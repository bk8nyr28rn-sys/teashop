// 样机浏览器测试的公用部分：直接打开正式页面，保留 iframe 和字体的相对路径；截图放到 OUT
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = process.env.PROTO_OUT || path.join(os.tmpdir(), 'teashop-proto');
fs.mkdirSync(path.join(OUT, 'loop'), { recursive: true });
const PAGES = { creator: 'docs/art/creator/index.html', loop: 'docs/proto/loop/index.html' };
function wrap(which) {
  return path.join(ROOT, PAGES[which]);
}
async function enableUnlimitedDays(page) {
  await page.locator('#menu').click();
  await page.locator('#unlimited-days').check();
  await page.getByRole('button', { name: '关上', exact: true }).click();
}
// 打印里出现 FAIL 或页面报错，就让进程以 1 退出
const log = console.log;
let failed = false;
console.log = (...a) => { const s = a.join(' '); if (/^FAIL /.test(s) || /^errors \S/.test(s)) failed = true; log(...a); };
process.on('exit', (c) => { if (failed && c === 0) process.exitCode = 1; });
module.exports = { ROOT, OUT, wrap, enableUnlimitedDays };
