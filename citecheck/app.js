// app.js — citecheck UI 控制器
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
    input: $("#input"),
    formatBadge: $("#formatBadge"),
    outputs: $("#outputs"),
    outApa: $("#out-apa"),
    outChicago: $("#out-chicago"),
    outMla: $("#out-mla"),
    outGbt: $("#out-gbt"),
    errPanel: $("#errPanel"),
    errText: $("#errText"),
    mainUI: $("#mainUI"),
    apiResult: $("#apiResult"),
  };

  const FORMAT_NAMES = {
    bibtex: "BibTeX", ris: "RIS", apa: "APA", gbt: "GB/T 7714",
    mla: "MLA", chicago: "Chicago", unknown: "未识别", empty: "",
  };

  let lastResult = null;

  function run() {
    const text = els.input.value;
    if (!text.trim()) {
      els.outputs.hidden = true;
      els.errPanel.hidden = true;
      els.formatBadge.hidden = true;
      setStatus("ready", "就绪 · 粘贴后自动转换");
      return;
    }
    const res = CiteCheck.convert(text);
    lastResult = res;

    if (res.format && res.format !== "unknown" && res.format !== "empty") {
      els.formatBadge.hidden = false;
      els.formatBadge.textContent = "识别：" + FORMAT_NAMES[res.format];
    } else {
      els.formatBadge.hidden = true;
    }

    if (res.error || !res.outputs.length) {
      els.outputs.hidden = true;
      els.errPanel.hidden = false;
      els.errText.textContent = res.error || "未能解析出引文。";
      setStatus("error", res.error ? res.error.slice(0, 40) : "未能解析");
      return;
    }

    els.errPanel.hidden = true;
    els.outputs.hidden = false;
    const join = (key) => res.outputs
      .map((o) => o.error ? `⚠ ${o.error}` : o[key])
      .join("\n\n");
    els.outApa.textContent = join("apa");
    els.outChicago.textContent = join("chicago");
    els.outMla.textContent = join("mla");
    els.outGbt.textContent = join("gbt");

    const n = res.outputs.length;
    const errs = res.outputs.filter((o) => o.error).length;
    setStatus("ok", `转换 ${n} 条${errs ? `（${errs} 条失败）` : ""}`);
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === "copy") {
      const key = btn.dataset.style;
      if (!lastResult) return;
      const text = lastResult.outputs
        .map((o) => o.error ? `⚠ ${o.error}` : o[key])
        .join("\n\n");
      copyText(text, btn).then((ok) =>
        setStatus(ok ? "ok" : "error", ok ? "已复制" : "复制失败"));
    } else if (act === "sample") {
      els.input.value = SAMPLE;
      run();
    } else if (act === "clear") {
      els.input.value = "";
      run();
      els.input.focus();
    }
  });

  els.input.addEventListener("input", debounce(run, 200));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.activeElement === els.input) {
      els.input.value = "";
      run();
    }
  });

  const SAMPLE = `王晓明, 李华, 张三, 等. 算法管理下的骑手劳动过程研究[J]. 新闻与传播研究, 2024, 51(6): 123-138.

Smith, J. P., & Lee, K. (2021). Media trust in the digital age. Communication Research, 48(2), 210-231. https://doi.org/10.1177/xyz

@article{zhang2023,
  author = {Zhang, Wei and Li, Juan},
  title  = {Platform Labor and Worker Autonomy},
  journal = {Journal of Communication},
  year   = {2023}, volume = {12}, number = {3}, pages = {45--59},
  doi    = {10.1093/jcr/abc123}
}`;

  // ── URL 接口（LLM）：?input=…&to=apa|chicago|mla|gbt[#json|#md] ──
  function initAPI() {
    const params = new URLSearchParams(location.search);
    const input = params.get("input");
    if (!input) return;
    els.input.value = input;
    run();

    const hash = location.hash.replace("#", "");
    if (hash !== "json" && hash !== "md") return;
    els.mainUI.hidden = true;
    els.apiResult.hidden = false;

    const to = params.get("to");
    const pick = (o) => o.error ? { error: o.error }
      : to ? { [to]: o[to] }
      : { apa: o.apa, chicago: o.chicago, mla: o.mla, gbt: o.gbt };

    if (lastResult && !lastResult.error) {
      const obj = {
        tool: "citecheck",
        format: lastResult.format,
        entries: lastResult.outputs.length,
        outputs: lastResult.outputs.map(pick),
      };
      window.__result__ = obj;
      els.apiResult.textContent = hash === "json"
        ? JSON.stringify(obj, null, 2)
        : lastResult.outputs.map((o) => o.error ? `⚠ ${o.error}` : (to ? o[to] : `${o.apa}\n${o.chicago}\n${o.mla}\n${o.gbt}`)).join("\n\n");
    } else {
      const err = lastResult ? (lastResult.error || "未能解析") : "empty";
      window.__result__ = { tool: "citecheck", error: err };
      els.apiResult.textContent = hash === "json"
        ? JSON.stringify({ tool: "citecheck", error: err }, null, 2)
        : `## 解析失败\n\n${err}`;
    }
  }

  setStatus("ready", "就绪 · 粘贴后自动转换");
  initAPI();
})();
