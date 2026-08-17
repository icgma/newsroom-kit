#!/usr/bin/env node
// sync-kit.mjs — 把 kit/kit.css 与 kit/kit.js 注入到各页面。
// 各文件中以 @kit:start / @kit:end 标记包裹的区域会被真源内容替换，
// 保证五个页面共享的设计系统字节级一致。
//
// 用法：node tools/sync-kit.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kitCss = readFileSync(join(root, "kit", "kit.css"), "utf8").trimEnd();
const kitJs = readFileSync(join(root, "kit", "kit.js"), "utf8").trimEnd();

const CSS_TARGETS = [
  "hub.css",
  "pvalue/styles.css",
  "bibfix/styles.css",
  "redact/styles.css",
  "scipdf/styles.css",
];
const JS_TARGETS = [
  "hub.js",
  "pvalue/app.js",
  "bibfix/app.js",
  "redact/app.js",
  "scipdf/app.js",
];

function inject(path, content, replacement) {
  const isCss = /\.(css)$/.test(path);
  const OPEN = isCss ? "/* @kit:start */" : "// @kit:start";
  const CLOSE = isCss ? "/* @kit:end */" : "// @kit:end";
  const esc = (s) => s.replace(/\*/g, "\\*");
  const re = new RegExp(`${esc(OPEN)}[\\s\\S]*?${esc(CLOSE)}`);
  if (!re.test(content)) {
    console.error(`✗ ${path}: 未找到 @kit:start/@kit:end 标记`);
    process.exitCode = 1;
    return content;
  }
  // 注意：必须用函数形式替换——替换文本中的 $$ 会被 String.replace
  // 当作转义序列（$$ → $），静默破坏注入内容。
  return content.replace(re, () => `${OPEN}\n${replacement}\n${CLOSE}`);
}

for (const t of CSS_TARGETS) {
  const p = join(root, t);
  const before = readFileSync(p, "utf8");
  const after = inject(t, before, kitCss);
  if (after !== before) {
    writeFileSync(p, after);
    console.log(`✓ css → ${t}`);
  } else {
    console.log(`· css   ${t}（无变化）`);
  }
}

for (const t of JS_TARGETS) {
  const p = join(root, t);
  const before = readFileSync(p, "utf8");
  const after = inject(t, before, kitJs);
  if (after !== before) {
    writeFileSync(p, after);
    console.log(`✓ js  → ${t}`);
  } else {
    console.log(`· js    ${t}（无变化）`);
  }
}
console.log("完成。");
