// csvclean.js — CSV 清洗核心（纯逻辑，无 DOM；经 globalThis.CsvClean 导出）
//
// 能力：RFC4180 解析、分隔符/编码检测、常见问题报告（混合分隔符、
// 引号不闭合、BOM、重复行、空列、数字列混入文本）、可配置清洗与再序列化。
// 原则：清洗动作全部可勾选、全部报告，默认不做破坏性操作。

((global) => {
  "use strict";

  // ── 分隔符检测：统计各候选在行内的出现频次稳定性 ─────────
  function detectDelimiter(text) {
    const candidates = [",", ";", "\t", "|"];
    const sample = String(text).split(/\r?\n/).filter((l) => l.trim()).slice(0, 30);
    if (!sample.length) return ",";
    let best = ",", bestScore = -1;
    for (const d of candidates) {
      const counts = sample.map((l) => countOutsideQuotes(l, d));
      const nonZero = counts.filter((c) => c > 0);
      if (!nonZero.length) continue;
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      // 均值高且行间一致（方差小）的候选更可信
      const varr = counts.reduce((a, b) => a + (b - avg) ** 2, 0) / counts.length;
      const score = avg * 10 - Math.sqrt(varr);
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  function countOutsideQuotes(line, d) {
    let count = 0, inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQ = !inQ;
      else if (ch === d && !inQ) count++;
    }
    return count;
  }

  // ── RFC4180 解析（引号内可含分隔符与换行）────────────────
  // 返回 { rows: [[cell,…],…], issues: [{row, col?, type, detail}] }
  function parseCSV(text, delimiter) {
    const rows = [];
    const issues = [];
    let row = [];
    let cell = "";
    let inQ = false;
    let rowNum = 1;
    let colNum = 0;
    let i = 0;
    const s = String(text);

    const pushCell = () => { row.push(cell); cell = ""; colNum++; };
    const pushRow = () => {
      pushCell();
      rows.push(row);
      row = [];
      colNum = 0;
      rowNum++;
    };

    while (i < s.length) {
      const ch = s[i];
      if (inQ) {
        if (ch === '"') {
          if (s[i + 1] === '"') { cell += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        cell += ch; i++; continue;
      }
      if (ch === '"' && cell === "") {
        inQ = true; i++; continue;
      }
      if (ch === '"') {
        // 引号出现在字段中间：报告并按字面保留
        issues.push({ row: rowNum, col: colNum + 1, type: "stray-quote", detail: "字段中间出现引号，已按字面保留" });
        cell += ch; i++; continue;
      }
      if (ch === delimiter) { pushCell(); i++; continue; }
      if (ch === "\r") {
        if (s[i + 1] === "\n") i++;
        pushRow(); i++; continue;
      }
      if (ch === "\n") { pushRow(); i++; continue; }
      cell += ch; i++;
    }
    if (inQ) {
      issues.push({ row: rowNum, type: "unclosed-quote", detail: "引号未闭合（文件在引号内结束）" });
    }
    if (cell !== "" || row.length) pushRow();
    // 去掉末尾完全为空的行（[ '' ]）
    while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") rows.pop();
    return { rows, issues };
  }

  // ── 编码检测与解码（浏览器 / Node 22 的 TextDecoder 支持 gb18030）──
  function decodeBuffer(buffer, forced) {
    const bytes = new Uint8Array(buffer);
    const issues = [];
    // BOM
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      issues.push({ row: 0, type: "bom", detail: "含 UTF-8 BOM，已去除" });
      return { text: new TextDecoder("utf-8").decode(bytes.slice(3)), encoding: "utf-8", issues };
    }
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
      issues.push({ row: 0, type: "bom", detail: "含 UTF-16 LE BOM" });
      return { text: new TextDecoder("utf-16le").decode(bytes.slice(2)), encoding: "utf-16le", issues };
    }
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
      issues.push({ row: 0, type: "bom", detail: "含 UTF-16 BE BOM" });
      return { text: new TextDecoder("utf-16be").decode(bytes.slice(2)), encoding: "utf-16be", issues };
    }

    const tryDecode = (enc) => {
      try {
        const dec = new TextDecoder(enc, { fatal: true });
        return dec.decode(bytes);
      } catch { return null; }
    };

    if (forced === "utf-8" || forced === "gb18030") {
      const enc = forced;
      const text = tryDecode(enc);
      return { text: text ?? "", encoding: enc, issues };
    }

    // 自动：先试 UTF-8（严格），失败则 GB18030
    const utf8 = tryDecode("utf-8");
    if (utf8 !== null) {
      return { text: utf8, encoding: "utf-8", issues };
    }
    const gb = tryDecode("gb18030");
    if (gb !== null) {
      issues.push({ row: 0, type: "encoding", detail: "不是合法 UTF-8，已按 GB18030 解码（问卷平台/Excel 导出常见）" });
      return { text: gb, encoding: "gb18030", issues };
    }
    // 都失败：非严格模式兜底
    issues.push({ row: 0, type: "encoding", detail: "编码无法确定，已用宽松模式解码，可能出现乱码" });
    return { text: new TextDecoder("utf-8").decode(bytes), encoding: "utf-8?", issues };
  }

  // ── 全半角与空白工具 ─────────────────────────────────────
  function fullWidthInfo(s) {
    let n = 0;
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if ((c >= 0xFF01 && c <= 0xFF5E) || c === 0x3000) n++;
    }
    return n;
  }
  function toHalfWidth(s) {
    let out = "";
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (c === 0x3000) out += " ";
      else if (c >= 0xFF01 && c <= 0xFF5E) out += String.fromCodePoint(c - 0xFEE0);
      else out += ch;
    }
    return out;
  }
  const hasInvisible = (s) => /[\u200B-\u200D\uFEFF\u2060]/.test(s);
  const stripInvisible = (s) => s.replace(/[\u200B-\u200D\uFEFF\u2060]/g, "");

  // ── 列分析 ───────────────────────────────────────────────
  function inferType(values) {
    const nonEmpty = values.filter((v) => v !== "");
    if (!nonEmpty.length) return "empty";
    let num = 0, date = 0;
    for (const v of nonEmpty) {
      if (v !== "" && !isNaN(Number(v.replace(/,/g, "")))) num++;
      if (/^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/.test(v)) date++;
    }
    if (date / nonEmpty.length > 0.9) return "date";
    if (num / nonEmpty.length > 0.9) return "number";
    return "text";
  }

  function analyze(rows, delimiter) {
    if (!rows.length) {
      return { rowCount: 0, colCount: 0, columns: [], issues: [] };
    }
    const colCount = Math.max(...rows.map((r) => r.length));
    const issues = [];

    // 各行列数不齐（混合分隔符 / 漏字段）
    rows.forEach((r, i) => {
      if (r.length !== colCount) {
        issues.push({ row: i + 1, type: "ragged", detail: `本行 ${r.length} 列，表头 ${colCount} 列` });
      }
    });

    const header = rows[0].map((h, i) => h.trim() || `列${i + 1}`);
    // 空/重复列名
    const seen = {};
    header.forEach((h, i) => {
      if (seen[h] !== undefined) {
        issues.push({ row: 1, col: i + 1, type: "dup-col", detail: `列名「${h}」重复（第 ${seen[h] + 1}、${i + 1} 列）` });
      } else seen[h] = i;
    });

    const columns = [];
    for (let c = 0; c < colCount; c++) {
      const values = rows.slice(1).map((r) => (r[c] ?? "").trim());
      const empty = values.filter((v) => v === "").length;
      const type = inferType(values);
      const col = { name: header[c], type, empty, index: c + 1 };

      if (empty === values.length && values.length) {
        issues.push({ row: 0, col: c + 1, type: "empty-col", detail: `第 ${c + 1} 列「${header[c]}」全空` });
      }
      // 数字列混入文本（乱码/单位/千分位问题的信号）：
      // 非空值中 ≥80% 可解析为数字且确有反例 → 提示可疑行
      const nonEmptyVals = values.filter((v) => v !== "");
      const numCount = nonEmptyVals.filter((v) => !isNaN(Number(v.replace(/,/g, "")))).length;
      if (nonEmptyVals.length >= 4 && numCount >= 3
          && numCount / nonEmptyVals.length >= 0.8
          && numCount < nonEmptyVals.length) {
        const bad = values
          .map((v, i) => [v, i])
          .filter(([v]) => v !== "" && isNaN(Number(v.replace(/,/g, ""))))
          .slice(0, 5);
        issues.push({
          row: 0, col: c + 1, type: "mixed-col",
          detail: `第 ${c + 1} 列「${header[c]}」基本是数字，但这些行不是：${bad.map(([, i]) => "第" + (i + 2) + "行").join("、")}`,
        });
      }
      columns.push(col);
    }

    // 全文级：隐形字符 / 全角字母数字
    let invisible = 0, fullWidth = 0, wsPadded = 0;
    for (const r of rows) {
      for (const cell of r) {
        if (hasInvisible(cell)) invisible++;
        if (fullWidthInfo(cell.replace(/[一-鿿]/g, "")) > 0) fullWidth++;
        if (cell !== cell.trim()) wsPadded++;
      }
    }
    if (invisible) issues.push({ row: 0, type: "invisible", detail: `${invisible} 个单元格含零宽/隐形字符（复制粘贴常见）` });
    if (fullWidth) issues.push({ row: 0, type: "fullwidth", detail: `${fullWidth} 个单元格含全角字母/数字/符号` });
    if (wsPadded) issues.push({ row: 0, type: "whitespace", detail: `${wsPadded} 个单元格首尾有空格` });

    return {
      rowCount: rows.length - 1, // 不含表头
      colCount,
      columns,
      issues,
      delimiter,
    };
  }

  // ── 清洗与再序列化 ───────────────────────────────────────
  // opts: { trimCells, toHalf, removeEmptyRows, removeDuplicateRows, normalizeQuotes, delimiter }
  function clean(text, opts) {
    opts = Object.assign({
      trimCells: true, toHalf: false, removeEmptyRows: true,
      removeDuplicateRows: false, normalizeQuotes: false, delimiter: null,
    }, opts);

    const actions = [];
    let s = String(text);

    if (/^\uFEFF/.test(s)) { s = s.slice(1); actions.push("去除 UTF-8 BOM"); }
    if (/\r\n|\r/.test(s)) { s = s.replace(/\r\n?/g, "\n"); actions.push("换行统一为 LF"); }

    const delimiter = opts.delimiter || detectDelimiter(s);
    const parsed = parseCSV(s, delimiter);
    let rows = parsed.rows;
    const issues = [...parsed.issues];

    const before = rows.length;

    if (opts.normalizeQuotes) {
      let n = 0;
      for (const r of rows) for (let c = 0; c < r.length; c++) {
        const fixed = r[c].replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
        if (fixed !== r[c]) { r[c] = fixed; n++; }
      }
      if (n) actions.push(`中文引号规范化 ${n} 处`);
    }
    if (opts.toHalf) {
      let n = 0;
      for (const r of rows) for (let c = 0; c < r.length; c++) {
        const fixed = toHalfWidth(r[c]);
        if (fixed !== r[c]) { r[c] = fixed; n++; }
      }
      if (n) actions.push(`全角转半角 ${n} 处`);
    }
    if (opts.trimCells) {
      let n = 0;
      for (const r of rows) for (let c = 0; c < r.length; c++) {
        const fixed = stripInvisible(r[c].trim());
        if (fixed !== r[c]) { r[c] = fixed; n++; }
      }
      if (n) actions.push(`去首尾空白与隐形字符 ${n} 处`);
    }
    if (opts.removeEmptyRows) {
      const kept = rows.filter((r, i) => i === 0 || r.some((cell) => cell.trim() !== ""));
      if (kept.length !== rows.length) {
        actions.push(`删除空行 ${rows.length - kept.length} 行`);
        rows = kept;
      }
    }
    if (opts.removeDuplicateRows) {
      const seen = new Set();
      const kept = [];
      let dups = 0;
      for (let i = 0; i < rows.length; i++) {
        const key = JSON.stringify(rows[i]);
        if (i > 0 && seen.has(key)) { dups++; continue; }
        seen.add(key);
        kept.push(rows[i]);
      }
      if (dups) { actions.push(`删除重复行 ${dups} 行`); rows = kept; }
    }

    const report = analyze(rows, delimiter);
    report.issues.push(...issues.map((x) => x));
    const output = serialize(rows, delimiter);

    return {
      delimiter,
      actions,
      removed: before - rows.length,
      report,
      output,
    };
  }

  // RFC4180 序列化：必要才加引号
  function serialize(rows, delimiter) {
    const needQuote = new RegExp('["\\r\\n' + escapeRe(delimiter) + "]");
    return rows.map((row) => row.map((cell) => {
      if (needQuote.test(cell)) return '"' + cell.replace(/"/g, '""') + '"';
      return cell;
    }).join(delimiter)).join("\n");
  }
  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ── 导出 ─────────────────────────────────────────────────
  global.CsvClean = {
    detectDelimiter, parseCSV, decodeBuffer, analyze, clean, serialize,
    toHalfWidth, inferType,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.CsvClean;
})(typeof globalThis !== "undefined" ? globalThis : this);
