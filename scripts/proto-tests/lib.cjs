// 样机浏览器测试的公用部分：把单文件页面包成完整 HTML 再用 Playwright 打开；截图和临时文件都放到 OUT
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = process.env.PROTO_OUT || path.join(os.tmpdir(), 'teashop-proto');
fs.mkdirSync(path.join(OUT, 'loop'), { recursive: true });
const PAGES = { creator: 'docs/art/creator/index.html', loop: 'docs/proto/loop/index.html' };
function wrap(which) {
  const f = path.join(OUT, `${which}-wrapped.html`);
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(ROOT, PAGES[which]), 'utf8') + '</body></html>');
  return f;
}
// 打印里出现 FAIL 或页面报错，就让进程以 1 退出
const log = console.log;
let failed = false;
console.log = (...a) => { const s = a.join(' '); if (/^FAIL /.test(s) || /^errors \S/.test(s)) failed = true; log(...a); };
process.on('exit', (c) => { if (failed && c === 0) process.exitCode = 1; });
module.exports = { ROOT, OUT, wrap };
