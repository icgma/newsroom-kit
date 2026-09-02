import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const root = dirname(fileURLToPath(import.meta.url));
const sandbox = { console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, "lib/jstat.min.js"), "utf8"), sandbox);
vm.runInContext(readFileSync(join(root, "stats.js"), "utf8"), sandbox);
const P = sandbox.PValue;

let n = 0;
function test(name, fn) {
  fn();
  n += 1;
  console.log("ok", n, name);
}

test("fmtP APA 去前导零", () => {
  assert.equal(P.fmtP(0.024), ".024");
  assert.equal(P.fmtP(0.0004), "< .001");
  assert.equal(P.fmtP(0.9996), "> .999");
  assert.equal(P.fmtP(NaN), "—");
});

test("stars", () => {
  assert.equal(P.stars(0.0005), "***");
  assert.equal(P.stars(0.008), "**");
  assert.equal(P.stars(0.04), "*");
  assert.equal(P.stars(0.06), "");
});

test("t(58)=2.31 → p ≈ .024", () => {
  const r = P.calcT(2.31, 58);
  assert.ok(Math.abs(r.p - 0.0245) < 0.001);
  assert.match(r.report_plain, /p = \.024/);
  assert.equal(r.stars, "*");
});

test("缺参数会抛错", () => {
  assert.throws(() => P.calculate({}), /请指定/);
  assert.throws(() => P.calcT("x", 10), /有限数值/);
});

test("功效分析 d=.5 → 每组 n=64（G*Power）", () => {
  const r = P.powerT(0.5, 0.05, 0.8);
  assert.equal(r.n_per_group, 64);
});

console.log(`\n${n} tests passed`);
