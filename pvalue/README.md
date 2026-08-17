# pvalue — p 值与效应量换算

输入论文里的检验统计量（t / F / χ² / r），即时得到 p 值、效应量与置信区间，按 APA 格式报告；或反推「要检出这个效应需要多少样本」。纯浏览器计算，数据不上传。

## 功能

- **四种检验**：t（独立/配对·单样本）、F（含 η² 与 ω²）、χ²（含 Cramér's V）、r 相关（含 Fisher z 置信区间）
- **精确数值方法**：非中心 t / F / χ² 分布，与 G*Power、R `pwr` 对基准
- **功效分析**：给定期望效应量与 α/功效，算最小样本量；Cohen 小/中/大效应快捷按钮
- **APA 报告**：一键复制 `t(58) = 2.31, p = .024, d = 0.607`
- **统计符号按 APA 惯例衬线斜体显示**

## 使用

打开 [pvalue](https://icgma.github.io/newsroom-kit/pvalue/)，选检验类型，填统计量——输入完成即自动计算。

## LLM 接口

支持 URL 参数 + `#json` / `#md`，详见 [SKILL.md](SKILL.md)。

```
https://icgma.github.io/newsroom-kit/pvalue/?t=2.31&df=58#json
https://icgma.github.io/newsroom-kit/pvalue/?d=0.5#json
```

## 技术说明

- 统计库 jStat 1.9.6 已本地化（`lib/jstat.min.js`），不依赖 CDN，离线可用
- 纯计算核心在 `stats.js`（无 DOM 依赖，可在 Node 中直接测试）
- 非中心 F 的混合级数注意尺度因子 `x·df1/(df1+2j)`（早期实现漏掉此处导致功效分析错误 6 倍，已修复并对基准验证）

## 本地预览

```bash
python -m http.server 8000   # http://localhost:8000/pvalue/
```
