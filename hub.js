// hub — 由 registry.js 驱动渲染
// 三种视图：按类别 / 按场景 / 全部。搜索跨字段匹配。

(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const els = {
    views: document.querySelectorAll("[data-view]"),
    content: $("#content"),
    search: $("#search"),
    searchClear: $("#searchClear"),
    count: $("#count"),
    themeToggle: $("#themeToggle"),
    themeLabel: $("#themeLabel"),
  };

  const state = {
    view: localStorage.getItem("kit-view") || "category",
    query: "",
  };

  // ---------- 主题（与各工具共用同一个 key，跨站一致） ----------
  const THEME_KEY = "toolkit-theme";
  const root = document.documentElement;
  function applyTheme(theme) {
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    const isLight = theme === "light" || (theme === "auto" && matchMedia("(prefers-color-scheme: light)").matches);
    els.themeLabel.textContent = isLight ? "深色" : "浅色";
  }
  els.themeToggle.addEventListener("click", () => {
    const cur = localStorage.getItem(THEME_KEY) || "auto";
    const next = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
  applyTheme(localStorage.getItem(THEME_KEY) || "auto");

  // ---------- 工具函数 ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const byId = (id) => TOOLS.find((t) => t.id === id);

  const STATUS_LABEL = { live: "", wip: "开发中", planned: "计划中" };

  function matches(tool, q) {
    if (!q) return true;
    const hay = [tool.name, tool.title, tool.tagline, tool.desc, ...(tool.tags || []), ...(tool.keywords || [])]
      .join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }

  function visibleTools() {
    return TOOLS.filter((t) => matches(t, state.query));
  }

  // ---------- 卡片 ----------
  function toolCard(tool, opts = {}) {
    const live = tool.status === "live";
    const badge = STATUS_LABEL[tool.status]
      ? `<span class="badge ${tool.status}">${STATUS_LABEL[tool.status]}</span>` : "";
    const step = opts.step ? `<span class="step-n">${opts.step}</span>` : "";
    const tags = (tool.tags || []).slice(0, 4).map((t) => `<span>${esc(t)}</span>`).join("");
    const tag = live ? "a" : "div";
    const href = live ? ` href="${esc(tool.url)}"` : "";

    return `
      <${tag} class="tool${live ? "" : " disabled"}"${href}>
        ${step}
        <div class="tool-icon"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${tool.icon}</svg></div>
        <div class="tool-body">
          <div class="tool-head">
            <h3>${esc(tool.title)}</h3>
            <code>${esc(tool.name)}</code>
            ${badge}
          </div>
          <p class="tool-tagline">${esc(tool.tagline)}</p>
          <p class="tool-desc">${esc(tool.desc)}</p>
          <div class="tool-tags">${tags}</div>
        </div>
        ${live ? '<span class="tool-go" aria-hidden="true">→</span>' : ""}
      </${tag}>`;
  }

  // ---------- 三种视图 ----------
  function renderByCategory(tools) {
    const groups = CATEGORIES
      .map((c) => ({ c, items: tools.filter((t) => t.categories.includes(c.id)) }))
      .filter((g) => g.items.length);

    if (!groups.length) return emptyState();

    return groups.map(({ c, items }) => `
      <section class="group">
        <div class="group-head">
          <h2>${esc(c.name)}</h2>
          <p>${esc(c.desc)}</p>
          <span class="group-n">${items.length}</span>
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
      <section class="group scenario">
        <div class="group-head">
          <h2>${esc(s.name)}</h2>
          <p>${esc(s.desc)}</p>
          <span class="group-n">${items.length} 步</span>
        </div>
        <div class="flow">${items.map((t, i) => toolCard(t, { step: i + 1 })).join('<span class="flow-arrow" aria-hidden="true">→</span>')}</div>
      </section>`).join("");
  }

  function renderAll(tools) {
    if (!tools.length) return emptyState();
    return `<section class="group"><div class="grid">${tools.map((t) => toolCard(t)).join("")}</div></section>`;
  }

  function emptyState() {
    return `<div class="empty"><p>没有匹配的工具。</p><p class="empty-hint">试试别的关键词，或切换到“全部”。</p></div>`;
  }

  // ---------- 渲染 ----------
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

  // ---------- 交互 ----------
  for (const b of els.views) {
    b.addEventListener("click", () => {
      state.view = b.dataset.view;
      localStorage.setItem("kit-view", state.view);
      render();
    });
  }

  let debounce;
  els.search.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.query = els.search.value.trim(); render(); }, 100);
  });

  els.searchClear.addEventListener("click", () => {
    els.search.value = ""; state.query = ""; render(); els.search.focus();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== els.search) { e.preventDefault(); els.search.focus(); }
    if (e.key === "Escape" && document.activeElement === els.search) { els.search.value = ""; state.query = ""; render(); els.search.blur(); }
  });

  render();
})();
