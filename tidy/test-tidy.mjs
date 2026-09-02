// tidy 需求场景测试。运行：node tidy/test-tidy.mjs
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { tidy, summarize } = require(join(dirname(fileURLToPath(import.meta.url)), "tidy.js"));

let n = 0;
function test(name, fn) {
  fn();
  n += 1;
  console.log("ok", n, name);
}

test("空输入", () => {
  assert.equal(tidy("").text, "");
  assert.equal(tidy(null).text, "");
  assert.equal(tidy(undefined).changed, false);
});

test("BOM 与零宽字符", () => {
  const raw = "\uFEFF今\u200B天\u200D见\uFEFF面";
  const r = tidy(raw);
  assert.equal(r.text, "今天见面");
  assert.ok(r.counts.zw >= 3);
  assert.equal(r.changed, true);
});

test("不间断空格与全角空格", () => {
  const r = tidy("北京\u00A0时间\u3000发布");
  assert.equal(r.text, "北京 时间 发布");
  assert.ok(r.counts.nbsp >= 2);
});

test("全角字母数字变半角", () => {
  const r = tidy("ＡＰＰ　１２３"); // fullwidth space handled as odd space
  assert.match(r.text, /APP/);
  assert.match(r.text, /123/);
  assert.ok(r.counts.alnum >= 6);
});

test("行尾空白与连续空行", () => {
  const r = tidy("第一段  \n\n\n\n第二段\t\n");
  assert.equal(r.text, "第一段\n\n第二段");
  assert.ok(r.counts.trail >= 1);
  assert.equal(r.counts.blank, 1);
});

test("中文后的半角标点", () => {
  const r = tidy("他说,今天开会.真的吗?");
  assert.equal(r.text, "他说，今天开会。真的吗？");
  assert.equal(r.counts.punct, 1);
});

test("行末问号也改", () => {
  const r = tidy("真的吗?\n下一句");
  assert.equal(r.text, "真的吗？\n下一句");
});

test("数字千分位逗号不动", () => {
  const r = tidy("共 1,234 人到场");
  assert.match(r.text, /1,234/);
});

test("三点省略号", () => {
  const r = tidy("未完...");
  assert.equal(r.text, "未完……");
  assert.ok(r.counts.ellipsis >= 1);
});

test("直角引号", () => {
  const r = tidy("他说\"你好\"再走", { quotes: "corner" });
  assert.equal(r.text, "他说「你好」再走");
});

test("弯引号", () => {
  const r = tidy("他说\"你好\"", { quotes: "curly" });
  assert.equal(r.text, "他说“你好”");
});

test("直引号", () => {
  const r = tidy("“你好”", { quotes: "straight" });
  assert.equal(r.text, "\"你好\"");
});

test("干净稿不变实质", () => {
  const r = tidy("今天发布。\n");
  assert.equal(r.text, "今天发布。");
});

test("关掉某项就不改那项", () => {
  const r = tidy("Ａ,中文", { alnum: false, punct: false, space: false, quotes: "off" });
  assert.match(r.text, /Ａ/);
  assert.match(r.text, /,/);
});

test("summarize 有改动", () => {
  const r = tidy("Ａ\u200B");
  assert.match(summarize(r.counts), /零宽|全角/);
});

console.log(`\n${n} tests passed`);
