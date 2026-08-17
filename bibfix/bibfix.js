// bibfix.js — 参考文献修复核心（纯逻辑，无 DOM；经 globalThis.BibFix 导出）
// 原则：只修可确定的问题，绝不臆造缺失字段；逐条记录改动。

((global) => {
  "use strict";

  const BIBTEX_TYPES = new Set([
    "article", "book", "inproceedings", "conference", "thesis", "phdthesis",
    "mastersthesis", "incollection", "proceedings", "techreport", "misc",
    "unpublished", "booklet", "inbook", "manual", "online", "electronic",
  ]);

  const RIS_TYPE_MAP = {
    JOUR: "article", MAG: "article", NEWS: "article",
    CONF: "inproceedings", ELEC: "online", WEB: "online",
    BOOK: "book", CHAP: "incollection", THES: "phdthesis",
    RPRT: "techreport", STD: "techreport", PAT: "misc", UNPB: "unpublished",
  };

  // ── 格式识别 ─────────────────────────────────────────────
  function detectFormat(text) {
    const t = String(text || "");
    if (/@\s*[A-Za-z]+\s*[({]/.test(t) && /[={]/.test(t)) {
      // 更严格：出现已知 BibTeX 类型则认定
      if (/@\s*(article|book|inproceedings|conference|thesis|phdthesis|mastersthesis|incollection|proceedings|techreport|misc|unpublished|booklet|inbook|manual|online|electronic)\b/i.test(t)) return "bibtex";
    }
    if (/^TY\s{1,2}-\s*/m.test(t)) return "ris";
    return "unknown";
  }

  // ── BibTeX 解析（括号计数，容错各种排版）─────────────────
  function parseBibtex(text) {
    const entries = [];
    let i = 0;
    const n = text.length;

    while (true) {
      const at = text.indexOf("@", i);
      if (at === -1) break;
      const typeMatch = text.slice(at + 1).match(/^[ \t]*([A-Za-z]+)[ \t]*([({])/);
      if (!typeMatch) { i = at + 1; continue; }

      const rawType = typeMatch[1];
      const openCh = typeMatch[2];
      const closeCh = openCh === "(" ? ")" : "}";
      const bodyStart = at + 1 + typeMatch[0].length;
      const type = rawType.toLowerCase();

      // 跳过 @comment / @string / @preamble 整块
      if (type === "comment" || type === "string" || type === "preamble") {
        const end = findClose(text, bodyStart, openCh, closeCh);
        i = end === -1 ? n : end;
        continue;
      }
      if (!BIBTEX_TYPES.has(type)) { i = at + 1; continue; }

      const end = findClose(text, bodyStart, openCh, closeCh);
      if (end === -1) break; // 未闭合：放弃剩余
      const body = text.slice(bodyStart, end);
      i = end;

      const { key, fields } = parseBibtexBody(body);
      entries.push({ type, key, fields });
    }
    return entries;
  }

  // 找到与 openCh 配对的闭合符（值内的花括号按深度计数）
  function findClose(text, start, openCh, closeCh) {
    let depth = 0;
    for (let p = start - 1; p < text.length; p++) {
      const ch = text[p];
      if (ch === openCh) depth++;
      else if (ch === closeCh) {
        depth--;
        if (depth === 0) return p + 1 === start ? -1 : p;
      }
    }
    return -1;
  }

  function parseBibtexBody(body) {
    // key：第一个顶层逗号之前
    let key = body.trim();
    let rest = "";
    const commaIdx = indexOfTopLevel(body, ",");
    if (commaIdx !== -1) {
      key = body.slice(0, commaIdx).trim();
      rest = body.slice(commaIdx + 1);
    }
    // 允许 key 中的非法字符只是警告，不在解析层处理

    // 字段：顶层逗号切分（花括号深度 + 引号状态）
    const fields = {};
    for (const part of splitTopLevel(rest)) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim().toLowerCase();
      if (!name) continue;
      let val = part.slice(eq + 1).trim();
      val = unwrapValue(val);
      if (val !== "") fields[name] = val;
    }
    return { key, fields };
  }

  function indexOfTopLevel(s, target) {
    let depth = 0, inQ = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"' && depth === 0) inQ = !inQ;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === target && depth === 0 && !inQ) return i;
    }
    return -1;
  }

  function splitTopLevel(s) {
    const parts = [];
    let depth = 0, inQ = false, cur = "";
    for (const ch of s) {
      if (ch === '"' && depth === 0) { inQ = !inQ; cur += ch; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      if (ch === "," && depth === 0 && !inQ) { parts.push(cur); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    return parts.map((p) => p.trim()).filter(Boolean);
  }

  function unwrapValue(val) {
    if (!val) return val;
    // 去尾部逗号
    let v = val.replace(/,\s*$/, "").trim();
    if (v.startsWith("{") && v.endsWith("}")) {
      // 只剥最外层一层
      let depth = 0;
      for (let i = 0; i < v.length; i++) {
        if (v[i] === "{") depth++;
        else if (v[i] === "}") {
          depth--;
          if (depth === 0 && i !== v.length - 1) return v; // 内层闭合早于结尾 → 保守不剥
        }
      }
      return v.slice(1, -1).trim();
    }
    if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
      return v.slice(1, -1).trim();
    }
    return v;
  }

  // ── RIS 解析 ─────────────────────────────────────────────
  function parseRIS(text) {
    const entries = [];
    let cur = null;
    const lines = String(text).split(/\r\n|\r|\n/);

    for (const line of lines) {
      const m = line.match(/^\s*([A-Z][A-Z0-9])\s{0,2}-\s?(.*)$/);
      if (!m) continue;
      const tag = m[1].toUpperCase();
      const val = m[2].trim();
      if (tag === "TY") {
        cur = { type: RIS_TYPE_MAP[val.toUpperCase()] || "misc", key: "", fields: {}, _risType: val };
        entries.push(cur);
        continue;
      }
      if (!cur) continue;
      if (tag === "ER") { cur = null; continue; }
      if (!val) continue;
      if (!cur.fields[tag]) cur.fields[tag] = [];
      cur.fields[tag].push(val);
    }

    for (const e of entries) {
      const f = e.fields;
      const first = (t) => (f[t] && f[t][0]) || "";
      const all = (t) => (f[t] || []).join(" and ");

      e.fields = {};
      if (all("AU") || all("A1")) e.fields.author = all("AU") || all("A1");
      const title = all("TI") || all("T1");
      if (title) e.fields.title = title;
      const year = (first("PY") || first("DA") || "").match(/(?:19|20)\d{2}/);
      if (year) e.fields.year = year[0];
      const container = first("JO") || first("JF") || first("T2") || first("BT");
      if (container) {
        if (e.type === "incollection" || e.type === "inproceedings" || e.type === "book") {
          e.fields.booktitle = container;
        } else {
          e.fields.journal = container;
        }
      }
      if (first("VO")) e.fields.volume = first("VO");
      if (first("IS")) e.fields.number = first("IS");
      if (first("SP")) e.fields.pages = first("EP") ? `${first("SP")}--${first("EP")}` : first("SP");
      if (first("DO")) e.fields.doi = first("DO");
      if (all("AB") || all("N2")) e.fields.abstract = all("AB") || all("N2");
      if (first("PB")) e.fields.publisher = first("PB");
      if (first("LA")) e.fields.language = first("LA");
      e.key = makeKey(e.fields.author, e.fields.year, e.fields.title, entries.indexOf(e) + 1);
    }
    return entries;
  }

  // ── 引用键生成 ───────────────────────────────────────────
  function makeKey(author, year, title, seq) {
    let name = "";
    if (author) {
      const first = String(author).split(/\s+and\s+/i)[0].trim();
      const comma = first.indexOf(",");
      let family = comma > 0 ? first.slice(0, comma) : first.split(/\s+/).pop();
      family = family.replace(/[^\p{L}\p{N}]/gu, "");
      name = family.toLowerCase();
    }
    if (!name) {
      name = String(title || "").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 12).toLowerCase() || "ref";
    }
    const yr = (String(year || "").match(/(?:19|20)\d{2}/) || ["xxxx"])[0];
    return `${name}${yr}` + (seq ? "" : "");
  }

  // ── 修复规则（只修确定的）────────────────────────────────
  function repairDOI(v) {
    let out = String(v).trim().replace(/\s+/g, "");
    out = out.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
    out = out.replace(/^doi:\s*/i, "");
    out = out.replace(/^[<>]+|[<>]+$/g, "");
    return out;
  }
  function repairURL(v) {
    let out = String(v).trim().replace(/\s+/g, "");
    out = out.replace(/^[<>]+|[<>]+$/g, "");
    return out;
  }
  function repairYear(v) {
    const m = String(v).match(/(?:19|20)\d{2}/);
    return m ? m[0] : v;
  }
  function repairPages(v) {
    let out = String(v).trim();
    out = out.replace(/[\u2010-\u2015\u2212]/g, "-"); // 连字符类 Unicode 归一为 -
    out = out.replace(/\s*-\s*/g, "-");               // 去两端空格
    out = out.replace(/-+/g, "--");                   // 折叠为 BibTeX 的 --
    return out;
  }
  function repairAuthorNameChinese(name) {
    const tokens = String(name).trim().split(/[\s,,;;、、]+/).filter(Boolean);
    // "王 小明"/"王，小明" 等两三段纯中文 → 合并
    if (tokens.length >= 2 && tokens.every((t) => /^[\u3400-\u9fff]+$/.test(t))) {
      return tokens.join("");
    }
    return name;
  }
  function repairAuthorString(author) {
    if (!author) return author;
    const parts = String(author).split(/\s+and\s+/i);
    return parts
      .map((p) => repairAuthorNameChinese(p).replace(/\s{2,}/g, " ").trim())
      .join(" and ");
  }
  function repairTitleCaps(title) {
    if (!title) return title;
    const latinOnly = String(title).replace(/[\u3400-\u9fff\u3000-\u303f]/g, "").replace(/[^A-Za-z]/g, "");
    if (latinOnly.length >= 3 && latinOnly === latinOnly.toUpperCase()) {
      const minor = new Set(["a", "an", "the", "and", "or", "but", "for", "nor", "on",
        "in", "of", "to", "with", "by", "at", "from", "as", "is", "was", "are", "be"]);
      return String(title).replace(/[A-Za-z]+/g, (word, offset) => {
        const lower = word.toLowerCase();
        if (offset > 0 && minor.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      });
    }
    return title;
  }
  function repairKey(key, entry) {
    let out = String(key).trim();
    const before = out;
    out = out.replace(/[\s,;:]+/g, "");
    if (out !== before) return out;
    return key;
  }

  function repairEntry(entry, seq) {
    const changes = [];
    const f = { ...entry.fields };
    const record = (field, before, after, reason) => {
      if (before !== after) changes.push({ field, before: String(before), after: String(after), reason });
    };

    for (const k of ["doi", "url"]) {
      if (f[k]) {
        const fixed = k === "doi" ? repairDOI(f[k]) : repairURL(f[k]);
        record(k, f[k], fixed, k === "doi" ? "DOI 规范化（去 URL 前缀与空格）" : "URL 规范化（去空格与尖括号）");
        f[k] = fixed;
      }
    }
    if (f.year) {
      const y = repairYear(f.year);
      record("year", f.year, y, "年份取四位数字（去掉月份等）");
      f.year = y;
    }
    if (f.pages) {
      const p = repairPages(f.pages);
      record("pages", f.pages, p, "页码区间用双连字符 --");
      f.pages = p;
    }
    if (f.author) {
      const a = repairAuthorString(f.author);
      record("author", f.author, a, "中文人名合并（去分隔空格）");
      f.author = a;
    }
    if (f.title) {
      const t = repairTitleCaps(f.title);
      record("title", f.title, t, "全大写英文标题转为标题式大小写");
      f.title = t;
    }

    // 键名规范化 / 生成
    let key = entry.key;
    if (!key || !String(key).trim()) {
      key = makeKey(f.author, f.year, f.title, seq);
      if (key) changes.push({ field: "(key)", before: "（空）", after: key, reason: "生成引用键" });
    } else {
      const fixedKey = repairKey(key);
      if (fixedKey !== key) {
        changes.push({ field: "(key)", before: key, after: fixedKey, reason: "引用键含非法字符（空格/逗号）" });
        key = fixedKey;
      }
    }

    // 缺失字段警告（不补写）
    const warnings = [];
    if (!f.author) warnings.push("缺少 author 字段");
    if (!f.year) warnings.push("缺少 year 字段");
    if (!f.title) warnings.push("缺少 title 字段");

    return { type: entry.type, key, fields: f, changes, warnings };
  }

  // ── 输出格式化 ───────────────────────────────────────────
  function formatBibtex(entry) {
    const names = Object.keys(entry.fields);
    const width = Math.min(10, Math.max(...names.map((x) => x.length), 0));
    const lines = [`@${entry.type}{${entry.key},`];
    names.forEach((name, i) => {
      const pad = name.padEnd(width, " ");
      const comma = i < names.length - 1 ? "," : "";
      lines.push(`  ${pad} = {${entry.fields[name]}}${comma}`);
    });
    lines.push("}");
    return lines.join("\n");
  }

  // ── 主入口 ───────────────────────────────────────────────
  function repair(text, opts) {
    opts = opts || {};
    const detected = (opts.format && opts.format !== "auto") ? opts.format : detectFormat(text);
    if (detected === "unknown") {
      return {
        format: "unknown", entries: [], fixed: "", changes: [], warnings: [],
        error: "无法识别输入格式。请粘贴 BibTeX（@article{…}）或 RIS（TY  - … ER  -）。",
      };
    }

    let parsed;
    if (detected === "bibtex") parsed = parseBibtex(String(text));
    else parsed = parseRIS(String(text));

    if (!parsed.length) {
      return {
        format: detected, entries: [], fixed: "", changes: [], warnings: [],
        error: detected === "bibtex"
          ? "没有找到可解析的 BibTeX 条目。请确认以 @article{key, …} 等开头，花括号配对完整。"
          : "没有找到可解析的 RIS 条目。请确认包含 TY  - 与 ER  - 标签。",
      };
    }

    // 重名键去重
    const seen = new Set();
    const repaired = parsed.map((e, i) => {
      const r = repairEntry(e, i + 1);
      if (seen.has(r.key)) {
        const dedup = r.key + String.fromCharCode(97 + (i % 26));
        r.changes.push({ field: "(key)", before: r.key, after: dedup, reason: "引用键重复，自动加后缀" });
        r.key = dedup;
      }
      seen.add(r.key);
      return r;
    });

    const changes = repaired.flatMap((e, i) =>
      e.changes.map((c) => ({ entry: `#${i + 1} ${e.key}`, ...c })));
    const warnings = repaired.flatMap((e, i) =>
      e.warnings.map((w) => ({ entry: `#${i + 1} ${e.key}`, message: w })));

    return {
      format: detected,
      entries: repaired,
      fixed: repaired.map(formatBibtex).join("\n\n"),
      changes,
      warnings,
    };
  }

  global.BibFix = {
    detectFormat, parseBibtex, parseRIS, repair,
    repairDOI, repairURL, repairYear, repairPages,
    repairAuthorString, repairTitleCaps, formatBibtex, makeKey,
  };
})(globalThis);
