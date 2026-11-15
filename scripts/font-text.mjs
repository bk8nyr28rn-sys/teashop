// 从实际网页 bundle 的字符串中提取用字，包含规则返回的提示，但不包含源码注释、类型或测试。
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export async function webBundle() {
  const result = await build({
    entryPoints: ['src/web/main.ts'], bundle: true, format: 'iife',
    target: 'es2020', minify: true, write: false, legalComments: 'none',
  });
  return result.outputFiles[0].text;
}

export function fontText(js, page) {
  const chunks = [];
  const source = ts.createSourceFile('web.js', js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isStringLiteralLike(node) || [ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail].includes(node.kind)) {
      chunks.push(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  chunks.push(page.replace(/<style\b[^>]*>[\s\S]*?<\/style>|<script\b[^>]*>[\s\S]*?<\/script>|<!--[\s\S]*?-->/gi, ''));
  // 数字、英文名及动态格式化使用基本 ASCII；中文和符号只保留实际字符串中的字符。
  chunks.push(Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join(''));
  const text = [...new Set(chunks.join(''))].filter(c => c.codePointAt(0) >= 32 && c !== '\x7f')
    .sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
  return { text, sha256: createHash('sha256').update(text).digest('hex') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(fontText(await webBundle(), readFileSync('src/web/page.html', 'utf8'))));
}
