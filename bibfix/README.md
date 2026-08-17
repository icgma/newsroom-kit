# bibfix — 参考文献修复

粘贴从 CNKI、万方、Google Scholar、Zotero 导出的 BibTeX 或 RIS，自动修复常见格式问题。绝不臆造缺失字段，只修确定的问题，逐条列出改动便于核对。

## 功能

- **格式自动识别**：BibTeX / RIS，或手动指定
- **DOI 规范化**：去掉 `https://doi.org/`、`doi:` 前缀，去除空格和尖括号
- **URL 规范化**：去除内部空格和包裹的尖括号
- **页码连字符**：`123-128` / `123–128` / `123 — 128` → 统一为 `123--128`
- **年份提取**：`2024-06` → `2024`
- **中文作者名**：`王 小明` → `王小明`（去中文姓名内空格，英文 `Zhang San` 不动）
- **全大写英文标题**：转为标题式（仅当拉丁字母部分全大写时才改）
- **改动清单**：每个修复都列出"字段 / 改动前 / 改动后 / 原因"
- **复制 / 下载 .bib**

## 不做什么

- 不补写缺失的 DOI、作者、期刊名（不能猜）
- 不翻译标题
- 不合并重复条目
- 不校验引用内容是否正确（只修格式）

## 使用方法

1. 打开 [bibfix](https://icgma.github.io/bibfix/)
2. 粘贴 BibTeX 或 RIS 文本
3. 自动识别格式并修复
4. 查看改动清单，确认无误
5. 复制或下载修复后的 .bib 文件

## 隐私

全部在浏览器中运行，不上传任何数据。

## LLM 接口

支持 URL 参数调用，详见 [SKILL.md](SKILL.md)。

```
https://icgma.github.io/bibfix/?input=<URL编码的BibTeX>#json
https://icgma.github.io/bibfix/?input=<URL编码的RIS>&format=ris#md
```

## 本地预览

```bash
python -m http.server 8000
```

打开 http://localhost:8000/bibfix/

## 部署

推送到 `main` 分支，GitHub Actions 自动发布到 GitHub Pages。