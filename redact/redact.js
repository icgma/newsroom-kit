// redact.js — 匿名化脱敏核心（纯逻辑，无 DOM；经 globalThis.Redact 导出）
//
// 识别策略：正则 + 词表启发式（本机、零依赖、结果可复核）；
// 可选 LLM 命名实体识别（由调用方提供 API 配置）。
// 产品原则：宁可漏判、不可错杀；所有替换逐项列出，用户可勾选撤销。

((global) => {
  "use strict";

  // ── 常见姓氏（含复姓，长的优先匹配）──────────────────────
  const SURNAMES = [
    "王","李","张","刘","陈","杨","赵","黄","周","吴",
    "徐","孙","胡","朱","高","林","何","郭","马","罗",
    "梁","宋","郑","谢","韩","唐","冯","于","董","萧",
    "程","曹","袁","邓","许","傅","沈","曾","彭","吕",
    "苏","卢","蒋","蔡","贾","丁","魏","薛","叶","阎",
    "余","潘","杜","戴","夏","钟","汪","田","任","姜",
    "范","方","石","姚","谭","廖","邹","熊","金","陆",
    "郝","孔","白","崔","康","毛","邱","秦","江","史",
    "顾","侯","邵","孟","龙","万","段","雷","钱","汤",
    "尹","黎","易","常","武","乔","贺","赖","龚","文",
    "庞","樊","兰","殷","施","陶","洪","翟","安","颜",
    "倪","严","牛","温","芦","季","俞","章","鲁","葛",
    "伍","韦","申","尤","毕","聂","丛","焦","向","柳",
    "邢","路","岳","齐","梅","莫","庄","辛","管","祝",
    "左","涂","谷","祁","时","舒","耿","牟","卜","詹",
    "关","苗","凌","费","纪","靳","盛","童","欧","甄",
    "项","曲","成","游","阳","裴","席","宁","柯","阮",
    "桂","闵","欧阳","太史","端木","上官","司马","东方",
    "独孤","南宫","万俟","闻人","夏侯","诸葛","尉迟","公羊",
    "赫连","澹台","皇甫","宗政","濮阳","公冶","太叔","申屠",
    "公孙","慕容","仲孙","钟离","长孙","宇文","司徒","鲜于",
    "司空","闾丘","子车","亓官","司寇","巫马","公西","颛孙",
    "壤驷","公良","漆雕","乐正","谷梁","拓跋","夹谷","轩辕",
    "令狐","段干","百里","呼延","东郭","南门","羊舌","微生",
    "左丘","西门","第五","荣","双","习","宫","欧",
  ];
  const SURNAMES_SORTED = [...new Set(SURNAMES)].sort((a, b) => b.length - a.length);

  // ── 人名上下文线索 ───────────────────────────────────────
  // 名字后面紧跟的敬语/称谓 → 强人名信号
  const HONORIFIC_AFTER = /^(?:先生|女士|老师|教授|医生|大夫|主任|校长|院长|经理|记者|律师|工程师|同学|书记|局长|处长|科长|队长|警官|师傅|阿姨|叔叔|大爷|大妈|博士|硕士|护士|教练|园长|镇长|县长|市长|省长|部长|行长|董事长|咨询师|分析师|研究员|讲师|助教|编辑|作家|导演|演员|歌手|司机|厨师|保安|保洁|保姆|月嫂|护工)/;
  // 名字后面紧跟的引语/行为动词 → 人名信号
  const SPEECH_AFTER = /^(?:表示|认为|指出|回忆|告诉|介绍|解释|强调|提到|补充|回答|说|称|问|写道|直言|坦言|感叹|同意|不同意|反对|拒绝|支持|拒绝道|回忆道|补充道|解释道|强调道|笑着说)/;
  // 枚举语境：前接（句首或）和/、/， 且名后接这些 → 多人并列（张三和李四都…）
  const ENUM_AFTER = /^[都也就还和与、，。；;或是]/;
  // 名字前面紧贴的称谓 → 允许中文字符前缀
  const HONORIFIC_BEFORE = /(?:受访者|被访者|被试|患者|村民|居民|同学|学生|老师|教授|医生|主任|校长|院长|经理|记者|律师|工程师|书记|局长|处长|科长|队长|警官|师傅|博士|教练|编辑|导演|司机|厨师|保安|保姆|月嫂|护工)$/;
  // 单字名排除：这些字极少单独作为人名的名（数字不在此列——张三、李四、王五是典型人名）
  const STOP_GIVEN = new Set(["的","了","在","是","和","与","或","有","不","也","都","就","而","及","等","被","把","让","给","从","向","到","对","为","以","于","比","按","将","用","因","由","但","却","又","再","才","已","曾","正","要","会","能","可","该","应","须","需","得","着","过","来","去","起","出","入","上","下","中","前","后","里","外","间","内","旁","左","右","东","西","南","北","个","只","条","种","样","件","次","回","人","年","月","日","时","分","秒","大","小","多","少","好","坏","新","旧","高","低","长","短","远","近","快","慢","早","晚","很","太","更","最","同","各","每","另","别","这","那","哪","怎","如","若","虽","然","所","并","且"]);

  const CJK = /[\u3400-\u9fff]/;
  const CJK_FULL = /^[\u3400-\u9fff]+$/;

  // ── 地名词表（省级 + 常见城市/城区，长的优先）───────────
  const PLACES = [
    "北京市","天津市","上海市","重庆市",
    "河北省","山西省","辽宁省","吉林省","黑龙江省",
    "江苏省","浙江省","安徽省","福建省","江西省","山东省",
    "河南省","湖北省","湖南省","广东省","海南省",
    "四川省","贵州省","云南省","陕西省","甘肃省","青海省","台湾省",
    "内蒙古自治区","广西壮族自治区","西藏自治区","宁夏回族自治区","新疆维吾尔自治区",
    "香港特别行政区","澳门特别行政区",
    "北京","天津","上海","重庆","河北","山西","辽宁","吉林","黑龙江",
    "江苏","浙江","安徽","福建","江西","山东","河南","湖北","湖南",
    "广东","海南","四川","贵州","云南","陕西","甘肃","青海","台湾",
    "内蒙古","广西","西藏","宁夏","新疆","香港","澳门",
    "石家庄","唐山","秦皇岛","邯郸","邢台","保定","张家口","承德","沧州","廊坊","衡水",
    "太原","大同","阳泉","长治","晋城","朔州","晋中","运城","忻州","临汾","吕梁",
    "沈阳","大连","鞍山","抚顺","本溪","丹东","锦州","营口","阜新","辽阳","盘锦","铁岭","葫芦岛",
    "长春","四平","辽源","通化","白山","松原","白城",
    "哈尔滨","齐齐哈尔","牡丹江","佳木斯","大庆","鸡西","双鸭山","伊春","七台河","绥化","黑河",
    "南京","苏州","无锡","常州","徐州","南通","连云港","淮安","盐城","扬州","镇江","泰州","宿迁",
    "杭州","宁波","温州","嘉兴","湖州","绍兴","金华","衢州","舟山","台州","丽水",
    "合肥","芜湖","蚌埠","淮南","马鞍山","淮北","铜陵","安庆","黄山","滁州","阜阳","宿州","六安","亳州","池州","宣城",
    "福州","厦门","泉州","漳州","莆田","龙岩","三明","南平","宁德",
    "南昌","景德镇","萍乡","九江","新余","鹰潭","赣州","吉安","宜春","抚州","上饶",
    "济南","青岛","烟台","威海","潍坊","淄博","临沂","济宁","泰安","日照","东营","德州","聊城","滨州","菏泽","枣庄",
    "郑州","洛阳","开封","南阳","安阳","新乡","许昌","平顶山","焦作","信阳","驻马店","商丘","周口","漯河","濮阳","鹤壁","三门峡",
    "武汉","宜昌","襄阳","荆州","十堰","黄冈","孝感","荆门","咸宁","黄石","鄂州","随州","恩施",
    "长沙","株洲","湘潭","衡阳","岳阳","常德","益阳","郴州","永州","怀化","娄底","邵阳","张家界","湘西",
    "广州","深圳","珠海","佛山","东莞","中山","惠州","汕头","江门","茂名","湛江","肇庆","潮州","揭阳","清远","韶关","梅州","河源","阳江","云浮","汕尾",
    "南宁","柳州","桂林","梧州","北海","防城港","钦州","贵港","玉林","百色","贺州","河池","来宾","崇左",
    "海口","三亚","儋州","琼海","文昌","万宁",
    "成都","绵阳","德阳","宜宾","南充","泸州","达州","乐山","内江","自贡","遂宁","广安","眉山","资阳","雅安","广元","攀枝花","巴中",
    "贵阳","遵义","六盘水","安顺","毕节","铜仁",
    "昆明","曲靖","玉溪","大理","红河","楚雄","昭通","保山","丽江","临沧","普洱","西双版纳",
    "西安","宝鸡","咸阳","渭南","汉中","安康","榆林","延安","商洛","铜川",
    "兰州","天水","白银","庆阳","平凉","酒泉","张掖","武威","定西","金昌","嘉峪关",
    "西宁","海东",
    "银川","石嘴山","吴忠","固原","中卫",
    "乌鲁木齐","克拉玛依","吐鲁番","哈密","昌吉","喀什","和田","伊犁","塔城","阿勒泰",
    "拉萨","日喀则","昌都","林芝","山南","那曲","阿里",
    "呼和浩特","包头","乌海","赤峰","通辽","鄂尔多斯","呼伦贝尔","巴彦淖尔","乌兰察布",
    "朝阳区","海淀区","丰台区","石景山区","通州区","顺义区","房山区","大兴区","昌平区","怀柔区","平谷区","门头沟区",
    "黄浦区","徐汇区","长宁区","静安区","普陀区","虹口区","杨浦区","浦东新区","闵行区","宝山区","嘉定区",
    "越秀区","荔湾区","海珠区","天河区","白云区","黄埔区","番禺区","南沙区",
    "福田区","罗湖区","南山区","盐田区","宝安区","龙岗区","龙华区","坪山区","光明区",
    "武侯区","锦江区","青羊区","金牛区","成华区","龙泉驿区","新都区","双流区","郫都区",
    "西湖区","上城区","拱墅区","滨江区","萧山区","余杭区","临平区",
    "武昌区","洪山区","江汉区","汉阳区",
    "岳麓区","芙蓉区","天心区","开福区",
  ];
  const PLACES_SORTED = [...new Set(PLACES)].sort((a, b) => b.length - a.length);

  // ── 机构后缀 ─────────────────────────────────────────────
  const ORG_SUFFIXES = [
    "大学","学院","研究院","研究所","研究中心","实验室",
    "有限公司","股份有限公司","有限责任公司","集团公司","公司","集团",
    "委员会","工作委员会","专门委员会",
    "法院","检察院","公安局","派出所","交警队",
    "医院","卫生院","诊所","保健院",
    "报社","电视台","广播电台","出版社","杂志社","通讯社","融媒体中心",
    "协会","学会","研究会","促进会","联合会","基金会","商会",
    "中学","小学","幼儿园","实验学校","附属中学","附属小学","职业技术学校",
    "教堂","寺庙","道观","清真寺",
    "街道办","居委会","村委会",
    "银行","证券","保险","信托",
  ];

  // ── 类别定义 ─────────────────────────────────────────────
  const CATEGORIES = {
    person:  { label: "姓名",  prefix: "姓名" },
    org:     { label: "机构名", prefix: "机构" },
    place:   { label: "地名",  prefix: "地点" },
    idcard:  { label: "证件号", prefix: "证件" },
    phone:   { label: "电话",  prefix: "电话" },
    email:   { label: "邮箱",  prefix: "邮箱" },
    custom:  { label: "自定义", prefix: "自定义" },
  };

  // ── 身份证校验 ───────────────────────────────────────────
  const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const ID_CHECK_CHARS = "10X98765432";
  function validateIDCard(id) {
    if (!/^\d{17}[\dXx]$/.test(id)) return false;
    let sum = 0;
    for (let i = 0; i < 17; i++) sum += parseInt(id[i], 10) * ID_WEIGHTS[i];
    return id[17].toUpperCase() === ID_CHECK_CHARS[sum % 11];
  }

  const PATTERNS = {
    idcard: /\b\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
    phone: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
    email: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  };

  // ── 人名识别 ─────────────────────────────────────────────
  // 对每个姓氏位置，同时评估「双字名」与「单字名」两个候选并打分：
  //   3 分：前后均为非中文边界（最稳）；或名后紧跟敬语/引语动词（强信号）
  //   1 分：枚举语境（前接 和/、/， 且后接 都/也/、/。）；或名前是称谓
  // 单字名额外保守：虚词名直接排除；仅凭「名前称谓」不采信。
  // 得分同分时优先双字名；后置信号（分高）可纠正双字名的贪心切分，
  // 例如「张三表示」不会再被切成「张三表」。
  function detectPersons(text) {
    const matches = [];
    const used = new Set();

    // nameStart：完整名字起点（姓的开头），givenStart：名的起点
    function scoreCandidate(nameStart, givenStart, end) {
      const givenName = text.substring(givenStart, end);
      if (!CJK_FULL.test(givenName)) return -1;
      if (givenName.length === 1 && STOP_GIVEN.has(givenName)) return -1;

      const prevCh = nameStart > 0 ? text[nameStart - 1] : "";
      const nextCh = end < text.length ? text[end] : "";
      const prevIsCJK = prevCh && CJK.test(prevCh);
      const nextIsCJK = nextCh && CJK.test(nextCh);
      const afterStr = text.slice(end, end + 5);
      const beforeStr = text.slice(Math.max(0, nameStart - 5), nameStart);

      if (!prevIsCJK && !nextIsCJK) return 3;
      if (HONORIFIC_AFTER.test(afterStr) || SPEECH_AFTER.test(afterStr)) return 3;
      let s = 0;
      if ((prevCh === "" || "和与、，,；;".includes(prevCh)) && ENUM_AFTER.test(afterStr)) s = 1;
      else if (prevIsCJK && HONORIFIC_BEFORE.test(beforeStr)) s = 1;
      return s;
    }

    for (const surname of SURNAMES_SORTED) {
      let pos = 0;
      while (true) {
        const idx = text.indexOf(surname, pos);
        if (idx === -1) break;
        pos = idx + 1;

        const gs = idx + surname.length;
        if (gs >= text.length) continue;

        const cand2 = { end: gs + 2, score: scoreCandidate(idx, gs, gs + 2) };
        const cand1 = { end: gs + 1, score: scoreCandidate(idx, gs, gs + 1) };

        // 同分时取更短的候选：枚举/引语语境中，双字名常把后面的
        // 动词首字吞进来（李四都/张三表），短候选配合后置信号更准。
        let pick = null;
        if (cand1.score >= cand2.score && cand1.score > 0) pick = cand1;
        else if (cand2.score > 0) pick = cand2;
        if (!pick) continue;

        const endPos = pick.end;
        let overlap = false;
        for (let c = idx; c < endPos; c++) if (used.has(c)) { overlap = true; break; }
        if (overlap) continue;

        matches.push({ original: text.substring(idx, endPos), start: idx, end: endPos, type: "person", source: "regex" });
        for (let c = idx; c < endPos; c++) used.add(c);
      }
    }
    matches.sort((a, b) => a.start - b.start);
    return dedupMatches(matches);
  }

  // ── 机构识别 ─────────────────────────────────────────────
  function detectOrgs(text) {
    const matches = [];
    const used = new Set();

    for (const suffix of ORG_SUFFIXES) {
      let pos = 0;
      while (true) {
        const idx = text.indexOf(suffix, pos);
        if (idx === -1) break;
        pos = idx + 1;
        const suffixEnd = idx + suffix.length;

        // 向前取机构名主体（≤8 个连续中文，且排除连接性虚词开头）
        let nameStart = idx;
        for (let back = 1; back <= 8 && idx - back >= 0; back++) {
          const ch = text[idx - back];
          if (!CJK.test(ch)) break;
          nameStart = idx - back;
        }
        if (nameStart >= idx) continue;

        // 去掉以代词/虚词开头的部分（他在北京大学 → 北京大学）
        const PARTICLES = "的了在是和与或有也都就而等被把让给从向到对为以于比按将用因由但却又再才已正要会能可该应须需得着过他她它我你您刚便";
        while (nameStart < idx && PARTICLES.includes(text[nameStart])) nameStart++;

        const orgName = text.substring(nameStart, suffixEnd);
        if (orgName.length < 3) continue;

        let overlap = false;
        for (let c = nameStart; c < suffixEnd; c++) if (used.has(c)) { overlap = true; break; }
        if (overlap) continue;

        matches.push({ original: orgName, start: nameStart, end: suffixEnd, type: "org", source: "regex" });
        for (let c = nameStart; c < suffixEnd; c++) used.add(c);
      }
    }
    matches.sort((a, b) => a.start - b.start);
    return dedupMatches(matches);
  }

  // ── 地名识别 ─────────────────────────────────────────────
  function detectPlaces(text) {
    const matches = [];
    const used = new Set();
    for (const place of PLACES_SORTED) {
      let pos = 0;
      while (true) {
        const idx = text.indexOf(place, pos);
        if (idx === -1) break;
        pos = idx + 1;
        const end = idx + place.length;
        let overlap = false;
        for (let c = idx; c < end; c++) if (used.has(c)) { overlap = true; break; }
        if (overlap) continue;
        matches.push({ original: place, start: idx, end, type: "place", source: "regex" });
        for (let c = idx; c < end; c++) used.add(c);
      }
    }
    matches.sort((a, b) => a.start - b.start);
    return dedupMatches(matches);
  }

  // ── 正则类识别 ───────────────────────────────────────────
  function scanPattern(text, re, type) {
    const matches = [];
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      matches.push({ original: m[0], start: m.index, end: m.index + m[0].length, type, source: "regex" });
    }
    return matches;
  }
  const detectIDCards = (t) => scanPattern(t, PATTERNS.idcard, "idcard").filter((m) => validateIDCard(m.original));
  const detectPhones = (t) => scanPattern(t, PATTERNS.phone, "phone");
  const detectEmails = (t) => scanPattern(t, PATTERNS.email, "email");

  function detectCustom(text, rules) {
    const matches = [];
    for (const rule of rules || []) {
      try {
        const re = new RegExp(rule.pattern, "g");
        let m;
        while ((m = re.exec(text)) !== null) {
          matches.push({
            original: m[0], start: m.index, end: m.index + m[0].length,
            type: "custom", customLabel: rule.label || "自定义", source: "regex",
          });
        }
      } catch { /* 无效正则，跳过 */ }
    }
    return matches;
  }

  // ── 去重（重叠时保留更长/更早）───────────────────────────
  function dedupMatches(matches) {
    if (!matches.length) return matches;
    matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const result = [];
    let lastEnd = -1;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        result.push(m);
        lastEnd = m.end;
      } else if (m.end > lastEnd && result.length) {
        const prev = result[result.length - 1];
        if (m.end - m.start > prev.end - prev.start) {
          result[result.length - 1] = m;
          lastEnd = m.end;
        }
      }
    }
    return result;
  }

  // ── 正则与 LLM 结果合并（LLM 优先）───────────────────────
  function mergeMatches(regexMatches, llmMatches) {
    const all = [...regexMatches, ...llmMatches.map((m) => ({ ...m, source: "llm" }))];
    all.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const result = [];
    const occupied = new Map();
    for (const m of all) {
      let conflictIdx = -1;
      for (let c = m.start; c < m.end; c++) {
        if (occupied.has(c)) { conflictIdx = occupied.get(c); break; }
      }
      if (conflictIdx === -1) {
        const idx = result.length;
        result.push(m);
        for (let c = m.start; c < m.end; c++) occupied.set(c, idx);
      } else if (m.source === "llm") {
        const old = result[conflictIdx];
        for (let c = old.start; c < old.end; c++) occupied.delete(c);
        result[conflictIdx] = m;
        for (let c = m.start; c < m.end; c++) occupied.set(c, conflictIdx);
      }
    }
    return result.filter(Boolean).sort((a, b) => a.start - b.start);
  }

  // ── 替换编号与文本生成 ───────────────────────────────────
  // exclude: Set("original::type::label")，被排除的原始文本保持原样，
  // 其余按类别重新编号，保证脱敏文本中的序号连续。
  function buildResult(text, allMatches, exclude) {
    exclude = exclude || new Set();
    const counters = {};
    const groupMap = new Map(); // key -> { replacement, info }
    const replacements = [];

    for (const m of allMatches) {
      const cat = CATEGORIES[m.type] || CATEGORIES.custom;
      const label = m.type === "custom" && m.customLabel ? m.customLabel : cat.prefix;
      const key = `${m.original}::${m.type}::${label}`;
      if (exclude.has(key)) continue;

      if (!groupMap.has(key)) {
        if (!counters[label]) counters[label] = 0;
        counters[label]++;
        const info = {
          original: m.original,
          replacement: `【${label}${counters[label]}】`,
          type: m.type,
          label,
          source: m.source,
          customLabel: m.customLabel || null,
          count: 0,
        };
        groupMap.set(key, info);
        replacements.push(info);
      }
      groupMap.get(key).count++;
    }

    // 从后往前替换
    let redacted = text;
    const sorted = [...allMatches].sort((a, b) => b.start - a.start);
    for (const m of sorted) {
      const cat = CATEGORIES[m.type] || CATEGORIES.custom;
      const label = m.type === "custom" && m.customLabel ? m.customLabel : cat.prefix;
      const info = groupMap.get(`${m.original}::${m.type}::${label}`);
      if (info) redacted = redacted.slice(0, m.start) + info.replacement + redacted.slice(m.end);
    }

    return { redacted, replacements, matches: allMatches };
  }

  // ── 主入口 ───────────────────────────────────────────────
  function redact(text, options) {
    if (!text || !text.trim()) return { redacted: text || "", replacements: [], matches: [] };
    const opts = Object.assign({
      enabled: { person: true, org: true, place: true, idcard: true, phone: true, email: true },
      customRules: [],
      llmEntities: null,
      exclude: null,
    }, options);

    let regexMatches = [];
    if (opts.enabled.person) regexMatches = regexMatches.concat(detectPersons(text));
    if (opts.enabled.org) regexMatches = regexMatches.concat(detectOrgs(text));
    if (opts.enabled.place) regexMatches = regexMatches.concat(detectPlaces(text));
    if (opts.enabled.idcard) regexMatches = regexMatches.concat(detectIDCards(text));
    if (opts.enabled.phone) regexMatches = regexMatches.concat(detectPhones(text));
    if (opts.enabled.email) regexMatches = regexMatches.concat(detectEmails(text));
    if (opts.customRules && opts.customRules.length) regexMatches = regexMatches.concat(detectCustom(text, opts.customRules));
    regexMatches = dedupMatches(regexMatches);

    let llmMatches = [];
    if (opts.llmEntities && opts.llmEntities.length) {
      for (const entity of opts.llmEntities) {
        const type = mapLLMType(entity.type);
        if (!type) continue;
        if (type !== "custom" && !opts.enabled[type]) continue;
        let p = 0;
        while (true) {
          const i = text.indexOf(entity.text, p);
          if (i === -1) break;
          p = i + 1;
          llmMatches.push({ original: entity.text, start: i, end: i + entity.text.length, type, source: "llm" });
        }
      }
      llmMatches = dedupMatches(llmMatches);
    }

    const allMatches = llmMatches.length ? mergeMatches(regexMatches, llmMatches) : regexMatches;
    return buildResult(text, allMatches, opts.exclude);
  }

  function mapLLMType(llmType) {
    const t = String(llmType || "").toLowerCase().trim();
    if (["person", "人名", "name", "per"].includes(t)) return "person";
    if (["org", "organization", "机构", "机构名", "组织", "组织名"].includes(t)) return "org";
    if (["place", "location", "地名", "地点", "地点名", "loc", "gpe"].includes(t)) return "place";
    if (["idcard", "id", "身份证", "证件", "证件号", "身份证号"].includes(t)) return "idcard";
    if (["phone", "电话", "手机", "手机号", "电话号码"].includes(t)) return "phone";
    if (["email", "邮箱", "电子邮件", "邮件"].includes(t)) return "email";
    return null;
  }

  // ── LLM 调用（可选，浏览器直连用户自备的 API）───────────
  async function callLLM(text, config) {
    const endpoint = config.endpoint || "https://api.openai.com/v1/chat/completions";
    const model = config.model || "gpt-4o-mini";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "你是命名实体识别专家。识别文本中的人名、机构名、地名。只返回JSON数组，不要其他文字。格式：[{\"text\":\"张三\",\"type\":\"person\"}]。type 只能是：person（人名）、org（机构名）、place（地名）。不要识别身份证号、电话、邮箱，那些由正则处理。",
          },
          { role: "user", content: text },
        ],
        temperature: 0,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`API 请求失败 (${response.status}): ${errText || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("API 返回内容为空");

    let jsonStr = content.trim();
    const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) jsonStr = codeBlock[1].trim();
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) jsonStr = arrayMatch[0];

    try {
      const entities = JSON.parse(jsonStr);
      if (!Array.isArray(entities)) throw new Error("返回结果不是数组");
      return entities.filter((e) => e.text && e.type).map((e) => ({ text: String(e.text), type: String(e.type) }));
    } catch (e) {
      throw new Error(`解析 API 返回失败: ${e.message}`);
    }
  }

  // ── 导出映射表（CSV，Excel 兼容 BOM）─────────────────────
  function replacementsToCSV(replacements) {
    const escCSV = (s) => (/[",\n\r]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
    const rows = replacements.map((r) => {
      const typeLabel = CATEGORIES[r.type]?.label || r.customLabel || r.type;
      const sourceLabel = r.source === "llm" ? "LLM" : "正则";
      return [r.original, r.replacement, typeLabel, sourceLabel, r.count || 1].map(escCSV).join(",");
    });
    return "\uFEFF原始文本,替换为,类型,来源,出现次数\n" + rows.join("\n");
  }

  // ── 导出 ─────────────────────────────────────────────────
  global.Redact = {
    redact, buildResult, callLLM, replacementsToCSV,
    detectPersons, detectOrgs, detectPlaces,
    detectIDCards, detectPhones, detectEmails, detectCustom,
    dedupMatches, mergeMatches, validateIDCard, mapLLMType,
    CATEGORIES,
  };
})(globalThis);
