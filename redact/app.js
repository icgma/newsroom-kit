// app.js — redact UI 控制器
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
    input: $("#inputText"),
    output: $("#outputText"),
    resultMeta: $("#resultMeta"),
    outputActions: $("#outputActions"),
    reviewSection: $("#reviewSection"),
    reviewBody: $("#reviewBody"),
    pills: $$("#categoryPills .pill input"),
    rulesList: $("#customRulesList"),
    newRulePattern: $("#newRulePattern"),
    newRuleLabel: $("#newRuleLabel"),
    llmEndpoint: $("#llmEndpoint"),
    llmApiKey: $("#llmApiKey"),
    llmModel: $("#llmModel"),
    llmSection: $("#llmSection"),
    mainUI: $("#mainUI"),
    apiResult: $("#apiResult"),
  };

  // ── 本地状态 ─────────────────────────────────────────────
  const RULES_KEY = "redact-custom-rules";
  const LLM_KEY = "redact-llm-config";
  let customRules = loadJSON(RULES_KEY, []);
  let lastRun = null;      // { text, matches }
  let excluded = new Set(); // "original::type::label" → 保持原样

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 隐私模式 */ }
  }

  function enabledCategories() {
    const enabled = {};
    for (const cb of els.pills) enabled[cb.dataset.cat] = cb.checked;
    return enabled;
  }

  // ── 自定义规则 ───────────────────────────────────────────
  function renderRules() {
    els.rulesList.innerHTML = customRules.map((rule, i) => `
      <div class="rule-item">
        <span class="rule-pattern">${esc(rule.pattern)}</span>
        <span class="rule-label-text">${esc(rule.label)}</span>
        <button class="rule-del" data-act="del-rule" data-index="${i}" type="button">删除</button>
      </div>`).join("");
  }
  function addRule() {
    const pattern = els.newRulePattern.value.trim();
    const label = els.newRuleLabel.value.trim() || "自定义";
    if (!pattern) { setStatus("error", "请输入正则表达式"); return; }
    try { new RegExp(pattern); } catch (e) {
      setStatus("error", "正则表达式无效：" + e.message);
      return;
    }
    customRules.push({ pattern, label });
    saveJSON(RULES_KEY, customRules);
    els.newRulePattern.value = "";
    els.newRuleLabel.value = "";
    renderRules();
    setStatus("ok", "规则已添加，点击「脱敏」生效");
  }

  // ── LLM 配置 ─────────────────────────────────────────────
  function loadLLMConfig() {
    const cfg = loadJSON(LLM_KEY, {});
    if (cfg.endpoint) els.llmEndpoint.value = cfg.endpoint;
    if (cfg.apiKey) els.llmApiKey.value = cfg.apiKey;
    if (cfg.model) els.llmModel.value = cfg.model;
  }
  function saveLLMConfig() {
    saveJSON(LLM_KEY, {
      endpoint: els.llmEndpoint.value.trim(),
      apiKey: els.llmApiKey.value.trim(),
      model: els.llmModel.value.trim(),
    });
  }
  for (const el of [els.llmEndpoint, els.llmApiKey, els.llmModel]) {
    el.addEventListener("change", saveLLMConfig);
  }

  // ── 脱敏主流程 ───────────────────────────────────────────
  let runToken = 0;

  async function runRedact(useLLM) {
    const text = els.input.value;
    if (!text.trim()) { setStatus("error", "请输入需要脱敏的文本"); return; }

    const token = ++runToken;
    const enabled = enabledCategories();

    let llmEntities = null;
    if (useLLM) {
      const apiKey = els.llmApiKey.value.trim();
      if (!apiKey) { setStatus("error", "请先在「LLM 辅助识别」中填写 API Key"); return; }
      setStatus("busy", "LLM 识别中…（文本仅发送至你配置的端点）");
      try {
        llmEntities = await Redact.callLLM(text, {
          endpoint: els.llmEndpoint.value.trim(),
          apiKey,
          model: els.llmModel.value.trim() || "gpt-4o-mini",
        });
      } catch (e) {
        if (token !== runToken) return;
        setStatus("error", "LLM 调用失败，已仅用正则：" + e.message);
      }
    } else {
      setStatus("busy", "识别中…");
    }
    if (token !== runToken) return;

    // 探测全量匹配（excluded 中已不存在的项顺带清理）
    const probe = Redact.redact(text, {
      enabled, customRules, llmEntities,
    });
    const validKeys = new Set(probe.matches.map((m) => {
      const cat = Redact.CATEGORIES[m.type] || Redact.CATEGORIES.custom;
      const label = m.type === "custom" && m.customLabel ? m.customLabel : cat.prefix;
      return `${m.original}::${m.type}::${label}`;
    }));
    excluded = new Set([...excluded].filter((k) => validKeys.has(k)));

    lastRun = { text, matches: probe.matches };
    renderResult(llmEntities);
  }

  function currentResult() {
    if (!lastRun) return null;
    return Redact.buildResult(lastRun.text, lastRun.matches, excluded);
  }

  function renderResult(llmEntities) {
    const result = Redact.buildResult(lastRun.text, lastRun.matches, excluded);
    const reps = result.replacements;

    // 输出文本：替换标记按类型高亮
    let html = esc(result.redacted);
    if (reps.length) {
      const sorted = [...reps].sort((a, b) => b.replacement.length - a.replacement.length);
      for (const r of sorted) {
        const token = esc(r.replacement);
        const cls = "rh rh-" + (r.type === "custom" ? "custom" : r.type);
        const title = esc(r.original);
        html = html.split(token).join(`<span class="${cls}" title="${title}">${token}</span>`);
      }
    }
    els.output.innerHTML = html || '<span class="placeholder">脱敏后的文本显示在这里</span>';

    // 复核表
    if (reps.length || excluded.size) {
      els.reviewSection.hidden = false;
      renderReviewTable(reps);
    } else {
      els.reviewSection.hidden = true;
    }

    const has = reps.length > 0;
    els.outputActions.hidden = !has;
    const kept = excluded.size ? ` · 保留 ${excluded.size} 项` : "";
    els.resultMeta.textContent = `${reps.length} 处替换${kept}`;
    const llmNote = llmEntities && llmEntities.length ? "（含 LLM 识别）" : "";
    setStatus("ok", `完成：${reps.length} 处替换${llmNote}`, `${lastRun.text.length} 字`);
  }

  function renderReviewTable(reps) {
    els.reviewBody.innerHTML = reps.map((r) => {
      const key = `${r.original}::${r.type}::${r.label}`;
      const checked = !excluded.has(key) ? "checked" : "";
      const rowCls = excluded.has(key) ? "is-excluded" : "";
      const typeCls = r.type === "custom" ? "custom" : r.type;
      const cat = Redact.CATEGORIES[r.type] || Redact.CATEGORIES.custom;
      const typeLabel = r.type === "custom" && r.customLabel ? r.customLabel : cat.label;
      return `<tr class="${rowCls}" data-key="${esc(key)}">
        <td><input type="checkbox" ${checked} data-act="toggle-item" data-key="${esc(key)}" aria-label="保留或还原 ${esc(r.original)}" /></td>
        <td class="td-original">${esc(r.original)}</td>
        <td class="td-replacement">${esc(r.replacement)}</td>
        <td><span class="type-badge type-${typeCls}">${esc(typeLabel)}</span></td>
        <td class="${r.source === "llm" ? "src-llm" : "src-regex"}">${r.source === "llm" ? "LLM" : "正则"}</td>
        <td class="td-count">×${r.count}</td>
      </tr>`;
    }).join("");
  }

  // ── 导出 ─────────────────────────────────────────────────
  function exportCSV() {
    const result = currentResult();
    if (!result || !result.replacements.length) return;
    downloadFile("redact-mapping.csv", Redact.replacementsToCSV(result.replacements), "text/csv;charset=utf-8");
    setStatus("ok", "映射表已导出（含当前勾选项）");
  }

  // ── 事件 ─────────────────────────────────────────────────
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === "redact") {
      const llmOn = els.llmSection.open && els.llmApiKey.value.trim();
      runRedact(!!llmOn);
    } else if (act === "sample") {
      els.input.value = SAMPLE;
      runRedact(false);
    } else if (act === "clear") {
      els.input.value = "";
      lastRun = null;
      excluded = new Set();
      els.output.innerHTML = '<span class="placeholder">脱敏后的文本显示在这里</span>';
      els.outputActions.hidden = true;
      els.reviewSection.hidden = true;
      els.resultMeta.textContent = "";
      setStatus("ready", "就绪");
    } else if (act === "add-rule") {
      addRule();
    } else if (act === "del-rule") {
      customRules.splice(Number(btn.dataset.index), 1);
      saveJSON(RULES_KEY, customRules);
      renderRules();
    } else if (act === "copy-redacted") {
      const result = currentResult();
      if (result) {
        copyText(result.redacted, btn).then((ok) =>
          setStatus(ok ? "ok" : "error", ok ? "脱敏文本已复制" : "复制失败"));
      }
    } else if (act === "export-csv") {
      exportCSV();
    }
  });

  // 复核勾选（事件委托：change 不冒泡为 click）
  els.reviewBody.addEventListener("change", (e) => {
    const cb = e.target.closest('[data-act="toggle-item"]');
    if (!cb) return;
    const key = cb.dataset.key;
    if (cb.checked) excluded.delete(key);
    else excluded.add(key);
    renderResult();
  });

  for (const cb of els.pills) {
    cb.addEventListener("change", () => {
      // 类别变化后需重新识别（保持已排除项）
      if (lastRun) runRedact(false);
    });
  }

  // ── 示例文本 ─────────────────────────────────────────────
  const SAMPLE = `访谈记录 W03 · 2024年3月

受访者张三表示，他在北京大学新闻与传播学院工作了八年，主要研究平台经济。他的同事李四老师补充说，团队从 2019 年开始关注外卖骑手群体。

"王小红主任当时也在场，"张三回忆道，"她提到深圳的一家配送站点有 300 多名骑手，负责人是陈志远。"

如有后续问题，可联系受访者助理：13812345678，邮箱 zhangsan.work@example.com。项目编号：INT-2024-017。`;

  // ── URL 接口（LLM）：?input=…[&llm=1][#json|#md] ──────────
  async function checkAPIMode() {
    const hash = location.hash.replace("#", "").toLowerCase();
    if (hash !== "json" && hash !== "md") return;
    const params = new URLSearchParams(location.search);
    const input = params.get("input");
    if (!input) return;

    els.mainUI.hidden = true;
    els.apiResult.hidden = false;

    const enabled = enabledCategories();
    let llmEntities = null;
    if (params.get("llm") === "1") {
      const cfg = loadJSON(LLM_KEY, {});
      if (cfg.apiKey) {
        try {
          llmEntities = await Redact.callLLM(input, {
            endpoint: cfg.endpoint || "https://api.openai.com/v1/chat/completions",
            apiKey: cfg.apiKey,
            model: cfg.model || "gpt-4o-mini",
          });
        } catch { /* 回退到纯正则 */ }
      }
    }

    const result = Redact.redact(input, { enabled, customRules, llmEntities });
    const obj = {
      tool: "redact",
      input: { length: input.length },
      result: {
        redacted: result.redacted,
        replacements: result.replacements.map((r) => ({
          original: r.original, replacement: r.replacement,
          type: r.type, source: r.source, count: r.count,
        })),
      },
    };
    window.__result__ = obj;
    els.apiResult.textContent = hash === "json"
      ? JSON.stringify(obj, null, 2)
      : toMarkdown(obj);
  }

  function toMarkdown(obj) {
    const lines = ["## 脱敏结果", "", "**脱敏后文本：**", "", obj.result.redacted, ""];
    if (obj.result.replacements.length) {
      lines.push("**替换映射：**", "",
        "| 原始文本 | 替换为 | 类型 | 来源 | 次数 |", "|---|---|---|---|---|");
      for (const r of obj.result.replacements) {
        const cat = Redact.CATEGORIES[r.type] || Redact.CATEGORIES.custom;
        lines.push(`| ${r.original} | ${r.replacement} | ${cat.label} | ${r.source === "llm" ? "LLM" : "正则"} | ${r.count} |`);
      }
    } else {
      lines.push("未发现需要脱敏的内容。");
    }
    return lines.join("\n");
  }

  // ── 初始化 ───────────────────────────────────────────────
  renderRules();
  loadLLMConfig();
  setStatus("ready", "就绪 · 粘贴文本后点击「脱敏」");
  checkAPIMode();
})();
