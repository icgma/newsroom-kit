// hub.js — 工具箱入口页渲染器（由 registry.js 驱动）
// 三种视图：按场景 / 按类别 / 全部；搜索跨字段匹配。
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
    views: $$("[data-view]"),
    content: $("#content"),
    search: $("#search"),
    searchClear: $("#searchClear"),
    count: $("#count"),
  };

  const state = {
    view: (() => {
      const saved = (() => { try { return localStorage.getItem("kit-view"); } catch { return null; } })();
      return ["scenario", "category", "all"].includes(saved) ? saved : "scenario";
    })(),
    query: "",
  };

  const byId = (id) => TOOLS.find((t) => t.id === id);
  const STATUS_LABEL = { wip: "开发中", planned: "计划中" };

  function matches(tool, q) {
    if (!q) return true;
    const hay = [tool.name, tool.title, tool.tagline, tool.desc,
      ...(tool.tags || []), ...(tool.keywords || [])].join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }
  const visibleTools = () => TOOLS.filter((t) => matches(t, state.query));

  // ── 卡片 ─────────────────────────────────────────────────
  function toolCard(tool, opts = {}) {
    const live = tool.status === "live";
    const badge = STATUS_LABEL[tool.status]
      ? `<span class="badge badge-${tool.status}">${STATUS_LABEL[tool.status]}</span>` : "";
    const step = opts.step ? `<span class="step-num" aria-hidden="true">${opts.step}</span>` : "";
    const tags = (tool.tags || []).slice(0, 4).map((t) => `<span>${esc(t)}</span>`).join("");
    const tag = live ? "a" : "div";
    const href = live ? ` href="${esc(tool.url)}"` : "";
    const cls = live ? "tool" : "tool is-planned";

    return `
      <${tag} class="${cls}"${href}${live ? ' target="_blank" rel="noopener"' : ""}>
        ${step}
        <span class="tool-icon"><svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">${tool.icon}</svg></span>
        <span class="tool-body">
          <span class="tool-name"><h3>${esc(tool.title)}</h3><code class="tool-slug">${esc(tool.name)}</code>${badge}</span>
          <span class="tool-tagline">${esc(tool.tagline)}</span>
          <span class="tool-desc">${esc(tool.desc)}</span>
          <span class="tool-tags">${tags}</span>
        </span>
        ${live ? '<span class="tool-go" aria-hidden="true">→</span>' : ""}
      </${tag}>`;
  }

  // ── 三种视图 ─────────────────────────────────────────────
  function renderByCategory(tools) {
    const groups = CATEGORIES
      .map((c) => ({ c, items: tools.filter((t) => t.categories.includes(c.id)) }))
      .filter((g) => g.items.length);
    if (!groups.length) return emptyState();
    return groups.map(({ c, items }) => `
      <section class="group" aria-labelledby="cat-${c.id}">
        <div class="group-head">
          <h2 class="group-title" id="cat-${c.id}">${esc(c.name)}<span class="group-count">${items.length}</span></h2>
          <p class="group-desc">${esc(c.desc)}</p>
        </div>
        <div class="grid">${items.map((t) => toolCard(t)).join("")}</div>
      </section>`).join("");
  }

  function renderByScenario(tools) {
    const ids = new Set(tools.map((t) => t.id));
    const groups = SCENARIOS
      .map((s) => ({ s, items: s.steps.map(byId).filter((t) => t && ids.has(t.id)) }))
      .filter((g) => g.items.length);
    if (!groups.length) return emptyState();
    return groups.map(({ s, items }) => `
      <section class="group" aria-labelledby="sc-${s.id}">
        <div class="group-head">
          <h2 class="group-title" id="sc-${s.id}">${esc(s.name)}<span class="group-count">${items.length} 步</span></h2>
          <p class="group-desc">${esc(s.desc)}</p>
        </div>
        <div class="flow">${items.map((t, i) => toolCard(t, { step: i + 1 })).join('<span class="flow-arrow" aria-hidden="true">↓</span>')}</div>
      </section>`).join("");
  }

  function renderAll(tools) {
    if (!tools.length) return emptyState();
    return `<section class="group"><div class="grid">${tools.map((t) => toolCard(t)).join("")}</div></section>`;
  }

  function emptyState() {
    return `<div class="empty">
      <p>没有匹配「<strong>${esc(state.query)}</strong>」的工具。</p>
      <p>试试别的关键词，或切换浏览方式。</p>
    </div>`;
  }

  // ── 渲染 ─────────────────────────────────────────────────
  function render() {
    const tools = visibleTools();
    const liveN = TOOLS.filter((t) => t.status === "live").length;

    els.content.innerHTML =
      state.view === "category" ? renderByCategory(tools) :
      state.view === "scenario" ? renderByScenario(tools) :
      renderAll(tools);

    els.count.textContent = state.query
      ? `匹配 ${tools.length} 个`
      : `${liveN} 个可用 · 共 ${TOOLS.length} 个`;
    for (const b of els.views) b.classList.toggle("active", b.dataset.view === state.view);
    els.searchClear.hidden = !state.query;
  }

  // ── 交互 ─────────────────────────────────────────────────
  for (const b of els.views) {
    b.addEventListener("click", () => {
      state.view = b.dataset.view;
      try { localStorage.setItem("kit-view", state.view); } catch { /* 隐私模式 */ }
      render();
    });
  }

  els.search.addEventListener("input", debounce(() => {
    state.query = els.search.value.trim();
    render();
  }, 100));

  els.searchClear.addEventListener("click", () => {
    els.search.value = "";
    state.query = "";
    render();
    els.search.focus();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== els.search) {
      e.preventDefault();
      els.search.focus();
    }
    if (e.key === "Escape" && document.activeElement === els.search) {
      els.search.value = "";
      state.query = "";
      render();
      els.search.blur();
    }
  });

  render();
})();
