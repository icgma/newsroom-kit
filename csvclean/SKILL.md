---
name: csvclean
description: CSV 清洗与体检——自动检测分隔符与编码（UTF-8/GB18030），报告混合分隔符、引号不闭合、空列、重复行、数字列混入文本等问题；勾选制清洗，本地完成
url: https://icgma.github.io/newsroom-kit/csvclean/
---

# csvclean — CSV 清洗与体检

## 何时使用

- 用户的问卷数据 / Excel 导出 / 数据库导出打不开或「看着不对」
- 用户在分析前想检查 CSV 的编码、分隔符、缺行缺列问题
- 用户需要删重复行、去空白、全角转半角等确定性清洗

## 如何调用

```
GET https://icgma.github.io/newsroom-kit/csvclean/?input=<URL编码CSV>#json
```

适合小样本；大文件请引导用户在页面上拖入（文件不离开本机）。

## 输出格式

```json
{
  "tool": "csvclean",
  "delimiter": ",",
  "actions": ["删除重复行 1 行"],
  "report": {
    "rows": 3, "columns": 3,
    "columnTypes": [{ "name": "id", "type": "number" }],
    "issues": [{ "row": 0, "type": "mixed-col", "detail": "…" }]
  },
  "output": "…清洗后的 CSV…"
}
```

`issues[].type`：ragged（行列数不齐）/ dup-col / empty-col / mixed-col / unclosed-quote / encoding / invisible / fullwidth / whitespace。

## 提示

- 编码自动回退 GB18030 并在 issues 里注明——中文问卷平台导出常见
- 清洗动作在 URL 模式取默认集（去空白、删空行）；更多选项请在页面勾选
