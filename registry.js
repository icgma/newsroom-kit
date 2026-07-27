// registry — 工具清单（唯一数据源）
// 加工具 = 在 TOOLS 里加一条；不需要改主页 HTML。
// 一个工具可同时属于多个类别与多个场景，主页据此自由重组。

// ---------- 类别：按“它是什么” ----------
const CATEGORIES = [
  { id: "text",    name: "文字处理", desc: "改写、转换、清理稿件文字" },
  { id: "measure", name: "计量核查", desc: "数字、时间、字数的换算与核对" },
  { id: "encode",  name: "编码转换", desc: "格式与编码之间的互转" },
  { id: "media",   name: "图像音视", desc: "图片与多媒体素材处理" },
];

// ---------- 场景：按“什么时候用” ----------
// steps 是有顺序的工作流，主页会按顺序展示成流程条。
const SCENARIOS = [
  {
    id: "cross-strait",
    name: "一稿多地发布",
    desc: "同一篇稿子要发大陆、台湾、香港，字形和用词都得换。",
    steps: ["s2t", "textstats"],
  },
  {
    id: "filing",
    name: "交稿前自查",
    desc: "字数够不够、有没有超长句、朗读要多久。",
    steps: ["textstats"],
  },
  {
    id: "foreign-desk",
    name: "处理外媒来稿",
    desc: "换算发布时间、还原乱码与转义字符、把繁体转回简体。",
    steps: ["timezone", "codec", "s2t"],
  },
  {
    id: "verify",
    name: "核查取证",
    desc: "算文件哈希核对素材是否被改动、解析可疑链接与 token。",
    steps: ["codec"],
  },
];

// ---------- 工具 ----------
// status: live | wip | planned
const TOOLS = [
  {
    id: "codec",
    name: "codec",
    title: "编解码",
    tagline: "Base64、URL、Hex、JWT、哈希",
    desc: "还原邮件里的乱码附件名、解开被转义的链接、算素材文件的哈希核对是否被改动。",
    url: "https://icgma.github.io/codec/",
    repo: "https://github.com/icgma/codec",
    status: "live",
    categories: ["encode", "text"],
    scenarios: ["foreign-desk", "verify"],
    tags: ["Base64", "URL 编码", "Hex", "JWT", "SHA"],
    keywords: ["编码", "解码", "加密", "解密", "乱码", "转义", "哈希", "md5", "校验", "base64", "token"],
    icon: '<path fill="currentColor" d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4Zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4Z"/>',
  },
  {
    id: "s2t",
    name: "s2t",
    title: "简繁转换",
    tagline: "简 ↔ 繁，含台港用词差异",
    desc: "不只换字形。软件/軟體、网络/網路、鼠标/滑鼠——台港用词习惯一并处理，改动处逐字标出便于校对。",
    url: "https://icgma.github.io/s2t/",
    repo: "https://github.com/icgma/s2t",
    status: "live",
    categories: ["text"],
    scenarios: ["cross-strait", "foreign-desk"],
    tags: ["简体", "繁体", "台湾正体", "香港字形", "OpenCC", "直角引号"],
    keywords: ["简繁", "繁简", "转换", "台湾", "香港", "港台", "用词", "校对", "发稿", "简转繁", "繁转简"],
    icon: '<path fill="currentColor" d="M4 4h7v2.5H8.6V14H6.4V6.5H4V4Zm8.5 6H20v2h-2.6v5.5h-2.2V12H12.5v-2Z"/><path fill="currentColor" d="M12.8 4h1.9l2.8 4.8h-2.1l-.6-1.2h-2.2l-.6 1.2H10L12.8 4Z" opacity=".55"/>',
  },
  {
    id: "textstats",
    name: "textstats",
    title: "稿件统计",
    tagline: "字数、朗读时长、长句检测",
    desc: "中文按汉字算而不是按空格分词。给出播报时长、阅读时长，并把超过 50 字的长句逐条列出来。",
    url: "https://icgma.github.io/textstats/",
    repo: "https://github.com/icgma/textstats",
    status: "live",
    categories: ["measure", "text"],
    scenarios: ["filing", "cross-strait"],
    tags: ["汉字计数", "朗读时长", "长句", "段落"],
    keywords: ["字数", "统计", "计数", "口播", "播报", "配音", "时长", "可读性", "自查", "编辑", "改稿"],
    icon: '<path fill="currentColor" d="M4 19h16v2H4v-2Zm2-5h2v4H6v-4Zm4-5h2v9h-2V9Zm4 3h2v6h-2v-6Zm4-8h2v14h-2V4Z"/>',
  },
  {
    id: "timezone",
    name: "timezone",
    title: "时区换算",
    tagline: "外媒发布时间换算到本地",
    desc: "路透 14:30 GMT 发的稿，北京时间几点？含夏令时判断，可同时比对多个新闻中心的当地时间。",
    url: "https://icgma.github.io/timezone/",
    repo: "https://github.com/icgma/timezone",
    status: "live",
    categories: ["measure"],
    scenarios: ["foreign-desk"],
    tags: ["时区", "夏令时", "Unix 时间戳", "ISO 8601"],
    keywords: ["时间", "换算", "北京时间", "格林威治", "GMT", "UTC", "外媒", "路透", "时差", "当地时间"],
    icon: '<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm1 3h-2v6l5 3 1-1.7-4-2.3V7Z"/>',
  },
  {
    id: "imgshrink",
    name: "imgshrink",
    title: "图片压缩",
    tagline: "供图前压到能发邮件",
    desc: "相机原图动辄 8MB，邮箱附件上限常是 10MB。本地压缩与格式转换，图片不上传。",
    url: "https://icgma.github.io/imgshrink/",
    repo: "https://github.com/icgma/imgshrink",
    status: "planned",
    categories: ["media"],
    scenarios: [],
    tags: ["压缩", "WebP", "尺寸缩放", "EXIF"],
    keywords: ["图片", "照片", "供图", "邮件附件", "太大", "瘦身", "jpg", "png", "webp", "分辨率"],
    keywords: ["图片", "照片", "供图", "邮件", "附件", "体积", "缩小", "格式转换", "JPEG", "PNG"],
    icon: '<path fill="currentColor" d="M21 5H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Zm-1 2v7.6l-3.3-3.3-3 3-3.2-3.2L4 17.4V7h16ZM8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>',
  },
];
