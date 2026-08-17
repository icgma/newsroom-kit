// scipdf.js — 论文 PDF 元数据提取核心（纯逻辑，无 DOM、无 pdf.js 依赖）
// 经 globalThis.SciPDF 导出。
//
// 定位：启发式提取（标题/作者/DOI/摘要/期刊卷期页），结果必须人工核对。
// pdf.js 的文本项（textContent.items）由调用方传入 buildLines() 重建行结构，
// 避免把整页 join 成一行后丢失排版信息。

((global) => {
  "use strict";

  const DOI_RE = /\b(10\.\d{4,9}\/[^\s"'<>&,;]+?)(?=[\s"'<>&,;]|$)/g;
  const YEAR_RE = /(?:19|20)\d{2}/;

  const TITLE_PREFIXES = /^(?:research article|original article|article|review|letter|communication|rapid communication|short communication|case report|clinical case|chapter|book chapter|preface|editorial|introduction|conclusion|abstract|keywords|key words|摘要|关键词|引言|前言|绪论|结论)\s*[:：—–-]\s*/i;

  const ABSTRACT_RE = /^(?:abstract|摘\s*要|内容提要|要旨|synopsis|summary)\s*[:：]?\s*/i;
  const ABSTRACT_END_RE = /^(?:keywords?|关键词|key words|关键字|introduction|引言|前言|1[\.\s]|methods?|方法|results?|结果|discussion|讨论|conclusion[s]?|结论|references?|参考文献|acknowledg)/i;

  // ── pdf.js 文本项 → 行数组 ───────────────────────────────
  // item.hasEOL 为 pdf.js ≥2.x 提供；旧版本退化为按 y 坐标分组。
  function buildLines(items) {
    const lines = [];
    let cur = "";
    let lastY = null;
    for (const it of items) {
      if (typeof it.str !== "string") continue;
      cur += it.str;
      const y = it.transform ? it.transform[5] : null;
      const eol = it.hasEOL === true || (it.hasEOL === undefined && y !== null && lastY !== null && Math.abs(y - lastY) > 2);
      if (eol) {
        lines.push(cur.trim());
        cur = "";
      }
      lastY = y;
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines.filter(Boolean);
  }

  // ── DOI ──────────────────────────────────────────────────
  function extractDOI(text) {
    DOI_RE.lastIndex = 0;
    const m = DOI_RE.exec(text);
    if (!m) return "";
    return m[1].replace(/[.,;:)\]]+$/, "");
  }

  // ── 年份 ─────────────────────────────────────────────────
  // 优先取版权/出版标记旁的年份；否则取首页出现频次最高的年份
  // （避免“收稿 2021 / 出版 2023”取错）。
  function extractYear(text) {
    const marked = text.match(/(?:©|\(c\)|copyright|published\s+(?:online\s+)?|accept(?:ed)?\s*:?\s*(?:(?:19|20)\d{2}\s*[-/]\s*)?)\D{0,12}((?:19|20)\d{2})/i);
    if (marked) return marked[1];

    const years = text.match(/(?:19|20)\d{2}/g) || [];
    if (!years.length) return "";
    const freq = {};
    for (const y of years) freq[y] = (freq[y] || 0) + 1;
    return years.sort((a, b) => freq[b] - freq[a] || years.indexOf(b) - years.indexOf(a))[0];
  }

  // ── 摘要 ─────────────────────────────────────────────────
  function extractAbstract(lines) {
    const out = [];
    let inAbs = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (!inAbs) {
        if (ABSTRACT_RE.test(line)) {
          inAbs = true;
          const rest = line.replace(ABSTRACT_RE, "");
          if (rest) out.push(rest);
        }
        continue;
      }
      if (ABSTRACT_END_RE.test(line) && out.length) break;
      out.push(line);
      if (out.join(" ").length > 2500) break;
    }
    let abs = out.join(" ").replace(/\s{2,}/g, " ").trim();
    if (abs.length > 2000) abs = abs.slice(0, 2000) + "…";
    return abs;
  }

  // ── 标题 ─────────────────────────────────────────────────
  function isCitationLike(line) {
    if (/(?:19|20)\d{2}/.test(line) && /\d{1,3}\s*\(\d{1,3}\)/.test(line)) return true;
    if (/《.+》/.test(line) && /(?:19|20)\d{2}/.test(line)) return true;
    if (/^doi:/i.test(line)) return true;
    return false;
  }

  const TITLE_SKIP = [
    /^journal\s+of\s+/i, /^frontiers\s+in\s+/i, /^plos\s+/i,
    /^doi:/i, /^(?:vol\.?|volume|issue|no\.?|pp\.?|pages)\s*\d/i,
    /^(?:19|20)\d{2}\s*$/, /^ISSN/i, /^ISBN/i,
    /^(?:https?:\/\/|www\.)/i, /^(?:copyright|©|all rights reserved)/i,
    /^(?:received|accepted|published|available online|available\s)/i,
    /^(?:january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /^(?:research|original|review)\s+article$/i, /^article$/i,
    /^(?:abstract|摘\s*要|内容提要)/i,
    /^\d+$/, /^第?\s*\d+\s*(卷|期|页)?\s*$/,
  ];

  function isTitleCandidate(line) {
    if (!line || line.length < 6 || line.length > 300) return false;
    if (TITLE_SKIP.some((re) => re.test(line))) return false;
    if (isCitationLike(line)) return false;
    if (DOI_RE.test(line) && line.length < 60) { DOI_RE.lastIndex = 0; return false; }
    if (/^[a-zA-Z0-9._%+-]+@/.test(line)) return false;
    if (/^[\d\s.,;:()\-–—]+$/.test(line)) return false;
    return true;
  }

  function extractTitle(lines) {
    const candidates = [];
    for (let i = 0; i < Math.min(lines.length, 50); i++) {
      const line = lines[i].trim();
      if (!isTitleCandidate(line)) continue;
      candidates.push({ text: line, index: i, score: scoreTitle(line, i) });
      if (candidates.length >= 6) break;
    }
    if (!candidates.length) return "";
    candidates.sort((a, b) => b.score - a.score);
    let title = candidates[0].text.replace(TITLE_PREFIXES, "").trim();

    // 跨行标题：以冒号/破折号结尾且下一行仍是合格候选 → 合并副标题
    const nextLine = (lines[candidates[0].index + 1] || "").trim();
    if (/[:：—-]$/.test(title) && isTitleCandidate(nextLine)
        && !/^(?:abstract|摘要|keywords?|关键词)/i.test(nextLine)) {
      title = title.replace(/[:：]\s*$/, ": ") + nextLine;
    }
    return title;
  }

  function scoreTitle(line, index) {
    let s = 0;
    if (index >= 1 && index <= 14) s += 30;
    else if (index < 1) s += 18;
    if (/[A-Z]/.test(line) && /[a-z]/.test(line)) s += 20;
    if (line === line.toUpperCase() && /[A-Z]{5,}/.test(line)) s -= 12; // 大写栏目头
    if (line.length >= 18 && line.length <= 200) s += 15;
    if (!/[.;]$/.test(line)) s += 10;
    const words = line.split(/\s+/).length;
    if (words >= 4 && words <= 30) s += 15;
    if (/@/.test(line)) s -= 20;
    if (/[\u3400-\u9fff]/.test(line)) s += 12; // 中文论文
    if (/[。！？!?]$/.test(line)) s -= 12;      // 句号结尾是句子，不是标题
    if (/^(?:university|department|school|institute|college)/i.test(line)) s -= 25;
    return s;
  }

  // ── 作者 ─────────────────────────────────────────────────
  function extractAuthors(lines, title) {
    // 标题可能由多行合并而成：取首段（冒号前）反查起始行
    const firstSeg = title.split(/[:：]/)[0].trim().slice(0, 20);
    const titleIdx = firstSeg
      ? lines.findIndex((l) => l.includes(firstSeg))
      : lines.findIndex((l) => l.trim() === title);
    const start = titleIdx >= 0 ? titleIdx + 1 : 0;

    for (let i = start; i < Math.min(lines.length, start + 12); i++) {
      const line = lines[i].trim();
      if (!line || line.length < 3) continue;
      if (line === title) continue;
      if (title && title.includes(line)) continue; // 跨行标题的其余片段
      if (/^(?:abstract|摘要|introduction|引言|keywords?|关键词)/i.test(line)) break;
      if (/^(?:department|faculty|school|college|university|institute|实验室|学院|大学|研究所|院系)/i.test(line)) continue;
      if (DOI_RE.test(line) && line.length < 60) { DOI_RE.lastIndex = 0; continue; }
      if (/^[a-zA-Z0-9._%+-]+@/.test(line)) continue;

      const cleaned = cleanAuthorLine(line);
      if (isValidAuthorLine(cleaned)) return cleaned;
    }
    return "";
  }

  function cleanAuthorLine(line) {
    let out = line;
    out = out.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, "");
    // 上标编号：汉字/字母后跟 1-3 位数字（王晓明1、Li2）
    out = out.replace(/(\p{L})\d{1,3}(?=[,，;；、]|\s|$)/gu, "$1");
    out = out.replace(/(?:[,，]\s*\d{1,3})+(?=[,，;；]|\s|$)/g, "");
    out = out.replace(/[*†‡§¶]/g, "");
    out = out.replace(/\s+et\s+al\.?/gi, "");
    out = out.replace(/\s{2,}/g, " ").trim();
    out = out.replace(/^[,，;；\s]+|[,，;；\s]+$/g, "");
    return out;
  }

  function isValidAuthorLine(line) {
    if (!line || line.length < 3) return false;
    if (!/[a-zA-Z\u3400-\u9fff]/.test(line)) return false;
    const words = line.split(/[,，;；\s]+/).filter(Boolean);
    if (words.length > 20) return false;
    if (/\b(?:the|this|we|our|study|results?|show|found|method|using|based|through|analysis|investigation|university|department)\b/i.test(line) && words.length > 6) return false;
    if (/[,，]/.test(line) || /\band\b/i.test(line) || /、/.test(line)) return true;
    return words.length >= 1 && words.length <= 6;
  }

  // ── 引用行（期刊·卷(期)·页码）───────────────────────────
  // 依次尝试完整模式；字段可来自不同行（如期刊名一行、Vol. 12, No. 3 一行）
  function parseCitationLine(lines) {
    const out = { journal: "", volume: "", number: "", pages: "" };

    for (const raw of lines.slice(0, 45)) {
      const line = raw.trim();
      let m;

      // 英文：Journal of X, 12(3), 45-59（卷号不能是年份的一部分）
      m = line.match(/^(.{4,80}?),\s*(?!(?:19|20)\d{2})(\d{1,3})\s*\((\d{1,3})\)\s*,?\s*(\d{1,5})\s*[–—-]\s*(\d{1,5})$/);
      if (m && !/(?:19|20)\d{2}/.test(m[1])) {
        out.journal = m[1].replace(/[.,;]$/, "").trim();
        out.volume = m[2]; out.number = m[3]; out.pages = `${m[4]}--${m[5]}`;
        return out;
      }
      // 英文变体：Journal of X 12(3): 45-59（无逗号）
      m = line.match(/^(.{4,80}?)\s+(?!(?:19|20)\d{2})(\d{1,3})\s*\((\d{1,3})\)\s*:?\s*(\d{1,5})\s*[–—-]\s*(\d{1,5})$/);
      if (m && !/(?:19|20)\d{2}/.test(m[1])) {
        out.journal = m[1].replace(/[.,;]$/, "").trim();
        out.volume = m[2]; out.number = m[3]; out.pages = `${m[4]}--${m[5]}`;
        return out;
      }
      // 英文变体：Journal, vol. 12, no. 3, pp. 45-59
      m = line.match(/^(.{4,80}?)[,.]?\s*vol\.?\s*(\d{1,3})[,.]?\s*(?:no\.?|iss\.?)\s*(\d{1,3})[,.]?\s*pp?\.?\s*(\d{1,5})\s*[–—-]\s*(\d{1,5})$/i);
      if (m) {
        out.journal = m[1].replace(/[.,;]$/, "").trim();
        out.volume = m[2]; out.number = m[3]; out.pages = `${m[4]}--${m[5]}`;
        return out;
      }
      // 中文：《期刊名》2024 年第 12 卷第 6 期 / 期刊名, 2024, 40(6): 123-128
      m = line.match(/《(.{2,40})》.*?(?:19|20)\d{2}\s*年.*?第\s*(\d+)\s*卷?\s*第\s*(\d+)\s*期/);
      if (m) {
        out.journal = m[1]; out.volume = m[2]; out.number = m[3];
        return out;
      }
      m = line.match(/^《?([\u3400-\u9fff][\u3400-\u9fff\w\s]{1,30})》?,\s*(?:19|20)\d{2},\s*(\d{1,3})\s*\((\d{1,3})\)\s*:?\s*(\d{1,5})\s*[–—-]\s*(\d{1,5})/);
      if (m) {
        out.journal = m[1].trim();
        out.volume = m[2]; out.number = m[3]; out.pages = `${m[4]}--${m[5]}`;
        return out;
      }
    }

    // 分散字段：独立的 Vol/No 行、pp. 行、期刊名行
    for (const raw of lines.slice(0, 45)) {
      const line = raw.trim();
      let m;
      if (!out.volume && (m = line.match(/^(?:vol\.?|volume)\s*(\d{1,3})[,.]?\s*(?:no\.?|iss\.?|issue)\s*(\d{1,3})/i))) {
        out.volume = m[1]; out.number = m[2];
      }
      if (!out.volume && (m = line.match(/^(?:vol\.?|volume)\s*(\d{1,3})$/i))) {
        out.volume = m[1];
      }
      if (!out.pages && (m = line.match(/^(?:pp?\.?|pages?)\s*(\d{1,5})\s*[–—-]\s*(\d{1,5})$/i))) {
        out.pages = `${m[1]}--${m[2]}`;
      }
    }
    return out;
  }

  // ── 引用键 ───────────────────────────────────────────────
  function splitAuthors(authorStr) {
    if (!authorStr) return [];
    return authorStr
      .split(/[,，;；、]\s*|\s+and\s+/i)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
  }

  function citeKey(authors, year, title) {
    const list = splitAuthors(authors);
    let name = "ref";
    if (list.length) {
      const first = list[0];
      if (/[\u3400-\u9fff]/.test(first)) {
        name = first.replace(/[\s、，,]+/g, "");
      } else {
        const comma = first.indexOf(",");
        if (comma > 0) {
          name = first.slice(0, comma).trim().toLowerCase().replace(/[^a-z]/g, "");
        } else {
          const parts = first.trim().split(/\s+/);
          const PINYIN = ["wang","li","zhang","liu","chen","yang","zhao","huang","zhou","wu","xu","sun","hu","zhu","gao","lin","he","guo","ma","luo","zheng","liang","song","xie","han","tang","feng","yu","dong","duan"];
          if (parts.length === 2 && PINYIN.includes(parts[0].toLowerCase())) name = parts[0].toLowerCase();
          else name = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, "");
        }
      }
    }
    if (!name) name = String(title || "").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 12).toLowerCase() || "ref";
    return `${name}${(String(year || "").match(/(?:19|20)\d{2}/) || ["xxxx"])[0]}`;
  }

  // ── BibTeX / CSL-JSON ────────────────────────────────────
  const FIELD_ORDER = ["title", "author", "year", "journal", "booktitle", "volume", "number", "pages", "doi", "url", "abstract"];

  function toBibtex(meta) {
    const key = citeKey(meta.authors, meta.year, meta.title);
    const type = meta.type || "article";
    const lines = [`@${type}{${key},`];
    const used = FIELD_ORDER.filter((f) => meta[f] && String(meta[f]).trim());
    used.forEach((f, i) => {
      const comma = i < used.length - 1 ? "," : "";
      lines.push(`  ${f.padEnd(8, " ")} = {${String(meta[f]).trim()}}${comma}`);
    });
    lines.push("}");
    return { key, bibtex: lines.join("\n") };
  }

  function toCSLJSON(meta) {
    const authors = splitAuthors(meta.authors).map((name) => {
      if (/[\u3400-\u9fff]/.test(name)) return { literal: name };
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(" ") };
      return { literal: name };
    });
    const item = {
      type: meta.type === "inproceedings" ? "paper-conference"
        : meta.type === "book" ? "book"
        : meta.type === "phdthesis" || meta.type === "mastersthesis" ? "thesis"
        : "article-journal",
      title: meta.title || "",
      author: authors,
    };
    if (meta.year) item.issued = { "date-parts": [[parseInt(meta.year, 10) || meta.year]] };
    if (meta.journal) item["container-title"] = meta.journal;
    if (meta.volume) item.volume = meta.volume;
    if (meta.number) item.issue = meta.number;
    if (meta.pages) item.page = meta.pages.replace("--", "-");
    if (meta.doi) item.DOI = meta.doi;
    if (meta.abstract) item.abstract = meta.abstract;
    return [item];
  }

  // ── 主入口 ───────────────────────────────────────────────
  function extractMetadata(lines, fullText) {
    const text = fullText ?? lines.join("\n");
    const title = extractTitle(lines);
    const authors = extractAuthors(lines, title);
    const doi = extractDOI(text);
    const year = extractYear(text);
    const abstract = extractAbstract(lines);
    const cite = parseCitationLine(lines);

    // 期刊回退：行首样式匹配
    let journal = cite.journal;
    if (!journal) {
      for (const line of lines.slice(0, 25)) {
        if (/^(?:journal\s+of|proceedings\s+of|proceedings|nature|science|plos\s+one|frontiers\s+in)/i.test(line.trim())) {
          journal = line.trim();
          break;
        }
      }
    }

    return {
      title, authors, year, doi, abstract,
      journal,
      volume: cite.volume || "",
      number: cite.number || "",
      pages: cite.pages || "",
      type: "article",
    };
  }

  global.SciPDF = {
    buildLines, extractDOI, extractYear, extractTitle, extractAuthors,
    extractAbstract, parseCitationLine, extractMetadata,
    splitAuthors, citeKey, toBibtex, toCSLJSON,
  };
})(globalThis);
