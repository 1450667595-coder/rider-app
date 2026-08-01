import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { BarChart3, TrendingUp, Calendar, Sun, Cloud, CloudRain, Wind, Download, Upload, Activity, Shield, Zap, Brain, Target, AlertTriangle, PieChart, LineChart, GitBranch, Radar as RadarIcon } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import { showToast } from "@/components/shared/Toast";
import { getCurrentMonth, getLastNDays, formatDate, getDayOfWeek, today } from "@/utils/date";
import {
  detectAnomalies,
  deepAnalyze,
  gaussianProcessPredict,
  spectralResidualAnalysis,
  empiricalModeDecomposition,
  computePredictionAccuracy,
  trackPredictionAccuracy,
  predictTomorrowAI,
} from "@/utils/aiPrediction";
import type { SpectralAnalysis, PredictionRecord } from "@/utils/aiPrediction";
import { Weather, WEATHER_LABELS, DailyRecord } from "@/types";

const WEEK_DAYS = ["日", "一", "二", "三", "四", "五", "六"];
const WEEK_DAYS_FULL = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Analytics() {
  const records = useStore((s) => s.records);
  const saveRecord = useStore((s) => s.saveRecord);
  const [viewMode, setViewMode] = useState<"week" | "month" | "weather" | "dow" | "anomaly" | "deep" | "trend" | "distribution" | "forecast" | "correlation">("week");

  const weekData = useMemo(() => {
    const days = getLastNDays(7);
    return days.map((date) => {
      const r = records[date];
      return {
        date,
        label: formatDate(date).slice(2),
        day: getDayOfWeek(date),
        orders: r?.orders || 0,
        income: r?.income || 0,
      };
    });
  }, [records]);

  const monthData = useMemo(() => {
    const { year, month } = getCurrentMonth();
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const monthRecords = Object.values(records).filter((r) => r.date.startsWith(prefix));
    const monthlyOrders = monthRecords.reduce((s, r) => s + r.orders, 0);
    const monthlyIncome = monthRecords.reduce((s, r) => s + r.income, 0);
    const avgDaily = monthRecords.length > 0 ? Math.round(monthlyOrders / monthRecords.length) : 0;
    const maxDaily = monthRecords.reduce((max, r) => Math.max(max, r.orders), 0);
    const minDaily = monthRecords.length > 0 ? Math.min(...monthRecords.map(r => r.orders)) : 0;

    return {
      orders: monthlyOrders,
      income: monthlyIncome,
      avgDaily,
      maxDaily,
      minDaily,
      recordDays: monthRecords.length,
    };
  }, [records]);

  const weatherStats = useMemo(() => {
    const { year, month } = getCurrentMonth();
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const monthRecords = Object.values(records).filter((r) => r.date.startsWith(prefix));

    const stats: Record<Weather, { count: number; totalOrders: number }> = {
      sunny: { count: 0, totalOrders: 0 },
      cloudy: { count: 0, totalOrders: 0 },
      rainy: { count: 0, totalOrders: 0 },
      snowy: { count: 0, totalOrders: 0 },
      windy: { count: 0, totalOrders: 0 },
    };

    monthRecords.forEach((r) => {
      stats[r.weather].count++;
      stats[r.weather].totalOrders += r.orders;
    });

    return Object.entries(stats)
      .map(([weather, data]) => ({
        weather: weather as Weather,
        label: WEATHER_LABELS[weather as Weather],
        count: data.count,
        avgOrders: data.count > 0 ? Math.round(data.totalOrders / data.count) : 0,
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [records]);

  const dowStats = useMemo(() => {
    const allRecords = Object.values(records);
    const dowData: { orders: number[]; income: number[] }[] = Array(7).fill(null).map(() => ({ orders: [], income: [] }));

    allRecords.forEach((r) => {
      const dow = new Date(r.date).getDay();
      dowData[dow].orders.push(r.orders);
      dowData[dow].income.push(r.income);
    });

    return dowData.map((data, i) => {
      const avgOrders = data.orders.length > 0
        ? Math.round(data.orders.reduce((s, v) => s + v, 0) / data.orders.length)
        : 0;
      const avgIncome = data.income.length > 0
        ? Math.round(data.income.reduce((s, v) => s + v, 0) / data.income.length)
        : 0;
      const totalOrders = data.orders.reduce((s, v) => s + v, 0);
      return {
        day: WEEK_DAYS_FULL[i],
        short: WEEK_DAYS[i],
        avgOrders,
        avgIncome,
        totalOrders,
        count: data.orders.length,
      };
    });
  }, [records]);

  const maxDowOrders = Math.max(...dowStats.map((d) => d.avgOrders), 1);

  const anomalies = useMemo(() => detectAnomalies(records), [records]);

  // Deep analysis
  const deepAnalysis = useMemo(() => deepAnalyze(records), [records]);

  // v10.0: 频谱残差分析
  const spectralAnalysis = useMemo(() => {
    const allOrders = Object.values(records)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(r => r.orders);
    if (allOrders.length < 7) return null;
    return spectralResidualAnalysis(allOrders);
  }, [records]);

  // v10.0: 经验模态分解
  const emdAnalysis = useMemo(() => {
    const allOrders = Object.values(records)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(r => r.orders);
    if (allOrders.length < 10) return null;
    return empiricalModeDecomposition(allOrders);
  }, [records]);

  // v10.0: 高斯过程回归预测
  const gprAnalysis = useMemo(() => {
    const allOrders = Object.values(records)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(r => r.orders);
    if (allOrders.length < 5) return null;
    return gaussianProcessPredict(allOrders);
  }, [records]);

  // v10.0: 预测准确率追踪
  const predictionAccuracy = useMemo(() => {
    const sorted = Object.values(records).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    if (sorted.length < 3) return null;

    const predictionRecords: PredictionRecord[] = [];
    for (let i = 3; i < sorted.length; i++) {
      const pastRecords = Object.fromEntries(
        sorted.slice(0, i).map(r => [r.date, r])
      );
      const pred = predictTomorrowAI(pastRecords, sorted[i].weather);
      predictionRecords.push({
        date: sorted[i].date,
        predicted: pred.predictedOrders,
        actual: sorted[i].orders,
        weather: sorted[i].weather,
      });
    }

    let tracker = null;
    for (const record of predictionRecords) {
      tracker = trackPredictionAccuracy(tracker, record);
    }
    return tracker;
  }, [records]);

  // v10.0: 分布分析（分位数 + 分布形态）
  const distributionAnalysis = useMemo(() => {
    const allOrders = Object.values(records)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(r => r.orders);
    if (allOrders.length < 5) return null;

    const sorted = [...allOrders].sort((a, b) => a - b);
    const n = sorted.length;
    const getPercentile = (p: number) => {
      const idx = Math.round((p / 100) * (n - 1));
      return sorted[idx];
    };

    const m = allOrders.reduce((s, v) => s + v, 0) / n;
    const variance = allOrders.reduce((s, v) => s + (v - m) ** 2, 0) / n;
    const skewness = allOrders.reduce((s, v) => s + ((v - m) / Math.sqrt(variance || 1)) ** 3, 0) / n;
    const kurtosis = allOrders.reduce((s, v) => s + ((v - m) / Math.sqrt(variance || 1)) ** 4, 0) / n - 3;

    return {
      p10: getPercentile(10),
      p25: getPercentile(25),
      p50: getPercentile(50),
      p75: getPercentile(75),
      p90: getPercentile(90),
      mean: Math.round(m),
      std: Math.round(Math.sqrt(variance)),
      skewness: Math.round(skewness * 100) / 100,
      kurtosis: Math.round(kurtosis * 100) / 100,
      cv: Math.round((Math.sqrt(variance) / Math.max(1, m)) * 100),
      range: sorted[n - 1] - sorted[0],
    };
  }, [records]);

  // v10.0: 关联分析（天气-单量相关性矩阵）
  const correlationMatrix = useMemo(() => {
    const allRecords = Object.values(records);
    if (allRecords.length < 10) return null;

    const weatherOrders: Record<Weather, number[]> = {
      sunny: [], cloudy: [], rainy: [], snowy: [], windy: [],
    };

    allRecords.forEach(r => {
      weatherOrders[r.weather].push(r.orders);
    });

    const overallAvg = allRecords.reduce((s, r) => s + r.orders, 0) / allRecords.length;

    const weatherStats = (Object.entries(weatherOrders) as [Weather, number[]][])
      .filter(([, v]) => v.length > 0)
      .map(([w, orders]) => {
        const avg = orders.reduce((s, v) => s + v, 0) / orders.length;
        return {
          weather: w,
          label: WEATHER_LABELS[w],
          count: orders.length,
          avg: Math.round(avg),
          lift: Math.round((avg / Math.max(1, overallAvg) - 1) * 100),
          min: Math.min(...orders),
          max: Math.max(...orders),
        };
      })
      .sort((a, b) => b.avg - a.avg);

    return { weatherStats, overallAvg: Math.round(overallAvg) };
  }, [records]);

  // Radar chart data for deep analysis
  const radarData = useMemo(() => {
    if (!deepAnalysis) return [];
    return [
      { subject: "日波动率", A: Math.min(100, deepAnalysis.volatility.daily * 3), fullMark: 100 },
      { subject: "周波动率", A: Math.min(100, deepAnalysis.volatility.weekly * 2), fullMark: 100 },
      { subject: "季节性", A: Math.min(100, deepAnalysis.seasonality.strength * 100), fullMark: 100 },
      { subject: "增长率", A: Math.max(0, 50 + deepAnalysis.growth.rate), fullMark: 100 },
      { subject: "效率", A: Math.min(100, deepAnalysis.efficiency.avgPerHour * 20), fullMark: 100 },
      { subject: "风险", A: deepAnalysis.risk.score, fullMark: 100 },
    ];
  }, [deepAnalysis]);

  const weatherIcons: Record<Weather, React.ReactNode> = {
    sunny: <Sun size={16} />,
    cloudy: <Cloud size={16} />,
    rainy: <CloudRain size={16} />,
    snowy: <Cloud size={16} />,
    windy: <Wind size={16} />,
  };

  const handleExportCSV = () => {
    const allRecords = Object.values(records).sort((a, b) => a.date.localeCompare(b.date));
    if (allRecords.length === 0) {
      showToast("暂无数据可导出", "error");
      return;
    }
    const header = "日期,单量,收入,工时,天气,备注";
    const rows = allRecords.map((r) =>
      `${r.date},${r.orders},${r.income},${r.workHours},${WEATHER_LABELS[r.weather]},${r.note || ""}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `骑手数据_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV 导出成功", "success");
  };

  const handleImportCSV = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const lines = text.trim().split("\n");
        if (lines.length < 2) {
          showToast("CSV 格式无效", "error");
          return;
        }
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",");
          if (cols.length < 4) continue;
          const date = cols[0].trim();
          const orders = parseInt(cols[1]) || 0;
          const income = parseInt(cols[2]) || 0;
          const workHours = parseFloat(cols[3]) || 8;
          const weatherLabel = cols[4]?.trim() || "";
          const note = cols.slice(5).join(",").trim();
          let weather: Weather = "sunny";
          if (weatherLabel.includes("晴")) weather = "sunny";
          else if (weatherLabel.includes("云")) weather = "cloudy";
          else if (weatherLabel.includes("雨")) weather = "rainy";
          else if (weatherLabel.includes("雪")) weather = "snowy";
          else if (weatherLabel.includes("风")) weather = "windy";

          if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            saveRecord({ date, orders, income, workHours, weather, note });
            imported++;
          }
        }
        showToast(`成功导入 ${imported} 条记录`, "success");
      };
      reader.readAsText(file, "UTF-8");
    };
    input.click();
  };

  return (
    <motion.div
      className="px-4 pt-6 pb-4 space-y-5"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] flex items-center gap-2 tracking-[-0.01em]">
            <BarChart3 size={24} className="icon-glow-gold" />
            数据看板
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportCSV}
            className="flex items-center gap-1 text-[#E0E0E0]/30 hover:text-[#E0E0E0] text-xs transition-colors"
          >
            <Upload size={12} />
            导入
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 text-[#E0E0E0]/30 hover:text-[#E0E0E0] text-xs transition-colors"
          >
            <Download size={12} />
            导出
          </button>
        </div>
      </motion.div>

      {/* View Tabs */}
      <motion.div variants={item} className="flex gap-1 holo-card rounded-xl p-1 overflow-x-auto">
        {[          { key: "week" as const, label: "本周", icon: TrendingUp },
          { key: "month" as const, label: "本月", icon: Calendar },
          { key: "trend" as const, label: "趋势", icon: LineChart },
          { key: "distribution" as const, label: "分布", icon: PieChart },
          { key: "forecast" as const, label: "预测", icon: RadarIcon },
          { key: "correlation" as const, label: "关联", icon: GitBranch },
          { key: "weather" as const, label: "天气", icon: Cloud },
          { key: "dow" as const, label: "星期", icon: Target },
          { key: "anomaly" as const, label: "异常", icon: AlertTriangle },
          { key: "deep" as const, label: "深度分析", icon: Brain },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key)}
            className={`tap-cyber shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              viewMode === tab.key
                ? "bg-[#00E5FF] text-[#020408]"
                : "text-[#E0E0E0]/30 hover:text-[#E0E0E0]"
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Week View */}
      {viewMode === "week" && (
        <motion.div variants={item} className="holo-card rounded-[26px] p-4">
          <h3 className="cyber-section-title text-sm font-medium mb-4 flex items-center gap-2 tracking-tight">
            <TrendingUp size={16} className="icon-glow-gold" />
            本周每日单量
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1A1A2E", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px", color: "#fff",
                }}
                formatter={(value: number) => [`${value} 单`, "单量"]}
              />
              <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
                {weekData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.date === new Date().toISOString().slice(0, 10) ? "#00E5FF" : entry.day === "六" || entry.day === "日" ? "#E040FB" : "#00E5FF"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#00E5FF]" /><span className="text-[#E0E0E0]/30 text-xs">今日</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#00E5FF]" /><span className="text-[#E0E0E0]/30 text-xs">工作日</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#E040FB]" /><span className="text-[#E0E0E0]/30 text-xs">周末</span></div>
          </div>
        </motion.div>
      )}

      {/* Month View */}
      {viewMode === "month" && (
        <motion.div variants={item} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="holo-card rounded-[26px] p-4">
              <span className="terminal-text text-xs tracking-tight">本月总单量</span>
              <AnimatedNumber value={monthData.orders} className="block text-2xl font-bold text-[#E0E0E0] mt-1" />
            </div>
            <div className="holo-card rounded-[26px] p-4">
              <span className="terminal-text text-xs tracking-tight">本月总收入</span>
              <AnimatedNumber value={monthData.income} prefix="¥" className="block text-2xl font-bold text-[#E0E0E0] mt-1" />
            </div>
            <div className="holo-card rounded-[26px] p-4">
              <span className="terminal-text text-xs tracking-tight">日均单量</span>
              <span className="block text-2xl font-bold text-[#E0E0E0] mt-1">{monthData.avgDaily}</span>
            </div>
            <div className="holo-card rounded-[26px] p-4">
              <span className="terminal-text text-xs tracking-tight">记录天数</span>
              <span className="block text-2xl font-bold text-[#E0E0E0] mt-1">{monthData.recordDays}</span>
            </div>
            <div className="holo-card rounded-[26px] p-4">
              <span className="terminal-text text-xs tracking-tight">最高单日</span>
              <span className="block text-2xl font-bold text-[#00E676] mt-1">{monthData.maxDaily}</span>
            </div>
            <div className="holo-card rounded-[26px] p-4">
              <span className="terminal-text text-xs tracking-tight">最低单日</span>
              <span className="block text-2xl font-bold text-[#FF1744] mt-1">{monthData.minDaily}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Trend View */}
      {viewMode === "trend" && (
        <motion.div variants={item} className="space-y-4">
          <h3 className="cyber-section-title text-sm font-medium flex items-center gap-2 tracking-tight">
            <LineChart size={16} className="icon-glow-cyan" />
            趋势分析 · v10.0 频谱残差
          </h3>
          {!spectralAnalysis ? (
            <div className="holo-card rounded-[26px] p-8 text-center">
              <p className="text-[#E0E0E0]/30">需要至少 7 天数据</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="holo-card rounded-[26px] p-4">
                  <span className="terminal-text text-xs">趋势分量</span>
                  <p className="text-2xl font-bold text-[#00E5FF] mt-1">{spectralAnalysis.trendComponent}</p>
                  <span className="text-[#E0E0E0]/30 text-[10px]">线性趋势外推</span>
                </div>
                <div className="holo-card rounded-[26px] p-4">
                  <span className="terminal-text text-xs">季节分量</span>
                  <p className="text-2xl font-bold text-[#E040FB] mt-1">{spectralAnalysis.seasonalComponent}</p>
                  <span className="text-[#E0E0E0]/30 text-[10px]">周期波动</span>
                </div>
                <div className="holo-card rounded-[26px] p-4">
                  <span className="terminal-text text-xs">残差分量</span>
                  <p className="text-2xl font-bold text-[#FFD740] mt-1">{spectralAnalysis.residualComponent}</p>
                  <span className="text-[#E0E0E0]/30 text-[10px]">随机噪声</span>
                </div>
                <div className="holo-card rounded-[26px] p-4">
                  <span className="terminal-text text-xs">周期评分</span>
                  <p className="text-2xl font-bold text-[#00E676] mt-1">{spectralAnalysis.periodicityScore}</p>
                  <span className="text-[#E0E0E0]/30 text-[10px]">0-1越高越具周期性</span>
                </div>
              </div>

              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title text-sm font-medium mb-3">主导周期</h3>
                {spectralAnalysis.dominantPeriods.length === 0 ? (
                  <p className="text-[#E0E0E0]/30 text-xs">未检测到显著周期</p>
                ) : (
                  <div className="space-y-2">
                    {spectralAnalysis.dominantPeriods.map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-[#E0E0E0]/5 last:border-0">
                        <span className="text-[#E0E0E0]/50 text-sm">{p.period} 天周期</span>
                        <div className="flex items-center gap-2">
                          <div className="progress-cyber w-24">
                            <motion.div
                              className="progress-cyber-fill"
                              style={{ background: i === 0 ? "linear-gradient(90deg, #00E5FF, #00E676)" : i === 1 ? "linear-gradient(90deg, #E040FB, #FFD740)" : "linear-gradient(90deg, #FFD740, #FF6D00)" }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, p.strength * 100)}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          <span className="text-[#E0E0E0] text-sm font-bold">{p.strength.toFixed(3)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title text-sm font-medium mb-3">频谱预测</h3>
                <div className="text-center">
                  <p className="text-4xl font-bold text-[#E0E0E0] neon-cyan">{spectralAnalysis.forecast}</p>
                  <p className="text-[#E0E0E0]/30 text-xs mt-1">基于 FFT 频谱分解的趋势 + 周期预测</p>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Distribution View */}
      {viewMode === "distribution" && (
        <motion.div variants={item} className="space-y-4">
          <h3 className="cyber-section-title text-sm font-medium flex items-center gap-2 tracking-tight">
            <PieChart size={16} className="icon-glow-cyan" />
            分布分析 · v10.0 分位数 + EMD
          </h3>
          {!distributionAnalysis ? (
            <div className="holo-card rounded-[26px] p-8 text-center">
              <p className="text-[#E0E0E0]/30">需要至少 5 天数据</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="holo-card rounded-[26px] p-3 text-center">
                  <span className="terminal-text text-xs">P10 低分位</span>
                  <p className="text-xl font-bold text-[#E0E0E0] mt-1">{distributionAnalysis.p10}</p>
                </div>
                <div className="holo-card rounded-[26px] p-3 text-center">
                  <span className="terminal-text text-xs">P25 下四分位</span>
                  <p className="text-xl font-bold text-[#E0E0E0] mt-1">{distributionAnalysis.p25}</p>
                </div>
                <div className="holo-card rounded-[26px] p-3 text-center">
                  <span className="terminal-text text-xs">P50 中位数</span>
                  <p className="text-xl font-bold text-[#00E5FF] mt-1">{distributionAnalysis.p50}</p>
                </div>
                <div className="holo-card rounded-[26px] p-3 text-center">
                  <span className="terminal-text text-xs">P75 上四分位</span>
                  <p className="text-xl font-bold text-[#E0E0E0] mt-1">{distributionAnalysis.p75}</p>
                </div>
                <div className="holo-card rounded-[26px] p-3 text-center">
                  <span className="terminal-text text-xs">P90 高分位</span>
                  <p className="text-xl font-bold text-[#E040FB] mt-1">{distributionAnalysis.p90}</p>
                </div>
                <div className="holo-card rounded-[26px] p-3 text-center">
                  <span className="terminal-text text-xs">极差</span>
                  <p className="text-xl font-bold text-[#FFD740] mt-1">{distributionAnalysis.range}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="holo-card rounded-[26px] p-4">
                  <span className="terminal-text text-xs">偏度</span>
                  <p className="text-xl font-bold text-[#E0E0E0] mt-1">{distributionAnalysis.skewness}</p>
                  <span className="text-[#E0E0E0]/30 text-[10px]">{distributionAnalysis.skewness > 0.5 ? "右偏(高峰多)" : distributionAnalysis.skewness < -0.5 ? "左偏(低谷多)" : "对称"}</span>
                </div>
                <div className="holo-card rounded-[26px] p-4">
                  <span className="terminal-text text-xs">峰度</span>
                  <p className="text-xl font-bold text-[#E0E0E0] mt-1">{distributionAnalysis.kurtosis}</p>
                  <span className="text-[#E0E0E0]/30 text-[10px]">{distributionAnalysis.kurtosis > 1 ? "厚尾(极端值多)" : distributionAnalysis.kurtosis < -1 ? "薄尾(较稳定)" : "正态"}</span>
                </div>
                <div className="holo-card rounded-[26px] p-4">
                  <span className="terminal-text text-xs">变异系数</span>
                  <p className="text-xl font-bold text-[#E0E0E0] mt-1">{distributionAnalysis.cv}%</p>
                  <span className="text-[#E0E0E0]/30 text-[10px]">标准差/均值</span>
                </div>
                <div className="holo-card rounded-[26px] p-4">
                  <span className="terminal-text text-xs">均值</span>
                  <p className="text-xl font-bold text-[#E0E0E0] mt-1">{distributionAnalysis.mean}</p>
                  <span className="text-[#E0E0E0]/30 text-[10px]">±{distributionAnalysis.std}</span>
                </div>
              </div>
            </>
          )}

          {/* EMD 分解 */}
          {emdAnalysis && (
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                <Activity size={14} className="icon-glow-magenta" />
                EMD 经验模态分解 · v10.0
              </h3>
              <div className="space-y-3">
                {emdAnalysis.imfs.map((imf, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[#E0E0E0]/40 text-xs">IMF-{i + 1} ({imf.length} 点)</span>
                      <span className="text-[#E0E0E0]/30 text-[10px]">范围: {Math.min(...imf).toFixed(1)} ~ {Math.max(...imf).toFixed(1)}</span>
                    </div>
                    <div className="progress-cyber">
                      <motion.div
                        className="progress-cyber-fill"
                        style={{ background: i === 0 ? "linear-gradient(90deg, #00E5FF, #0091EA)" : i === 1 ? "linear-gradient(90deg, #E040FB, #D050F0)" : "linear-gradient(90deg, #FFD740, #FF6D00)" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.abs(imf[imf.length - 1]) / Math.max(1, Math.max(...imf.map(Math.abs))) * 100)}%` }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E0E0E0]/10">
                  <span className="text-[#E0E0E0]/40 text-xs">残差（趋势）</span>
                  <span className="text-[#00E676] text-sm font-bold">{emdAnalysis.residual}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#E0E0E0]/40 text-xs">EMD 预测</span>
                  <span className="text-[#00E5FF] text-sm font-bold">{emdAnalysis.forecast} 单</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Forecast View */}
      {viewMode === "forecast" && (
        <motion.div variants={item} className="space-y-4">
          <h3 className="cyber-section-title text-sm font-medium flex items-center gap-2 tracking-tight">
            <RadarIcon size={16} className="icon-glow-cyan" />
            预测分析 · v10.0 GPR
          </h3>
          {!gprAnalysis ? (
            <div className="holo-card rounded-[26px] p-8 text-center">
              <p className="text-[#E0E0E0]/30">需要至少 5 天数据</p>
            </div>
          ) : (
            <>
              <div className="holo-card rounded-[26px] p-6 text-center">
                <p className="text-[#E0E0E0]/40 text-sm mb-2">GPR 高斯过程回归预测</p>
                <p className="text-5xl font-bold text-[#E0E0E0] neon-cyan">{Math.round(gprAnalysis.mean)}</p>
                <span className="text-[#E0E0E0]/50 text-lg ml-2">单</span>
                <p className="text-[#E0E0E0]/30 text-xs mt-2 terminal-text">
                  不确定性: ±{Math.round(Math.sqrt(gprAnalysis.variance))} 单 · 置信度: {Math.round(gprAnalysis.confidence * 100)}%
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="holo-card rounded-[26px] p-4">
                  <span className="terminal-text text-xs">预测均值</span>
                  <p className="text-2xl font-bold text-[#00E5FF] mt-1">{Math.round(gprAnalysis.mean)}</p>
                </div>
                <div className="holo-card rounded-[26px] p-4">
                  <span className="terminal-text text-xs">预测方差</span>
                  <p className="text-2xl font-bold text-[#E040FB] mt-1">{Math.round(gprAnalysis.variance)}</p>
                </div>
                <div className="holo-card rounded-[26px] p-4">
                  <span className="terminal-text text-xs">标准差</span>
                  <p className="text-2xl font-bold text-[#FFD740] mt-1">±{Math.round(Math.sqrt(gprAnalysis.variance))}</p>
                </div>
                <div className="holo-card rounded-[26px] p-4">
                  <span className="terminal-text text-xs">GPR 置信度</span>
                  <p className="text-2xl font-bold text-[#00E676] mt-1">{Math.round(gprAnalysis.confidence * 100)}%</p>
                </div>
              </div>

              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title text-sm font-medium mb-3">预测区间（95%置信）</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1 holo-card rounded-xl p-4 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs">下限</span>
                    <p className="text-xl font-bold text-[#FF1744]">{Math.max(0, Math.round(gprAnalysis.mean - 2 * Math.sqrt(gprAnalysis.variance)))}</p>
                  </div>
                  <span className="text-[#E0E0E0]/20">—</span>
                  <div className="flex-1 holo-card rounded-xl p-4 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs">上限</span>
                    <p className="text-xl font-bold text-[#00E676]">{Math.round(gprAnalysis.mean + 2 * Math.sqrt(gprAnalysis.variance))}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 预测准确率追踪 */}
          {predictionAccuracy && (
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                <Shield size={14} className="icon-glow-cyan" />
                预测准确率追踪
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="holo-card rounded-xl p-3 text-center">
                  <span className="text-[#E0E0E0]/30 text-xs">MAPE</span>
                  <p className="text-lg font-bold text-[#E0E0E0] mt-1">{predictionAccuracy.overallAccuracy.mape}%</p>
                </div>
                <div className="holo-card rounded-xl p-3 text-center">
                  <span className="text-[#E0E0E0]/30 text-xs">R²</span>
                  <p className="text-lg font-bold text-[#E0E0E0] mt-1">{predictionAccuracy.overallAccuracy.r2}</p>
                </div>
                <div className="holo-card rounded-xl p-3 text-center">
                  <span className="text-[#E0E0E0]/30 text-xs">RMSE</span>
                  <p className="text-lg font-bold text-[#E0E0E0] mt-1">{predictionAccuracy.overallAccuracy.rmse}</p>
                </div>
                <div className="holo-card rounded-xl p-3 text-center">
                  <span className="text-[#E0E0E0]/30 text-xs">偏差</span>
                  <p className={`text-lg font-bold mt-1 ${predictionAccuracy.overallAccuracy.bias > 0 ? "text-amber-400" : predictionAccuracy.overallAccuracy.bias < 0 ? "text-red-400" : "text-[#00E5FF]"}`}>
                    {predictionAccuracy.overallAccuracy.bias > 0 ? "+" : ""}{predictionAccuracy.overallAccuracy.bias}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#E0E0E0]/30 text-xs">总预测 {predictionAccuracy.totalPredictions} 次 · 已验证 {predictionAccuracy.totalVerified} 次</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  predictionAccuracy.trend === "improving" ? "badge-cyber-green" : predictionAccuracy.trend === "stable" ? "badge-cyber-gold" : "badge-cyber"
                }`}>
                  {predictionAccuracy.trend === "improving" ? "改善中" : predictionAccuracy.trend === "stable" ? "稳定" : "下降中"}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Correlation View */}
      {viewMode === "correlation" && (
        <motion.div variants={item} className="space-y-4">
          <h3 className="cyber-section-title text-sm font-medium flex items-center gap-2 tracking-tight">
            <GitBranch size={16} className="icon-glow-cyan" />
            关联分析 · v10.0 天气-单量
          </h3>
          {!correlationMatrix ? (
            <div className="holo-card rounded-[26px] p-8 text-center">
              <p className="text-[#E0E0E0]/30">需要至少 10 天数据</p>
            </div>
          ) : (
            <>
              <div className="holo-card rounded-[26px] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[#E0E0E0]/40 text-xs">平均单量</span>
                  <span className="text-[#00E5FF] font-bold text-lg">{correlationMatrix.overallAvg}</span>
                </div>
                <div className="space-y-2">
                  {correlationMatrix.weatherStats.map((s) => (
                    <div key={s.weather} className="holo-card rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#E0E0E0] text-sm font-medium">{s.label}</span>
                        <span className={`text-sm font-bold ${s.lift > 0 ? "text-[#00E676]" : s.lift < 0 ? "text-[#FF1744]" : "text-[#E0E0E0]"}`}>
                          {s.lift > 0 ? "+" : ""}{s.lift}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#E0E0E0]/30 text-xs">{s.count}天 · 日均 {s.avg}单</span>
                        <span className="text-[#E0E0E0]/30 text-xs">范围 {s.min}-{s.max}</span>
                      </div>
                      <div className="progress-cyber mt-2">
                        <motion.div
                          className="progress-cyber-fill"
                          style={{ background: s.lift > 0 ? "linear-gradient(90deg, #00E676, #00E5FF)" : "linear-gradient(90deg, #FF1744, #E040FB)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(2, Math.min(100, 50 + s.lift * 2))}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {deepAnalysis && (
                <div className="holo-card rounded-[26px] p-4">
                  <h3 className="cyber-section-title text-sm font-medium mb-3">天气敏感性</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="holo-card rounded-xl p-3 text-center">
                      <span className="text-[#E0E0E0]/30 text-xs terminal-text">天气敏感指数</span>
                      <p className="text-xl font-bold text-[#FFD740] mt-1">{deepAnalysis.weatherSensitivity?.index ?? "—"}</p>
                    </div>
                    <div className="holo-card rounded-xl p-3 text-center">
                      <span className="text-[#E0E0E0]/30 text-xs terminal-text">最敏感天气</span>
                      <p className="text-xl font-bold text-[#FF1744] mt-1">
                        {deepAnalysis.weatherSensitivity ? WEATHER_LABELS[deepAnalysis.weatherSensitivity.mostSensitive] : "—"}
                      </p>
                    </div>
                    <div className="holo-card rounded-xl p-3 text-center">
                      <span className="text-[#E0E0E0]/30 text-xs terminal-text">最不敏感</span>
                      <p className="text-xl font-bold text-[#00E676] mt-1">
                        {deepAnalysis.weatherSensitivity ? WEATHER_LABELS[deepAnalysis.weatherSensitivity.leastSensitive] : "—"}
                      </p>
                    </div>
                    <div className="holo-card rounded-xl p-3 text-center">
                      <span className="text-[#E0E0E0]/30 text-xs terminal-text">稳定性</span>
                      <p className={`text-xl font-bold mt-1 ${
                        deepAnalysis.stabilityScore?.level === "stable" ? "text-[#00E676]" :
                        deepAnalysis.stabilityScore?.level === "moderate" ? "text-[#FFD740]" : "text-[#FF1744]"
                      }`}>
                        {deepAnalysis.stabilityScore?.score ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Weather View */}
      {viewMode === "weather" && (
        <motion.div variants={item} className="space-y-3">
          <h3 className="cyber-section-title text-sm font-medium flex items-center gap-2 tracking-tight">
            <Calendar size={16} className="icon-glow-cyan" />
            本月天气与单量关系
          </h3>
          {weatherStats.length === 0 ? (
            <div className="holo-card rounded-[26px] p-8 text-center">
              <p className="text-[#E0E0E0]/30">暂无本月数据</p>
            </div>
          ) : (
            weatherStats.map((stat) => (
              <div key={stat.weather} className="holo-card rounded-[26px] p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-[#E0E0E0]/30">
                  {weatherIcons[stat.weather]}
                </div>
                <div className="flex-1">
                  <p className="text-[#E0E0E0] font-medium">{stat.label}</p>
                  <p className="text-[#E0E0E0]/30 text-xs">{stat.count} 天</p>
                </div>
                <div className="text-right">
                  <p className="text-[#E0E0E0] font-bold">{stat.avgOrders}</p>
                  <p className="text-[#E0E0E0]/30 text-xs">日均单量</p>
                </div>
              </div>
            ))
          )}
        </motion.div>
      )}

      {/* Day of Week View */}
      {viewMode === "dow" && (
        <motion.div variants={item} className="space-y-3">
          <h3 className="cyber-section-title text-sm font-medium flex items-center gap-2 tracking-tight">
            <TrendingUp size={16} className="icon-glow-cyan" />
            星期维度分析（全部历史数据）
          </h3>
          <div className="space-y-2.5">
            {dowStats.map((d) => {
              const barWidth = maxDowOrders > 0 ? (d.avgOrders / maxDowOrders) * 100 : 0;
              const isWeekend = d.short === "六" || d.short === "日";
              return (
                <div key={d.day} className="holo-card rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 text-center">
                      <p className={`text-xs font-bold ${isWeekend ? "text-[#E040FB]" : "text-[#E0E0E0]/30"}`}>
                        {d.day}
                      </p>
                      <p className="text-[#E0E0E0]/30 text-[10px]">{d.count}天</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#E0E0E0] text-sm font-medium">{d.avgOrders} 单/天</span>
                        <span className="text-[#00E676]/60 text-xs">¥{d.avgIncome}/天</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5">
                        <motion.div
                          className="h-1.5 rounded-full"
                          style={{ background: isWeekend ? "linear-gradient(90deg, #E040FB, #D050F0)" : "linear-gradient(90deg, #00E5FF, #0091EA)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Anomaly View */}
      {viewMode === "anomaly" && (
        <motion.div variants={item} className="space-y-3">
          <h3 className="cyber-section-title text-sm font-medium flex items-center gap-2 tracking-tight">
            <AlertTriangle size={16} className="icon-glow-cyan" />
            异常检测（滑动窗口 Z-Score + 变点检测）
          </h3>
          {anomalies.length === 0 ? (
            <div className="holo-card rounded-[26px] p-8 text-center">
              <p className="text-[#E0E0E0]/30">未检测到异常数据</p>
              <p className="text-[#E0E0E0]/20 text-xs mt-1">需要更多数据才能检测</p>
            </div>
          ) : (
            <div className="space-y-2">
              {anomalies.slice().reverse().map((a) => (
                <div key={a.date} className={`holo-card rounded-xl p-4 ${
                  a.type === "spike" ? "ring-1 ring-cyan-400/20" : "ring-1 ring-red-400/20"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={a.type === "spike" ? "text-[#00E676]" : "text-[#FF1744]"}>
                          {a.type === "spike" ? "🔺" : "🔻"}
                        </span>
                        <span className="text-[#E0E0E0] font-medium text-sm">{a.date}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          a.type === "spike" ? "bg-[#00E676]/20 text-[#00E676]" : "bg-[#FF1744]/20 text-[#FF1744]"
                        }`}>
                          {a.type === "spike" ? "异常高峰" : "异常低谷"}
                        </span>
                      </div>
                      <p className="text-[#E0E0E0]/30 text-xs mt-1">
                        实际 {a.orders} 单 | 预期 {a.expected} 单 | 偏差 {a.deviation > 0 ? "+" : ""}{a.deviation} 单
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-[#E0E0E0]">{a.orders}</span>
                      <span className="text-[#E0E0E0]/30 text-xs ml-1">单</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Deep Analysis View */}
      {viewMode === "deep" && (
        <motion.div variants={item} className="space-y-4">
          {!deepAnalysis ? (
            <div className="holo-card rounded-[26px] p-8 text-center">
              <Brain size={40} className="text-[#E0E0E0]/20 mx-auto mb-3" />
              <p className="text-[#E0E0E0]/30">需要至少 14 天数据才能进行深度分析</p>
            </div>
          ) : (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="holo-card rounded-[26px] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity size={16} className="icon-glow-cyan" />
                    <span className="terminal-text text-xs">波动率</span>
                  </div>
                  <p className="text-xl font-bold text-[#E0E0E0]">{deepAnalysis.volatility.daily}%</p>
                  <p className="text-[#E0E0E0]/30 text-[10px] mt-1">日波动 | 周 {deepAnalysis.volatility.weekly}%</p>
                </div>
                <div className="holo-card rounded-[26px] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={16} className={
                      deepAnalysis.risk.level === "low" ? "icon-glow-green" :
                      deepAnalysis.risk.level === "medium" ? "icon-glow-gold" : "text-[#FF1744]"
                    } />
                    <span className="terminal-text text-xs">风险评分</span>
                  </div>
                  <p className={`text-xl font-bold ${
                    deepAnalysis.risk.level === "low" ? "text-[#00E676]" :
                    deepAnalysis.risk.level === "medium" ? "text-[#FFD740]" : "text-[#FF1744]"
                  }`}>{deepAnalysis.risk.score}/100</p>
                  <p className="text-[#E0E0E0]/30 text-[10px] mt-1">
                    {deepAnalysis.risk.level === "low" ? "低风险" : deepAnalysis.risk.level === "medium" ? "中风险" : "高风险"}
                  </p>
                </div>
                <div className="holo-card rounded-[26px] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className={
                      deepAnalysis.growth.direction === "up" ? "icon-glow-green" :
                      deepAnalysis.growth.direction === "down" ? "text-[#FF1744]" : "icon-glow-cyan"
                    } />
                    <span className="terminal-text text-xs">增长率</span>
                  </div>
                  <p className={`text-xl font-bold ${
                    deepAnalysis.growth.direction === "up" ? "text-[#00E676]" :
                    deepAnalysis.growth.direction === "down" ? "text-[#FF1744]" : "text-[#E0E0E0]"
                  }`}>{deepAnalysis.growth.rate > 0 ? "+" : ""}{deepAnalysis.growth.rate}%</p>
                  <p className="text-[#E0E0E0]/30 text-[10px] mt-1">
                    {deepAnalysis.growth.direction === "up" ? "上升趋势" : deepAnalysis.growth.direction === "down" ? "下降趋势" : "稳定"}
                  </p>
                </div>
                <div className="holo-card rounded-[26px] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={16} className="icon-glow-gold" />
                    <span className="terminal-text text-xs">小时效率</span>
                  </div>
                  <p className="text-xl font-bold text-[#E0E0E0]">{deepAnalysis.efficiency.avgPerHour}</p>
                  <p className="text-[#E0E0E0]/30 text-[10px] mt-1">
                    单/小时 | {deepAnalysis.efficiency.trend === "up" ? "↑ 提升" : deepAnalysis.efficiency.trend === "down" ? "↓ 下降" : "→ 稳定"}
                  </p>
                </div>
              </div>

              {/* Trends */}
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title text-sm font-medium mb-3">多尺度趋势</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[#E0E0E0]/40 text-xs">短期 (7天)</span>
                      <span className="text-[#E0E0E0] text-sm font-bold">{deepAnalysis.trends.shortTerm} 单/天</span>
                    </div>
                    <div className="progress-cyber">
                      <div className="progress-cyber-fill" style={{ width: `${Math.min(100, (deepAnalysis.trends.shortTerm / Math.max(1, deepAnalysis.trends.longTerm)) * 100)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[#E0E0E0]/40 text-xs">中期 (14天)</span>
                      <span className="text-[#E0E0E0] text-sm font-bold">{deepAnalysis.trends.mediumTerm} 单/天</span>
                    </div>
                    <div className="progress-cyber">
                      <div className="progress-cyber-fill" style={{ width: `${Math.min(100, (deepAnalysis.trends.mediumTerm / Math.max(1, deepAnalysis.trends.longTerm)) * 100)}%`, background: "linear-gradient(90deg, #E040FB, #00E5FF)" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[#E0E0E0]/40 text-xs">长期 (30天)</span>
                      <span className="text-[#E0E0E0] text-sm font-bold">{deepAnalysis.trends.longTerm} 单/天</span>
                    </div>
                    <div className="progress-cyber">
                      <div className="progress-cyber-fill" style={{ width: "100%", background: "linear-gradient(90deg, #FFD740, #FF6D00)" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seasonality Details */}
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                  <Calendar size={14} />
                  季节性分析 · 强度 {deepAnalysis.seasonality.strength}
                </h3>
                <p className="text-[#E0E0E0]/40 text-xs mb-3">{deepAnalysis.seasonality.pattern}</p>
                <div className="space-y-2">
                  {deepAnalysis.seasonality.details.map((d, i) => {
                    const isWeekend = i === 0 || i === 6;
                    return (
                      <div key={d.day} className="flex items-center gap-2">
                        <span className={`w-10 text-xs ${isWeekend ? "text-[#E040FB]" : "text-[#E0E0E0]/30"}`}>{d.day}</span>
                        <div className="flex-1 bg-white/5 rounded-full h-2">
                          <motion.div
                            className="h-2 rounded-full"
                            style={{ background: d.factor > 1 ? "linear-gradient(90deg, #00E676, #00E5FF)" : "linear-gradient(90deg, #FF1744, #E040FB)" }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, Math.max(0, d.factor * 80))}%` }}
                            transition={{ duration: 0.5, delay: i * 0.05 }}
                          />
                        </div>
                        <span className="text-[#E0E0E0]/40 text-xs w-10 text-right">{d.factor > 1 ? "+" : ""}{Math.round((d.factor - 1) * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Weather Correlation */}
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                  <Cloud size={14} />
                  天气相关性
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {(["sunny", "cloudy", "rainy", "snowy", "windy"] as Weather[]).map((w) => {
                    const avg = deepAnalysis.correlation.weather[w] || 0;
                    const maxCorr = Math.max(...Object.values(deepAnalysis.correlation.weather), 1);
                    const barH = (avg / maxCorr) * 100;
                    return (
                      <div key={w} className="text-center">
                        <div className="h-20 flex items-end justify-center mb-1">
                          <motion.div
                            className="w-8 rounded-t-md"
                            style={{ background: `linear-gradient(180deg, ${w === "sunny" ? "#FFD740" : w === "rainy" ? "#00E5FF" : w === "snowy" ? "#E0E0E0" : w === "windy" ? "#E040FB" : "#00E676"}, transparent)` }}
                            initial={{ height: 0 }}
                            animate={{ height: `${barH}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <p className="text-[#E0E0E0] font-bold text-xs">{avg}</p>
                        <p className="text-[#E0E0E0]/30 text-[10px]">{WEATHER_LABELS[w].split(" ")[0]}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Risk Factors */}
              {deepAnalysis.risk.factors.length > 0 && (
                <div className="holo-card rounded-[26px] p-4">
                  <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-[#FFD740]" />
                    风险因素
                  </h3>
                  <div className="space-y-2">
                    {deepAnalysis.risk.factors.map((factor, i) => (
                      <div key={i} className="flex items-center gap-2 text-[#FFD740]/80 text-sm">
                        <span>⚠</span>
                        <span>{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Changepoints */}
              {deepAnalysis.changepoints.length > 0 && (
                <div className="holo-card rounded-[26px] p-4">
                  <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                    <Activity size={14} className="icon-glow-magenta" />
                    变点检测
                  </h3>
                  <p className="text-[#E0E0E0]/40 text-xs">
                    检测到 {deepAnalysis.changepoints.length} 个数据模式变化点，模型已自动调整预测策略
                  </p>
                </div>
              )}

              {/* v10.0: 雷达图多维分析 */}
              {radarData.length > 0 && (
                <div className="holo-card rounded-[26px] p-4">
                  <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                    <RadarIcon size={14} className="icon-glow-cyan" />
                    多维雷达分析 · v10.0
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="subject" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                      <PolarRadiusAxis stroke="rgba(255,255,255,0.1)" fontSize={10} />
                      <Radar
                        name="分析指标"
                        dataKey="A"
                        stroke="#00E5FF"
                        fill="#00E5FF"
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* v10.0: 天气敏感性分析 */}
              {deepAnalysis.weatherSensitivity && (
                <div className="holo-card rounded-[26px] p-4">
                  <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                    <CloudRain size={14} className="icon-glow-magenta" />
                    天气敏感性 · v10.0
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="holo-card rounded-xl p-3 text-center">
                      <span className="text-[#E0E0E0]/30 text-xs terminal-text">敏感指数</span>
                      <p className="text-xl font-bold text-[#FFD740] mt-1">{deepAnalysis.weatherSensitivity.index}</p>
                    </div>
                    <div className="holo-card rounded-xl p-3 text-center">
                      <span className="text-[#E0E0E0]/30 text-xs terminal-text">最敏感</span>
                      <p className="text-xl font-bold text-[#FF1744] mt-1">{WEATHER_LABELS[deepAnalysis.weatherSensitivity.mostSensitive]}</p>
                    </div>
                    <div className="holo-card rounded-xl p-3 text-center">
                      <span className="text-[#E0E0E0]/30 text-xs terminal-text">最不敏感</span>
                      <p className="text-xl font-bold text-[#00E676] mt-1">{WEATHER_LABELS[deepAnalysis.weatherSensitivity.leastSensitive]}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* v10.0: 稳定性评分 */}
              {deepAnalysis.stabilityScore && (
                <div className="holo-card rounded-[26px] p-4">
                  <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                    <Shield size={14} className="icon-glow-cyan" />
                    稳定性评分 · v10.0
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-16 h-16 rounded-full border-4 flex items-center justify-center"
                      style={{
                        borderColor: deepAnalysis.stabilityScore.level === "stable" ? "#00E676" :
                                     deepAnalysis.stabilityScore.level === "moderate" ? "#FFD740" : "#FF1744",
                      }}
                    >
                      <span className="text-lg font-bold text-[#E0E0E0]">{deepAnalysis.stabilityScore.score}</span>
                    </div>
                    <div>
                      <p className="text-[#E0E0E0] font-medium text-sm">
                        {deepAnalysis.stabilityScore.level === "stable" ? "稳定" :
                         deepAnalysis.stabilityScore.level === "moderate" ? "中等波动" : "波动较大"}
                      </p>
                      <p className="text-[#E0E0E0]/30 text-xs mt-1">
                        基于变异系数(CV)和鲁棒标准差(MAD)的综合评估
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* v10.0: 动量指数 */}
              {deepAnalysis.momentumIndex && (
                <div className="holo-card rounded-[26px] p-4">
                  <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                    <TrendingUp size={14} className={
                      deepAnalysis.momentumIndex.trend === "accelerating" ? "icon-glow-green" :
                      deepAnalysis.momentumIndex.trend === "decelerating" ? "text-[#FF1744]" : "icon-glow-cyan"
                    } />
                    动量指数 · v10.0
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-[#E0E0E0]/40 text-xs">7日动量比</span>
                    <span className={`text-lg font-bold ${
                      deepAnalysis.momentumIndex.trend === "accelerating" ? "text-[#00E676]" :
                      deepAnalysis.momentumIndex.trend === "decelerating" ? "text-[#FF1744]" : "text-[#E0E0E0]"
                    }`}>
                      {deepAnalysis.momentumIndex.value}
                    </span>
                  </div>
                  <p className="text-[#E0E0E0]/30 text-[10px] mt-1">
                    {deepAnalysis.momentumIndex.trend === "accelerating" ? "加速增长" :
                     deepAnalysis.momentumIndex.trend === "decelerating" ? "减速" : "稳定"}
                  </p>
                </div>
              )}

              {/* v10.0: EMD 经验模态分解 */}
              {emdAnalysis && (
                <div className="holo-card rounded-[26px] p-4">
                  <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                    <Activity size={14} className="icon-glow-magenta" />
                    EMD 经验模态分解 · v10.0
                  </h3>
                  <div className="space-y-3">
                    {emdAnalysis.imfs.map((imf, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[#E0E0E0]/40 text-xs">IMF-{i + 1} ({imf.length}点)</span>
                          <span className="text-[#E0E0E0]/30 text-[10px]">范围: {Math.min(...imf).toFixed(1)}~{Math.max(...imf).toFixed(1)}</span>
                        </div>
                        <div className="progress-cyber">
                          <motion.div
                            className="progress-cyber-fill"
                            style={{ background: i === 0 ? "linear-gradient(90deg, #00E5FF, #0091EA)" : i === 1 ? "linear-gradient(90deg, #E040FB, #D050F0)" : "linear-gradient(90deg, #FFD740, #FF6D00)" }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, Math.abs(imf[imf.length - 1]) / Math.max(1, Math.max(...imf.map(Math.abs))) * 100)}%` }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E0E0E0]/10">
                      <span className="text-[#E0E0E0]/40 text-xs">残差趋势</span>
                      <span className="text-[#00E676] text-sm font-bold">{emdAnalysis.residual}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#E0E0E0]/40 text-xs">EMD 预测</span>
                      <span className="text-[#00E5FF] text-sm font-bold">{emdAnalysis.forecast} 单</span>
                    </div>
                  </div>
                </div>
              )}

              {/* v10.0: 预测准确率 */}
              {predictionAccuracy && (
                <div className="holo-card rounded-[26px] p-4">
                  <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                    <Shield size={14} className="icon-glow-cyan" />
                    预测准确率追踪 · v10.0
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="holo-card rounded-xl p-3 text-center">
                      <span className="text-[#E0E0E0]/30 text-xs">准确率</span>
                      <p className="text-xl font-bold text-[#00E5FF] mt-1">{100 - predictionAccuracy.overallAccuracy.mape}%</p>
                    </div>
                    <div className="holo-card rounded-xl p-3 text-center">
                      <span className="text-[#E0E0E0]/30 text-xs">R²</span>
                      <p className="text-xl font-bold text-[#E0E0E0] mt-1">{predictionAccuracy.overallAccuracy.r2}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#E0E0E0]/30 text-xs">
                      总预测 {predictionAccuracy.totalPredictions} 次 · 已验证 {predictionAccuracy.totalVerified} 次
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      predictionAccuracy.trend === "improving" ? "badge-cyber-green" :
                      predictionAccuracy.trend === "stable" ? "badge-cyber-gold" : "badge-cyber"
                    }`}>
                      {predictionAccuracy.trend === "improving" ? "改善" : predictionAccuracy.trend === "stable" ? "稳定" : "下降"}
                    </span>
                  </div>
                </div>
              )}

              {/* v10.0: 分位数分布 */}
              {deepAnalysis.quantileDistribution && (
                <div className="holo-card rounded-[26px] p-4">
                  <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2">
                    <PieChart size={14} className="icon-glow-cyan" />
                    分位数分布 · v10.0
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: "P10", value: deepAnalysis.quantileDistribution.p10, color: "#FF1744" },
                      { label: "P25", value: deepAnalysis.quantileDistribution.p25, color: "#FFD740" },
                      { label: "P50", value: deepAnalysis.quantileDistribution.p50, color: "#00E5FF" },
                      { label: "P75", value: deepAnalysis.quantileDistribution.p75, color: "#E040FB" },
                      { label: "P90", value: deepAnalysis.quantileDistribution.p90, color: "#00E676" },
                    ].map((q) => (
                      <div key={q.label} className="text-center">
                        <p className="text-[#E0E0E0]/30 text-[10px]">{q.label}</p>
                        <p className="text-sm font-bold mt-1" style={{ color: q.color }}>{q.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}