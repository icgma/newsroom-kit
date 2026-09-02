// app.js — tidy UI
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
    output: $("#output"),
    inputMeta: $("#inputMeta"),
    summary: $("#summary"),
    quoteStyle: $("#quoteStyle"),
    mainUI: $("#mainUI"),
    apiResult: $("#apiResult"),
  };

  const SAMPLE = "他说\"今天  开会\"...\n\n\nＡＩ\u200B生成的\u00A0稿件，真的吗?\n行尾有空格   \n";

  function opts() {
    const o = { quotes: els.quoteStyle.value };
    for (const box of $$("[data-opt]")) o[box.dataset.opt] = box.checked;
    return o;
  }

  function run() {
    const raw = els.input.value;
    els.inputMeta.textContent = raw.length + " 字";
    if (!raw) {
      els.output.value = "";
      els.summary.textContent = "粘贴后自动清理";
      setStatus("ready", "就绪");
      return;
    }
    try {
      const res = Tidy.tidy(raw, opts());
      els.output.value = res.text;
      els.summary.textContent = res.changed
        ? Tidy.summarize(res.counts)
        : "没有需要改的";
      setStatus(res.changed ? "ok" : "ready", res.changed ? "已清理" : "原稿已干净");
    } catch (e) {
      setStatus("error", "处理出错：" + e.message);
    }
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "sample") {
      els.input.value = SAMPLE;
      run();
    } else if (act === "clear") {
      els.input.value = "";
      run();
      els.input.focus();
    } else if (act === "copy-out") {
      copyText(els.output.value, btn).then((ok) =>
        setStatus(ok ? "ok" : "error", ok ? "已复制" : "复制失败，请手动选择"));
    }
  });

  els.input.addEventListener("input", debounce(run, 80));
  els.quoteStyle.addEventListener("change", run);
  for (const box of $$("[data-opt]")) box.addEventListener("change", run);

  function initAPI() {
    const params = new URLSearchParams(location.search);
    const input = params.get("input");
    const hop = takeHandoff("tidy");
    if (hop && hop.text) els.input.value = hop.text;
    else if (input) els.input.value = input;
    if (els.input.value) run();

    const hash = location.hash.replace("#", "");
    if (hash === "json" || hash === "md") {
      const res = Tidy.tidy(els.input.value, opts());
      const payload = { tool: "tidy", result: res };
      window.__result__ = payload;
      els.mainUI.hidden = true;
      els.apiResult.hidden = false;
      els.apiResult.textContent = hash === "md"
        ? `## 清稿\n\n${Tidy.summarize(res.counts)}\n\n\`\`\`\n${res.text}\n\`\`\``
        : JSON.stringify(payload, null, 2);
    }
  }

  setStatus("ready", "就绪 · 粘贴后自动清理");
  initAPI();
})();
