---
name: bibfix
description: 参考文献修复——粘贴 BibTeX 或 RIS（来自 CNKI、万方、Google Scholar），自动修复可确定的格式问题，转换 RIS 为 BibTeX，生成规范引用键，返回修复结果、逐条改动清单与缺失字段提醒
url: https://icgma.github.io/newsroom-kit/bibfix/
---

# bibfix — 参考文献修复

## 何时使用

- 用户从 CNKI、万方、Google Scholar、Zotero 导出了 BibTeX 或 RIS，需要修复格式问题
- 用户抱怨参考文献里 DOI 打不开、页码格式混乱、作者名奇怪、标题全大写
- 用户需要把 RIS 批量转成 BibTeX（含类型映射与规范引用键）

## 如何调用

```
GET https://icgma.github.io/newsroom-kit/bibfix/?input=<URL编码文本>[&format=bibtex|ris|auto]#json
```

## 修复规则（只修确定的，绝不臆造）

- **DOI**：去掉 `https://doi.org/`、`doi:` 前缀、空格、尖括号
- **URL**：去空格与尖括号
- **页码**：各类连字符（`-` `–` `—` 带空格）→ `123--128`
- **年份**：`2024-06` → `2024`
- **中文作者名**：`王 小明` → `王小明`（英文 `Zhang San` 不动）
- **全大写英文标题** → 标题式大小写（仅当拉丁部分全大写）
- **引用键**：空键生成「首作者姓+年份」；非法字符（空格/逗号）清理；重复键加后缀

## RIS → BibTeX 转换

- 类型映射：JOUR→article、CONF→inproceedings、BOOK→book、THES→phdthesis、CHAP→incollection…
- 字段映射：TI/AU/PY/JO|JF|T2/VO/IS/SP+EP/DO/AB/PB
- 会议与书章的 T2 映射为 `booktitle`

## 输出格式

```json
{
  "tool": "bibfix",
  "entries": 2,
  "changes": [ { "entry": "#1 duan2024", "field": "doi", "before": "…", "after": "…", "reason": "…" } ],
  "warnings": [ { "entry": "#2 wang2021", "message": "缺少 year 字段" } ],
  "fixed": "@article{duan2024,\n  …"
}
```

`warnings` 提示缺失的 author / year / title（不补写，保持原样）。
