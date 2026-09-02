// app.js — imgshrink UI（画布重绘 = 去掉 EXIF）
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
    drop: $("#dropzone"),
    file: $("#fileInput"),
    controls: $("#controls"),
    compare: $("#compare"),
    srcImg: $("#srcImg"),
    outImg: $("#outImg"),
    srcMeta: $("#srcMeta"),
    outMeta: $("#outMeta"),
    maxEdge: $("#maxEdge"),
    quality: $("#quality"),
    qualityLabel: $("#qualityLabel"),
    mime: $("#mime"),
  };

  let source = null; // { bitmap, name, size, type, width, height }
  let outBlob = null;
  let outUrl = "";

  function bytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }

  function extFor(mime) {
    return mime === "image/webp" ? "webp" : "jpg";
  }

  async function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setStatus("error", "请选择图片文件");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      source = {
        bitmap, name: file.name || "image",
        size: file.size, type: file.type,
        width: bitmap.width, height: bitmap.height,
      };
      els.srcImg.src = URL.createObjectURL(file);
      els.srcMeta.textContent = `${bitmap.width}×${bitmap.height} · ${bytes(file.size)}`;
      els.controls.hidden = false;
      els.compare.hidden = false;
      await compress();
    } catch (e) {
      setStatus("error", "读图失败：" + e.message);
    }
  }

  async function loadDataUrl(dataUrl, name) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], name || "paste.png", { type: blob.type || "image/png" });
    return loadFile(file);
  }

  async function compress() {
    if (!source) return;
    const maxEdge = Number(els.maxEdge.value) || 0;
    const quality = Number(els.quality.value) / 100;
    const mime = els.mime.value;
    const scale = maxEdge > 0
      ? Math.min(1, maxEdge / Math.max(source.width, source.height))
      : 1;
    const w = Math.max(1, Math.round(source.width * scale));
    const h = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(source.bitmap, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
    if (!blob) {
      setStatus("error", "压缩失败，换 JPEG 试试");
      return;
    }
    outBlob = blob;
    if (outUrl) URL.revokeObjectURL(outUrl);
    outUrl = URL.createObjectURL(blob);
    els.outImg.src = outUrl;
    const ratio = source.size ? Math.round((blob.size / source.size) * 100) : 0;
    els.outMeta.textContent = `${w}×${h} · ${bytes(blob.size)} · ${ratio}%`;
    setStatus("ok", `压到 ${bytes(blob.size)}（原 ${bytes(source.size)}）`);
  }

  function reset() {
    source = null;
    outBlob = null;
    els.controls.hidden = true;
    els.compare.hidden = true;
    els.file.value = "";
    setStatus("ready", "就绪");
  }

  els.drop.addEventListener("click", () => els.file.click());
  els.drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); els.file.click(); }
  });
  els.file.addEventListener("change", () => {
    if (els.file.files[0]) loadFile(els.file.files[0]);
  });

  ["dragenter", "dragover"].forEach((ev) => {
    els.drop.addEventListener(ev, (e) => {
      e.preventDefault();
      els.drop.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    els.drop.addEventListener(ev, (e) => {
      e.preventDefault();
      els.drop.classList.remove("dragover");
    });
  });
  els.drop.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  });

  document.addEventListener("paste", (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (!item) return;
    const file = item.getAsFile();
    if (file) loadFile(file);
  });

  els.maxEdge.addEventListener("change", compress);
  els.mime.addEventListener("change", compress);
  els.quality.addEventListener("input", () => {
    els.qualityLabel.textContent = els.quality.value + "%";
  });
  els.quality.addEventListener("change", compress);

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    if (btn.dataset.act === "download" && outBlob) {
      const base = (source.name || "image").replace(/\.[^.]+$/, "");
      saveBlob(`${base}-shrink.${extFor(els.mime.value)}`, outBlob);
      setStatus("ok", "已下载");
    } else if (btn.dataset.act === "reset") {
      reset();
    }
  });

  function saveBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const hop = takeHandoff("imgshrink");
  if (hop && hop.dataUrl) loadDataUrl(hop.dataUrl, hop.name);

  setStatus("ready", "就绪 · 拖入或粘贴图片");
})();
