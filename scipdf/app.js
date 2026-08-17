// app.js — scipdf UI 控制器
(() => {
  "use strict";

// @kit:start
// ════════════════════════════════════════════════════════════════
// newsroom-kit · kit.js — 各工具共享的 UI 基座（嵌入 app.js 内）
// 真源文件；用 `node tools/sync-kit.mjs` 同步。
// 依赖：页面含 #themeToggle/#themeLabel、.statusbar（#statusDot/#statusText/#statusRight）
// ════════════════════════════════════════════════════════════════

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

// ── 主题（三态循环：自动 → 浅色 → 深色；跨站共享同一 key）────
const THEME_KEY = "toolkit-theme";
const THEME_LABEL = { auto: "自动", light: "浅色", dark: "深色" };
const THEME_TITLE = {
  auto: "跟随系统（点击切换浅色）",
  light: "浅色（点击切换深色）",
  dark: "深色（点击切换跟随系统）",
};
function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "auto") root.setAttribute("data-theme", "auto");
  else root.setAttribute("data-theme", mode);
  const label = $("#themeLabel");
  if (label) label.textContent = THEME_LABEL[mode] || "自动";
  const btn = $("#themeToggle");
  if (btn) btn.title = THEME_TITLE[mode] || "";
}
function initTheme() {
  let mode = "auto";
  try { mode = localStorage.getItem(THEME_KEY) || "auto"; } catch { /* 隐私模式 */ }
  if (!THEME_LABEL[mode]) mode = "auto";
  applyTheme(mode);
  const btn = $("#themeToggle");
  if (btn) btn.addEventListener("click", () => {
    const cur = (document.documentElement.getAttribute("data-theme")) || "auto";
    const next = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
    try { localStorage.setItem(THEME_KEY, next); } catch { /* 隐私模式 */ }
    applyTheme(next);
  });
}

// ── 状态栏 ─────────────────────────────────────────────────
function setStatus(type, text, right) {
  const dot = $("#statusDot");
  const txt = $("#statusText");
  const rt = $("#statusRight");
  if (dot) dot.className = "status-dot " + type;
  if (txt) { txt.textContent = text || ""; }
  if (rt) rt.textContent = right || "";
}

// ── 剪贴板与按钮反馈 ───────────────────────────────────────
async function copyText(text, btn) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand("copy");
      document.body.removeChild(ta);
    } catch { ok = false; }
  }
  if (ok && btn) flash(btn, "已复制 ✓");
  return ok;
}
function flash(btn, msg, ms = 1200) {
  if (!btn || btn.dataset.flashing) return;
  btn.dataset.flashing = "1";
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = old; delete btn.dataset.flashing; }, ms);
}

// ── 文件下载 ───────────────────────────────────────────────
function downloadFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

initTheme();
// @kit:end

  const els = {
    dropzone: $("#dropzone"),
    fileInput: $("#fileInput"),
    progress: $("#progress"),
    progressFill: $("#progressFill"),
    progressText: $("#progressText"),
    results: $("#results"),
    errorBox: $("#errorBox"),
    errorText: $("#errorText"),
    fileMeta: $("#fileMeta"),
    title: $("#metaTitle"),
    authors: $("#metaAuthors"),
    year: $("#metaYear"),
    doi: $("#metaDoi"),
    journal: $("#metaJournal"),
    volume: $("#metaVolume"),
    number: $("#metaNumber"),
    pages: $("#metaPages"),
    type: $("#metaType"),
    abstract: $("#metaAbstract"),
    bibtexOut: $("#bibtexOut"),
    citeKey: $("#citeKey"),
    mainUI: $("#mainUI"),
    apiResult: $("#apiResult"),
  };

  const FIELD_LABELS = {
    title: "标题", authors: "作者", year: "年份", doi: "DOI",
    journal: "期刊", volume: "卷", number: "期", pages: "页码", abstract: "摘要",
  };
  let apiMode = location.hash === "#json" || location.hash === "#md";

  // ── 错误处理 ─────────────────────────────────────────────
  function showError(msg) {
    els.errorText.textContent = msg;
    els.errorBox.hidden = false;
    els.results.hidden = true;
    els.progress.hidden = true;
    setStatus("error", msg.slice(0, 60));
  }

  // ── PDF 处理 ─────────────────────────────────────────────
  async function processPDF(file) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showError("请选择 PDF 文件。");
      return;
    }

    els.errorBox.hidden = true;
    els.results.hidden = true;
    els.progress.hidden = false;
    els.progressFill.style.width = "8%";
    els.progressText.textContent = "正在读取 PDF…";
    setStatus("busy", "正在读取 PDF…", file.name);

    try {
      if (typeof pdfjsLib === "undefined") {
        throw new Error("PDF 解析库未能加载（lib/pdf.min.js）。请刷新页面重试。");
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";

      const arrayBuffer = await file.arrayBuffer();
      els.progressFill.style.width = "20%";
      els.progressText.textContent = "正在解析页面…";

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const maxPages = Math.min(pdf.numPages, 5);

      // 按行重建文本（保留 pdf.js 的 EOL 信息），跨页以空行分隔
      const allItems = [];
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        allItems.push(...content.items, { str: "\n", hasEOL: true }, { str: "", hasEOL: true });
        els.progressFill.style.width = (20 + (i / maxPages) * 60).toFixed(0) + "%";
        els.progressText.textContent = `正在提取文本…（第 ${i}/${maxPages} 页）`;
      }

      const lines = SciPDF.buildLines(allItems);
      if (!lines.join("").trim()) {
        throw new Error("PDF 中没有提取到文本。可能是扫描版 PDF（图片），需要先 OCR。");
      }

      els.progressFill.style.width = "88%";
      els.progressText.textContent = "正在识别元数据…";

      const meta = SciPDF.extractMetadata(lines, lines.join("\n"));
      fillFields(meta, file.name, pdf.numPages, maxPages);

      els.progressFill.style.width = "100%";
      els.progressText.textContent = "完成";
      els.results.hidden = false;
      els.progress.hidden = true;

      const filled = countFilled(meta);
      setStatus("ok", `提取完成：9 项中识别 ${filled} 项（读取前 ${maxPages} 页）`, file.name);
    } catch (e) {
      showError(e.message || "PDF 处理出错，请重试。");
    }
  }

  function countFilled(meta) {
    return ["title", "authors", "year", "doi", "journal", "volume", "number", "pages", "abstract"]
      .filter((k) => meta[k] && String(meta[k]).trim()).length;
  }

  function fillFields(meta, filename, totalPages, readPages) {
    const m = {
      title: meta.title || "",
      authors: meta.authors || "",
      year: meta.year || "",
      doi: meta.doi || "",
      journal: meta.journal || "",
      volume: meta.volume || "",
      number: meta.number || "",
      pages: meta.pages || "",
      type: meta.type || "article",
      abstract: meta.abstract || "",
    };
    els.title.value = m.title;
    els.authors.value = m.authors;
    els.year.value = m.year;
    els.doi.value = m.doi;
    els.journal.value = m.journal;
    els.volume.value = m.volume;
    els.number.value = m.number;
    els.pages.value = m.pages;
    els.type.value = m.type;
    els.abstract.value = m.abstract;

    // 空字段标注「未识别」提示
    for (const [key, label] of Object.entries(FIELD_LABELS)) {
      const input = key === "authors" ? els.authors : key === "title" ? els.title : $(`#meta${key.charAt(0).toUpperCase()}${key.slice(1)}`);
      if (input) input.placeholder = m[key] ? "" : "（未识别，可手填）";
    }

    els.fileMeta.textContent = `${filename} · ${totalPages} 页${readPages < totalPages ? `（读前 ${readPages} 页）` : ""}`;
    generateBibtex();

    if (apiMode) renderAPIMode();
  }

  // ── 表单 ⇄ BibTeX ────────────────────────────────────────
  function collectMeta() {
    return {
      title: els.title.value.trim(),
      authors: els.authors.value.trim(),
      year: els.year.value.trim(),
      doi: els.doi.value.trim(),
      journal: els.journal.value.trim(),
      volume: els.volume.value.trim(),
      number: els.number.value.trim(),
      pages: els.pages.value.trim(),
      type: els.type.value,
      abstract: els.abstract.value.trim(),
    };
  }

  function generateBibtex() {
    const meta = collectMeta();
    const { key, bibtex } = SciPDF.toBibtex(meta);
    els.bibtexOut.textContent = bibtex;
    els.citeKey.textContent = key ? `@${meta.type}{${key}}` : "";
    return { key, bibtex, meta };
  }

  for (const input of $$(".meta-grid .input")) {
    input.addEventListener("input", generateBibtex);
    input.addEventListener("change", generateBibtex);
  }

  // ── 文件选择与拖放 ───────────────────────────────────────
  function handleFiles(files) {
    if (files && files.length) processPDF(files[0]);
  }

  els.dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.dropzone.classList.add("dragover");
  });
  els.dropzone.addEventListener("dragleave", () => els.dropzone.classList.remove("dragover"));
  els.dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    els.dropzone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });
  els.dropzone.addEventListener("click", () => els.fileInput.click());
  els.dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      els.fileInput.click();
    }
  });
  els.fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
    e.target.value = "";
  });

  // ── 动作 ─────────────────────────────────────────────────
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === "copy-bibtex") {
      copyText(generateBibtex().bibtex, btn).then((ok) =>
        setStatus(ok ? "ok" : "error", ok ? "BibTeX 已复制" : "复制失败"));
    } else if (act === "download-bib") {
      const { key, bibtex } = generateBibtex();
      downloadFile(`${key || "reference"}.bib`, bibtex, "application/x-bibtex;charset=utf-8");
      setStatus("ok", `已下载 ${key}.bib`);
    } else if (act === "copy-json") {
      const csl = SciPDF.toCSLJSON(collectMeta());
      copyText(JSON.stringify(csl, null, 2), btn).then((ok) =>
        setStatus(ok ? "ok" : "error", ok ? "CSL-JSON 已复制" : "复制失败"));
    } else if (act === "reset") {
      els.results.hidden = true;
      els.errorBox.hidden = true;
      setStatus("ready", "就绪 · 拖入下一个 PDF");
    } else if (act === "dismiss-error") {
      els.errorBox.hidden = true;
    }
  });

  // ── API 结果模式（#json / #md）：提取完成后输出结构化结果 ─
  function renderAPIMode() {
    const meta = collectMeta();
    const { bibtex } = generateBibtex();
    els.mainUI.hidden = true;
    els.apiResult.hidden = false;
    window.__result__ = { tool: "scipdf", result: { ...meta, bibtex } };
    if (location.hash === "#md") {
      els.apiResult.textContent = [
        "## scipdf — PDF 元数据", "",
        `- **标题**：${meta.title || "（未识别）"}`,
        `- **作者**：${meta.authors || "（未识别）"}`,
        `- **年份**：${meta.year || "（未识别）"}`,
        `- **DOI**：${meta.doi || "（未识别）"}`,
        `- **期刊**：${meta.journal || "（未识别）"}`,
        "", "### BibTeX", "", "```bibtex", bibtex, "```",
      ].join("\n");
    } else {
      els.apiResult.textContent = JSON.stringify({
        tool: "scipdf", result: { ...meta, bibtex },
      }, null, 2);
    }
  }

  // ── 初始化 ───────────────────────────────────────────────
  setStatus("ready", "就绪 · 拖入论文 PDF");
})();
