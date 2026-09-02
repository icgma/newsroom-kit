---
name: citecheck
description: 引文格式互转——粘贴 BibTeX、RIS 或一条 APA/Chicago/MLA/GB/T 7714 格式的引文，自动识别并转换为其余格式；中英文作者名、DOI、页码规范处理
url: https://icgma.github.io/newsroom-kit/citecheck/
---

# citecheck — 引文格式互转

## 何时使用

- 用户给出一条引文（任何常见格式），要换成另一种格式
- 用户说「帮我转成 APA / GB/T 7714 / MLA / Chicago」
- 用户从知网/万方导出了 RIS，要放进 Word 的参考文献表

## 如何调用

```
GET https://icgma.github.io/newsroom-kit/citecheck/?input=<URL编码引文>[&to=apa|chicago|mla|gbt]#json
```

- `input`：URL 编码的引文文本；支持 BibTeX、RIS，或多行引文（每行一条）
- `to`：只返回目标格式；省略则同时返回四种

## 输出格式

```json
{
  "tool": "citecheck",
  "format": "apa",
  "entries": 1,
  "outputs": [
    { "apa": "…", "chicago": "…", "mla": "…", "gbt": "…" }
  ]
}
```

单条解析失败时对应元素为 `{ "error": "无法解析：…" }`——不要猜测，把错误如实告知用户。

## 提示

- 输出为纯文本：期刊名/书名的斜体无法携带，提醒用户在文档软件中补
- GB/T 输出西文作者为「姓全大写 + 名缩写」（`ZHANG W`），中文作者原样
- 规则引擎不臆造字段；识别失败时引导用户改用 BibTeX/RIS 输入
