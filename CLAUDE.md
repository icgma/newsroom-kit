# Project Guidelines for Claude (CLAUDE.md)

## 项目定位 (Project Overview)
本项目为一个**托管于 GitHub Pages 的纯前端/独立工具应用**，专注于开发者小众、实用的离线应用（如：编码解码、Token转CPA、Sub2API 订阅转换等）。

*   **核心约束**：
    1.  **无后端/纯客户端 (100% Client-Side)**：没有服务器逻辑，所有计算、解析与转换必须完全在浏览器中完成。
    2.  **隐私保护 (Zero Data Leak)**：敏感数据（API Key、Token、订阅链接）严禁离域发送，绝对不能向任何外部日志或分析服务透传用户输入。
    3.  **GitHub Pages 适配**：代码与构建产物必须完美兼容 GitHub Pages 的静态托管环境（注意子路径 Base Path 与路由模式）。

---

## 技术栈与部署架构 (Tech Stack & Deployment)
*   **构建工具**：Vite / HTML + TS (轻量化构建)
*   **前端框架**：React / Vue 3 / Svelte / Vanilla TS
*   **样式方案**：Tailwind CSS (CDN 或编译型)
*   **部署托管**：GitHub Pages (通过 GitHub Actions 自动构建与部署)

---

## 避坑与开发规范 (GitHub Pages Specific Rules)

### 1. 路径与路由规范 (Base Path & Routing)
*   **相对路径/Base 配置**：GitHub Pages 仓库通常部署在 `https://<user>.github.io/<repo-name>/` 子路径下。
    *   在 Vite 中必须配置 `base: './'` 或 `base: '/<repo-name>/'`。
    *   禁止使用全局绝对路径（如 `/assets/app.js`），资源引用统一使用相对路径 `./`。
*   **路由方案**：若使用前端路由，必须优先选择 **Hash 路由 (`HashRouter` / `createWebHashHistory`)**，避免用户刷新页面时触发 GitHub Pages 404 错误。

### 2. 模块与解耦 (Modular Architecture)
*   每个工具使用纯函数（Pure Function）解耦：
    *   `src/tools/<tool-name>/core.ts`: 纯转换/计算逻辑（不依赖 DOM/UI，方便单元测试）。
    *   `src/tools/<tool-name>/view.tsx`: UI 交互与状态绑定。

### 3. 跨域与请求 (CORS & Privacy)
*   若工具包含 API 连通性测试（如测试 Sub2API 节点或 Token 有效性）：
    *   必须在 UI 上明确标注“请求由浏览器直接发起”。
    *   遇到 CORS 跨域限制时，提供清晰的提示，或引导用户开启浏览器跨域插件/本地代理，严禁隐式将请求发往中继服务器。

### 4. 容错与状态离线化 (Offline & Fault Tolerance)
*   **本地持久化**：使用 `localStorage` 或 `IndexedDB` 保持用户配置（如编码偏好、转换规则），并且提供一键“清空本地数据”的隐私按钮。
*   **解析防崩溃**：所有 `JSON.parse`、Base64 解码、JWT 提取逻辑必须包裹 `try-catch`，并向用户展现人性化的报错提示。

---

## 常用 GitHub 开发与部署命令 (Common Commands)

```bash
# 本地开发
npm run dev

# 静态打包 (构建用于 GitHub Pages 的产物)
npm run build

# 本地预览打包产物 (模拟 GitHub Pages 环境)
npm run preview

# 单元测试 (纯逻辑测试)
npm run test