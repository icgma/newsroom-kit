// test-csvclean.mjs — CSV 清洗核心的单元测试（node csvclean/test-csvclean.mjs）
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const C = require(join(dirname(fileURLToPath(import.meta.url)), "csvclean.js"));

let n = 0;
function test(name, fn) {
  fn();
  n += 1;
  console.log("ok", n, name);
}

test("分隔符检测", () => {
  assert.equal(C.detectDelimiter("a,b,c\n1,2,3"), ",");
  assert.equal(C.detectDelimiter("a;b;c\n1;2;3"), ";");
  assert.equal(C.detectDelimiter("a\tb\tc\n1\t2\t3"), "\t");
  assert.equal(C.detectDelimiter("a|b|c\n1|2|3"), "|");
});

test("RFC4180：引号内逗号、转义双引号、引号内换行", () => {
  const p = C.parseCSV('name,note\n"Smith, John","said ""hi"""\n"multi\nline",2', ",");
  assert.equal(p.rows.length, 3);
  assert.equal(p.rows[1][0], "Smith, John");
  assert.equal(p.rows[1][1], 'said "hi"');
  assert.equal(p.rows[2][0], "multi\nline");
});

test("列分析：ragged / 重复列名 / 混型 / 全空列", () => {
  const rows = [
    ["id", "score", "score", "备注", ""],
    ["1", "90", "85", "好", ""],
    ["2", "88", "82", "", ""],
    ["3", "92", "abc"],
    ["4", "95", "91", "x", ""],
    ["5", "81", "88", "", ""],
  ];
  const a = C.analyze(rows, ",");
  assert.ok(a.issues.some((x) => x.type === "ragged"));
  assert.ok(a.issues.some((x) => x.type === "dup-col"));
  assert.ok(a.issues.some((x) => x.type === "mixed-col"));
  assert.ok(a.issues.some((x) => x.type === "empty-col"));
  assert.equal(a.columns[1].type, "number");
  assert.equal(a.rowCount, 5);
});

test("清洗：BOM、换行、空白、全角、空行、重复行", () => {
  const dirty = "\uFEFF 姓名 , 年龄\r\n王小明 , 2０\r\n\r\n李四,3０\r\n李四,3０";
  const r = C.clean(dirty, { toHalf: true, removeDuplicateRows: true });
  assert.ok(!r.output.startsWith("\uFEFF"));
  assert.equal(r.output.split("\n")[0], "姓名,年龄");
  assert.ok(r.output.includes("20"));
  assert.equal(r.output.split("\n").length, 3);
  assert.ok(r.actions.some((a) => a.includes("重复行")));
});

test("序列化：含分隔符的单元格自动加引号", () => {
  assert.equal(C.serialize([["a", "x,y"]], ","), 'a,"x,y"');
});

test("编码：GB18030 自动回退与 UTF-8 直通", () => {
  // “张三,20” 的 GBK 字节
  const gbBytes = new Uint8Array([0xD5, 0xC5, 0xC8, 0xFD, 0x2C, 0x32, 0x30]);
  const dec = C.decodeBuffer(gbBytes.buffer);
  assert.equal(dec.text, "张三,20");
  assert.equal(dec.encoding, "gb18030");
  const u8 = new TextEncoder().encode("王小明,20");
  assert.equal(C.decodeBuffer(u8.buffer).encoding, "utf-8");
});

test("BOM 报告与剥离", () => {
  const withBom = new TextEncoder().encode("\uFEFFa,b");
  const dec = C.decodeBuffer(withBom.buffer);
  assert.equal(dec.text, "a,b");
  assert.ok(dec.issues.some((x) => x.type === "bom"));
});

test("类型推断", () => {
  assert.equal(C.inferType(["90", "88", "95", "77", "91"]), "number");
  assert.equal(C.inferType(["90", "88", "abc", "95", "77"]), "text"); // 混列不定为数字
  assert.equal(C.inferType(["好", "坏", ""]), "text");
  assert.equal(C.inferType(["", "", ""]), "empty");
});

console.log(`\n${n} tests passed`);
