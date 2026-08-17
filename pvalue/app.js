// app.js — pvalue UI 控制器
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

  // ── 元素 ─────────────────────────────────────────────────
  const els = {
    mainUI: $("#mainUI"),
    apiResult: $("#apiResult"),
    modeSwitch: $("#modeSwitch"),
    panelPvalue: $("#panelPvalue"),
    panelPower: $("#panelPower"),
    testTabs: $("#testTabs"),
    powerTabs: $("#powerTabs"),
    inputFields: $("#inputFields"),
    outputPvalue: $("#outputPvalue"),
    statline: $("#resultStatline"),
    stars: $("#resultStars"),
    resultGrid: $("#resultGrid"),
    reportText: $("#reportText"),
    resultFootnote: $("#resultFootnote"),
    powerInputFields: $("#powerInputFields"),
    outputPower: $("#outputPower"),
    powerN: $("#powerN"),
    powerNLabel: $("#powerNLabel"),
    powerDetail: $("#powerDetail"),
    powerReportText: $("#powerReportText"),
  };

  const state = {
    mode: "pvalue",     // "pvalue" | "power"
    testType: "t",
    powerType: "t",
  };
  let lastResult = null;

  // ── 字段定义 ─────────────────────────────────────────────
  const PVALUE_FIELDS = {
    t: [
      { id: "pv-t", label: "t 值", ph: "如 2.31", param: "t" },
      { id: "pv-df", label: "自由度 df", ph: "如 58", param: "df" },
      { id: "pv-design", kind: "select", label: "研究设计", param: "design",
        options: [["independent", "独立样本（两组）"], ["paired", "配对 / 单样本"]] },
    ],
    F: [
      { id: "pv-F", label: "F 值", ph: "如 4.52", param: "F" },
      { id: "pv-df1", label: "分子自由度 df₁", ph: "如 2", param: "df1" },
      { id: "pv-df2", label: "分母自由度 df₂", ph: "如 87", param: "df2" },
    ],
    chi2: [
      { id: "pv-chi2", label: "χ² 值", ph: "如 7.83", param: "chi2" },
      { id: "pv-df", label: "自由度 df", ph: "如 3", param: "df" },
      { id: "pv-n", label: "总样本量 N", ph: "选填，如 120", param: "n", optional: true, hint: "填入可计算 Cramér's V" },
      { id: "pv-rows", label: "行数", ph: "选填", param: "rows", optional: true, hint: "如 3" },
      { id: "pv-cols", label: "列数", ph: "选填", param: "cols", optional: true, hint: "如 4" },
    ],
    r: [
      { id: "pv-r", label: "r 值", ph: "如 0.45", param: "r" },
      { id: "pv-n", label: "样本量 n", ph: "如 60", param: "n" },
      { id: "pv-conf", kind: "select", label: "置信水平", param: "conf",
        options: [["0.95", "95%"], ["0.90", "90%"], ["0.99", "99%"]] },
    ],
  };

  const POWER_FIELDS = {
    t: [
      { id: "pw-d", label: "Cohen's d", ph: "如 0.5", param: "d" },
      { id: "pw-design", kind: "select", label: "研究设计", param: "design",
        options: [["independent", "独立样本（每组 n）"], ["paired", "配对 / 单样本"]] },
      { id: "pw-alpha", label: "α 显著性水平", ph: "0.05", param: "alpha", default: "0.05" },
      { id: "pw-power", label: "期望功效 1−β", ph: "0.80", param: "power", default: "0.80" },
    ],
    F: [
      { id: "pw-f", label: "Cohen's f", ph: "如 0.25", param: "f" },
      { id: "pw-groups", label: "组数 k", ph: "如 3", param: "groups", default: "3" },
      { id: "pw-alpha", label: "α 显著性水平", ph: "0.05", param: "alpha", default: "0.05" },
      { id: "pw-power", label: "期望功效 1−β", ph: "0.80", param: "power", default: "0.80" },
    ],
    chi2: [
      { id: "pw-w", label: "Cohen's w", ph: "如 0.3", param: "w" },
      { id: "pw-df", label: "自由度 df", ph: "如 2", param: "df", default: "2" },
      { id: "pw-alpha", label: "α 显著性水平", ph: "0.05", param: "alpha", default: "0.05" },
      { id: "pw-power", label: "期望功效 1−β", ph: "0.80", param: "power", default: "0.80" },
    ],
    r: [
      { id: "pw-r", label: "期望 r 值", ph: "如 0.3", param: "r" },
      { id: "pw-alpha", label: "α 显著性水平", ph: "0.05", param: "alpha", default: "0.05" },
      { id: "pw-power", label: "期望功效 1−β", ph: "0.80", param: "power", default: "0.80" },
    ],
  };

  // Cohen 惯例效应量（用于快捷按钮）
  const PRESETS = {
    t: { small: 0.2, medium: 0.5, large: 0.8 },
    F: { small: 0.10, medium: 0.25, large: 0.40 },
    chi2: { small: 0.1, medium: 0.3, large: 0.5 },
    r: { small: 0.1, medium: 0.3, large: 0.5 },
  };
  const PRESET_FIELD = { t: "pw-d", F: "pw-f", chi2: "pw-w", r: "pw-r" };

  // ── 渲染输入区 ───────────────────────────────────────────
  function renderFields(container, defs) {
    container.innerHTML = defs.map((f) => {
      if (f.kind === "select") {
        const opts = f.options.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
        return `<div class="field">
          <label for="${f.id}">${f.label}</label>
          <select class="input" id="${f.id}" data-param="${f.param}" data-kind="select">${opts}</select>
        </div>`;
      }
      return `<div class="field">
        <label for="${f.id}">${f.label}${f.optional ? ' <span class="hint-inline">（选填）</span>' : ""}</label>
        <input type="number" step="any" inputmode="decimal" id="${f.id}" placeholder="${f.ph}" data-param="${f.param}" value="${f.default || ""}" />
        ${f.hint ? `<span class="hint">${f.hint}</span>` : ""}
      </div>`;
    }).join("");
    $$("input,select", container).forEach((inp) => {
      inp.addEventListener("input", debounce(autoCalc, 260));
    });
  }

  function renderPvalueFields() {
    renderFields(els.inputFields, PVALUE_FIELDS[state.testType]);
  }
  function renderPowerFields() {
    renderFields(els.powerInputFields, POWER_FIELDS[state.powerType]);
  }

  // ── 读取参数 ─────────────────────────────────────────────
  function readParams(defs, container) {
    const params = {};
    let complete = true;
    for (const f of defs) {
      const inp = $(`#${f.id}`, container);
      if (!inp) continue;
      if (f.kind === "select") {
        if (f.param === "design") params.design = inp.value;
        else if (f.param === "conf") params.conf = parseFloat(inp.value);
        continue;
      }
      const v = inp.value.trim();
      inp.classList.remove("invalid");
      if (!v) {
        if (!f.optional) complete = false;
        continue;
      }
      const num = parseFloat(v);
      if (isNaN(num)) {
        inp.classList.add("invalid");
        complete = false;
        continue;
      }
      params[f.param] = num;
    }
    return complete ? params : null;
  }

  function autoCalc() {
    if (state.mode === "pvalue") {
      const params = readParams(PVALUE_FIELDS[state.testType], els.inputFields);
      if (params) calc(params);
    } else {
      const params = readParams(POWER_FIELDS[state.powerType], els.powerInputFields);
      if (params) calc(params);
    }
  }

  // ── 计算与结果渲染 ───────────────────────────────────────
  function calc(params) {
    try {
      const result = PValue.calculate(params);
      lastResult = { params, result };
      if (state.mode === "pvalue") renderPvalueResult(result);
      else renderPowerResult(result);
      setStatus("ok", "计算完成");
    } catch (e) {
      if (state.mode === "pvalue") els.outputPvalue.hidden = true;
      else els.outputPower.hidden = true;
      setStatus("error", e.message);
    }
  }

  // 主统计行：<i>t</i>(58) = 2.31
  function statlineHTML(r) {
    if (r.test === "t") return `<i>t</i>(${r.df}) = ${r.statistic.toFixed(2)}`;
    if (r.test === "F") return `<i>F</i>(${r.df1}, ${r.df2}) = ${r.statistic.toFixed(2)}`;
    if (r.test === "chi2") return `χ²(${r.df}) = ${r.statistic.toFixed(2)}`;
    if (r.test === "r") return `<i>r</i>(${r.df}) = ${r.statistic.toFixed(2)}`;
    return "";
  }

  function badge(interpretation) {
    return interpretation ? `<span class="badge badge-accent">${interpretation}效应</span>` : "";
  }

  function renderPvalueResult(r) {
    els.outputPvalue.hidden = false;
    els.outputPvalue.classList.remove("rise");
    void els.outputPvalue.offsetWidth; // 重置动画
    els.outputPvalue.classList.add("rise");

    els.statline.innerHTML = statlineHTML(r);
    els.stars.textContent = r.stars || "";
    els.stars.title = r.stars ? `p ${r.stars.length === 3 ? "< .001" : r.stars.length === 2 ? "< .01" : "< .05"}` : "p ≥ .05";

    const items = [];
    const pKey = `<div class="r-item"><span class="r-label">p 值（双尾）</span><span class="r-value is-key">${PValue.fmtP(r.p)}</span></div>`;
    const pOne = r.p_one_tailed !== undefined
      ? `<div class="r-item"><span class="r-label">p 值（单尾）</span><span class="r-value">${PValue.fmtP(r.p_one_tailed)}</span></div>` : "";

    if (r.test === "t") {
      items.push(pKey, pOne);
      items.push(`<div class="r-item"><span class="r-label">${r.effect_size.name}</span><span class="r-value">${PValue.fmt3(r.effect_size.value)}</span><span class="r-sub">${badge(r.interpretation)}</span></div>`);
      items.push(`<div class="r-item"><span class="r-label">${r.design === "paired" ? "n（对/人）" : "总样本 N"}</span><span class="r-value">${r.design === "paired" ? r.n : r.n_total}</span></div>`);
      els.resultFootnote.textContent = r.design === "paired"
        ? "配对 / 单样本设计：dz = t/√n，n = df + 1。"
        : "独立样本设计：d = 2t/√df，隐含两组样本量相等。";
    } else if (r.test === "F") {
      items.push(pKey);
      items.push(`<div class="r-item"><span class="r-label">η²</span><span class="r-value">${PValue.fmt3(r.effect_size.value)}</span><span class="r-sub">${badge(r.interpretation)}</span></div>`);
      if (r.omega2) {
        items.push(`<div class="r-item"><span class="r-label">ω²</span><span class="r-value">${PValue.fmt3(r.omega2.value)}</span><span class="r-sub">误差校正估计</span></div>`);
      }
      items.push(`<div class="r-item"><span class="r-label">自由度</span><span class="r-value">${r.df1}, ${r.df2}</span></div>`);
      els.resultFootnote.textContent = "η² 适用于单因素方差分析；ω² 对模型复杂度做了校正，通常略小。";
    } else if (r.test === "chi2") {
      items.push(pKey);
      if (r.effect_size) {
        items.push(`<div class="r-item"><span class="r-label">Cramér's V</span><span class="r-value">${PValue.fmt3(r.effect_size.value)}</span><span class="r-sub">${badge(r.interpretation)}${esc(r.effect_size.basis)}</span></div>`);
      }
      items.push(`<div class="r-item"><span class="r-label">自由度</span><span class="r-value">${r.df}</span></div>`);
      els.resultFootnote.textContent = r.effect_size
        ? `V 按${r.effect_size.basis}的最小维度计算；未填行列数时按 2 行表假设。`
        : "填入总样本量 N 可同时计算 Cramér's V。";
    } else if (r.test === "r") {
      items.push(pKey, pOne);
      items.push(`<div class="r-item"><span class="r-label">r² 决定系数</span><span class="r-value">${PValue.fmt3(r.effect_size.value)}</span><span class="r-sub">${badge(r.interpretation)}</span></div>`);
      items.push(`<div class="r-item"><span class="r-label">${Math.round(r.ci.level * 100)}% CI</span><span class="r-value">[${r.ci.lo.toFixed(2)}, ${r.ci.hi.toFixed(2)}]</span></div>`);
      items.push(`<div class="r-item"><span class="r-label">样本量 n</span><span class="r-value">${r.n}</span></div>`);
      els.resultFootnote.textContent = "置信区间经 Fisher z 变换计算。若区间不含 0，则相关在对应 α 水平显著。";
    }

    els.resultGrid.innerHTML = items.filter(Boolean).join("");
    els.reportText.textContent = r.report;
  }

  function renderPowerResult(r) {
    els.outputPower.hidden = false;
    els.outputPower.classList.remove("rise");
    void els.outputPower.offsetWidth;
    els.outputPower.classList.add("rise");

    els.powerN.textContent = r.n_per_group ?? r.total_n;
    els.powerNLabel.textContent = r.n_label + (r.n_per_group ? `（总 N = ${r.total_n}）` : "");

    const items = [
      `<div class="r-item"><span class="r-label">${r.effect_size.name}</span><span class="r-value">${r.effect_size.value.toFixed(2)}</span></div>`,
      `<div class="r-item"><span class="r-label">α</span><span class="r-value">${r.alpha}</span></div>`,
      `<div class="r-item"><span class="r-label">目标功效</span><span class="r-value">${r.power.toFixed(2)}</span></div>`,
    ];
    if (r.groups) items.push(`<div class="r-item"><span class="r-label">组数 k</span><span class="r-value">${r.groups}</span></div>`);
    if (r.df && r.test === "power-chi2") items.push(`<div class="r-item"><span class="r-label">自由度</span><span class="r-value">${r.df}</span></div>`);
    els.powerDetail.innerHTML = items.join("");
    els.powerReportText.textContent = r.report;
  }

  // ── 交互 ─────────────────────────────────────────────────
  function setTabActive(container, btn) {
    $$(".tab", container).forEach((b) => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    });
  }
  function setSegActive(container, btn) {
    $$(".seg", container).forEach((b) => b.classList.toggle("active", b === btn));
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === "mode-pvalue") {
      state.mode = "pvalue";
      els.panelPvalue.hidden = false;
      els.panelPower.hidden = true;
      setSegActive(els.modeSwitch, btn);
    } else if (act === "mode-power") {
      state.mode = "power";
      els.panelPvalue.hidden = true;
      els.panelPower.hidden = false;
      setSegActive(els.modeSwitch, btn);
    } else if (act.startsWith("test-")) {
      state.testType = act.slice(5);
      setTabActive(els.testTabs, btn);
      renderPvalueFields();
      els.outputPvalue.hidden = true;
      setStatus("ready", "就绪");
    } else if (act.startsWith("power-")) {
      state.powerType = act.slice(6);
      setTabActive(els.powerTabs, btn);
      renderPowerFields();
      els.outputPower.hidden = true;
      setStatus("ready", "就绪");
    } else if (act === "copy-report") {
      copyText(els.reportText.textContent, btn).then((ok) =>
        setStatus(ok ? "ok" : "error", ok ? "报告已复制" : "复制失败"));
    } else if (act === "copy-power-report") {
      copyText(els.powerReportText.textContent, btn).then((ok) =>
        setStatus(ok ? "ok" : "error", ok ? "报告已复制" : "复制失败"));
    } else if (act.startsWith("preset-")) {
      const size = act.slice(7); // small | medium | large
      const fieldId = PRESET_FIELD[state.powerType];
      const inp = $("#" + fieldId);
      if (inp) {
        inp.value = PRESETS[state.powerType][size];
        inp.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") autoCalc();
  });

  // ── URL 接口（LLM / 深链）：?t=2.31&df=58[#json|#md] ─────
  function handleURLParams() {
    const params = new URLSearchParams(location.search);
    const hash = location.hash.replace("#", "");

    const known = ["t", "F", "chi2", "r", "df", "df1", "df2", "n", "rows", "cols",
      "d", "f", "w", "alpha", "power", "groups", "design", "conf"];
    if (!known.some((p) => params.has(p))) return;

    const input = {};
    for (const [k, v] of params.entries()) {
      if (k === "design") { input.design = v === "paired" ? "paired" : "independent"; continue; }
      const num = parseFloat(v);
      if (!isNaN(num)) input[k] = num;
    }

    try {
      const result = PValue.calculate(input);
      const output = { tool: "pvalue", input, result };
      window.__result__ = output;

      if (hash === "json" || hash === "md") {
        els.mainUI.hidden = true;
        els.apiResult.hidden = false;
        els.apiResult.textContent = hash === "json"
          ? JSON.stringify(output, null, 2)
          : formatMarkdown(output);
        return;
      }
      // 无 hash：预填并正常展示
      autoFillFromParams(input, result);
    } catch (e) {
      if (hash === "json" || hash === "md") {
        els.mainUI.hidden = true;
        els.apiResult.hidden = false;
        const err = { tool: "pvalue", input, error: e.message };
        window.__result__ = err;
        els.apiResult.textContent = hash === "json"
          ? JSON.stringify(err, null, 2)
          : `## 错误\n\n${e.message}`;
      } else {
        setStatus("error", e.message);
      }
    }
  }

  function autoFillFromParams(input, result) {
    const isPower = input.power !== undefined || input.d !== undefined
      || input.f !== undefined || input.w !== undefined;

    if (isPower) {
      state.mode = "power";
      els.panelPvalue.hidden = true;
      els.panelPower.hidden = false;
      setSegActive(els.modeSwitch, $('[data-act="mode-power"]'));

      const typeKey = input.d !== undefined ? "t" : input.f !== undefined ? "F" : input.w !== undefined ? "chi2" : "r";
      state.powerType = typeKey;
      setTabActive(els.powerTabs, $(`[data-act="power-${typeKey}"]`));
      renderPowerFields();
      const map = {
        t: [["pw-d", "d"], ["pw-alpha", "alpha"], ["pw-power", "power"]],
        F: [["pw-f", "f"], ["pw-groups", "groups"], ["pw-alpha", "alpha"], ["pw-power", "power"]],
        chi2: [["pw-w", "w"], ["pw-df", "df"], ["pw-alpha", "alpha"], ["pw-power", "power"]],
        r: [["pw-r", "r"], ["pw-alpha", "alpha"], ["pw-power", "power"]],
      };
      for (const [id, k] of map[typeKey]) {
        if (input[k] !== undefined) { const el = $("#" + id); if (el) el.value = input[k]; }
      }
      if (typeKey === "t" && input.design) {
        const el = $("#pw-design"); if (el) el.value = input.design;
      }
      if (result) renderPowerResult(result);
      return;
    }

    const typeKey = input.t !== undefined ? "t" : input.F !== undefined ? "F" : input.chi2 !== undefined ? "chi2" : "r";
    state.testType = typeKey;
    setTabActive(els.testTabs, $(`[data-act="test-${typeKey}"]`));
    renderPvalueFields();
    const map = {
      t: [["pv-t", "t"], ["pv-df", "df"]],
      F: [["pv-F", "F"], ["pv-df1", "df1"], ["pv-df2", "df2"]],
      chi2: [["pv-chi2", "chi2"], ["pv-df", "df"], ["pv-n", "n"], ["pv-rows", "rows"], ["pv-cols", "cols"]],
      r: [["pv-r", "r"], ["pv-n", "n"]],
    };
    for (const [id, k] of map[typeKey]) {
      if (input[k] !== undefined) { const el = $("#" + id); if (el) el.value = input[k]; }
    }
    if (typeKey === "t" && input.design) {
      const el = $("#pv-design"); if (el) el.value = input.design;
    }
    if (result) renderPvalueResult(result);
  }

  function formatMarkdown(output) {
    const r = output.result;
    const lines = ["## p 值计算结果", ""];
    if (r.test === "t") {
      lines.push(`- 检验类型：t 检验（${r.design === "paired" ? "配对/单样本" : "独立样本"}）`);
      lines.push(`- 统计量：t(${r.df}) = ${r.statistic.toFixed(2)}`);
      lines.push(`- p 值（双尾）：${PValue.fmtP(r.p)}${r.stars}`);
      if (r.p_one_tailed !== undefined) lines.push(`- p 值（单尾）：${PValue.fmtP(r.p_one_tailed)}`);
      lines.push(`- ${r.effect_size.name}：${PValue.fmt3(r.effect_size.value)}（${r.interpretation}效应量）`);
    } else if (r.test === "F") {
      lines.push(`- 检验类型：F 检验`);
      lines.push(`- 统计量：F(${r.df1}, ${r.df2}) = ${r.statistic.toFixed(2)}`);
      lines.push(`- p 值：${PValue.fmtP(r.p)}${r.stars}`);
      lines.push(`- η²：${PValue.fmt3(r.effect_size.value)}（${r.interpretation}效应量）`);
      if (r.omega2) lines.push(`- ω²：${PValue.fmt3(r.omega2.value)}`);
    } else if (r.test === "chi2") {
      lines.push(`- 检验类型：χ² 检验`);
      lines.push(`- 统计量：χ²(${r.df}) = ${r.statistic.toFixed(2)}`);
      lines.push(`- p 值：${PValue.fmtP(r.p)}${r.stars}`);
      if (r.effect_size) lines.push(`- Cramér's V：${PValue.fmt3(r.effect_size.value)}（${r.interpretation}效应量）`);
    } else if (r.test === "r") {
      lines.push(`- 检验类型：相关分析`);
      lines.push(`- 统计量：r(${r.df}) = ${r.statistic.toFixed(2)}`);
      lines.push(`- p 值（双尾）：${PValue.fmtP(r.p)}${r.stars}`);
      if (r.p_one_tailed !== undefined) lines.push(`- p 值（单尾）：${PValue.fmtP(r.p_one_tailed)}`);
      lines.push(`- r²：${PValue.fmt3(r.effect_size.value)}（${r.interpretation}效应量）`);
      lines.push(`- ${Math.round(r.ci.level * 100)}% CI：[${r.ci.lo.toFixed(2)}, ${r.ci.hi.toFixed(2)}]`);
    } else if (typeof r.test === "string" && r.test.startsWith("power-")) {
      lines.push(`- 功效分析：${r.report}`);
    }
    lines.push("", "---", "*由 pvalue 工具生成 · newsroom-kit*");
    return lines.join("\n");
  }

  // ── 初始化 ───────────────────────────────────────────────
  renderPvalueFields();
  renderPowerFields();
  setStatus("ready", "就绪 · 输入完成后自动计算");
  handleURLParams();
})();
