# scipdf — 论文 PDF 元数据提取

拖入论文 PDF，在浏览器中提取标题、作者、DOI、摘要与卷期页，生成 BibTeX 和 CSL-JSON。基于启发式规则——**不是万能的**——所有字段提取后可直接修改，改完即时重新生成。PDF 不上传，全部本地解析。

## 功能

- **拖入即用**：拖放或点击选择；只读取前 5 页
- **行结构重建**：按 pdf.js 的换行信息重建文本行（而非把整页拍平），跨行标题自动合并
- **启发式识别**：
  - 标题：位置与文本特征评分；排除期刊头、DOI 行、引用行、摘要行
  - 作者：标题下方行模式匹配；清理上标编号（`王晓明1` → `王晓明`）
  - DOI / 年份（版权年份优先，避免收稿年误导）
  - 摘要：`Abstract` / `摘要` / `内容提要` 标记
  - **卷期页**：引用行解析（`Journal, 12(3), 45-59`、中文 `《期刊》, 2024, 51(6): 123-138` 等）
- **可编辑**：所有字段可改，BibTeX 实时重生成；一键复制 / 下载 .bib / 复制 CSL-JSON

## 使用

打开 [scipdf](https://icgma.github.io/newsroom-kit/scipdf/)，拖入 PDF。

## LLM 接口

不支持 URL 参数（需文件），但支持 `#json` / `#md` fragment：拖入 PDF 后自动输出结构化结果。详见 [SKILL.md](SKILL.md)。

## 技术说明

- pdf.js 3.11.174（UMD）已本地化至 `lib/`，worker 同版本，离线可用
- 纯逻辑核心在 `scipdf.js`（无 DOM、无 pdf.js 依赖，可在 Node 中测试）

## 本地预览

```bash
python -m http.server 8000   # http://localhost:8000/scipdf/
node tools/make-test-pdf.mjs # 生成测试 PDF（仓库根目录运行）
```
