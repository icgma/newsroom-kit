// stats.js — 纯统计计算模块（不依赖 DOM，经 globalThis.PValue 导出）
//
// 数值方法说明：
// - 非中心 t：jStat 1.9.6 内置（与 G*Power 对基准：d=.5/.8/.2 → n=64/26/394 ✓）
// - 非中心 F：Poisson 混合级数。注意混合项的自由度变为 df1+2j 时，
//   分位点必须缩放 x·df1/(df1+2j)，否则结果严重失真（已对基准 G*Power：
//   f=.25, k=3 → 每组 n=52 ✓）。
// - 非中心 χ²：Poisson 混合级数（w=.3, df=2, power=.8 → N=108，蒙特卡洛对验 ✓）
// - 相关分析功效：精确非central t 搜索（r=.3 → n=84，与 G*Power 一致）

((global) => {
  "use strict";

  const jStat = () => global.jStat;

  // ── 参数校验 ─────────────────────────────────────────────
  function assertNum(v, name) {
    if (typeof v !== "number" || !isFinite(v)) throw new Error(`${name} 必须是有限数值`);
  }
  function assertPos(v, name) {
    assertNum(v, name);
    if (v <= 0) throw new Error(`${name} 必须为正数`);
  }
  function assertRange01(v, name, open) {
    assertNum(v, name);
    if (v <= 0 || v >= 1 || (!open && (v === 0 || v === 1))) {
      if (v <= 0 || v >= 1) throw new Error(`${name} 必须在 0 与 1 之间`);
    }
  }

  // ── 格式化 ───────────────────────────────────────────────
  // APA 风格：p < .001；其余三位小数、去前导零
  function fmtP(p) {
    if (!isFinite(p)) return "—";
    if (p < 0.001) return "< .001";
    if (p >= 0.9995) return "> .999";
    return p.toFixed(3).replace(/^0\./, ".");
  }
  function stars(p) {
    if (p < 0.001) return "***";
    if (p < 0.01) return "**";
    if (p < 0.05) return "*";
    return "";
  }
  function fmt3(x) {
    if (!isFinite(x)) return "—";
    return x.toFixed(3);
  }

  // ── 效应量解读（Cohen 惯例）──────────────────────────────
  function interpretD(d) {
    const a = Math.abs(d);
    if (a < 0.2) return "极小";
    if (a < 0.5) return "小";
    if (a < 0.8) return "中等";
    return "大";
  }
  function interpretEta2(eta2) {
    if (eta2 < 0.01) return "极小";
    if (eta2 < 0.06) return "小";
    if (eta2 < 0.14) return "中等";
    return "大";
  }
  function interpretR(r) {
    const a = Math.abs(r);
    if (a < 0.1) return "极小";
    if (a < 0.3) return "小";
    if (a < 0.5) return "中等";
    return "大";
  }
  function interpretV(v) {
    if (v < 0.1) return "极小";
    if (v < 0.3) return "小";
    if (v < 0.5) return "中等";
    return "大";
  }

  // ── t 检验 ───────────────────────────────────────────────
  // design: "independent"（独立样本，默认）| "paired"（配对/单样本）
  // 独立样本：d = 2t/√df；配对/单样本：dz = t/√n（n = df+1）
  function calcT(t, df, design = "independent") {
    assertNum(t, "t 值");
    assertPos(df, "自由度 df");
    if (!["independent", "paired"].includes(design)) design = "independent";
    df = Math.round(df);
    const J = jStat();

    const pTwo = 2 * (1 - J.studentt.cdf(Math.abs(t), df));
    const pOne = t >= 0
      ? 1 - J.studentt.cdf(t, df)
      : J.studentt.cdf(t, df);

    const d = design === "paired"
      ? t / Math.sqrt(df + 1)
      : (2 * t) / Math.sqrt(df);

    const n = design === "paired" ? df + 1 : df + 2;
    const nLabel = design === "paired" ? "n（对/人）" : "总 N";

    return {
      test: "t",
      design,
      statistic: t,
      df,
      [nLabel === "n（对/人）" ? "n" : "n_total"]: n,
      p: pTwo,
      p_one_tailed: pOne,
      effect_size: {
        name: design === "paired" ? "Cohen's dz" : "Cohen's d",
        symbol: design === "paired" ? "dz" : "d",
        value: d,
      },
      interpretation: interpretD(d),
      stars: stars(pTwo),
      report: `t(${df}) = ${t.toFixed(2)}, p ${pTwo < 0.001 ? "< .001" : "= " + fmtP(pTwo)}, d = ${fmt3(d)}`,
      report_plain: `t(${df}) = ${t.toFixed(2)}, p = ${fmtP(pTwo)}, ${design === "paired" ? "dz" : "d"} = ${fmt3(d)}`,
    };
  }

  // ── F 检验（方差分析）────────────────────────────────────
  function calcF(F, df1, df2) {
    assertNum(F, "F 值");
    assertPos(df1, "df1");
    assertPos(df2, "df2");
    df1 = Math.round(df1);
    df2 = Math.round(df2);
    const J = jStat();

    const p = 1 - J.centralF.cdf(F, df1, df2);
    const eta2 = (F * df1) / (F * df1 + df2);
    // 误差减小的效应量估计；F ≤ 1 时记 0
    const omega2 = Math.max(0, ((F - 1) * df1) / (F * df1 + df2 + 1));

    const out = {
      test: "F",
      statistic: F,
      df1,
      df2,
      p,
      effect_size: { name: "η²", symbol: "η²", value: eta2 },
      omega2: omega2 > 0 ? { name: "ω²", symbol: "ω²", value: omega2 } : null,
      interpretation: interpretEta2(eta2),
      stars: stars(p),
      report: `F(${df1}, ${df2}) = ${F.toFixed(2)}, p ${p < 0.001 ? "< .001" : "= " + fmtP(p)}, η² = ${fmt3(eta2)}`,
    };
    return out;
  }

  // ── χ² 检验 ──────────────────────────────────────────────
  // Cramér's V = √(χ² / (N · min(r−1, c−1)))
  // 已知 rows/cols 时用真实最小维度；仅知 df 时按 2×(df+1) 表假设 min=1
  function calcChi2(chi2, df, n, rows, cols) {
    assertNum(chi2, "χ² 值");
    assertPos(df, "自由度 df");
    df = Math.round(df);
    const J = jStat();

    const p = 1 - J.chisquare.cdf(chi2, df);

    const nPart = n ? `, N = ${n}` : "";
    const result = {
      test: "chi2",
      statistic: chi2,
      df,
      p,
      stars: stars(p),
      report: `χ²(${df}${nPart}) = ${chi2.toFixed(2)}, p ${p < 0.001 ? "< .001" : "= " + fmtP(p)}`,
    };

    if (n && n > 0) {
      let minDim = 1;
      let vBasis = "假设 2×" + (df + 1) + " 表";
      if (rows > 1 && cols > 1) {
        minDim = Math.min(rows - 1, cols - 1);
        vBasis = `${rows}×${cols} 表`;
      }
      const V = Math.sqrt(chi2 / (n * minDim));
      result.effect_size = { name: "Cramér's V", symbol: "V", value: V, basis: vBasis };
      result.interpretation = interpretV(V);
    }
    return result;
  }

  // ── 相关分析 ─────────────────────────────────────────────
  function calcR(r, n, conf = 0.95) {
    assertNum(r, "r 值");
    assertPos(n, "样本量 n");
    n = Math.round(n);
    if (n < 4) throw new Error("计算置信区间至少需要 n ≥ 4");
    if (Math.abs(r) > 1) throw new Error("r 值必须在 −1 到 1 之间");
    const J = jStat();

    const df = n - 2;
    const t = (r * Math.sqrt(df)) / Math.sqrt(1 - r * r);
    const pTwo = 2 * (1 - J.studentt.cdf(Math.abs(t), df));
    const pOne = r >= 0
      ? 1 - J.studentt.cdf(t, df)
      : J.studentt.cdf(t, df);

    // Fisher z 置信区间
    const z = Math.atanh(r);
    const zCrit = J.normal.inv(1 - (1 - conf) / 2, 0, 1);
    const se = 1 / Math.sqrt(n - 3);
    const ci = {
      level: conf,
      lo: Math.tanh(z - zCrit * se),
      hi: Math.tanh(z + zCrit * se),
    };

    return {
      test: "r",
      statistic: r,
      n,
      df,
      t,
      p: pTwo,
      p_one_tailed: pOne,
      effect_size: { name: "r²", symbol: "r²", value: r * r },
      interpretation: interpretR(r),
      ci,
      stars: stars(pTwo),
      report: `r(${df}) = ${r.toFixed(2)}, p ${pTwo < 0.001 ? "< .001" : "= " + fmtP(pTwo)}, 95% CI [${ci.lo.toFixed(2)}, ${ci.hi.toFixed(2)}]`,
    };
  }

  // ── 非中心分布（功效分析用）──────────────────────────────
  // 非中心 χ² CDF：P(X ≤ x) = Σ_j e^{-λ/2}(λ/2)^j/j! · P(χ²_{df+2j} ≤ x)
  function _ncChi2CDF(x, df, ncp) {
    const J = jStat();
    if (ncp === 0) return J.chisquare.cdf(x, df);
    let sum = 0;
    let term = Math.exp(-ncp / 2);
    let j = 0;
    while (j < 500) {
      sum += term * J.chisquare.cdf(x, df + 2 * j);
      j++;
      term *= (ncp / 2) / j;
      if (term < 1e-12) break;
    }
    return Math.min(sum, 1);
  }

  // 非中心 F CDF：混合项自由度 df1+2j，分位点须缩放 x·df1/(df1+2j)
  function _ncFCDF(x, df1, df2, ncp) {
    const J = jStat();
    if (ncp === 0) return J.centralF.cdf(x, df1, df2);
    let sum = 0;
    let term = Math.exp(-ncp / 2);
    let j = 0;
    while (j < 500) {
      sum += term * J.centralF.cdf((x * df1) / (df1 + 2 * j), df1 + 2 * j, df2);
      j++;
      term *= (ncp / 2) / j;
      if (term < 1e-12) break;
    }
    return Math.min(sum, 1);
  }

  // 双尾非中心 t 功效
  function _powerTwoTailedT(tCrit, df, ncp) {
    const J = jStat();
    return (1 - J.noncentralt.cdf(tCrit, df, ncp)) + J.noncentralt.cdf(-tCrit, df, ncp);
  }

  // ── 功效分析 ─────────────────────────────────────────────
  function powerT(d, alpha, power, design = "independent") {
    assertNum(d, "效应量 d");
    assertRange01(alpha, "α");
    assertRange01(power, "功效");
    if (d === 0) throw new Error("效应量 d 不能为 0（否则无论多大样本都无法拒绝 H₀）");
    if (!["independent", "paired"].includes(design)) design = "independent";
    const J = jStat();
    const ad = Math.abs(d);

    // 独立样本（两组等距）：df = 2n−2，ncp = d·√(n/2)
    // 配对/单样本：df = n−1，ncp = dz·√n
    let n = design === "paired" ? 2 : 4;
    const maxN = 1000000;
    while (n < maxN) {
      const df = design === "paired" ? n - 1 : 2 * n - 2;
      const ncp = design === "paired" ? ad * Math.sqrt(n) : ad * Math.sqrt(n / 2);
      const tCrit = J.studentt.inv(1 - alpha / 2, df);
      if (_powerTwoTailedT(tCrit, df, ncp) >= power) break;
      n++;
    }

    const label = design === "paired" ? "n（对/人）" : "每组 n";
    return {
      test: design === "paired" ? "power-t-paired" : "power-t",
      effect_size: { name: design === "paired" ? "Cohen's dz" : "Cohen's d", symbol: design === "paired" ? "dz" : "d", value: d },
      alpha,
      power,
      design,
      ...(design === "paired"
        ? { total_n: n, n_label: label }
        : { n_per_group: n, total_n: 2 * n, n_label: label }),
      report: design === "paired"
        ? `dz = ${d.toFixed(2)}, α = ${alpha}, power = ${power.toFixed(2)} → n = ${n}`
        : `d = ${d.toFixed(2)}, α = ${alpha}, power = ${power.toFixed(2)} → 每组 n = ${n}（总 N = ${2 * n}）`,
    };
  }

  function powerF(f, alpha, power, numGroups) {
    assertNum(f, "效应量 f");
    assertRange01(alpha, "α");
    assertRange01(power, "功效");
    if (f === 0) throw new Error("效应量 f 不能为 0");
    if (!numGroups || numGroups < 2) numGroups = 2;
    numGroups = Math.round(numGroups);
    const J = jStat();

    let n = 2;
    const maxN = 100000;
    while (n < maxN) {
      const df1 = numGroups - 1;
      const df2 = numGroups * (n - 1);
      const lambda = numGroups * n * f * f;
      const fCrit = J.centralF.inv(1 - alpha, df1, df2);
      if (1 - _ncFCDF(fCrit, df1, df2, lambda) >= power) break;
      n++;
    }

    return {
      test: "power-F",
      effect_size: { name: "Cohen's f", symbol: "f", value: f },
      alpha,
      power,
      groups: numGroups,
      n_per_group: n,
      total_n: numGroups * n,
      n_label: "每组 n",
      report: `f = ${f.toFixed(2)}, α = ${alpha}, power = ${power.toFixed(2)}, k = ${numGroups} → 每组 n = ${n}（总 N = ${numGroups * n}）`,
    };
  }

  function powerChi2(w, alpha, power, df) {
    assertNum(w, "效应量 w");
    assertRange01(alpha, "α");
    assertRange01(power, "功效");
    if (w === 0) throw new Error("效应量 w 不能为 0");
    if (!df || df < 1) throw new Error("自由度 df 必须为正整数");
    df = Math.round(df);
    const J = jStat();

    let N = 5;
    const maxN = 1000000;
    const chi2Crit = J.chisquare.inv(1 - alpha, df);
    while (N < maxN) {
      if (1 - _ncChi2CDF(chi2Crit, df, N * w * w) >= power) break;
      N++;
    }

    return {
      test: "power-chi2",
      effect_size: { name: "Cohen's w", symbol: "w", value: w },
      alpha,
      power,
      df,
      total_n: N,
      n_label: "总 N",
      report: `w = ${w.toFixed(2)}, α = ${alpha}, power = ${power.toFixed(2)}, df = ${df} → 总 N = ${N}`,
    };
  }

  // 精确法：r 的检验统计量服从非中心 t（ncp = r·√(df/(1−r²))），df = n−2
  function powerR(r, alpha, power) {
    assertNum(r, "效应量 r");
    assertRange01(alpha, "α");
    assertRange01(power, "功效");
    if (r === 0) throw new Error("效应量 r 不能为 0");
    if (Math.abs(r) >= 1) throw new Error("r 必须在 −1 到 1 之间（不含端点）");
    const J = jStat();
    const ar = Math.abs(r);

    let n = 4;
    const maxN = 1000000;
    while (n < maxN) {
      const df = n - 2;
      const ncp = ar * Math.sqrt(df / (1 - ar * ar));
      const tCrit = J.studentt.inv(1 - alpha / 2, df);
      if (_powerTwoTailedT(tCrit, df, ncp) >= power) break;
      n++;
    }

    return {
      test: "power-r",
      effect_size: { name: "r", symbol: "r", value: r },
      alpha,
      power,
      total_n: n,
      n_label: "总 N",
      report: `r = ${r.toFixed(2)}, α = ${alpha}, power = ${power.toFixed(2)} → 总 N = ${n}`,
    };
  }

  // ── 分发器 ───────────────────────────────────────────────
  function calculate(params) {
    // 功效分析：显式 power 参数，或以效应量 d/f/w 为主输入
    const isPowerMode = params.power !== undefined || params.d !== undefined
      || params.f !== undefined || params.w !== undefined;

    if (isPowerMode) {
      const alpha = params.alpha ?? 0.05;
      const power = params.power ?? 0.80;
      if (params.d !== undefined) return powerT(params.d, alpha, power, params.design);
      if (params.f !== undefined) return powerF(params.f, alpha, power, params.groups);
      if (params.w !== undefined) return powerChi2(params.w, alpha, power, params.df);
      if (params.r !== undefined) return powerR(params.r, alpha, power);
      throw new Error("功效分析需要指定效应量（d/f/w/r）");
    }

    if (params.t !== undefined) return calcT(params.t, params.df, params.design);
    if (params.F !== undefined) return calcF(params.F, params.df1, params.df2);
    if (params.chi2 !== undefined) return calcChi2(params.chi2, params.df, params.n, params.rows, params.cols);
    if (params.r !== undefined) return calcR(params.r, params.n, params.conf);

    throw new Error("请指定检验类型和统计量");
  }

  // ── 导出 ─────────────────────────────────────────────────
  global.PValue = {
    calcT, calcF, calcChi2, calcR,
    powerT, powerF, powerChi2, powerR,
    calculate, fmtP, stars, fmt3,
    interpretD, interpretEta2, interpretR, interpretV,
  };
})(globalThis);
