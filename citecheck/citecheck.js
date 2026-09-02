// citecheck.js — 引文格式解析与互转核心（纯逻辑，无 DOM；经 globalThis.CiteCheck 导出）
//
// 支持：BibTeX / RIS / APA / Chicago / MLA / GB/T 7714 互相识别，输出四种目标格式。
// 定位：规则引擎处理最常见的 80% 情形；解析不了的明确报错，绝不输出编造的字段。

((global) => {
  "use strict";

  const CJK = /[\u3400-\u9fff]/;
  const PINYIN = new Set(["wang","li","zhang","liu","chen","yang","zhao","huang","zhou","wu",
    "xu","sun","hu","zhu","gao","lin","he","guo","ma","luo","zheng","liang","song","xie",
    "han","tang","feng","yu","cao","yuan","deng","xu","fu","shen","zeng","peng","lv","su",
    "lu","jiang","cai","jia","wei","xue","ye","yan","pan","du","dai","xia","zhong","tian",
    "ren","jiang","fan","fang","shi","yao","tan","liao","zou","xiong","jin","lu","hao"]);

  // ── 作者模型 ─────────────────────────────────────────────
  // { literal } 中文/整体名；或 { family, given } 西方名
  function parseOneName(raw) {
    const s = String(raw || "").trim().replace(/^[{*]|[*}]$/g, "");
    if (!s) return null;
    if (CJK.test(s)) return { literal: s.replace(/\s+/g, "") };
    if (s.includes(",")) {
      const i = s.indexOf(",");
      return { family: s.slice(0, i).trim(), given: s.slice(i + 1).trim() };
    }
    const toks = s.split(/\s+/).filter(Boolean);
    if (toks.length === 1) return { literal: toks[0] };
    // "Zhang San" 拼音姓氏优先（中文作者的拼音）；否则末词为姓
    if (toks.length === 2 && PINYIN.has(toks[0].toLowerCase())) {
      return { family: toks[0], given: toks[1] };
    }
    return { family: toks[toks.length - 1], given: toks.slice(0, -1).join(" ") };
  }
  function parseAuthors(str, sep = /\s+and\s+/i) {
    return String(str || "").split(sep).map(parseOneName).filter(Boolean);
  }

  // APA / MLA / Chicago 文本中的作者串：Family, G. G., & Family2, G. …
  // 难点：姓名内部的逗号（Smith, J. P.）与分隔逗号无法直接区分。
  // 策略：逗号切开后，"纯缩写"片段（J. P.）并入上一个作者。
  function parseAuthorsText(str) {
    let s = String(str || "").trim().replace(/[,&]\s*$/, "").trim();
    s = s.replace(/\s*&\s*/g, ", ").replace(/\s+and\s+/gi, ", ");
    const toks = s.split(",").map((t) => t.trim()).filter(Boolean);
    const raw = [];
    for (const t of toks) {
      if (/^([A-Z]\.\s*)+[A-Z]?\.?$/.test(t) && raw.length) {
        raw[raw.length - 1] += ", " + t;   // 缩写 → 并入上一个 Family
      } else if (raw.length && /^[a-z]/.test(t) && /^[A-Z]/.test(raw[raw.length - 1])) {
        raw[raw.length - 1] += " " + t;    // 小写续词（van/der/de）
      } else {
        raw.push(t);
      }
    }
    return raw.map(parseOneName).filter(Boolean);
  }

  function initialsOf(given) {
    if (!given) return "";
    return given.split(/[\s.\-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + ".").join(" ");
  }

  // ── BibTeX 解析（括号计数）───────────────────────────────
  function parseBibtex(text) {
    const entries = [];
    let i = 0;
    const TYPES = /^(article|book|inproceedings|conference|phdthesis|mastersthesis|techreport|incollection|misc|online)$/i;
    while (true) {
      const at = text.indexOf("@", i);
      if (at === -1) break;
      const m = text.slice(at + 1).match(/^[ \t]*([A-Za-z]+)[ \t]*[({]/);
      if (!m || !TYPES.test(m[1])) { i = at + 1; continue; }
      const open = text[at + 1 + m[0].length - 1];
      const close = open === "(" ? ")" : "}";
      let depth = 0, end = -1;
      for (let p = at + 1 + m[0].length - 1; p < text.length; p++) {
        if (text[p] === open) depth++;
        else if (text[p] === close && --depth === 0) { end = p; break; }
      }
      if (end === -1) break;
      const body = text.slice(at + 1 + m[0].length, end);
      i = end;

      const comma = body.indexOf(",");
      const fields = {};
      if (comma > -1) {
        let d = 0, inQ = false, cur = "", parts = [];
        for (const ch of body.slice(comma + 1)) {
          if (ch === '"' && d === 0) inQ = !inQ;
          if (ch === "{") d++;
          else if (ch === "}") d--;
          if (ch === "," && d === 0 && !inQ) { parts.push(cur); cur = ""; continue; }
          cur += ch;
        }
        parts.push(cur);
        for (const p of parts) {
          const eq = p.indexOf("=");
          if (eq === -1) continue;
          let v = p.slice(eq + 1).trim();
          v = v.replace(/,\s*$/, "").trim();
          if (v.startsWith("{") && v.endsWith("}")) v = v.slice(1, -1);
          else if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
          fields[p.slice(0, eq).trim().toLowerCase()] = v.replace(/[{}]/g, "").trim();
        }
      }
      entries.push(bibtexToEntry(m[1].toLowerCase(), fields));
    }
    return entries;
  }

  function bibtexToEntry(type, f) {
    const e = {
      type: type === "inproceedings" || type === "conference" ? "inproceedings"
        : type === "phdthesis" || type === "mastersthesis" ? "thesis"
        : type === "techreport" ? "report"
        : type === "online" ? "webpage" : type,
      authors: parseAuthors(f.author || ""),
      title: f.title || "",
      container: f.journal || f.booktitle || "",
      publisher: f.publisher || "",
      place: f.address || "",
      year: (f.year || "").match(/(?:19|20)\d{2}/)?.[0] || "",
      volume: f.volume || "", number: f.number || "",
      pages: normalizePages(f.pages || ""),
      doi: (f.doi || "").replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, ""),
      url: f.url || "",
      edition: f.edition || "",
    };
    return e;
  }

  // ── RIS 解析 ─────────────────────────────────────────────
  const RIS_TYPES = { JOUR: "article", MAG: "article", CONF: "inproceedings", CHAP: "inproceedings",
    BOOK: "book", THES: "thesis", RPRT: "report", ELEC: "webpage", WEB: "webpage" };
  function parseRIS(text) {
    const entries = [];
    let cur = null;
    for (const line of String(text).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z][A-Z0-9])\s{0,2}-\s?(.*)$/);
      if (!m) continue;
      const [, tag, val] = m;
      if (tag === "TY") {
        cur = { type: RIS_TYPES[val.toUpperCase()] || "article", authors: [], title: "", container: "",
          publisher: "", place: "", year: "", volume: "", number: "", pages: "", doi: "", url: "", edition: "" };
        entries.push(cur);
        continue;
      }
      if (!cur) continue;
      if (tag === "ER") { cur = null; continue; }
      if (!val) continue;
      if (tag === "AU" || tag === "A1") cur.authors.push(parseOneName(val));
      else if (tag === "TI" || tag === "T1") cur.title ||= val;
      else if (["JO", "JF", "T2", "BT"].includes(tag)) cur.container ||= val;
      else if (tag === "PY" || tag === "DA") cur.year ||= val.match(/(?:19|20)\d{2}/)?.[0] || "";
      else if (tag === "VO") cur.volume ||= val;
      else if (tag === "IS") cur.number ||= val;
      else if (tag === "SP") cur.sp = val;
      else if (tag === "EP") cur.ep = val;
      else if (tag === "DO") cur.doi ||= val.replace(/^doi:\s*/i, "");
      else if (tag === "UR") cur.url ||= val;
      else if (tag === "PB") cur.publisher ||= val;
      else if (tag === "CY") cur.place ||= val;
    }
    for (const e of entries) {
      if (!e.pages && e.sp) e.pages = e.ep ? `${e.sp}-${e.ep}` : e.sp;
      e.pages = normalizePages(e.pages);
      delete e.sp; delete e.ep;
      e.authors = e.authors.filter(Boolean);
    }
    return entries;
  }

  // ── 页码规范化 ───────────────────────────────────────────
  function normalizePages(v) {
    const m = String(v).match(/(\d+)\s*[–—-]+\s*(\d+)/);
    if (m) return `${m[1]}-${m[2]}`;
    const one = String(v).match(/\d+/);
    return one ? one[0] : "";
  }
  function displayPages(p, dash) {
    return p ? String(p).replace(/-/g, dash) : "";
  }

  // ── 纯文本引文解析（APA / Chicago / MLA / GB/T，尽力而为）──
  function stripDecor(s) {
    return s.replace(/^[*_"'“”‘’\s]+|[*_"'“”‘’\s.]+$/g, "").trim();
  }

  // GB/T：靠 [J]/[M] 等类型标记锚定，最可靠
  function parseGBTLine(line) {
    const m = line.match(/^(?:\[\d+\]\s*)?(.+?)\.\s*(.+?)\[([A-Z]{1,2}(?:\/OL)?)\]\.\s*(.+?)\.?$/);
    if (!m) return null;
    const [, auth, title, typeMark, rest] = m;
    const e = blankEntry();
    e.etAl = /(?:等|et al\.?)\s*\.?\s*$/.test(auth);
    e.authors = auth.split(/,\s*/).filter((a) => a && !/^(?:等|et al\.?)$/i.test(a)).map(parseOneName).filter(Boolean);
    e.title = stripDecor(title);
    const tmap = { J: "article", M: "book", C: "inproceedings", D: "thesis", N: "article",
      R: "report", S: "misc", P: "misc", EB: "webpage" };
    e.type = tmap[typeMark.split("/")[0]] || "misc";
    if (e.type === "webpage") {
      const url = rest.match(/https?:\/\/\S+/);
      if (url) e.url = url[0];
      const ym = rest.match(/(?:19|20)\d{2}/);
      if (ym) e.year = ym[0];
      return e;
    }
    if (e.type === "article") {
      // 期刊：期刊名, 2024, 51(6): 123-138 / 期刊, 2024(6): 12-15
      const jm = rest.match(/^(.+?),\s*((?:19|20)\d{2})(?:,\s*(\d+))?\s*(?:\((\d+)\))?\s*(?::\s*([\d–—-]+))?/);
      if (jm) {
        e.container = stripDecor(jm[1]);
        e.year = jm[2];
        e.volume = jm[3] || "";
        e.number = jm[4] || "";
        e.pages = jm[5] ? normalizePages(jm[5]) : "";
        return e;
      }
    } else {
      // 图书/学位论文：出版地: 出版社, 2020
      const bm = rest.match(/^(?:(.+?):\s*)?(.+?),\s*((?:19|20)\d{2})/);
      if (bm) {
        e.place = stripDecor(bm[1] || "");
        e.publisher = stripDecor(bm[2]);
        e.year = bm[3];
        return e;
      }
    }
    e.year = rest.match(/(?:19|20)\d{2}/)?.[0] || "";
    e.container = stripDecor(rest);
    return e;
  }

  // APA：靠 "(year)." 锚定作者/标题边界
  function parseAPALine(line) {
    const s = line.trim();
    const ym = s.match(/\((\d{4})\)/);
    if (!ym) return null;
    const e = blankEntry();
    e.year = ym[1];
    e.authors = parseAuthorsText(s.slice(0, ym.index));
    let rest = s.slice(ym.index + ym[0].length).replace(/^[\s.]+/, "");
    // DOI 尾巴
    const doi = rest.match(/(?:https?:\/\/doi\.org\/|doi:)\s*(10\.\S+?)[.\s]*$/i);
    if (doi) { e.doi = doi[1].replace(/[.,]$/, ""); rest = rest.slice(0, doi.index).trim(); }
    const url = rest.match(/https?:\/\/(?!doi\.org)\S+$/);
    if (url) { e.url = url[0].replace(/[.,]$/, ""); rest = rest.slice(0, url.index).trim(); }

    // 期刊：Title. Journal, 12(3), 45–59. （卷(期)锚点）
    const jm = rest.match(/^(.+?)\.\s*(.+?),\s*(\d+)\s*\((\d+)\)\s*,\s*([\d–—-]+)/);
    if (jm && !/^(?:vol|no|pp)/i.test(jm[3])) {
      e.type = "article";
      e.title = stripDecor(jm[1]);
      e.container = stripDecor(jm[2]);
      e.volume = jm[3];
      e.number = jm[4];
      e.pages = normalizePages(jm[5]);
      return e;
    }
    // 无卷期：标题. 容器, … （可能是报纸/杂志）或图书 Title. Publisher.
    const parts = rest.split(/\.\s+/);
    if (parts.length >= 2) {
      e.title = stripDecor(parts[0]);
      const tail = parts.slice(1).join(". ");
      // 图书：Publisher, 年 已被去掉；试探 ed./Vol. 标记
      if (/\bed\.|\bVol\.|第.+版/.test(tail) || !/,/.test(tail)) {
        e.type = "book";
        const pm = tail.match(/^(.*?)(?:,\s*|\s)+((?:19|20)\d{2})?$/);
        e.publisher = stripDecor(pm ? pm[1] : tail);
      } else {
        e.type = "article";
        const cm = tail.match(/^(.+?),\s*(?:(\d+)\s*\((\d+)\)\s*,?\s*)?((?:19|20)\d{2})?/);
        e.container = stripDecor(cm ? cm[1] : tail);
        if (cm) { if (cm[2]) e.volume = cm[2]; if (cm[3]) e.number = cm[3]; }
      }
    } else {
      e.title = stripDecor(rest);
      e.type = "book";
    }
    return e;
  }

  // MLA / Chicago 文本的作者段：作者之间只用 and / & 分隔，
  // 段内逗号必是 Family, Given —— 按 and/& 切段最可靠。
  function parseAuthorsQuoted(str) {
    const s = String(str || "").trim().replace(/[.,\s]+$/, "");
    return s.split(/\s*,?\s*(?:\band\b|&)\s*,?\s*/i)
      .filter(Boolean)
      .map(parseOneName)
      .filter(Boolean);
  }

  // MLA / Chicago：靠 "Title." 引号锚定
  function parseQuotedLine(line) {
    const s = line.trim();
    const qm = s.match(/[“"]([^”"]+)[”"]\s*[.,]?\s*/);
    if (!qm) return null;
    const e = blankEntry();
    e.title = qm[1].replace(/\.\s*$/, "").trim();

    // Chicago 作者-年份：作者. 2020. "Title." —— 年份夹在作者与标题之间
    const isChicago = /\((?:19|20)\d{2}\)\s*:/.test(s.slice(qm.index)) ||
      /\.\s*(?:19|20)\d{2}\.\s*["“]/.test(s);
    let head = s.slice(0, qm.index);
    if (isChicago) {
      const ym = head.match(/\.\s*((?:19|20)\d{2})\.?\s*$/);
      if (ym) { e.year = ym[1]; head = head.slice(0, ym.index); }
    }
    e.authors = parseAuthorsQuoted(head);
    let rest = s.slice(qm.index + qm[0].length).trim();

    const doi = rest.match(/(?:https?:\/\/doi\.org\/|doi:)\s*(10\.\S+?)[.\s]*$/i);
    if (doi) { e.doi = doi[1].replace(/[.,]$/, ""); rest = rest.slice(0, doi.index).trim(); }
    rest = rest.replace(/\.\s*$/, "").trim();

    const isMLA = /\bvol\.\s*\d+|\bpp?\.\s*\d+/i.test(rest);

    if (isMLA) {
      // MLA 期刊：Journal, vol. 12, no. 3, 2023, pp. 45-59.
      e.type = "article";
      const jm = rest.match(/^(.+?),\s*vol\.\s*(\d+)\s*,\s*no\.\s*(\d+)\s*,\s*((?:19|20)\d{2})\s*,\s*pp?\.\s*([\d–—-]+)/i);
      if (jm) {
        e.container = stripDecor(jm[1]); e.volume = jm[2]; e.number = jm[3];
        e.year = jm[4]; e.pages = normalizePages(jm[5]);
      } else {
        // MLA 图书：Publisher, 2020. / Place: Publisher, 2020.
        e.type = "book";
        const bm = rest.match(/^(?:(.+?):\s*)?(.+?),\s*((?:19|20)\d{2})/);
        if (bm) { e.place = stripDecor(bm[1] || ""); e.publisher = stripDecor(bm[2]); e.year = bm[3]; }
        else e.publisher = stripDecor(rest);
      }
      return e;
    }
    // Chicago 作者-年份：Journal 12, no. 3 (2023): 45–59. 或 Journal 12 (2023): 45–59.
    const cm = rest.match(/^(.+?)\s+(\d+)\s*,\s*no\.\s*(\d+)\s*\(((?:19|20)\d{2})\)\s*:\s*([\d–—-]+)/);
    if (cm) {
      e.type = "article";
      e.container = stripDecor(cm[1]); e.volume = cm[2]; e.number = cm[3];
      e.year = cm[4]; e.pages = normalizePages(cm[5]);
      return e;
    }
    const cm2 = rest.match(/^(.+?)\s+(\d+)\s*\(((?:19|20)\d{2})\)\s*:\s*([\d–—-]+)$/);
    if (cm2) {
      e.type = "article";
      e.container = stripDecor(cm2[1]); e.volume = cm2[2]; e.year = cm2[3];
      e.pages = normalizePages(cm2[4]);
      return e;
    }
    // Chicago 变体：Journal 126 (2): 310-345（年份在作者后）
    const cm3 = rest.match(/^(.+?)\s+(\d+)\s*\((\d+)\)\s*:\s*([\d–—-]+)$/);
    if (cm3) {
      e.type = "article";
      e.container = stripDecor(cm3[1]); e.volume = cm3[2]; e.number = cm3[3];
      e.pages = normalizePages(cm3[4]);
      return e;
    }
    if (isChicago) {
      // 年份在作者后：Author. 2020. "Title." Place: Publisher. / "Title." Journal 12 (2023): 45–59.
      e.type = "book";
      const bm = rest.match(/^(?:(.+?):\s*)?(.+?)(?:,\s*(?:19|20)\d{2})?\.?$/);
      if (bm) { e.place = stripDecor(bm[1] || ""); e.publisher = stripDecor(bm[2]); }
      return e;
    }
    // 兜底：容器. 期刊名, 2023, 12(3), 45-59（APA 变体）
    const fm = rest.match(/^(.+?)\.\s*(.+?),\s*(?:(\d+)(?:\((\d+)\))?\s*,\s*)?((?:19|20)\d{2})?\s*,?\s*([\d–—-]+)?/);
    if (fm) {
      e.type = "article";
      e.container = stripDecor(fm[1]);
      if (fm[3]) e.volume = fm[3];
      if (fm[4]) e.number = fm[4];
      e.year = fm[5] || e.year || "";
      if (fm[6]) e.pages = normalizePages(fm[6]);
      return e;
    }
    return null;
  }

  function blankEntry() {
    return { type: "article", authors: [], etAl: false, title: "", container: "", publisher: "", place: "",
      year: "", volume: "", number: "", pages: "", doi: "", url: "", edition: "" };
  }

  // ── 格式识别 ─────────────────────────────────────────────
  function detectFormat(text) {
    const s = String(text).trim();
    if (!s) return "empty";
    if (/^@\s*\w+\s*[({]/m.test(s)) return "bibtex";
    if (/^\s*TY\s{1,2}-/m.test(s)) return "ris";
    const first = s.split(/\r?\n/).find((l) => l.trim()) || "";
    if (/\[[JMCDNRSEP]|EB\/OL\]/.test(first)) return "gbt";
    if (/[“"][^”"]+[”"]/.test(first)) {
      if (/\bvol\.\s*\d+|\bpp?\.\s*\d+/i.test(first)) return "mla";
      if (/\((?:19|20)\d{2}\)\s*:|[\s.](?:19|20)\d{2}\.\s*["“]/.test(first)) return "chicago";
      return "mla";
    }
    if (/\((?:19|20)\d{2}\)/.test(first)) return "apa";
    return "unknown";
  }

  // ── 统一解析入口 ─────────────────────────────────────────
  function parseText(text) {
    const s = String(text).trim();
    // 按空行/编号分段：文本格式一行一条
    const lines = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (detectFormat(s) === "bibtex") return parseBibtex(s);
    if (detectFormat(s) === "ris") return parseRIS(s);

    const entries = [];
    for (const line of lines) {
      let e = parseGBTLine(line) || parseQuotedLine(line) || parseAPALine(line);
      if (!e) {
        // 最后兜底：句号分段猜测
        const parts = line.split(/\.\s+/);
        if (parts.length >= 3) {
          e = blankEntry();
          e.authors = parseAuthors(parts[0]);
          e.title = stripDecor(parts[1]);
          const tail = parts.slice(2).join(". ");
          const ym = tail.match(/(?:19|20)\d{2}/);
          e.year = ym ? ym[0] : "";
          e.container = stripDecor(tail.replace(ym ? ym[0] : "____", ""));
        }
      }
      if (e && (e.title || e.authors.length)) entries.push(e);
      else entries.push({ error: `无法解析：${line.slice(0, 50)}${line.length > 50 ? "…" : ""}` });
    }
    return entries;
  }

  // ── 输出格式化 ───────────────────────────────────────────
  function fmtAuthorsAPA(authors, etAl) {
    const parts = authors.map((a) =>
      a.literal ? a.literal : [a.family, initialsOf(a.given)].filter(Boolean).join(", "));
    if (parts.length === 0) return "";
    if (etAl) return parts.join(", ") + ", et al";
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(", ") + ", & " + parts[parts.length - 1];
  }
  function fmtAuthorsChicago(authors, etAl) {
    const parts = authors.map((a) =>
      a.literal ? a.literal : [a.family, a.given].filter(Boolean).join(", "));
    if (parts.length === 0) return "";
    if (etAl) return parts.join(", ") + ", et al";
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
  }
  const noDot = (s) => String(s || "").replace(/\.$/, "");
  function fmtAuthorsMLA(authors) {
    const parts = authors.map((a) =>
      a.literal ? a.literal : [a.family, a.given].filter(Boolean).join(", "));
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts[0] + " and " + parts[1];
    return parts[0] + ", et al";
  }
  function fmtAuthorsGBT(authors) {
    const parts = authors.slice(0, 3).map((a) => {
      if (a.literal) return a.literal;
      const fam = a.family.toUpperCase();
      const ini = (a.given || "").replace(/[^A-Za-z\s]/g, "").split(/\s+/).filter(Boolean)
        .map((w) => w[0].toUpperCase()).join(" ");
      return ini ? `${fam} ${ini}` : fam;
    });
    if (authors.length > 3) parts.push(CJK.test(authors[0].literal || authors[0].family || "") ? "等" : "et al");
    return parts.join(", ");
  }

  function fmtDoiAPA(doi) { return doi ? `https://doi.org/${doi}` : ""; }
  function fmtDoiGBT(doi) { return doi ? `DOI:${doi}.` : ""; }

  function formatAPA(e) {
    const p = displayPages(e.pages, "–");
    if (e.type === "article") {
      return [`${fmtAuthorsAPA(e.authors, e.etAl)} (${e.year}). ${e.title}. ${e.container}${e.volume ? `, ${e.volume}` : ""}${e.number ? `(${e.number})` : ""}${p ? `, ${p}` : ""}.`,
        fmtDoiAPA(e.doi)].filter(Boolean).join(" ");
    }
    if (e.type === "thesis") {
      const kind = "Doctoral dissertation";
      return `${fmtAuthorsAPA(e.authors, e.etAl)} (${e.year}). ${e.title} [${kind}${e.publisher ? ", " + e.publisher : ""}].`;
    }
    if (e.type === "inproceedings") {
      return [`${fmtAuthorsAPA(e.authors, e.etAl)} (${e.year}). ${e.title}. In ${e.container}${p ? ` (pp. ${p})` : ""}.`,
        e.publisher, fmtDoiAPA(e.doi)].filter(Boolean).join(". ");
    }
    if (e.type === "webpage") {
      return `${fmtAuthorsAPA(e.authors, e.etAl)} (${e.year}). ${e.title}. ${e.container ? e.container + ". " : ""}${e.url || fmtDoiAPA(e.doi)}`.trim();
    }
    // book / report
    return [`${fmtAuthorsAPA(e.authors, e.etAl)} (${e.year}). ${e.title}${e.edition ? ` (${e.edition} ed.)` : ""}.`,
      e.publisher ? e.publisher + "." : "", fmtDoiAPA(e.doi)]
      .filter(Boolean).join(" ");
  }

  function formatChicago(e) {
    const p = displayPages(e.pages, "–");
    const auth = noDot(fmtAuthorsChicago(e.authors, e.etAl));
    if (e.type === "article") {
      return [`${auth}. ${e.year}. "${e.title}" ${e.container}${e.volume ? ` ${e.volume}` : ""}${e.number ? `, no. ${e.number}` : ""}${p ? `: ${p}` : ""}.`,
        fmtDoiAPA(e.doi)].filter(Boolean).join(" ");
    }
    if (e.type === "thesis") {
      return `${auth}. "${e.title}" PhD diss.${e.publisher ? `, ${e.publisher}` : ""}${e.year ? `, ${e.year}` : ""}.`;
    }
    if (e.type === "inproceedings") {
      return `${auth}. "${e.title}" In ${e.container}${p ? `, ${p}` : ""}${e.place ? `. ${e.place}` : ""}${e.publisher ? `: ${e.publisher}` : ""}${e.year ? `, ${e.year}` : ""}.`;
    }
    if (e.type === "webpage") {
      return `${auth}. "${e.title}"${e.container ? ` ${e.container}.` : ""}${e.year ? ` ${e.year}.` : ""}${e.url ? ` ${e.url}.` : ""}`.trim();
    }
    return [`${auth}. ${e.year}. ${e.title}.`,
      e.place ? `${e.place}: ${e.publisher}` : e.publisher, fmtDoiAPA(e.doi)]
      .filter(Boolean).join(" ").replace(/([^.\d])$/, "$1.");
  }

  function formatMLA(e) {
    const p = displayPages(e.pages, "–");
    const auth = noDot(fmtAuthorsMLA(e.authors));
    if (e.type === "article") {
      return [`${auth}. "${e.title}" ${e.container}${e.volume ? `, vol. ${e.volume}` : ""}${e.number ? `, no. ${e.number}` : ""}${e.year ? `, ${e.year}` : ""}${p ? `, pp. ${p}` : ""}.`,
        fmtDoiAPA(e.doi)].filter(Boolean).join(" ");
    }
    if (e.type === "thesis") {
      return `${auth}. "${e.title}"${e.publisher ? ` ${e.publisher},` : ""}${e.year ? ` ${e.year}.` : ""}`;
    }
    if (e.type === "inproceedings") {
      return `${auth}. "${e.title}" ${e.container}${e.year ? `, ${e.year}` : ""}${p ? `, pp. ${p}` : ""}.`;
    }
    if (e.type === "webpage") {
      return `${auth}. "${e.title}"${e.container ? ` ${e.container},` : ""}${e.year ? ` ${e.year},` : ""}${e.url || fmtDoiAPA(e.doi) ? ` ${e.url || fmtDoiAPA(e.doi)}.` : ""}`.trim();
    }
    const loc = e.place ? `${e.place}: ${e.publisher}` : e.publisher;
    let out = [`${auth}. ${e.title}.`, loc].filter(Boolean).join(" ");
    if (e.year) out += (loc ? "," : "") + ` ${e.year}.`;
    return out;
  }

  function formatGBT(e) {
    const p = displayPages(e.pages, "-");
    const typeMark = e.type === "article" ? "J" : e.type === "book" ? "M"
      : e.type === "inproceedings" ? "C" : e.type === "thesis" ? "D"
      : e.type === "report" ? "R" : e.type === "webpage" ? "EB/OL" : "Z";
    const auth = fmtAuthorsGBT(e.authors);
    if (e.type === "webpage") {
      return `${auth ? auth + ". " : ""}${e.title}[EB/OL].${e.year ? ` (${e.year.slice(0, 4)}-01-01)` : ""}${e.url ? ` ${e.url}` : ""}.`;
    }
    if (e.type === "article") {
      return [`${auth ? auth + ". " : ""}${e.title}[J]. ${e.container}, ${e.year}${e.volume ? `, ${e.volume}` : ""}${e.number ? `(${e.number})` : ""}${p ? `: ${p}` : ""}.`,
        fmtDoiGBT(e.doi)].filter(Boolean).join(" ");
    }
    if (e.type === "thesis") {
      return `${auth ? auth + ". " : ""}${e.title}[D]. ${e.place ? e.place + ": " : ""}${e.publisher || ""}${e.year ? `, ${e.year}` : ""}.`;
    }
    if (e.type === "inproceedings") {
      return `${auth ? auth + ". " : ""}${e.title}[C]//${e.container}${p ? `: ${p}` : ""}${e.year ? `, ${e.year}` : ""}.`;
    }
    return [`${auth ? auth + ". " : ""}${e.title}[${typeMark}]. ${e.edition ? e.edition + ". " : ""}${e.place ? e.place + ": " : ""}${e.publisher || ""}${e.year ? `, ${e.year}` : ""}.`,
      fmtDoiGBT(e.doi)].filter(Boolean).join(" ");
  }

  // ── 主入口 ───────────────────────────────────────────────
  function convert(text) {
    const s = String(text || "");
    if (!s.trim()) return { format: "empty", entries: [], outputs: [] };
    const format = detectFormat(s);
    let entries;
    try {
      entries = parseText(s);
    } catch (err) {
      return { format, entries: [], outputs: [], error: "解析失败：" + err.message };
    }
    if (!entries.length) {
      return { format, entries: [], outputs: [],
        error: "未能识别引文。支持粘贴：BibTeX、RIS、或一条 APA / Chicago / MLA / GB/T 格式的引文文本。" };
    }
    const outputs = entries.map((e) => e.error ? { error: e.error } : {
      apa: formatAPA(e), chicago: formatChicago(e), mla: formatMLA(e), gbt: formatGBT(e),
    });
    return { format, entries, outputs };
  }

  global.CiteCheck = {
    detectFormat, parseText, convert,
    parseBibtex, parseRIS,
    formatAPA, formatChicago, formatMLA, formatGBT,
    normalizePages,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.CiteCheck;
})(typeof globalThis !== "undefined" ? globalThis : this);
