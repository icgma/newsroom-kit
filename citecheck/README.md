# citecheck — 引文格式互转

粘贴 BibTeX、RIS，或一条任意格式的引文，自动识别并转换成其余格式。支持 **APA 7 / Chicago（作者-年份）/ MLA 9 / GB/T 7714-2015** 四种输出。纯浏览器规则引擎，数据不上传。

## 功能

- **输入识别**：BibTeX、RIS、以及四种格式的引文文本（每行一条，自动识别）
- **中文作者**：中文姓名整体保留；GB/T 输出按「姓全大写 + 名缩写」处理西文（`ZHANG W`）
- **超过 3 位作者**：GB/T 自动截断为「前 3 位 + 等/et al」，其余格式保留 et al 标记
- **DOI / 页码规范化**：各种连字符统一；DOI 按 APA/Chicago/MLA 补 `https://doi.org/` 前缀，GB/T 用 `DOI:` 前缀
- **类型处理**：期刊论文 / 图书 / 学位论文 / 会议论文 / 网页，各自按对应模板输出
- **解析不了的明说**：规则引擎只处理可确定的部分，非引文文本明确报错，绝不编造字段

## 使用

打开 [citecheck](https://icgma.github.io/newsroom-kit/citecheck/)，粘贴引文即自动转换；每条结果独立复制。写论文链路：[scipdf](../scipdf/) 抽元数据 → [bibfix](../bibfix/) 修格式 → **citecheck 转格式** → 粘进 Word / Overleaf。

## 边界

- 期刊名与卷号的*斜体*需在 Word 中自行应用（纯文本无法携带）
- 自由文本引文解析为尽力而为：APA / GB/T / MLA / Chicago 各按其典型版式锚定（`(year).`、`[J]`、`"Title."`），遇到非常规排版可能识别失败——失败时明确提示，不会输出错的信息
- 斜体信息（如书名）从纯文本中不可恢复

## LLM 接口

```
GET https://icgma.github.io/newsroom-kit/citecheck/?input=<URL编码引文>&to=apa|chicago|mla|gbt#json
```

详见 [SKILL.md](SKILL.md)。

## 本地测试

```bash
node citecheck/test-citecheck.mjs   # 16 项断言
```
