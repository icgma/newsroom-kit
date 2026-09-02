import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { diffTexts, summarize } = require(join(dirname(fileURLToPath(import.meta.url)), "diff.js"));

let n = 0;
function test(name, fn) {
  fn();
  n += 1;
  console.log("ok", n, name);
}

test("完全相同", () => {
  const r = diffTexts("今天发布。", "今天发布。");
  assert.equal(r.stats.changedLines, 0);
  assert.equal(r.rows[0].type, "eq");
});

test("空对空", () => {
  const r = diffTexts("", "");
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].type, "eq");
});

test("整行新增", () => {
  const r = diffTexts("第一段", "第一段\n第二段");
  assert.equal(r.rows[0].type, "eq");
  assert.equal(r.rows[1].type, "ins");
  assert.equal(r.rows[1].text, "第二段");
});

test("整行删除", () => {
  const r = diffTexts("第一段\n第二段", "第一段");
  assert.equal(r.rows[1].type, "del");
});

test("中文逐字改", () => {
  const r = diffTexts("今天发布新闻", "今晚发布新闻");
  assert.equal(r.rows[0].type, "mod");
  const types = r.rows[0].tokens.map((t) => t.type + ":" + t.value);
  assert.ok(types.includes("del:天"));
  assert.ok(types.includes("ins:晚"));
  assert.ok(types.includes("eq:今"));
});

test("英文单词级", () => {
  const r = diffTexts("hello world", "hello there");
  const toks = r.rows[0].tokens;
  assert.ok(toks.some((t) => t.type === "del" && t.value === "world"));
  assert.ok(toks.some((t) => t.type === "ins" && t.value === "there"));
});

test("两行对三行：末行是新增", () => {
  const r = diffTexts("市委今天开会。\n要加快推进。", "市委今晚开会。\n要稳步推进。\n会后印发纪要。");
  assert.equal(r.rows[0].type, "mod");
  assert.equal(r.rows[1].type, "mod");
  assert.equal(r.rows[2].type, "ins");
  assert.equal(r.rows[2].text, "会后印发纪要。");
  assert.ok(r.rows[0].tokens.some((t) => t.type === "del" && t.value === "天"));
  assert.ok(r.rows[0].tokens.some((t) => t.type === "ins" && t.value === "晚"));
});

test("summarize", () => {
  const r = diffTexts("a", "b");
  assert.match(summarize(r.stats), /改动/);
});

console.log(`\n${n} tests passed`);
