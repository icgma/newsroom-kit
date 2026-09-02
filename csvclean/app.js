// app.js — csvclean UI 控制器
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

// ── 工作台交接：入口粘贴/拖入后跳到对应工具 ───────────────
const HANDOFF_KEY = "kit-handoff";
function takeHandoff(toolId) {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.tool !== toolId) return null;
    sessionStorage.removeItem(HANDOFF_KEY);
    return data;
  } catch {
    return null;
  }
}
function setHandoff(data) {
  try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(data)); } catch { /* 隐私模式 / 配额 */ }
}
// @kit:end

  const els = {
    dropzone: $("#dropzone"),
    fileInput: $("#fileInput"),
    pasteArea: $("#pasteArea"),
    settings: $("#settings"),
    encodingSel: $("#encodingSel"),
    delimSel: $("#delimSel"),
    optTrim: $("#optTrim"),
    optEmpty: $("#optEmpty"),
    optDup: $("#optDup"),
    optHalf: $("#optHalf"),
    optQuote: $("#optQuote"),
    reportPanel: $("#reportPanel"),
    fileMeta: $("#fileMeta"),
    reportFacts: $("#reportFacts"),
    colBody: $("#colBody"),
    issueList: $("#issueList"),
    previewPanel: $("#previewPanel"),
    actionCount: $("#actionCount"),
    actionList: $("#actionList"),
    previewTable: $("#previewTable"),
    previewNote: $("#previewNote"),
    errorBox: $("#errorBox"),
    errorText: $("#errorText"),
    mainUI: $("#mainUI"),
    apiResult: $("#apiResult"),
  };

  // 源状态：文件原始 buffer 或粘贴文本
  const source = { buffer: null, fileName: "", rawText: "" };

  // ── 文件载入 ─────────────────────────────────────────────
  async function loadFile(file) {
    if (!file) return;
    source.buffer = await file.arrayBuffer();
    source.fileName = file.name;
    source.rawText = "";
    els.settings.hidden = false;
    clearError();
    run(true);
  }

  function loadPaste() {
    const text = els.pasteArea.value;
    if (!text.trim()) {
      if (!source.buffer) {
        els.reportPanel.hidden = true;
        els.previewPanel.hidden = true;
        els.settings.hidden = true;
        setStatus("ready", "就绪");
      }
      return;
    }
    source.buffer = null;
    source.fileName = "粘贴文本";
    source.rawText = text;
    els.settings.hidden = false;
    clearError();
    run(true);
  }

  // ── 主流程 ───────────────────────────────────────────────
  function run(fromSource) {
    try {
      let text, encodingNote = null;

      if (source.buffer) {
        const forced = els.encodingSel.value;
        const dec = CsvClean.decodeBuffer(source.buffer, forced === "auto" ? null : forced);
        text = dec.text;
        encodingNote = dec;
      } else if (source.rawText) {
        text = source.rawText;
      } else {
        return;
      }

      const delimRaw = els.delimSel.value;
      const delimiter = delimRaw === "auto" ? null : delimRaw.replace("\\t", "\t");
      const opts = {
        trimCells: els.optTrim.checked,
        removeEmptyRows: els.optEmpty.checked,
        removeDuplicateRows: els.optDup.checked,
        toHalf: els.optHalf.checked,
        normalizeQuotes: els.optQuote.checked,
        delimiter,
      };

      const result = CsvClean.clean(text, opts);
      render(result, encodingNote);
    } catch (e) {
      showError("处理出错：" + (e.message || e));
    }
  }

  // ── 最近一次结果（复制/下载用）─────────────────────────
  let lastResult = null;

  function render(result, encodingNote) {
    lastResult = result;
    const rep = result.report;
    if (!rep.rowCount && !rep.colCount) {
      showError("没有解析到数据行。请检查文件内容。");
      return;
    }
    clearError();

    // 事实条
    const delimName = { ",": "逗号", ";": "分号", "\t": "Tab", "|": "竖线" }[result.delimiter] || result.delimiter;
    const facts = [
      ["编码", encodingNote ? encodingNote.encoding : "（粘贴文本）"],
      ["分隔符", delimName],
      ["数据行", rep.rowCount],
      ["列数", rep.colCount],
    ];
    els.reportFacts.innerHTML = facts
      .map(([k, v]) => `<span class="fact"><span class="k">${k}</span><span class="v">${esc(v)}</span></span>`)
      .join("");

    els.fileMeta.textContent = source.fileName;
    els.reportPanel.hidden = false;

    // 列概览
    const TYPE_NAMES = { number: "数字", date: "日期", text: "文本", empty: "全空" };
    els.colBody.innerHTML = rep.columns.map((c) => `
      <tr>
        <td>${c.index}</td>
        <td>${esc(c.name)}</td>
        <td><span class="type-badge type-${c.type}">${TYPE_NAMES[c.type]}</span></td>
        <td class="num">${c.empty}</td>
      </tr>`).join("");

    // 问题清单
    if (encodingNote) {
      for (const x of encodingNote.issues) {
        rep.issues.unshift({ row: 0, type: "encoding", detail: x.detail });
      }
    }
    els.issueList.innerHTML = rep.issues.length
      ? rep.issues.map((x) => `<li><span class="issue-mark">▲</span>${esc(x.detail)}</li>`).join("")
      : '<li class="issue-none">✓ 未发现常见问题。</li>';

    // 清洗动作
    els.actionCount.textContent = result.actions.length + " 项";
    els.actionList.innerHTML = result.actions.length
      ? result.actions.map((a) => `<li>${esc(a)}</li>`).join("")
      : '<li class="action-none">无需清洗——原始数据已经干净。</li>';

    // 预览表（前 100 行）
    const parsed = CsvClean.parseCSV(result.output, result.delimiter);
    const preview = parsed.rows.slice(0, 101);
    const head = preview[0] || [];
    const body = preview.slice(1);
    els.previewTable.innerHTML =
      "<thead><tr>" + head.map((h) => `<th>${esc(h)}</th>`).join("") + "</tr></thead>" +
      "<tbody>" + body.map((r) => "<tr>" + head.map((_, c) => `<td>${esc(r[c] ?? "")}</td>`).join("") + "</tr>").join("") + "</tbody>";
    els.previewNote.textContent = rep.rowCount > 100
      ? `预览前 100 行，共 ${rep.rowCount} 行数据。下载可获取完整结果。`
      : "全部数据行如上。";

    els.previewPanel.hidden = false;
    setStatus("ok", `体检完成：${rep.rowCount} 行 × ${rep.colCount} 列，${rep.issues.length} 个发现`);
  }

  // ── 导出 ─────────────────────────────────────────────────
  // ── 事件 ─────────────────────────────────────────────────
  els.dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.dropzone.classList.add("dragover");
  });
  els.dropzone.addEventListener("dragleave", () => els.dropzone.classList.remove("dragover"));
  els.dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    els.dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
  });
  els.dropzone.addEventListener("click", () => els.fileInput.click());
  els.dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); els.fileInput.click(); }
  });
  els.fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) loadFile(e.target.files[0]);
    e.target.value = "";
  });

  els.pasteArea.addEventListener("input", debounce(loadPaste, 300));

  for (const sel of [els.encodingSel, els.delimSel]) {
    sel.addEventListener("change", () => { if (source.buffer || source.rawText) run(); });
  }
  for (const opt of [els.optTrim, els.optEmpty, els.optDup, els.optHalf, els.optQuote]) {
    opt.addEventListener("change", () => { if (source.buffer || source.rawText) run(); });
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    if (btn.dataset.act === "copy" && lastResult) {
      copyText(lastResult.output, btn).then((ok) =>
        setStatus(ok ? "ok" : "error", ok ? "清洗结果已复制" : "复制失败"));
    } else if (btn.dataset.act === "download" && lastResult) {
      const base = source.fileName.replace(/\.[^.]+$/, "") || "data";
      downloadFile(`${base}-clean.csv`, lastResult.output, "text/csv;charset=utf-8");
      setStatus("ok", "已下载 " + base + "-clean.csv");
    }
  });

  function showError(msg) {
    els.errorText.textContent = msg;
    els.errorBox.hidden = false;
    els.reportPanel.hidden = true;
    els.previewPanel.hidden = true;
    setStatus("error", msg.slice(0, 50));
  }
  function clearError() { els.errorBox.hidden = true; }

  // ── URL 接口：?input=…[#json] ────────────────────────────
  function initAPI() {
    const params = new URLSearchParams(location.search);
    const input = params.get("input");
    if (!input) return;
    if (location.hash !== "#json") {
      els.pasteArea.value = input;
      loadPaste();
      return;
    }
    els.mainUI.hidden = true;
    els.apiResult.hidden = false;
    const result = CsvClean.clean(input, {});
    const obj = {
      tool: "csvclean",
      delimiter: result.delimiter,
      actions: result.actions,
      report: {
        rows: result.report.rowCount,
        columns: result.report.colCount,
        columnTypes: result.report.columns.map((c) => ({ name: c.name, type: c.type })),
        issues: result.report.issues,
      },
      output: result.output,
    };
    window.__result__ = obj;
    els.apiResult.textContent = JSON.stringify(obj, null, 2);
  }

  setStatus("ready", "就绪 · 拖入 CSV 或粘贴文本");
  initAPI();
})();
