// app.js — bibfix UI 控制器
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
    outputActions: $("#outputActions"),
    outputStatus: $("#outputStatus"),
    summaryLine: $("#summaryLine"),
    changelog: $("#changelog"),
    changeCount: $("#changeCount"),
    clBody: $("#clBody"),
    warningsBox: $("#warningsBox"),
    warnCount: $("#warnCount"),
    warnList: $("#warnList"),
    mainUI: $("#mainUI"),
    apiResult: $("#apiResult"),
    formatBtns: $$("#formatSegment .seg"),
  };

  let lastResult = null;

  function currentFormat() {
    const b = els.formatBtns.find((x) => x.classList.contains("active"));
    return b ? b.dataset.format : "auto";
  }

  // ── 主流程 ───────────────────────────────────────────────
  function run() {
    const text = els.input.value;
    if (!text.trim()) {
      els.inputMeta.textContent = "0 条 · 0 字";
      els.output.value = "";
      els.outputActions.hidden = true;
      els.outputStatus.hidden = true;
      els.changelog.hidden = true;
      els.warningsBox.hidden = true;
      setStatus("ready", "就绪");
      return;
    }
    try {
      const res = BibFix.repair(text, { format: currentFormat() });
      lastResult = res;

      if (res.error) {
        els.inputMeta.textContent = `格式未识别 · ${text.length} 字`;
        els.output.value = "";
        els.outputActions.hidden = true;
        els.outputStatus.hidden = true;
        els.changelog.hidden = true;
        els.warningsBox.hidden = true;
        setStatus("error", res.error);
        return;
      }

      els.output.value = res.fixed;
      els.outputActions.hidden = false;
      els.outputStatus.hidden = false;
      renderChangelog(res.changes);
      renderWarnings(res.warnings);

      const fmtName = res.format === "ris" ? "RIS → BibTeX" : "BibTeX";
      els.inputMeta.textContent = `${res.entries.length} 条 · ${text.length} 字 · ${fmtName}`;
      els.summaryLine.textContent =
        `${res.entries.length} 条 · 改动 ${res.changes.length} 处` +
        (res.warnings.length ? ` · ${res.warnings.length} 条缺字段提醒` : "");
      setStatus("ok", `解析完成：${res.entries.length} 条，改动 ${res.changes.length} 处`);
    } catch (e) {
      setStatus("error", "处理出错：" + e.message);
    }
  }

  function renderChangelog(changes) {
    els.changeCount.textContent = changes.length + " 处";
    if (!changes.length) {
      els.changelog.hidden = true;
      return;
    }
    els.changelog.hidden = false;
    els.clBody.innerHTML = changes.map((c) => `
      <tr>
        <td class="cl-entry">${esc(c.entry)}</td>
        <td class="cl-field">${esc(c.field)}</td>
        <td><span class="cl-before">${esc(c.before)}</span><span class="arrow"> → </span><span class="cl-after">${esc(c.after)}</span></td>
        <td class="cl-reason">${esc(c.reason)}</td>
      </tr>`).join("");
  }

  function renderWarnings(warnings) {
    els.warnCount.textContent = warnings.length + " 条";
    if (!warnings.length) {
      els.warningsBox.hidden = true;
      return;
    }
    els.warningsBox.hidden = false;
    els.warnList.innerHTML = warnings.map((w) =>
      `<li><code>${esc(w.entry)}</code> — ${esc(w.message)}</li>`).join("");
  }

  // ── 动作 ─────────────────────────────────────────────────
  const SAMPLE = `@article{duan2024,
  author  = {段 某 and Lili Zhang},
  title   = {A STUDY ON THE DIGITAL ECONOMY AND REGIONAL DEVELOPMENT},
  journal = {管理世界},
  year    = {2024-06},
  volume  = {40},
  number  = {6},
  pages   = {123-128},
  doi     = {https://doi.org/10. xxxx/yyy},
}

@article{ wang 2021 ,
  author  = {Wang, Xiao-Ming and 刘 芳},
  title   = {MEDIA TRUST AND ITS DETERMINANTS},
  journal = {新闻与传播研究},
  pages   = {45–59},
  doi     = {doi:10.10000/cncs.2021.05},
}`;

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
      if (!lastResult) return;
      copyText(lastResult.fixed, btn).then((ok) =>
        setStatus(ok ? "ok" : "error", ok ? "修复结果已复制" : "复制失败，请手动选择复制"));
    } else if (act === "download") {
      if (!lastResult) return;
      downloadFile("references-fixed.bib", lastResult.fixed, "application/x-bibtex;charset=utf-8");
      setStatus("ok", "已下载 references-fixed.bib");
    }
  });

  for (const b of els.formatBtns) {
    b.addEventListener("click", () => {
      for (const x of els.formatBtns) x.classList.toggle("active", x === b);
      run();
    });
  }

  els.input.addEventListener("input", debounce(run, 160));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.activeElement === els.input) {
      els.input.value = "";
      run();
    }
  });

  // ── URL 接口（LLM）：?input=…[&format=…][#json|#md] ───────
  function initAPI() {
    const params = new URLSearchParams(location.search);
    const input = params.get("input");
    if (!input) return;
    const fmt = params.get("format");
    if (fmt) {
      for (const b of els.formatBtns) b.classList.toggle("active", b.dataset.format === fmt);
    }
    els.input.value = input;
    run();

    const hash = location.hash.replace("#", "");
    if (hash === "json" || hash === "md") {
      els.mainUI.hidden = true;
      els.apiResult.hidden = false;
      window.__result__ = lastResult;
      if (lastResult && !lastResult.error) {
        els.apiResult.textContent = hash === "md" ? toMarkdown(lastResult) : JSON.stringify({
          tool: "bibfix",
          input: { format: lastResult.format },
          entries: lastResult.entries.length,
          changes: lastResult.changes,
          warnings: lastResult.warnings,
          fixed: lastResult.fixed,
        }, null, 2);
      } else {
        els.apiResult.textContent = hash === "md"
          ? `## 解析失败\n\n${lastResult ? lastResult.error : "无输入"}`
          : JSON.stringify({ tool: "bibfix", error: lastResult ? lastResult.error : "empty" }, null, 2);
      }
    }
  }

  function toMarkdown(res) {
    const lines = [
      "## bibfix — 参考文献修复", "",
      `输入格式：${res.format === "ris" ? "RIS（已转 BibTeX）" : "BibTeX"}`,
      `条目数：${res.entries.length}`,
      `改动数：${res.changes.length}`, "",
    ];
    if (res.changes.length) {
      lines.push("### 改动清单", "");
      for (const c of res.changes) {
        lines.push(`- ${c.entry} · \`${c.field}\`：${c.before} → ${c.after}（${c.reason}）`);
      }
      lines.push("");
    }
    if (res.warnings.length) {
      lines.push("### 缺失字段提醒", "");
      for (const w of res.warnings) lines.push(`- ${w.entry}：${w.message}`);
      lines.push("");
    }
    lines.push("### 修复结果", "", "```bibtex", res.fixed, "```");
    return lines.join("\n");
  }

  // ── 初始化 ───────────────────────────────────────────────
  setStatus("ready", "就绪 · 粘贴后自动修复");
  initAPI();
  const hop = takeHandoff("bibfix");
  if (hop && hop.text && !els.input.value) {
    els.input.value = hop.text;
    run();
  }
})();
