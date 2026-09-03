# newsroom-kit · 便携工具箱

自用小工具集：写稿、核材料、访谈脱敏、整理文献。每个工具都是独立的纯前端页面（HTML + CSS + JS），零构建、零后端，打开就能用，计算留在这台电脑上。

## 本仓库自带的工具（随仓库一起部署）

| 工具 | 用途 | 地址 |
|------|------|------|
| [pvalue](pvalue/) | t/F/χ²/r → p 值、效应量、置信区间；反向功效分析算样本量。APA 格式报告 | [/pvalue/](https://icgma.github.io/newsroom-kit/pvalue/) |
| [redact](redact/) | 访谈稿匿名化：人名/机构/地名/证件号自动识别，逐项复核，导出替换映射表 | [/redact/](https://icgma.github.io/newsroom-kit/redact/) |
| [bibfix](bibfix/) | BibTeX / RIS 参考文献修复：DOI、页码、年份、中文人名、全大写标题 | [/bibfix/](https://icgma.github.io/newsroom-kit/bibfix/) |
| [scipdf](scipdf/) | 拖入论文 PDF → 标题、作者、DOI、卷期页、BibTeX / CSL-JSON | [/scipdf/](https://icgma.github.io/newsroom-kit/scipdf/) |
| [tidy](tidy/) | 清稿：零宽字符、全角字母数字、多余空白、中文标点与引号 | [/tidy/](https://icgma.github.io/newsroom-kit/tidy/) |
| [imgshrink](imgshrink/) | 本地压图：最长边、画质、JPEG/WebP，画布重绘去掉 EXIF | [/imgshrink/](https://icgma.github.io/newsroom-kit/imgshrink/) |
| [diffmark](diffmark/) | 两段稿逐字对照：改稿、审稿、作业 | [/diffmark/](https://icgma.github.io/newsroom-kit/diffmark/) |
| [citecheck](citecheck/) | 引文格式互转：BibTeX/RIS/APA/Chicago/MLA/GB/T 7714 任意进、四种出 | [/citecheck/](https://icgma.github.io/newsroom-kit/citecheck/) |
| [csvclean](csvclean/) | CSV 体检与清洗：编码/分隔符检测，混合分隔符、空列、重复行、数字列混文本 | [/csvclean/](https://icgma.github.io/newsroom-kit/csvclean/) |

## 收录的外部工具（独立仓库部署）

| 工具 | 用途 | 仓库 |
|------|------|------|
| [codec](https://icgma.github.io/codec/) | Base64 / URL / Hex / HTML / Unicode 编解码、SHA 哈希、JWT 解析 | [icgma/codec](https://github.com/icgma/codec) |
| [s2t](https://icgma.github.io/s2t/) | 简繁中文转换（台湾/香港/通用），标出改动 | [icgma/s2t](https://github.com/icgma/s2t) |
| [textstats](https://icgma.github.io/textstats/) | 稿件字数、阅读/播报时长、长句与重复用词 | [icgma/textstats](https://github.com/icgma/textstats) |
| [timezone](https://icgma.github.io/timezone/) | 外媒发布时间换算到本地，含夏令时 | [icgma/timezone](https://github.com/icgma/timezone) |

## 架构

```
index.html + hub.js + hub.css   ← 入口页（registry 数据驱动）
registry.js                     ← 工具清单（唯一数据源）
kit/kit.css + kit/kit.js        ← 统一设计系统「案头」的真源
tools/sync-kit.mjs              ← 把 kit 注入各页面的 @kit 标记区
pvalue/  redact/  bibfix/  scipdf/  tidy/  imgshrink/  diffmark/  citecheck/  csvclean/   ← 各工具
    index.html  styles.css  app.js   ← UI
    stats.js / redact.js / …         ← 纯逻辑核心（无 DOM，可单测）
    lib/                              ← 本地化的第三方库（锁版本）
```

- **设计系统**：新闻纸双主题 + 朱砂点缀，统计符号按 APA 惯例用衬线斜体。改设计只需编辑 `kit/`，然后 `node tools/sync-kit.mjs` 一键同步五个页面。
- **第三方库已本地化并锁版本**（jStat 1.9.6、pdf.js 3.11.174），不依赖 CDN，离线可用。
- **LLM 接口**：每个工具支持 URL 参数 + `#json`/`#md` fragment 直接调用，见 [LLM-SKILL-SPEC.md](LLM-SKILL-SPEC.md)。

## 本地开发

```bash
python -m http.server 8000   # 打开 http://localhost:8000
```

改完 `kit/` 后同步：`node tools/sync-kit.mjs`

生成测试 PDF（scipdf 用）：`node tools/make-test-pdf.mjs [输出路径]`

清稿单元测试：`node tidy/test-tidy.mjs`

对照单元测试：`node diffmark/test-diff.mjs`

pvalue 单元测试：`node pvalue/test-pvalue.mjs`

引文互转单元测试：`node citecheck/test-citecheck.mjs`

CSV 清洗单元测试：`node csvclean/test-csvclean.mjs`

## 部署

推送到 `main`，`.github/workflows/deploy.yml` 自动把整个仓库发布到
<https://icgma.github.io/newsroom-kit/>（工具在各自子路径下）。

## 中国访问优化

github.io 在大陆访问不稳定，本仓库已做的与可选的进一步措施：

**已完成（仓库内置）**

- **零第三方 CDN 依赖**：jStat、pdf.js 全部本地化到各工具 `lib/` 并锁版本——
  这本身就是最重要的「CDN 优化」，不受 jsdelivr/unpkg 在大陆间歇失效影响
- **scipdf 懒加载**：pdf.js（约 1.3MB）只在用户真正拖入 PDF 时才加载，首屏与普通访问零负担
- **脚本全部 `defer`**：HTML 解析不被阻塞
- **字体本地化**：Newsreader 衬线以 woff2 自托管（`assets/fonts/`），零外部请求
- **单页自包含**：每页 HTML+CSS+JS 合计 < 60KB（不含工具库），弱网可开

**可选的进一步措施（需要你自己的资源）**

| 方案 | 效果 | 门槛 |
|------|------|------|
| 自定义域名 + 国内 CDN（阿里云/腾讯云 EdgeOne）回源 github.io | 大陆访问快且稳 | 需备案域名 |
| Cloudflare Pages 镜像（Actions 里加一个 deploy 步骤） | 免备案，速度一般但可用性更好 | 需 CF 账号 |
| 多入口公告：在 README/课程主页同时给出镜像地址 | 用户可自行选择 | 无 |

如需启用镜像部署，可在 Secrets 里配置对应平台的 Token 后仿照
`deploy.yml` 增加一个 job，产物直接上传即可（仓库是纯静态目录）。

## SEO

- 每页独立 `title` / `description` / `keywords`（中文搜索词优先）
- `canonical` + [sitemap.xml](sitemap.xml) + [robots.txt](robots.txt) + 自定义 [404](404.html)
- Open Graph / Twitter Card：分享到微信、微博、X 有品牌卡片（印章设计，`assets/og-*.png`）
- JSON-LD 结构化数据：hub 为 `WebSite`，工具为 `WebApplication`
- 卡片重生成：`python -m http.server` 后用浏览器截图 `tools/og-card.html?seal=p&title=…`

注意：百度对 github.io 收录有限；如需大陆搜索引擎收录，建议配合上述自定义域名方案，
并在百度站长平台提交验证。

## 关于

作者 [icgma](https://github.com/icgma)。自用为主，遇到什么问题就补什么工具。规划见 [ROADMAP.md](ROADMAP.md)。
