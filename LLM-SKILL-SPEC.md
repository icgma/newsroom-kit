# newsroom-kit LLM Skill 接口规范

## 核心理念

每个工具同时服务两类用户：
1. **人类** — 通过浏览器界面操作
2. **LLM agent** — 通过 URL 参数 + fragment hash 调用，获取结构化输出

LLM 不需要"看到"网页，它只需要：知道 URL、传什么参数、拿到什么格式的结果。

---

## 接口设计

### 1. URL 参数驱动

每个工具支持 GET 参数，直接预填输入并自动执行：

```
https://icgma.github.io/newsroom-kit/pvalue/?t=2.31&df=58
https://icgma.github.io/newsroom-kit/redact/?input=…（URL编码的文本）
https://icgma.github.io/newsroom-kit/bibfix/?input=…（URL编码的BibTeX/RIS）
https://icgma.github.io/newsroom-kit/scipdf/  （需拖入文件，不支持 URL 参数）
```

### 2. Fragment hash 输出模式

当 URL 包含 `#json` 或 `#md` 时，工具不渲染 UI，只显示纯文本结果，
并将结果写入 `window.__result__` 全局变量。

### 3. 输出格式

**JSON 模式**（`#json`）：
```json
{
  "tool": "pvalue",
  "input": { "test": "t", "statistic": 2.31, "df": 58 },
  "result": {
    "p": 0.0245,
    "p_one_tailed": 0.0123,
    "effect_size": { "name": "Cohen's d", "symbol": "d", "value": 0.607 },
    "interpretation": "中等",
    "report": "t(58) = 2.31, p = .024, d = 0.607"
  }
}
```

**Markdown 模式**（`#md`）：人类可读的结构化摘要。

---

## 各工具接口速查

### pvalue — 统计换算

```
GET ?t=2.31&df=58#json                        → t 检验 p 值 + Cohen's d
GET ?t=2.31&df=58&design=paired#json          → 配对/单样本 t 检验（dz）
GET ?F=4.52&df1=2&df2=87#json                 → F 检验 p 值 + η² + ω²
GET ?chi2=7.83&df=3&n=120&rows=3&cols=4#json  → χ² 检验 p 值 + Cramér's V
GET ?r=0.45&n=60#json                         → 相关分析 + r² + 95% CI
GET ?r=0.45&n=60&conf=0.99#json               → 99% 置信区间
GET ?d=0.5&alpha=0.05&power=0.80#json         → 功效分析（独立样本 t，每组 n）
GET ?d=0.5&design=paired#json                 → 功效分析（配对 t，n 对）
GET ?f=0.25&groups=3#json                     → 功效分析（单因素 ANOVA）
GET ?w=0.3&df=2#json                          → 功效分析（χ²）
GET ?r=0.3&power=0.8#json                     → 功效分析（相关，精确非中心 t）
```

| 参数 | 类型 | 说明 |
|------|------|------|
| t / F / chi2 / r | float | 检验统计量 |
| df / df1 / df2 | int | 自由度 |
| n | int | 样本量（χ² 的 N、相关的 n） |
| rows / cols | int | χ² 列联表行列数（算 Cramér's V 用） |
| design | str | `independent`（默认）/ `paired` |
| conf | float | 相关系数置信水平，默认 0.95 |
| d / f / w | float | 期望效应量（功效分析） |
| alpha / power | float | 显著性水平 / 期望功效（默认 0.05 / 0.80） |
| groups | int | 组数（F 功效分析） |

数值方法与 G*Power / R `pwr` 对基准（非中心 t/F/χ² 精确分布）。

### redact — 访谈稿匿名化

```
GET ?input=<URL编码文本>#json              → 自动脱敏，返回脱敏文本 + 替换清单
GET ?input=…&llm=1#json                    → 调 LLM 做命名实体识别（需本机已存 API 配置）
```

返回的 `replacements` 含 `count`（出现次数）。识别策略：宁可漏判、不可错杀；
界面端支持逐项勾选撤销，URL 接口返回全量结果。

### bibfix — 参考文献修复

```
GET ?input=<URL编码 BibTeX或RIS>&format=bibtex|ris|auto#json
```

返回 `{ entries, changes[], warnings[], fixed }`：
- `changes`：逐条改动（字段、前后值、原因）
- `warnings`：缺失字段提醒（author/year/title，不补写）
- `fixed`：修复后的 BibTeX（RIS 输入会被转换，引用键按「首作者姓+年份」生成）

### scipdf — PDF 元数据提取

不支持 URL 参数（需文件上传），但支持 `#json` / `#md` fragment：
拖入 PDF 后自动输出结构化结果。

---

## 输出约定

- 所有工具把结果同时写入 `window.__result__`（供无头浏览器读取）
- 出错时 JSON 模式返回 `{ tool, input?, error }`，HTTP 仍为 200
- p 值格式遵循 APA：`< .001`，`.024`（去前导零）
