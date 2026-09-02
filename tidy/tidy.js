// tidy.js — 清稿：去零宽字符、全角字母数字、多余空白、统一引号与中文标点
// 不依赖 DOM。经 globalThis.Tidy 导出，Node 下也可 require/import。
((global) => {
  "use strict";

  const ZW = /[\u200B-\u200D\u2060\uFEFF\u00AD\u180E\uFE00-\uFE0F]/g;
  const ODD_SPACE = /[\u00A0\u202F\u2007\u2008\u2009\u200A\u3000]/g;
  const FULLWIDTH_ALNUM = /[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/g;
  const PUNCT_MAP = { ",": "，", ".": "。", ";": "；", ":": "：", "!": "！", "?": "？" };

  const DEFAULTS = {
    zw: true,
    space: true,
    alnum: true,
    quotes: "corner", // corner 「」 · curly “” · straight "
    punct: true,
    ellipsis: true,
  };

  function countRe(text, re) {
    const m = text.match(re);
    return m ? m.length : 0;
  }

  function mapFullwidthAlnum(ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  }

  function unifyQuotes(text, style) {
    if (style === "straight") {
      return text.replace(/[“”„‟«»]/g, "\"").replace(/[‘’‚‛‹›]/g, "'");
    }
    if (style === "curly") {
      let dq = 0, sq = 0;
      return text
        .replace(/[“”„‟«»"]/g, () => (dq++ % 2 === 0 ? "“" : "”"))
        .replace(/[‘’‚‛‹›']/g, () => (sq++ % 2 === 0 ? "‘" : "’"));
    }
    // corner：中文稿默认直角引号
    let dq = 0, sq = 0;
    return text
      .replace(/[“”„‟«»"]/g, () => (dq++ % 2 === 0 ? "「" : "」"))
      .replace(/[‘’‚‛‹›']/g, () => (sq++ % 2 === 0 ? "『" : "』"));
  }

  function cjkPunct(text) {
    return text.replace(/([\u4e00-\u9fff])([,.;:!?])(?=([\u4e00-\u9fff])|$|\s)/g, (_, a, p) => {
      return a + (PUNCT_MAP[p] || p);
    });
  }

  function tidy(input, opts) {
    const o = { ...DEFAULTS, ...(opts || {}) };
    if (input == null) {
      return { text: "", counts: emptyCounts(), changed: false };
    }
    const original = String(input);
    let text = original;
    const counts = emptyCounts();

    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
      counts.zw += 1;
    }

    if (o.zw) {
      const n = countRe(text, ZW);
      if (n) {
        text = text.replace(ZW, "");
        counts.zw += n;
      }
    }

    if (o.space) {
      const nbs = countRe(text, ODD_SPACE);
      if (nbs) {
        text = text.replace(ODD_SPACE, " ");
        counts.nbsp = nbs;
      }
      text = text.replace(/\r\n?/g, "\n");
      const trail = countRe(text, /[ \t]+$/gm);
      if (trail) {
        text = text.replace(/[ \t]+$/gm, "");
        counts.trail = trail;
      }
      const squeezed = text.replace(/[^\S\n]{2,}/g, " ");
      if (squeezed !== text) {
        counts.space = 1;
        text = squeezed;
      }
      const blanked = text.replace(/\n{3,}/g, "\n\n");
      if (blanked !== text) {
        counts.blank = 1;
        text = blanked;
      }
      const trimmed = text.replace(/^\n+/, "").replace(/\n+$/, "");
      if (trimmed !== text) {
        counts.blank = 1;
        text = trimmed;
      }
    }

    if (o.alnum) {
      const n = countRe(text, FULLWIDTH_ALNUM);
      if (n) {
        text = text.replace(FULLWIDTH_ALNUM, mapFullwidthAlnum);
        counts.alnum = n;
      }
    }

    if (o.ellipsis) {
      const n = countRe(text, /(?:\.{3}|。{3,}|…{2,})/g);
      if (n) {
        text = text.replace(/(?:\.{3}|。{3,}|…{2,})/g, "……");
        counts.ellipsis = n;
      }
    }

    if (o.quotes && o.quotes !== "off") {
      const next = unifyQuotes(text, o.quotes);
      if (next !== text) {
        counts.quotes = 1;
        text = next;
      }
    }

    if (o.punct) {
      const next = cjkPunct(text);
      if (next !== text) {
        counts.punct = 1;
        text = next;
      }
    }

    return {
      text,
      counts,
      changed: text !== original,
    };
  }

  function emptyCounts() {
    return { zw: 0, nbsp: 0, alnum: 0, space: 0, quotes: 0, punct: 0, ellipsis: 0, blank: 0, trail: 0 };
  }

  function summarize(counts) {
    const parts = [];
    if (counts.zw) parts.push(`零宽 ${counts.zw}`);
    if (counts.nbsp) parts.push(`特殊空格 ${counts.nbsp}`);
    if (counts.alnum) parts.push(`全角字母数字 ${counts.alnum}`);
    if (counts.trail) parts.push(`行尾空白 ${counts.trail}`);
    if (counts.space) parts.push("连续空格");
    if (counts.blank) parts.push("空行");
    if (counts.quotes) parts.push("引号");
    if (counts.punct) parts.push("中文标点");
    if (counts.ellipsis) parts.push(`省略号 ${counts.ellipsis}`);
    return parts.length ? parts.join(" · ") : "没有需要改的";
  }

  const api = { tidy, summarize, DEFAULTS };
  global.Tidy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
