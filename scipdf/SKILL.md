---
name: scipdf
description: 论文 PDF 元数据提取——拖入 PDF，本地解析标题、作者、DOI、摘要与卷期页，生成 BibTeX 与 CSL-JSON。启发式提取，结果需人工核对
url: https://icgma.github.io/newsroom-kit/scipdf/
---

# scipdf — 论文 PDF 元数据提取

## 何时使用

- 用户有学术论文 PDF，想知道标题、作者、DOI、摘要、卷期页
- 用户需要为 PDF 生成 BibTeX / CSL-JSON 条目
- 用户有一批 PDF 需要快速整理成参考文献库

## 如何调用

**不支持 URL 参数**（需要文件输入）。两种方式：

1. 引导用户打开 <https://icgma.github.io/newsroom-kit/scipdf/> 拖入 PDF
2. 无头浏览器：加载页面 → 派发文件选择事件 → URL 加 `#json`，提取完成后
   页面自动输出 JSON，并写入 `window.__result__`

## 输出格式（`#json`）

```json
{
  "tool": "scipdf",
  "result": {
    "title": "…", "authors": "Wei Zhang, Juan Li and Marco Rossi",
    "year": "2023", "doi": "10.1093/jcr/12.3.45-59",
    "journal": "Journal of Communication Research",
    "volume": "12", "number": "3", "pages": "45--59",
    "abstract": "…", "type": "article",
    "bibtex": "@article{zhang2023,\n  …}"
  }
}
```

- `authors` 用 `and` 分隔（BibTeX 惯例）
- `pages` 为 BibTeX 双连字符格式；CSL-JSON 里自动转为单连字符
- 空字段返回空字符串（未识别），不是 null

## 可靠性

启发式提取：标题/作者识别准确率因排版而异，**结果务必人工核对**。
扫描版 PDF（无文本层）会明确报错提示需要 OCR。
