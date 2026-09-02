// test-citecheck.mjs — 引文互转核心的单元测试（node citecheck/test-citecheck.mjs）
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const C = require(join(dirname(fileURLToPath(import.meta.url)), "citecheck.js"));

let n = 0;
function test(name, fn) {
  fn();
  n += 1;
  console.log("ok", n, name);
}

const APA_FIXTURE = "Smith, J. P., & Lee, K. (2021). Media trust in the digital age. Communication Research, 48(2), 210-231. https://doi.org/10.1177/xyz";
const GBT_FIXTURE = "王晓明, 李华, 张三, 等. 算法管理下的骑手劳动过程研究[J]. 新闻与传播研究, 2024, 51(6): 123-138.";
const MLA_FIXTURE = 'Zhang, Wei, and Juan Li. "Platform Labor and Autonomy." Journal of Communication, vol. 12, no. 3, 2023, pp. 45-59.';
const CHI_FIXTURE = 'Smith, J. 2020. "A Study of Trust." American Journal of Sociology 126 (2): 310-345.';
const BIB_FIXTURE = `@article{z2023,
  author = {Zhang, Wei and Li, Juan},
  title = {Platform Labor},
  journal = {Journal of Communication},
  year = {2023}, volume = {12}, number = {3}, pages = {45--59},
  doi = {10.1093/abc}
}`;

test("格式识别", () => {
  assert.equal(C.detectFormat(BIB_FIXTURE), "bibtex");
  assert.equal(C.detectFormat("TY  - JOUR\nAU  - A\nER  - "), "ris");
  assert.equal(C.detectFormat(GBT_FIXTURE), "gbt");
  assert.equal(C.detectFormat(APA_FIXTURE), "apa");
  assert.equal(C.detectFormat(MLA_FIXTURE), "mla");
  assert.equal(C.detectFormat(CHI_FIXTURE), "chicago");
});

test("APA → APA 往返保真", () => {
  const out = C.convert(APA_FIXTURE).outputs[0];
  assert.equal(out.apa,
    "Smith, J. P., & Lee, K. (2021). Media trust in the digital age. Communication Research, 48(2), 210–231. https://doi.org/10.1177/xyz");
});

test("APA → GB/T（作者大写缩写、DOI 前缀）", () => {
  const out = C.convert(APA_FIXTURE).outputs[0];
  assert.equal(out.gbt,
    "SMITH J P, LEE K. Media trust in the digital age[J]. Communication Research, 2021, 48(2): 210-231. DOI:10.1177/xyz.");
});

test("GB/T → APA（中文作者、等→et al）", () => {
  const out = C.convert(GBT_FIXTURE).outputs[0];
  assert.equal(out.apa,
    "王晓明, 李华, 张三, et al (2024). 算法管理下的骑手劳动过程研究. 新闻与传播研究, 51(6), 123–138.");
});

test("GB/T → GB/T 往返保真", () => {
  const out = C.convert(GBT_FIXTURE).outputs[0];
  assert.equal(out.gbt,
    "王晓明, 李华, 张三. 算法管理下的骑手劳动过程研究[J]. 新闻与传播研究, 2024, 51(6): 123-138.");
});

test("MLA → APA", () => {
  const out = C.convert(MLA_FIXTURE).outputs[0];
  assert.equal(out.apa,
    "Zhang, W., & Li, J. (2023). Platform Labor and Autonomy. Journal of Communication, 12(3), 45–59.");
});

test("Chicago 作者-年份 → APA", () => {
  const out = C.convert(CHI_FIXTURE).outputs[0];
  assert.equal(out.apa,
    "Smith, J. (2020). A Study of Trust. American Journal of Sociology, 126(2), 310–345.");
});

test("Chicago → GB/T", () => {
  const out = C.convert(CHI_FIXTURE).outputs[0];
  assert.equal(out.gbt,
    "SMITH J. A Study of Trust[J]. American Journal of Sociology, 2020, 126(2): 310-345.");
});

test("BibTeX → 四格式", () => {
  const out = C.convert(BIB_FIXTURE).outputs[0];
  assert.equal(out.apa, "Zhang, W., & Li, J. (2023). Platform Labor. Journal of Communication, 12(3), 45–59. https://doi.org/10.1093/abc");
  assert.equal(out.gbt, "ZHANG W, LI J. Platform Labor[J]. Journal of Communication, 2023, 12(3): 45-59. DOI:10.1093/abc.");
  assert.equal(out.mla, 'Zhang, Wei and Li, Juan. "Platform Labor" Journal of Communication, vol. 12, no. 3, 2023, pp. 45–59. https://doi.org/10.1093/abc');
});

test("BibTeX 图书（中文）→ 各格式", () => {
  const out = C.convert("@book{fxt2020, author={费孝通}, title={乡土中国}, publisher={北京大学出版社}, address={北京}, year={2020}}").outputs[0];
  assert.equal(out.gbt, "费孝通. 乡土中国[M]. 北京: 北京大学出版社, 2020.");
  assert.equal(out.mla, "费孝通. 乡土中国. 北京: 北京大学出版社, 2020.");
});

test("GB/T 图书 → APA / Chicago", () => {
  const out = C.convert("王晓明. 乡土中国[M]. 北京: 北京大学出版社, 2020.").outputs[0];
  assert.equal(out.apa, "王晓明 (2020). 乡土中国. 北京大学出版社.");
  assert.equal(out.chicago, "王晓明. 2020. 乡土中国. 北京: 北京大学出版社.");
});

test("GB/T 学位论文 → GB/T", () => {
  const out = C.convert("张三. 网络社会的情感结构[D]. 北京: 中国人民大学, 2022.").outputs[0];
  assert.equal(out.gbt, "张三. 网络社会的情感结构[D]. 北京: 中国人民大学, 2022.");
});

test("RIS → APA", () => {
  const ris = "TY  - JOUR\nAU  - Smith, John\nTI  - Testing Citation Tools\nJO  - Methods Journal\nPY  - 2022\nVO  - 8\nIS  - 1\nSP  - 10\nEP  - 20\nDO  - 10.1000/test\nER  - ";
  const out = C.convert(ris).outputs[0];
  assert.equal(out.apa, "Smith, J. (2022). Testing Citation Tools. Methods Journal, 8(1), 10–20. https://doi.org/10.1000/test");
});

test("多行多条文本文档", () => {
  const res = C.convert(GBT_FIXTURE + "\n" + APA_FIXTURE);
  assert.equal(res.outputs.length, 2);
  assert.ok(res.outputs[1].apa.includes("Communication Research"));
});

test("非引文文本明确报错", () => {
  const res = C.convert("这句话不是引文也不是参考文献，只是随便一句话而已。");
  assert.ok(res.outputs[0].error);
});

test("页码规范化（各种连字符）", () => {
  assert.equal(C.normalizePages("45--59"), "45-59");
  assert.equal(C.normalizePages("45–59"), "45-59");
  assert.equal(C.normalizePages("45 - 59"), "45-59");
});

console.log(`\n${n} tests passed`);
