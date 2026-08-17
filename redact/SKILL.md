---
name: redact
description: 访谈稿匿名化——自动识别并遮盖中文文本中的人名、机构名、地名、身份证号、手机号、邮箱，返回脱敏文本与替换映射（含出现次数）
url: https://icgma.github.io/newsroom-kit/redact/
---

# redact — 访谈稿匿名化

## 何时使用

- 用户需要脱敏访谈转录、田野笔记、问卷开放题等含个人信息的文本
- 用户需要满足 IRB / 伦理审查的匿名化要求
- 用户需要一份"原文 → 替换"的映射表用于存档（re-identification key）

## 如何调用

```
GET https://icgma.github.io/newsroom-kit/redact/?input=<URL编码文本>#json
```

可选参数：

| 参数 | 说明 |
|------|------|
| input | URL 编码的文本（必填） |
| llm=1 | 用本机已保存的 LLM 配置做命名实体识别（需用户事先在页面配置 API key） |

## 输出格式

```json
{
  "tool": "redact",
  "result": {
    "redacted": "【姓名1】在【机构1】表示……",
    "replacements": [
      { "original": "张三", "replacement": "【姓名1】", "type": "person", "source": "regex", "count": 2 }
    ]
  }
}
```

- `type`：person / org / place / idcard / phone / email / custom
- `source`：regex（本地正则）或 llm
- 相同原文只返回一条，`count` 为出现次数

## 识别策略

人名识别宁可漏判、不可错杀（上下文启发式：敬语、引语动词、并列语境）。
URL 接口返回全量结果；界面端支持逐项勾选撤销后导出。

## 提示

- LLM 模式需要用户浏览器本机存有 API 配置（endpoint/key/model），agent 无法代填
- 脱敏稿与映射表应分开保存，映射表即再识别钥匙
