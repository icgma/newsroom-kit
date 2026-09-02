// diff.js — 行级 LCS + 行内分词对照。不依赖 DOM。
((global) => {
  "use strict";

  function tokenize(s) {
    return String(s).match(/[\u4e00-\u9fff]|[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*|\s+|./g) || [];
  }

  function diffSeq(a, b) {
    const n = a.length, m = b.length;
    if (n === 0) return b.map((value) => ({ type: "ins", value }));
    if (m === 0) return a.map((value) => ({ type: "del", value }));
    if (n * m > 4e6) {
      const same = n === m && a.every((x, i) => x === b[i]);
      if (same) return a.map((value) => ({ type: "eq", value }));
      return a.map((value) => ({ type: "del", value }))
        .concat(b.map((value) => ({ type: "ins", value })));
    }
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const out = [];
    let i = n, j = m;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        out.push({ type: "eq", value: a[i - 1] });
        i--; j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        out.push({ type: "del", value: a[--i] });
      } else {
        out.push({ type: "ins", value: b[--j] });
      }
    }
    while (i > 0) out.push({ type: "del", value: a[--i] });
    while (j > 0) out.push({ type: "ins", value: b[--j] });
    return out.reverse();
  }

  function countStats(rows) {
    let added = 0, removed = 0, changedLines = 0;
    for (const row of rows) {
      if (row.type === "ins") { added += 1; changedLines += 1; }
      else if (row.type === "del") { removed += 1; changedLines += 1; }
      else if (row.type === "mod") {
        changedLines += 1;
        for (const t of row.tokens) {
          if (t.type === "ins") added += 1;
          if (t.type === "del") removed += 1;
        }
      }
    }
    return { added, removed, changedLines, total: rows.length };
  }

  function diffTexts(oldText, newText) {
    const a = String(oldText ?? "").split("\n");
    const b = String(newText ?? "").split("\n");
    const ops = diffSeq(a, b);
    const rows = [];
    let i = 0;
    while (i < ops.length) {
      if (ops[i].type === "eq") {
        rows.push({ type: "eq", text: ops[i].value });
        i++;
        continue;
      }
      const dels = [];
      const ins = [];
      while (i < ops.length && ops[i].type !== "eq") {
        if (ops[i].type === "del") dels.push(ops[i].value);
        else ins.push(ops[i].value);
        i++;
      }
      const nPair = Math.min(dels.length, ins.length);
      for (let k = 0; k < nPair; k++) {
        rows.push({
          type: "mod",
          old: dels[k],
          text: ins[k],
          tokens: diffSeq(tokenize(dels[k]), tokenize(ins[k])),
        });
      }
      for (let k = nPair; k < dels.length; k++) rows.push({ type: "del", text: dels[k] });
      for (let k = nPair; k < ins.length; k++) rows.push({ type: "ins", text: ins[k] });
    }
    return { rows, stats: countStats(rows) };
  }

  function summarize(stats) {
    if (!stats.changedLines) return "两稿相同";
    const parts = [];
    if (stats.removed) parts.push(`删 ${stats.removed}`);
    if (stats.added) parts.push(`增 ${stats.added}`);
    parts.push(`${stats.changedLines} 行有改动`);
    return parts.join(" · ");
  }

  const api = { diffTexts, tokenize, summarize };
  global.DiffMark = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
