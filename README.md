# newsroom-kit · 新闻人工具箱

一个新闻人接触 AI、学习编程过程中做的小工具集。每个工具都是单个 HTML + CSS + JS，零依赖，纯前端本地运行，托管在 GitHub Pages。

## 收录工具

| 工具 | 用途 | 仓库 |
|------|------|------|
| [codec](https://icgma.github.io/codec/) | Base64 / URL / Hex / HTML / Unicode 编解码、SHA 哈希、JWT 解析 | [icgma/codec](https://github.com/icgma/codec) |
| [s2t](https://icgma.github.io/s2t/) | 简繁中文转换（台湾/香港/通用），标出改动 | [icgma/s2t](https://github.com/icgma/s2t) |
| [textstats](https://icgma.github.io/textstats/) | 稿件字数、阅读/播报时长、长句与重复用词 | [icgma/textstats](https://github.com/icgma/textstats) |

## 这个仓库（hub）

`index.html` 是工具箱入口页，链接到上面各工具。各工具是独立仓库，分别部署在自己的 `*.github.io/<repo>/` 下，从 hub 跳转过去。

## 本地预览

```bash
python -m http.server 8000
```

打开 http://localhost:8000 即可。

## 部署

推送到 `main` 分支，`.github/workflows/deploy.yml` 自动发布到 https://icgma.github.io/newsroom-kit/

## 关于

作者 [icgma](https://github.com/icgma)。这是学编程的练习场，工具会随我遇到的实际问题慢慢增加。
