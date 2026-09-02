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
    views: $$("[data-view]"),
    content: $("#content"),
    search: $("#search"),
    searchClear: $("#searchClear"),
    count: $("#count"),
    recent: $("#recent"),
  };

  const RECENT_KEY = "kit-recent";
  const state = {
    view: (() => {
      const saved = (() => { try { return localStorage.getItem("kit-view"); } catch { return null; } })();
      return ["scenario", "category", "all"].includes(saved) ? saved : "all";
    })(),
    query: "",
  };

  const byId = (id) => TOOLS.find((t) => t.id === id);
  const STATUS_LABEL = { wip: "开发中", planned: "计划中" };

  function loadRecent() {
    try {
      const ids = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(ids) ? ids.map(byId).filter((t) => t && t.status === "live") : [];
    } catch {
      return [];
    }
  }
  function pushRecent(id) {
    const next = [id, ...loadRecent().map((t) => t.id).filter((x) => x !== id)].slice(0, 4);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* 隐私模式 */ }
  }

  function matches(tool, q) {
    if (!q) return true;
    const hay = [tool.name, tool.title, tool.tagline, tool.desc,
      ...(tool.tags || []), ...(tool.keywords || [])].join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }
  const visibleTools = () => TOOLS.filter((t) => matches(t, state.query));
  const liveVisible = () => TOOLS.filter((t) => t.status === "live" && matches(t, state.query));

  function toolRow(tool, opts = {}) {
    const live = tool.status === "live";
    const badge = STATUS_LABEL[tool.status]
      ? `<span class="badge badge-${tool.status}">${STATUS_LABEL[tool.status]}</span>` : "";
    const key = opts.step
      ? `<span class="step-num" aria-hidden="true">${opts.step}</span>`
      : `<span class="row-key">${opts.key || ""}</span>`;
    const tag = live ? "a" : "div";
    const href = live ? ` href="${esc(tool.url)}"` : "";
    const blank = live && tool.external ? ' target="_blank" rel="noopener"' : "";
    const cls = live ? "row" : "row is-planned";
    return `
      <${tag} class="${cls}"${href}${blank} data-tool="${esc(tool.id)}">
        ${key}
        <h3 class="row-title">${esc(tool.title)}</h3>
        <code class="row-slug">${esc(tool.name)}</code>
        <span class="row-use">${esc(tool.tagline)}</span>
        ${live ? '<span class="row-go">打开</span>' : badge}
      </${tag}>`;
  }

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
        <div class="index">${items.map((t) => toolRow(t)).join("")}</div>
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
        <div class="index">${items.map((t, i) => toolRow(t, { step: i + 1 })).join("")}</div>
      </section>`).join("");
  }

  function renderAll(tools) {
    if (!tools.length) return emptyState();
    const live = tools.filter((t) => t.status === "live");
    const rest = tools.filter((t) => t.status !== "live");
    const ordered = live.concat(rest);
    return `<section class="group"><div class="index">${ordered.map((t, i) =>
      toolRow(t, { key: t.status === "live" ? String(i + 1) : "" })
    ).join("")}</div></section>`;
  }

  function emptyState() {
    return `<div class="empty">
      <p>没有匹配「<strong>${esc(state.query)}</strong>」的工具。</p>
      <p>试试 p 值、脱敏、BibTeX、简繁、时区。</p>
    </div>`;
  }

  function renderRecent() {
    if (!els.recent) return;
    if (state.query) { els.recent.hidden = true; return; }
    const items = loadRecent();
    if (!items.length) { els.recent.hidden = true; return; }
    els.recent.hidden = false;
    els.recent.innerHTML = `
      <p class="recent-label">最近用过</p>
      <div class="recent-list">${items.map((t) =>
        `<a class="recent-item" href="${esc(t.url)}"${t.external ? ' target="_blank" rel="noopener"' : ""} data-tool="${esc(t.id)}">
          <strong>${esc(t.title)}</strong><span>${esc(t.tagline)}</span>
        </a>`).join("")}</div>`;
  }

  function render() {
    const tools = visibleTools();
    const liveN = TOOLS.filter((t) => t.status === "live").length;

    els.content.innerHTML =
      state.view === "category" ? renderByCategory(tools) :
      state.view === "scenario" ? renderByScenario(tools) :
      renderAll(tools);

    renderRecent();

    els.count.textContent = state.query
      ? `匹配 ${tools.length} 个`
      : `${liveN} 个可用 · 共 ${TOOLS.length} 个`;
    for (const b of els.views) b.classList.toggle("active", b.dataset.view === state.view);
    els.searchClear.hidden = !state.query;
  }

  function openNth(n) {
    const tools = liveVisible();
    const tool = tools[n - 1];
    if (!tool) return;
    pushRecent(tool.id);
    renderRecent();
    if (tool.external) window.open(tool.url, "_blank", "noopener");
    else location.href = tool.url;
  }

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

  document.addEventListener("click", (e) => {
    const node = e.target.closest("[data-tool]");
    if (node) pushRecent(node.dataset.tool);
  });

  document.addEventListener("keydown", (e) => {
    const typing = e.target === els.search || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";
    if (e.key === "/" && !typing) {
      e.preventDefault();
      els.search.focus();
      els.search.select();
      return;
    }
    if (e.key === "Escape" && document.activeElement === els.search) {
      els.search.value = "";
      state.query = "";
      render();
      els.search.blur();
      return;
    }
    if (!typing && state.view === "all" && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      openNth(Number(e.key));
    }
  });

  // ── 粘贴 / 拖入分流 ──────────────────────────────────────
  const pasteBar = $("#pasteBar");
  const pasteMsg = $("#pasteMsg");
  let pendingPaste = null;

  function sniffText(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    if (/^@\w+\s*\{/m.test(t) || /^TY\s+-\s+/m.test(t)) {
      return { id: "bibfix", reason: "像 BibTeX / RIS", text: t };
    }
    if (/\bt\s*\(\s*\d+\s*\)\s*=\s*-?[\d.]+/i.test(t) || /^t\s*=\s*-?[\d.]+/im.test(t)) {
      return { id: "pvalue", reason: "像 t 检验报告", text: t };
    }
    if (/[\u200B-\u200D\uFEFF\u00AD\u2060]/.test(t) || /[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/.test(t)) {
      return { id: "tidy", reason: "稿里有零宽字符或全角字母", text: t };
    }
    return null;
  }

  function showPaste(hit) {
    const tool = byId(hit.id);
    if (!tool || tool.status !== "live") return;
    pendingPaste = { ...hit, tool };
    pasteMsg.textContent = `${hit.reason}，打开「${tool.title}」？`;
    pasteBar.hidden = false;
  }

  function goPaste() {
    if (!pendingPaste) return;
    const { tool } = pendingPaste;
    if (pendingPaste.dataUrl) setHandoff({ tool: tool.id, dataUrl: pendingPaste.dataUrl, name: pendingPaste.name });
    else if (pendingPaste.text) setHandoff({ tool: tool.id, text: pendingPaste.text });
    pushRecent(tool.id);
    if (tool.external) window.open(tool.url, "_blank", "noopener");
    else location.href = tool.url;
  }

  if (pasteBar) {
    $("#pasteGo").addEventListener("click", goPaste);
    $("#pasteDismiss").addEventListener("click", () => {
      pasteBar.hidden = true;
      pendingPaste = null;
    });
  }

  document.addEventListener("paste", (e) => {
    const typing = e.target === els.search || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";
    if (typing) return;
    const img = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (img) {
      const file = img.getAsFile();
      if (!file) return;
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = () => showPaste({ id: "imgshrink", reason: "剪贴板是图片", dataUrl: reader.result, name: file.name });
      reader.readAsDataURL(file);
      return;
    }
    const text = e.clipboardData?.getData("text");
    const hit = sniffText(text);
    if (hit) {
      e.preventDefault();
      showPaste(hit);
    }
  });

  document.addEventListener("dragover", (e) => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    if (e.target.closest("input, textarea")) return;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    e.preventDefault();
    if (file.type.startsWith("image/")) {
      if (file.size > 3.5 * 1024 * 1024) {
        showPaste({ id: "imgshrink", reason: "拖入的是图片（较大，请到压图页再放一次）" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => showPaste({ id: "imgshrink", reason: "拖入的是图片", dataUrl: reader.result, name: file.name });
      reader.readAsDataURL(file);
      return;
    }
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      showPaste({ id: "scipdf", reason: "拖入的是 PDF，打开后请再放一次文件" });
    }
  });

  const wipe = $("#wipeLocal");
  if (wipe) {
    wipe.addEventListener("click", () => {
      try {
        localStorage.removeItem("kit-recent");
        localStorage.removeItem("kit-view");
        localStorage.removeItem("toolkit-theme");
        sessionStorage.removeItem("kit-handoff");
      } catch { /* 隐私模式 */ }
      location.reload();
    });
  }

  render();
})();
