---
name: pvalue
description: 计算 p 值、效应量（Cohen's d/dz, η², ω², Cramér's V, r²）、相关系数置信区间与功效分析（样本量估算）
url: https://icgma.github.io/newsroom-kit/pvalue/
---

# pvalue — p 值与效应量换算

## 何时使用

- 用户给出 t/F/χ²/r 值和自由度，需要算 p 值
- 用户需要计算效应量或相关系数的置信区间
- 用户需要做功效分析 / 样本量估算
- 用户问"这个结果显著吗""需要多少样本""效应量多大"

数值方法与非中心 t/F/χ² 精确分布实现，已对基准 G*Power 与 R `pwr`。

## 如何调用

### t 检验（独立样本，默认）
```
https://icgma.github.io/newsroom-kit/pvalue/?t=2.31&df=58#json
```

### t 检验（配对 / 单样本）
```
https://icgma.github.io/newsroom-kit/pvalue/?t=2.31&df=58&design=paired#json
```
此时效应量为 Cohen's dz = t/√n。

### F 检验（含 η² 与 ω²）
```
https://icgma.github.io/newsroom-kit/pvalue/?F=4.52&df1=2&df2=87#json
```

### χ² 检验（含 Cramér's V）
```
https://icgma.github.io/newsroom-kit/pvalue/?chi2=7.83&df=3&n=120&rows=3&cols=4#json
```
`n`/`rows`/`cols` 选填；只填 n 时按 2×k 表假设。

### 相关分析（含 95% CI）
```
https://icgma.github.io/newsroom-kit/pvalue/?r=0.45&n=60#json
https://icgma.github.io/newsroom-kit/pvalue/?r=0.45&n=60&conf=0.99#json
```

### 功效分析
```
?t=… 无效；用效应量：
?d=0.5&alpha=0.05&power=0.80            → 独立样本 t（每组 n）
?d=0.5&design=paired                    → 配对/单样本 t（n 对）
?f=0.25&groups=3                        → 单因素 ANOVA（每组 n）
?w=0.3&df=2                             → χ²（总 N）
?r=0.3&power=0.8                        → 相关（精确非中心 t）
```

## 参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| t / F / chi2 / r | float | 检验统计量 |
| df / df1 / df2 | int | 自由度 |
| n | int | 样本量（相关分析的 n；χ² 的总 N，选填） |
| rows / cols | int | 列联表行列数（Cramér's V 用，选填） |
| design | str | `independent`（默认）/ `paired` |
| conf | float | 相关系数置信水平，默认 0.95 |
| d / f / w | float | 期望效应量（功效分析） |
| groups | int | 组数 k（F 功效分析） |
| alpha / power | float | 显著性水平 / 期望功效（默认 0.05 / 0.80） |

## 输出格式

JSON 模式（`#json`）返回 `{ tool, input, result }`，`result` 含：
`p`、`p_one_tailed`、`effect_size: {name, symbol, value}`、`interpretation`、
`stars`、`report`（APA 格式，如 `t(58) = 2.31, p = .024, d = 0.607`）；
t 检验另含 `design`，相关另含 `ci: {level, lo, hi}`，F 另含 `omega2`。

Markdown 模式（`#md`）返回人类可读摘要。

## 效应量解读标准（Cohen 惯例）

| 效应量 | 极小 | 小 | 中等 | 大 |
|--------|------|----|------|----|
| Cohen's d / dz | < 0.2 | 0.2–0.5 | 0.5–0.8 | ≥ 0.8 |
| η² / ω² | < 0.01 | 0.01–0.06 | 0.06–0.14 | ≥ 0.14 |
| r | < 0.1 | 0.1–0.3 | 0.3–0.5 | ≥ 0.5 |
| Cramér's V | < 0.1 | 0.1–0.3 | 0.3–0.5 | ≥ 0.5 |
