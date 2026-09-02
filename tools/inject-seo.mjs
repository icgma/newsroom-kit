// inject-seo.mjs — 向四个工具页注入 SEO 元数据块（一次性维护脚本）
// 用法：node tools/inject-seo.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://icgma.github.io/newsroom-kit";

const TOOLS = {
  pvalue: {
    title: "pvalue — p 值、效应量与样本量在线计算 | newsroom-kit",
    desc: "输入 t / F / χ² / r 统计量，即刻得到 p 值、效应量（Cohen's d、η²、ω²、Cramér's V）与 95% 置信区间，按 APA 格式报告；亦可反推所需样本量。与 G*Power 对基准的精确计算，纯浏览器运行。",
    keywords: "p值计算,效应量,Cohen's d,样本量,功效分析,eta方,卡方检验,t检验,置信区间,APA,统计检验,在线统计",
    ogTitle: "pvalue — p 值与效应量换算",
    ogDesc: "t / F / χ² / r → p 值、效应量、置信区间；反向功效分析算样本量。APA 格式报告。",
    twDesc: "统计量进，APA 报告出；功效分析算样本量。全部本地计算。",
    appName: "pvalue — p 值与效应量换算",
    appDesc: "输入 t/F/χ²/r 统计量计算 p 值、效应量与置信区间，或反推所需样本量；APA 格式报告。",
  },
  redact: {
    title: "redact — 访谈稿匿名化·脱敏工具（IRB 伦理审查） | newsroom-kit",
    desc: "自动识别并脱敏访谈稿中的人名、机构、地名、身份证号、手机号、邮箱。每一处替换均可逐项复核撤销，导出替换映射表，满足 IRB / 伦理审查要求。纯浏览器运行，数据不上传。",
    keywords: "访谈脱敏,匿名化,伦理审查,IRB,人名识别,个人信息保护,质性研究,替换映射表,文本脱敏",
    ogTitle: "redact — 访谈稿匿名化",
    ogDesc: "人名 / 机构 / 地名 / 证件号自动识别，逐项复核，导出映射表，满足伦理审查。",
    twDesc: "访谈稿一键脱敏：逐项复核 + 映射表导出，IRB 伦理审查友好。",
    appName: "redact — 访谈稿匿名化",
    appDesc: "自动识别人名、机构、地名、证件号等个人信息并脱敏，支持逐项复核与映射表导出。",
  },
  bibfix: {
    title: "bibfix — BibTeX / RIS 参考文献修复工具（CNKI·万方·Scholar） | newsroom-kit",
    desc: "粘贴从 CNKI、万方、Google Scholar 导出的 BibTeX / RIS，自动修复 DOI 前缀、页码连字符、年份、中文人名、全大写标题，RIS 自动转 BibTeX 并生成规范引用键。不臆造缺失字段，逐条列改动。纯浏览器运行。",
    keywords: "参考文献修复,BibTeX,RIS,DOI,CNKI,万方,Zotero,Overleaf,引用格式,文献管理",
    ogTitle: "bibfix — 参考文献修复",
    ogDesc: "BibTeX / RIS 自动修复：DOI · 页码 · 年份 · 中文人名 · 不臆造字段。",
    twDesc: "中文数据库导出的引文问题一键修复，RIS 直接转 BibTeX。",
    appName: "bibfix — 参考文献修复",
    appDesc: "自动修复 BibTeX / RIS 参考文献的常见格式问题，支持 RIS 转 BibTeX 与规范引用键生成。",
  },
  tidy: {
    title: "tidy — 清稿：去零宽字符、全角字母、多余空白 | newsroom-kit",
    desc: "粘贴从 Word、微信、网页拷出来的稿。去掉零宽字符、全角字母数字、行尾空白和多余空行，把中文后的半角标点改成全角，引号统一成直角引号。全部在浏览器本地完成。",
    keywords: "清稿,去空格,零宽字符,全角半角,中文标点,引号,微信粘贴,Word粘贴,新闻改稿",
    ogTitle: "tidy — 清稿",
    ogDesc: "Word / 微信粘出来的垃圾清掉。零宽字符、全角字母、多余空白、中文标点。",
    twDesc: "粘进来，干净稿复制出去。数据不出本机。",
    appName: "tidy — 清稿",
    appDesc: "清理 Word、微信粘贴稿中的零宽字符、全角字母数字、多余空白，并统一中文标点与引号。",
  },
  diffmark: {
    title: "diffmark — 逐字对照：改稿、审稿、作业 | newsroom-kit",
    desc: "两段稿逐行、逐字对照。删的标红，增的标绿。改稿前后、审稿意见、学生作业都能用。纯浏览器，数据不出本机。",
    keywords: "文本对照,逐字比对,diff,改稿,审稿,作业批改,版本对比",
    ogTitle: "diffmark — 逐字对照",
    ogDesc: "两段稿对照：删的标红，增的标绿。改稿、审稿、作业。",
    twDesc: "改稿前后贴进来，改动处标色。数据不出本机。",
    appName: "diffmark — 逐字对照",
    appDesc: "两段文本逐行逐字对照，标出增删改。",
  },
  imgshrink: {
    title: "imgshrink — 本地压图：供图、课件、邮件附件 | newsroom-kit",
    desc: "把相机原图、截图压到能当邮件附件或课件插图。选最长边和画质，导出 JPEG 或 WebP。画布重绘，EXIF 一并去掉。图片不上传。",
    keywords: "图片压缩,本地压图,邮件附件,WebP,JPEG,去EXIF,供图,课件插图",
    ogTitle: "imgshrink — 本地压图",
    ogDesc: "原图拖进来，压到能发邮件。EXIF 去掉，图片不上传。",
    twDesc: "供图、课件、附件。压完本机下载。",
    appName: "imgshrink — 本地压图",
    appDesc: "在浏览器本地压缩图片，控制最长边与画质，导出 JPEG / WebP 并去除 EXIF。",
  },
  scipdf: {
    title: "scipdf — 论文 PDF 元数据提取→BibTeX | newsroom-kit",
    desc: "拖入论文 PDF，在浏览器中本地提取标题、作者、DOI、摘要与卷期页，生成 BibTeX / CSL-JSON。启发式提取，字段可核对可修改，PDF 不上传。",
    keywords: "PDF元数据,论文PDF,BibTeX生成,DOI提取,文献管理,引用格式,CSL-JSON,卷期页",
    ogTitle: "scipdf — PDF 元数据提取",
    ogDesc: "拖入论文 PDF → 标题 · 作者 · DOI · 卷期页，生成 BibTeX。全程本地。",
    twDesc: "PDF 拖进来，BibTeX 出去，不上传任何文件。",
    appName: "scipdf — 论文 PDF 元数据提取",
    appDesc: "本地解析论文 PDF，提取标题、作者、DOI、摘要与卷期页，生成 BibTeX 与 CSL-JSON。",
  },
};

for (const [slug, t] of Object.entries(TOOLS)) {
  const file = join(root, slug, "index.html");
  let html = readFileSync(file, "utf8");
  const url = `${BASE}/${slug}/`;
  const img = `${BASE}/assets/og-${slug}.png`;

  const block = `<title>${t.title}</title>
<meta name="description" content="${t.desc}" />
<meta name="keywords" content="${t.keywords}" />
<meta name="author" content="icgma" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f4ee" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#171410" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="newsroom-kit 新闻人工具箱" />
<meta property="og:title" content="${t.ogTitle}" />
<meta property="og:description" content="${t.ogDesc}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${img}" />
<meta property="og:locale" content="zh_CN" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t.ogTitle}" />
<meta name="twitter:description" content="${t.twDesc}" />
<meta name="twitter:image" content="${img}" />
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "${t.appName}",
  "url": "${url}",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Web",
  "browserRequirements": "Requires JavaScript",
  "inLanguage": "zh-CN",
  "description": "${t.appDesc}",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "CNY" },
  "isPartOf": { "@type": "WebSite", "name": "newsroom-kit 新闻人工具箱", "url": "${BASE}/" }
}
</script>`;

  // 幂等：先移除旧的注入块（title 到 ld+json 结束）
  html = html.replace(/<title>[\s\S]*?<\/script>\n(?=\n*<link rel="icon")/, "");
  html = html.replace(/<title>[^\n]*<\/title>\n<meta name="description"[^\n]*\/>/, block);

  writeFileSync(file, html);
  console.log(`✓ ${slug}`);
}
console.log("完成");
