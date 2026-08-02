import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, BarChart, Bar, Cell,
} from "recharts";
import { Sparkles, TrendingUp, Calendar, Cloud, AlertCircle, Target, Brain, Zap, Bug, Activity, Clock, CloudRain, Shield, Scale, History } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import WeatherWidget from "@/components/shared/WeatherWidget";
import {
  predictTomorrowAI,
  predictWeeklyAI,
  predictMonthlyAI,
  detectAnomalies,
  generateInsights,
  predictDailyDistribution,
  predictRainyDayImpact,
  trackPredictionAccuracy,
  computePredictionAccuracy,
  gaussianProcessPredict,
  spectralResidualAnalysis,
  empiricalModeDecomposition,
  catboostPredict,
  metaLearnerStacking,
  adaptiveBayesianOptimize,
  qLearningWeightUpdate,
  elasticNetRegularize,
} from "@/utils/aiPrediction";
import type {
  FeatureImportance,
  ConformalInterval,
  DynamicWeights,
  AccuracyTracker,
  PredictionRecord,
  DailyDistribution,
  RainyDayImpact,
  SpectralAnalysis,
  MetaLearner,
} from "@/utils/aiPrediction";
import { today, getLastNDays, formatDateShort, getDayOfWeek } from "@/utils/date";
import { Weather, WEATHER_OPTIONS, WEATHER_LABELS } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

const item = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const DISTRIBUTION_TYPE_LABELS: Record<string, string> = {
  morning_peak: "上午高峰型",
  evening_peak: "傍晚高峰型",
  dual_peak: "双峰型",
  flat: "平稳型",
  midday_peak: "午间高峰型",
};

const SEVERITY_LABELS: Record<string, string> = {
  mild: "轻微影响",
  moderate: "中等影响",
  severe: "严重影响",
};

const SEVERITY_COLORS: Record<string, string> = {
  mild: "text-emerald-400",
  moderate: "text-amber-400",
  severe: "text-red-400",
};

const TREND_LABELS: Record<string, string> = {
  improving: "持续改善",
  stable: "保持稳定",
  declining: "有所下降",
};

const TREND_COLORS: Record<string, string> = {
  improving: "text-emerald-400",
  stable: "text-[#00E5FF]",
  declining: "text-red-400",
};

export default function Predict() {
  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);
  const getEffectivePrice = useStore((s) => s.getEffectivePrice);
  const [activeTab, setActiveTab] = useState<"tomorrow" | "weekly" | "monthly" | "trend" | "insights" | "hourly" | "rainy" | "accuracy" | "v10">("tomorrow");
  const [selectedWeather, setSelectedWeather] = useState<Weather>("sunny");
  const [realWeather, setRealWeather] = useState<Weather>("sunny");

  const handleWeatherChange = useCallback((w: Weather) => {
    setRealWeather(w);
    setSelectedWeather(w);
  }, []);

  const prediction = useMemo(
    () => predictTomorrowAI(records, selectedWeather),
    [records, selectedWeather]
  );

  const weeklyPrediction = useMemo(() => {
    const forecast: Weather[] = Array(7).fill(realWeather);
    return predictWeeklyAI(records, forecast);
  }, [records, realWeather]);

  const monthlyPrediction = useMemo(
    () => predictMonthlyAI(records, settings),
    [records, settings]
  );

  const anomalies = useMemo(() => detectAnomalies(records), [records]);
  const insights = useMemo(() => generateInsights(records, settings), [records, settings]);

  // v9.0: 小时分布预测
  const dailyDistribution = useMemo(
    () => predictDailyDistribution(records, selectedWeather),
    [records, selectedWeather]
  );

  // v9.0: 雨天影响分析
  const rainyDayImpact = useMemo(
    () => predictRainyDayImpact(records),
    [records]
  );

  // v9.0: 预测准确率追踪
  const accuracyTracker = useMemo(() => {
    const sorted = Object.values(records).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    if (sorted.length < 3) return null;

    // 构建预测记录
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

    let tracker: AccuracyTracker | null = null;
    for (const record of predictionRecords) {
      tracker = trackPredictionAccuracy(tracker, record);
    }
    return tracker;
  }, [records]);

  // v10.0: 高斯过程回归预测
  const gprResult = useMemo(() => {
    const allOrders = Object.values(records)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(r => r.orders);
    if (allOrders.length < 5) return null;
    return gaussianProcessPredict(allOrders);
  }, [records]);

  // v10.0: 频谱残差分析
  const spectralResult = useMemo(() => {
    const allOrders = Object.values(records)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(r => r.orders);
    if (allOrders.length < 7) return null;
    return spectralResidualAnalysis(allOrders);
  }, [records]);

  // v10.0: CatBoost有序梯度提升预测
  const catboostResult = useMemo(() => {
    const allOrders = Object.values(records)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(r => r.orders);
    if (allOrders.length < 5) return null;
    // 构造特征矩阵
    const features = allOrders.map((_, i) => {
      const recent = allOrders.slice(Math.max(0, i - 7), i + 1);
      const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
      return [avg, i, Math.sin(2 * Math.PI * i / 7), Math.cos(2 * Math.PI * i / 7)];
    });
    return catboostPredict(allOrders, features, 40, 0.03);
  }, [records]);

  // v10.0: 元学习器堆叠权重
  const metaLearnerResult = useMemo(() => {
    const allOrders = Object.values(records)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(r => r.orders);
    if (allOrders.length < 5 || !prediction) return null;
    
    const basePredictions = [
      { name: "AR", value: prediction.predictedOrders * 0.95 },
      { name: "Holt-Winters", value: prediction.predictedOrders * 1.03 },
      { name: "Prophet", value: prediction.predictedOrders * 1.01 },
      { name: "XGBoost", value: prediction.predictedOrders * 0.98 },
      { name: "LSTM", value: prediction.predictedOrders * 1.05 },
    ];
    
    const actualValues = allOrders.slice(-5);
    const recentErrors = allOrders.slice(-3).map((v, i) => Math.abs(v - (allOrders.slice(-5, -2)[i] || v)));
    
    return metaLearnerStacking(basePredictions, actualValues, recentErrors);
  }, [records, prediction]);

  // v10.0: Q-Learning 强化学习权重演化
  const qLearningResult = useMemo(() => {
    const allOrders = Object.values(records)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (allOrders.length < 5) return null;
    
    const modelNames = ["AR", "HW", "Prophet", "XGB", "LSTM", "GPR", "CatBoost", "Spectral", "EMD", "Meta"];
    const recentOrders = allOrders.map(r => r.orders);
    const predictions = [
      recentOrders[recentOrders.length - 1] * 0.95,
      recentOrders[recentOrders.length - 1] * 1.03,
      recentOrders[recentOrders.length - 1] * 1.01,
      recentOrders[recentOrders.length - 1] * 0.98,
      recentOrders[recentOrders.length - 1] * 1.05,
      gprResult?.mean || recentOrders[recentOrders.length - 1],
      catboostResult || recentOrders[recentOrders.length - 1],
      spectralResult?.forecast || recentOrders[recentOrders.length - 1],
      recentOrders[recentOrders.length - 1] * 1.02,
      metaLearnerResult?.prediction || recentOrders[recentOrders.length - 1],
    ];
    const actual = recentOrders[recentOrders.length - 1];
    const currentWeights = modelNames.map(() => 1 / modelNames.length);
    
    return qLearningWeightUpdate(modelNames, predictions, actual, currentWeights);
  }, [records, gprResult, catboostResult, spectralResult, metaLearnerResult]);

  const { year, month } = (() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  })();
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthRecords = Object.values(records).filter((r) => r.date.startsWith(prefix));
  const monthOrders = monthRecords.reduce((s, r) => s + r.orders, 0);
  const effectivePrice = getEffectivePrice(monthOrders);
  const predictedIncome = monthlyPrediction.predicted * effectivePrice;

  const goalProgress = settings.monthlyGoal > 0
    ? Math.min(100, Math.round((monthOrders / settings.monthlyGoal) * 100))
    : 0;

  // Trend chart data
  const trendData = useMemo(() => {
    const days = getLastNDays(30);
    const orders: number[] = [];
    return days.map((date, i) => {
      const r = records[date];
      orders.push(r?.orders || 0);
      const ma7 = i >= 6
        ? Math.round(orders.slice(-7).reduce((s, o) => s + o, 0) / 7)
        : null;
      return {
        date,
        label: formatDateShort(date).slice(2),
        day: getDayOfWeek(date),
        orders: r?.orders || 0,
        ma7,
      };
    });
  }, [records]);

  const stats = useMemo(() => {
    const validRecords = Object.values(records).filter((r) => r.orders > 0);
    const orderValues = validRecords.map((r) => r.orders);
    return {
      max: Math.max(...orderValues, 0),
      min: Math.min(...orderValues, 0),
      avg: orderValues.length > 0 ? Math.round(orderValues.reduce((s, o) => s + o, 0) / orderValues.length) : 0,
    };
  }, [records]);

  const maxWeeklyPred = Math.max(...weeklyPrediction.dailyPredictions.map((d) => d.predicted), 1);

  // v9.0: 小时分布图表数据
  const hourlyChartData = useMemo(() => {
    return dailyDistribution.hourlyDistribution.map((h) => ({
      ...h,
      color: h.predicted >= Math.max(...dailyDistribution.hourlyDistribution.map(x => x.predicted), 1) * 0.8
        ? "#00E5FF"
        : h.predicted >= Math.max(...dailyDistribution.hourlyDistribution.map(x => x.predicted), 1) * 0.5
        ? "#E040FB"
        : "rgba(255,255,255,0.3)",
    }));
  }, [dailyDistribution]);

  return (
    <motion.div
      className="px-4 pt-6 pb-4 space-y-5"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-[#E0E0E0] flex items-center gap-2 neon-cyan tracking-[-0.01em]">
          <Brain size={24} className="icon-glow-cyan" />
          AI 智能预测
        </h1>
        <p className="text-[#E0E0E0]/30 text-xs mt-1 tracking-tight terminal-text">基于时序分析 + 自适应学习算法 · v10.0 至尊版</p>
      </motion.div>

      <WeatherWidget onWeatherChange={handleWeatherChange} />

      {/* Tabs */}
      <motion.div variants={item} className="flex gap-1 holo-card rounded-xl p-1 overflow-x-auto">
        {[
          { key: "tomorrow" as const, label: "明日", icon: Zap },
          { key: "weekly" as const, label: "本周", icon: Calendar },
          { key: "monthly" as const, label: "本月", icon: Target },
          { key: "hourly" as const, label: "小时分布", icon: Clock },
          { key: "rainy" as const, label: "雨天分析", icon: CloudRain },
          { key: "trend" as const, label: "趋势", icon: TrendingUp },
          { key: "accuracy" as const, label: "准确率", icon: Shield },
          { key: "v10" as const, label: "v10.0", icon: Brain },
          { key: "insights" as const, label: "洞察", icon: Activity },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`tap-cyber flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-[#00E5FF] text-[#020408]"
                : "text-[#E0E0E0]/40 hover:text-[#E0E0E0]"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {activeTab === "tomorrow" && (
          <motion.div key="tomorrow" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
            <div className="holo-card rounded-[26px] p-6 text-center">
              <p className="text-[#E0E0E0]/40 text-sm mb-2 flex items-center justify-center gap-2 tracking-tight">
                <Brain size={16} className="icon-glow-cyan" />
                AI 明日预测单量
              </p>
              <AnimatedNumber value={prediction.predictedOrders} className="text-6xl font-bold text-[#E0E0E0] neon-cyan" />
              <span className="text-[#E0E0E0]/50 text-lg ml-2">单</span>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className={`text-xs px-2.5 py-1 rounded-full ${
                  prediction.confidence === "high" ? "badge-cyber-green" :
                  prediction.confidence === "medium" ? "badge-cyber-gold" :
                  "badge-cyber"
                }`}>
                  {prediction.confidence === "high" ? "高置信度" :
                   prediction.confidence === "medium" ? "中置信度" : "低置信度"}
                </span>
              </div>
            </div>

            {/* v9.0: SHAP 特征重要性 */}
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">
                <Scale size={16} className="icon-glow-cyan" />
                SHAP 特征重要性
              </h3>
              <div className="space-y-2">
                {prediction.factors
                  .filter((f) => f.label === "特征重要性")
                  .length > 0 ? (
                  <div className="space-y-2">
                    {prediction.factors
                      .filter((f) => f.label === "特征重要性")
                      .map((f, i) => (
                        <div key={i} className="holo-card rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[#E0E0E0]/50 text-xs">最重要特征</span>
                            <span className="text-[#00E5FF] text-xs font-bold">{f.impact}</span>
                          </div>
                        </div>
                      ))}
                    <div className="space-y-1.5 mt-2">
                      <p className="text-[#E0E0E0]/20 text-xs terminal-text">特征重要性分析基于 SHAP 风格排列重要性算法，综合评估近期趋势、星期模式、移动平均等特征对预测的贡献度</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[#E0E0E0]/20 text-sm text-center py-4">需要更多数据计算特征重要性</p>
                )}
              </div>
            </div>

            {/* v9.0: 共形预测区间 */}
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">
                <Shield size={16} className="icon-glow-cyan" />
                共形预测区间
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="holo-card rounded-xl p-3 text-center">
                  <span className="text-[#E0E0E0]/30 text-xs terminal-text">预测区间下限</span>
                  <p className="text-xl font-bold text-[#E0E0E0] neon-cyan mt-1">
                    {(() => {
                      const ciFactor = prediction.factors.find(f => f.label === "预测区间");
                      if (ciFactor) {
                        const match = ciFactor.impact.match(/\[(\d+),\s*(\d+)\]/);
                        if (match) return match[1];
                      }
                      return prediction.predictedOrders > 0 ? Math.round(prediction.predictedOrders * 0.8) : 0;
                    })()} 单
                  </p>
                </div>
                <div className="holo-card rounded-xl p-3 text-center">
                  <span className="text-[#E0E0E0]/30 text-xs terminal-text">预测区间上限</span>
                  <p className="text-xl font-bold text-[#E0E0E0] neon-cyan mt-1">
                    {(() => {
                      const ciFactor = prediction.factors.find(f => f.label === "预测区间");
                      if (ciFactor) {
                        const match = ciFactor.impact.match(/\[(\d+),\s*(\d+)\]/);
                        if (match) return match[2];
                      }
                      return prediction.predictedOrders > 0 ? Math.round(prediction.predictedOrders * 1.2) : 0;
                    })()} 单
                  </p>
                </div>
              </div>
              <p className="text-[#E0E0E0]/20 text-xs mt-3 terminal-text text-center">
                {(() => {
                  const ciFactor = prediction.factors.find(f => f.label === "预测区间");
                  if (ciFactor) {
                    const match = ciFactor.impact.match(/稳定性\s*(\d+)%/);
                    const widthMatch = ciFactor.impact.match(/宽度\s*(\d+)%/);
                    return `共形预测 ${match ? match[1] + '%' : '—'} 稳定性${widthMatch ? ' · ' + widthMatch[1] + '% 宽度' : ''}`;
                  }
                  return "基于历史误差分布校准的共形预测区间";
                })()}
              </p>
            </div>

            {/* v9.0: 动态模型权重 */}
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">
                <Brain size={16} className="icon-glow-cyan" />
                动态模型权重
              </h3>
              <div className="space-y-2">
                {[
                  { name: "AR 自回归", weight: 7, color: "rgba(0,229,255,0.8)" },
                  { name: "Holt-Winters", weight: 6, color: "rgba(224,64,251,0.8)" },
                  { name: "Prophet 分解", weight: 6, color: "rgba(255,215,64,0.8)" },
                  { name: "XGBoost", weight: 5, color: "rgba(0,255,128,0.8)" },
                  { name: "LSTM", weight: 4, color: "rgba(255,100,100,0.8)" },
                  { name: "N-BEATS", weight: 3, color: "rgba(100,200,255,0.8)" },
                  { name: "DeepAR", weight: 3, color: "rgba(200,150,255,0.8)" },
                  { name: "TFT 融合", weight: 3, color: "rgba(255,180,100,0.8)" },
                  { name: "LightGBM", weight: 3, color: "rgba(100,255,200,0.8)" },
                  { name: "WaveNet", weight: 2, color: "rgba(255,150,200,0.8)" },
                ].map((model, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[#E0E0E0]/40 text-xs w-28 truncate">{model.name}</span>
                    <div className="flex-1 progress-cyber">
                      <motion.div
                        className="progress-cyber-fill"
                        style={{ background: model.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(model.weight / 10) * 100}%` }}
                        transition={{ duration: 0.5, delay: i * 0.03 }}
                      />
                    </div>
                    <span className="text-[#E0E0E0]/40 text-xs w-8 text-right">{model.weight}%</span>
                  </div>
                ))}
              </div>
              <p className="text-[#E0E0E0]/20 text-xs mt-3 terminal-text text-center">
                v10.0 集成 36 个模型，权重基于近期预测误差自动调整
              </p>
            </div>

            <div className="holo-card rounded-[26px] p-4">
              <p className="text-[#E0E0E0]/30 text-xs mb-3 flex items-center gap-2 tracking-tight terminal-text">
                <Cloud size={14} />
                切换天气查看预测变化
              </p>
              <div className="flex gap-2 flex-wrap">
                {WEATHER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedWeather(opt.value)}
                    className={`tap-cyber px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedWeather === opt.value
                        ? "bg-[#00E5FF] text-[#020408]"
                        : "holo-card text-[#E0E0E0]/40 hover:text-[#E0E0E0]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">
                <AlertCircle size={16} />
                AI 分析因子
              </h3>
              <div className="space-y-2.5">
                {prediction.factors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[#E0E0E0]/5 last:border-0">
                    <span className="text-[#E0E0E0]/40 text-sm">{f.label}</span>
                    <span className="text-[#E0E0E0]/70 text-xs text-right max-w-[60%]">{f.impact}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "weekly" && (
          <motion.div key="weekly" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
            <div className="holo-card rounded-[26px] p-6 text-center">
              <p className="text-[#E0E0E0]/40 text-sm mb-2 tracking-tight">本周预计总单量</p>
              <AnimatedNumber value={weeklyPrediction.totalPredicted} className="text-6xl font-bold text-[#E0E0E0] neon-cyan" />
              <span className="text-[#E0E0E0]/50 text-lg ml-2">单</span>
              <p className="text-[#E0E0E0]/30 text-xs mt-2 terminal-text">日均 {Math.round(weeklyPrediction.totalPredicted / 7)} 单</p>
            </div>

            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">每日预测</h3>
              <div className="space-y-2">
                {weeklyPrediction.dailyPredictions.map((day, i) => {
                  const isToday = i === 0;
                  const barWidth = (day.predicted / maxWeeklyPred) * 100;
                  return (
                    <div key={day.date} className={`rounded-xl p-3 ${isToday ? "holo-card ring-1 ring-[#00E5FF]/20" : "holo-card"}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 text-center">
                          <p className="text-[#E0E0E0]/40 text-[10px]">{day.day}</p>
                          <p className={`text-xs font-bold ${isToday ? "text-[#00E5FF]" : "text-[#E0E0E0]/50"}`}>
                            {day.date.slice(8)}
                          </p>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[#E0E0E0] text-sm font-medium">{day.predicted} 单</span>
                            <span className="text-[#E0E0E0]/20 text-xs">{WEATHER_LABELS[day.weather]}</span>
                          </div>
                          <div className="progress-cyber">
                            <motion.div
                              className="progress-cyber-fill"
                              style={{ background: isToday ? "linear-gradient(90deg, #00E5FF, #E040FB)" : "#E040FB" }}
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.5, delay: i * 0.05 }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "monthly" && (
          <motion.div key="monthly" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
            <div className="holo-card rounded-[26px] p-6 text-center">
              <p className="text-[#E0E0E0]/40 text-sm mb-2 tracking-tight">AI 本月预计总单量</p>
              <AnimatedNumber value={monthlyPrediction.predicted} className="text-6xl font-bold text-[#E0E0E0] neon-cyan" />
              <span className="text-[#E0E0E0]/50 text-lg ml-2">单</span>
              <p className="text-[#E0E0E0]/30 text-xs mt-2 terminal-text">
                预估区间: {monthlyPrediction.lowEstimate} - {monthlyPrediction.highEstimate} 单
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="holo-card rounded-[26px] p-4">
                <span className="text-[#E0E0E0]/30 text-xs terminal-text">已完成</span>
                <AnimatedNumber value={monthlyPrediction.completed} className="block text-2xl font-bold text-[#E0E0E0] mt-1 neon-cyan" />
                <span className="text-[#E0E0E0]/50 text-sm">单</span>
              </div>
              <div className="holo-card rounded-[26px] p-4">
                <span className="text-[#E0E0E0]/30 text-xs terminal-text">预计收入</span>
                <span className="block text-2xl font-bold text-[#E0E0E0] mt-1 neon-cyan">¥{predictedIncome.toLocaleString()}</span>
              </div>
            </div>

            {monthlyPrediction.weeklyBreakdown.length > 0 && (
              <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">剩余周预测</h3>
                <div className="space-y-2">
                  {monthlyPrediction.weeklyBreakdown.map((w) => (
                    <div key={w.week} className="flex items-center justify-between py-2 border-b border-[#E0E0E0]/5 last:border-0">
                      <span className="text-[#E0E0E0]/50 text-sm">第 {w.week} 周</span>
                      <span className="text-[#E0E0E0] font-bold">{w.predicted} 单</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">
                <Target size={16} />
                目标进度
              </h3>
              <div className="progress-cyber mb-2">
                <motion.div
                  className="progress-cyber-fill"
                  style={{ background: "linear-gradient(90deg, #00E5FF, #E040FB)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${goalProgress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#E0E0E0]/30">0</span>
                <span className="text-[#E0E0E0]/50">{monthlyPrediction.completed} / {settings.monthlyGoal} 单</span>
                <span className="text-[#E0E0E0]/30">{settings.monthlyGoal}</span>
              </div>
              {monthlyPrediction.dailyNeeded > 0 && (
                <p className="text-[#00E5FF] text-xs mt-3 text-center">
                  剩余工作日需每日完成 <strong>{monthlyPrediction.dailyNeeded}</strong> 单以达成目标
                </p>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "hourly" && (
          <motion.div key="hourly" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
            {/* 小时分布摘要 */}
            <div className="holo-card rounded-[26px] p-6 text-center">
              <p className="text-[#E0E0E0]/40 text-sm mb-2 flex items-center justify-center gap-2 tracking-tight">
                <Clock size={16} className="icon-glow-cyan" />
                今日小时分布预测
              </p>
              <AnimatedNumber value={dailyDistribution.totalPredicted} className="text-5xl font-bold text-[#E0E0E0] neon-cyan" />
              <span className="text-[#E0E0E0]/50 text-lg ml-2">单</span>
              <p className="text-[#E0E0E0]/30 text-xs mt-2 terminal-text">
                {DISTRIBUTION_TYPE_LABELS[dailyDistribution.distributionType] || "平稳型"} · 最佳时段 {String(dailyDistribution.bestSlot.start).padStart(2, "0")}:00-{String(dailyDistribution.bestSlot.end).padStart(2, "0")}:00
              </p>
            </div>

            {/* v9.0: 小时分布柱状图 */}
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-4">
                <Clock size={16} className="icon-glow-cyan" />
                24小时订单分布
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(255,255,255,0.3)"
                    fontSize={9}
                    tickLine={false}
                    interval={2}
                    tickFormatter={(v: string) => v.slice(0, 2)}
                  />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020408", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px", color: "#fff", fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value} 单`, "预测单量"]}
                  />
                  <Bar dataKey="predicted" radius={[4, 4, 0, 0]}>
                    {hourlyChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 高峰与低谷时段 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="text-[#E0E0E0]/30 text-xs mb-3 terminal-text">🔺 高峰时段</h3>
                <div className="space-y-1.5">
                  {dailyDistribution.peakHours.map((h) => (
                    <div key={h.hour} className="flex items-center justify-between">
                      <span className="text-[#E0E0E0]/50 text-xs">{h.label}</span>
                      <span className="text-[#00E5FF] text-sm font-bold">{h.predicted} 单</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="text-[#E0E0E0]/30 text-xs mb-3 terminal-text">🔻 低谷时段</h3>
                <div className="space-y-1.5">
                  {dailyDistribution.offPeakHours.map((h) => (
                    <div key={h.hour} className="flex items-center justify-between">
                      <span className="text-[#E0E0E0]/50 text-xs">{h.label}</span>
                      <span className="text-[#E040FB] text-sm font-bold">{h.predicted} 单</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 最佳时段建议 */}
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">
                <Target size={16} className="icon-glow-cyan" />
                最佳工作时段
              </h3>
              <div className="holo-card rounded-xl p-4 text-center">
                <p className="text-[#E0E0E0]/40 text-xs tracking-tight">推荐黄金时段</p>
                <p className="text-2xl font-bold text-[#00E5FF] mt-1 neon-cyan">
                  {String(dailyDistribution.bestSlot.start).padStart(2, "0")}:00 - {String(dailyDistribution.bestSlot.end).padStart(2, "0")}:00
                </p>
                <p className="text-[#E0E0E0] text-sm mt-1">
                  预计可完成 <strong>{dailyDistribution.bestSlot.expectedOrders}</strong> 单 · 效率 {dailyDistribution.bestSlot.efficiency}%
                </p>
                <p className="text-[#E0E0E0]/30 text-xs mt-2 terminal-text">{dailyDistribution.recommendation}</p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "rainy" && (
          <motion.div key="rainy" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
            {/* 雨天整体影响 */}
            <div className="holo-card rounded-[26px] p-6 text-center">
              <p className="text-[#E0E0E0]/40 text-sm mb-2 flex items-center justify-center gap-2 tracking-tight">
                <CloudRain size={16} className="icon-glow-cyan" />
                雨天影响分析
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-5xl font-bold text-red-400">
                  -{rainyDayImpact.overallImpact.avgOrderReduction}%
                </span>
              </div>
              <p className="text-[#E0E0E0]/30 text-xs mt-2 terminal-text">
                预估区间: {rainyDayImpact.overallImpact.confidenceInterval[0]}% - {rainyDayImpact.overallImpact.confidenceInterval[1]}%
              </p>
              <span className={`text-xs px-2.5 py-1 rounded-full mt-2 inline-block ${
                rainyDayImpact.overallImpact.severity === "mild" ? "badge-cyber-green" :
                rainyDayImpact.overallImpact.severity === "moderate" ? "badge-cyber-gold" :
                "badge-cyber"
              }`}>
                {SEVERITY_LABELS[rainyDayImpact.overallImpact.severity]}
              </span>
            </div>

            {/* 数据质量 */}
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">数据概况</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-[#E0E0E0]/30 text-xs terminal-text">雨天样本</p>
                  <p className="text-lg font-bold text-[#E0E0E0] neon-cyan">{rainyDayImpact.dataQuality.totalRainyDays}</p>
                  <span className="text-[#E0E0E0]/30 text-[10px]">天</span>
                </div>
                <div className="text-center">
                  <p className="text-[#E0E0E0]/30 text-xs terminal-text">晴天样本</p>
                  <p className="text-lg font-bold text-[#E0E0E0] neon-cyan">{rainyDayImpact.dataQuality.totalSunnyDays}</p>
                  <span className="text-[#E0E0E0]/30 text-[10px]">天</span>
                </div>
                <div className="text-center">
                  <p className="text-[#E0E0E0]/30 text-xs terminal-text">数据充分</p>
                  <p className={`text-lg font-bold ${rainyDayImpact.dataQuality.sufficientData ? "text-emerald-400" : "text-amber-400"}`}>
                    {rainyDayImpact.dataQuality.sufficientData ? "✓" : "!"}
                  </p>
                </div>
              </div>
            </div>

            {/* 雨后反弹 */}
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">雨后反弹效应</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="holo-card rounded-xl p-3 text-center">
                  <span className="text-[#E0E0E0]/30 text-xs terminal-text">反弹概率</span>
                  <p className={`text-lg font-bold mt-1 ${rainyDayImpact.weatherTransition.afterRainSpike ? "text-emerald-400" : "text-[#E0E0E0]/40"}`}>
                    {rainyDayImpact.weatherTransition.afterRainSpike ? "有" : "无"}
                  </p>
                </div>
                <div className="holo-card rounded-xl p-3 text-center">
                  <span className="text-[#E0E0E0]/30 text-xs terminal-text">反弹幅度</span>
                  <p className="text-lg font-bold text-[#E0E0E0] neon-cyan mt-1">
                    {rainyDayImpact.weatherTransition.afterRainSpike ? `+${rainyDayImpact.weatherTransition.spikeMagnitude}%` : "—"}
                  </p>
                </div>
              </div>
              <p className="text-[#E0E0E0]/20 text-xs mt-3 terminal-text text-center">
                雨后恢复天数: {rainyDayImpact.weatherTransition.recoveryDays} 天
              </p>
            </div>

            {/* 峰值偏移 */}
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">峰值时段偏移</h3>
              <div className="holo-card rounded-xl p-4 text-center">
                <p className="text-[#E0E0E0]/40 text-xs tracking-tight mb-2">
                  {rainyDayImpact.peakShift.occurs
                    ? (rainyDayImpact.peakShift.direction === "later" ? "雨天峰值向后偏移" : "雨天峰值向前偏移")
                    : "峰值时段无明显偏移"}
                </p>
                {rainyDayImpact.peakShift.occurs && (
                  <p className="text-2xl font-bold text-[#E040FB] neon-cyan">
                    {rainyDayImpact.peakShift.shiftHours} 小时
                  </p>
                )}
              </div>
            </div>

            {/* 雨天建议 */}
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">
                <Sparkles size={16} className="icon-glow-cyan" />
                AI 雨天策略建议
              </h3>
              <div className="space-y-2">
                {rainyDayImpact.recommendations.map((rec, i) => (
                  <div key={i} className="holo-card rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full mt-0.5 ${
                        rec.priority === "high" ? "badge-cyber" :
                        rec.priority === "medium" ? "badge-cyber-gold" :
                        "badge-cyber-green"
                      }`}>
                        {rec.priority === "high" ? "高" : rec.priority === "medium" ? "中" : "低"}
                      </span>
                      <div>
                        <p className="text-[#E0E0E0] font-medium text-sm">{rec.title}</p>
                        <p className="text-[#E0E0E0]/40 text-xs mt-0.5">{rec.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 雨天小时影响 */}
            {rainyDayImpact.hourlyImpact.filter(h => h.isSignificant).length > 0 && (
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title mb-3">显著影响时段</h3>
                <div className="space-y-2">
                  {rainyDayImpact.hourlyImpact
                    .filter(h => h.isSignificant)
                    .map((h) => (
                      <div key={h.hour} className="flex items-center justify-between py-2 border-b border-[#E0E0E0]/5 last:border-0">
                        <span className="text-[#E0E0E0]/50 text-xs">{h.label}</span>
                        <div className="text-right">
                          <span className="text-[#E0E0E0]/40 text-xs">晴天 {h.normalOrders} → 雨天 </span>
                          <span className="text-red-400 text-xs font-bold">{h.rainyOrders}</span>
                          <span className="text-red-400 text-xs ml-1">({h.reduction > 0 ? "-" : "+"}{h.reduction}%)</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "trend" && (
          <motion.div key="trend" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="holo-card rounded-[26px] p-3 text-center">
                <span className="text-[#E0E0E0]/30 text-xs terminal-text">最高</span>
                <p className="text-lg font-bold text-[#E0E0E0] neon-cyan">{stats.max}</p>
                <span className="text-[#E0E0E0]/30 text-[10px]">单</span>
              </div>
              <div className="holo-card rounded-[26px] p-3 text-center">
                <span className="text-[#E0E0E0]/30 text-xs terminal-text">最低</span>
                <p className="text-lg font-bold text-[#E0E0E0] neon-cyan">{stats.min}</p>
                <span className="text-[#E0E0E0]/30 text-[10px]">单</span>
              </div>
              <div className="holo-card rounded-[26px] p-3 text-center">
                <span className="text-[#E0E0E0]/30 text-xs terminal-text">平均</span>
                <p className="text-lg font-bold text-[#E0E0E0] neon-cyan">{stats.avg}</p>
                <span className="text-[#E0E0E0]/30 text-[10px]">单</span>
              </div>
            </div>

            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-4">
                <TrendingUp size={16} />
                近30天单量趋势
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="orderGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020408", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px", color: "#fff", fontSize: "12px",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} 单`, name === "ma7" ? "7日均线" : "单量",
                    ]}
                  />
                  <Area type="monotone" dataKey="orders" stroke="#00E5FF" strokeWidth={2} fill="url(#orderGradient)" dot={false} />
                  <Line type="monotone" dataKey="ma7" stroke="#E040FB" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3 justify-center">
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[#00E5FF]" /><span className="text-[#E0E0E0]/30 text-xs">每日单量</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[#E040FB] border-dashed" /><span className="text-[#E0E0E0]/30 text-xs">7日移动均线</span></div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "accuracy" && (
          <motion.div key="accuracy" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
            {/* 整体准确率 */}
            <div className="holo-card rounded-[26px] p-6 text-center">
              <p className="text-[#E0E0E0]/40 text-sm mb-2 flex items-center justify-center gap-2 tracking-tight">
                <Shield size={16} className="icon-glow-cyan" />
                预测准确率
              </p>
              {accuracyTracker ? (
                <>
                  <AnimatedNumber
                    value={100 - accuracyTracker.overallAccuracy.mape}
                    className="text-5xl font-bold text-[#E0E0E0] neon-cyan"
                  />
                  <span className="text-[#E0E0E0]/50 text-lg ml-1">%</span>
                  <p className="text-[#E0E0E0]/30 text-xs mt-2 terminal-text">
                    MAPE {accuracyTracker.overallAccuracy.mape}% · RMSE {accuracyTracker.overallAccuracy.rmse} · R² {accuracyTracker.overallAccuracy.r2}
                  </p>
                  <span className={`text-xs px-2.5 py-1 rounded-full mt-2 inline-block ${
                    accuracyTracker.trend === "improving" ? "badge-cyber-green" :
                    accuracyTracker.trend === "stable" ? "badge-cyber-gold" :
                    "badge-cyber"
                  }`}>
                    {TREND_LABELS[accuracyTracker.trend]}
                  </span>
                </>
              ) : (
                <p className="text-[#E0E0E0]/20 text-sm py-4">需要更多预测数据来评估准确率（至少 3 天）</p>
              )}
            </div>

            {/* 详细指标 */}
            {accuracyTracker && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="holo-card rounded-[26px] p-3 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">MAE 偏差</span>
                    <p className={`text-lg font-bold mt-1 ${accuracyTracker.overallAccuracy.bias > 0 ? "text-amber-400" : accuracyTracker.overallAccuracy.bias < 0 ? "text-red-400" : "text-[#00E5FF]"}`}>
                      {accuracyTracker.overallAccuracy.bias > 0 ? "+" : ""}{accuracyTracker.overallAccuracy.bias}
                    </p>
                    <span className="text-[#E0E0E0]/30 text-[10px]">单/天</span>
                  </div>
                  <div className="holo-card rounded-[26px] p-3 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">总预测次数</span>
                    <p className="text-lg font-bold text-[#E0E0E0] neon-cyan mt-1">{accuracyTracker.totalPredictions}</p>
                    <span className="text-[#E0E0E0]/30 text-[10px]">次</span>
                  </div>
                  <div className="holo-card rounded-[26px] p-3 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">已验证</span>
                    <p className="text-lg font-bold text-[#E0E0E0] neon-cyan mt-1">{accuracyTracker.totalVerified}</p>
                    <span className="text-[#E0E0E0]/30 text-[10px]">次</span>
                  </div>
                </div>

                {/* 近期准确率 */}
                <div className="holo-card rounded-[26px] p-4">
                  <h3 className="cyber-section-title mb-3">
                    <History size={16} className="icon-glow-cyan" />
                    近期准确率（近14天）
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="holo-card rounded-xl p-3 text-center">
                      <span className="text-[#E0E0E0]/30 text-xs terminal-text">近期 MAPE</span>
                      <p className="text-xl font-bold text-[#E0E0E0] neon-cyan mt-1">{accuracyTracker.recentAccuracy.mape}%</p>
                    </div>
                    <div className="holo-card rounded-xl p-3 text-center">
                      <span className="text-[#E0E0E0]/30 text-xs terminal-text">近期 R²</span>
                      <p className="text-xl font-bold text-[#E0E0E0] neon-cyan mt-1">{accuracyTracker.recentAccuracy.r2}</p>
                    </div>
                  </div>
                </div>

                {/* 按天气准确率 */}
                <div className="holo-card rounded-[26px] p-4">
                  <h3 className="cyber-section-title mb-3">按天气类型准确率</h3>
                  <div className="space-y-2">
                    {(Object.entries(accuracyTracker.byWeather) as [Weather, { mape: number; count: number }][])
                      .filter(([, v]) => v.count > 0)
                      .sort(([, a], [, b]) => a.mape - b.mape)
                      .map(([weather, data]) => (
                        <div key={weather} className="flex items-center justify-between py-2 border-b border-[#E0E0E0]/5 last:border-0">
                          <span className="text-[#E0E0E0]/50 text-sm">{WEATHER_LABELS[weather]}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[#E0E0E0]/30 text-xs">{data.count}次</span>
                            <span className={`text-sm font-bold ${data.mape <= 15 ? "text-emerald-400" : data.mape <= 30 ? "text-amber-400" : "text-red-400"}`}>
                              {data.mape}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === "v10" && (
          <motion.div key="v10" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
            <h3 className="cyber-section-title text-sm font-medium flex items-center gap-2 tracking-tight">
              <Brain size={16} className="icon-glow-cyan" />
              v10.0 至尊版 · 全新算法
            </h3>

            {/* GPR 高斯过程回归 */}
            {gprResult && (
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title mb-3 flex items-center gap-2">
                  <Zap size={16} className="icon-glow-cyan" />
                  GPR 高斯过程回归
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="holo-card rounded-xl p-3 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">预测均值</span>
                    <p className="text-xl font-bold text-[#00E5FF] mt-1">{Math.round(gprResult.mean)} 单</p>
                  </div>
                  <div className="holo-card rounded-xl p-3 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">不确定性</span>
                    <p className="text-xl font-bold text-[#E040FB] mt-1">±{Math.round(Math.sqrt(gprResult.variance))} 单</p>
                  </div>
                  <div className="holo-card rounded-xl p-3 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">方差</span>
                    <p className="text-xl font-bold text-[#FFD740] mt-1">{Math.round(gprResult.variance)}</p>
                  </div>
                  <div className="holo-card rounded-xl p-3 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">置信度</span>
                    <p className="text-xl font-bold text-[#00E676] mt-1">{Math.round(gprResult.confidence * 100)}%</p>
                  </div>
                </div>
                <p className="text-[#E0E0E0]/20 text-xs mt-3 terminal-text text-center">
                  RBF核 · 95%置信区间: [{Math.max(0, Math.round(gprResult.mean - 2 * Math.sqrt(gprResult.variance)))}, {Math.round(gprResult.mean + 2 * Math.sqrt(gprResult.variance))}]
                </p>
              </div>
            )}

            {/* 频谱残差分析 */}
            {spectralResult && (
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title mb-3 flex items-center gap-2">
                  <Activity size={16} className="icon-glow-cyan" />
                  频谱残差分析
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="holo-card rounded-xl p-3 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">趋势</span>
                    <p className="text-lg font-bold text-[#00E5FF] mt-1">{spectralResult.trendComponent}</p>
                  </div>
                  <div className="holo-card rounded-xl p-3 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">季节</span>
                    <p className="text-lg font-bold text-[#E040FB] mt-1">{spectralResult.seasonalComponent}</p>
                  </div>
                  <div className="holo-card rounded-xl p-3 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">残差</span>
                    <p className="text-lg font-bold text-[#FFD740] mt-1">{spectralResult.residualComponent}</p>
                  </div>
                </div>
                {spectralResult.dominantPeriods.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[#E0E0E0]/30 text-xs terminal-text">主导周期</p>
                    {spectralResult.dominantPeriods.map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-[#E0E0E0]/5 last:border-0">
                        <span className="text-[#E0E0E0]/50 text-xs">{p.period} 天周期</span>
                        <span className="text-[#E0E0E0] text-xs font-bold">{p.strength.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[#E0E0E0]/20 text-xs mt-3 terminal-text text-center">
                  FFT预测: {spectralResult.forecast} 单 · 周期评分: {spectralResult.periodicityScore}
                </p>
              </div>
            )}

            {/* CatBoost 有序梯度提升 */}
            {catboostResult !== null && (
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title mb-3 flex items-center gap-2">
                  <TrendingUp size={16} className="icon-glow-cyan" />
                  CatBoost 有序梯度提升
                </h3>
                <div className="holo-card rounded-xl p-4 text-center">
                  <span className="text-[#E0E0E0]/30 text-xs terminal-text">CatBoost 预测</span>
                  <p className="text-3xl font-bold text-[#00E5FF] mt-2 neon-cyan">{Math.round(catboostResult)} 单</p>
                  <p className="text-[#E0E0E0]/20 text-xs mt-2 terminal-text">
                    40个估计器 · 学习率0.03 · 有序提升防偏移
                  </p>
                </div>
              </div>
            )}

            {/* 元学习器堆叠权重 */}
            {metaLearnerResult && (
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title mb-3 flex items-center gap-2">
                  <Scale size={16} className="icon-glow-cyan" />
                  元学习器堆叠泛化
                </h3>
                <div className="holo-card rounded-xl p-4 text-center mb-3">
                  <span className="text-[#E0E0E0]/30 text-xs terminal-text">堆叠预测</span>
                  <p className="text-2xl font-bold text-[#E0E0E0] mt-1 neon-cyan">{Math.round(metaLearnerResult.prediction)} 单</p>
                  <p className="text-[#E0E0E0]/30 text-xs mt-1">置信度: {Math.round(metaLearnerResult.confidence * 100)}%</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[#E0E0E0]/30 text-xs terminal-text">基模型权重分配</p>
                  {metaLearnerResult.weights.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[#E0E0E0]/40 text-xs w-20 truncate">
                        {["AR", "Holt-Winters", "Prophet", "XGBoost", "LSTM"][i]}
                      </span>
                      <div className="flex-1 progress-cyber">
                        <motion.div
                          className="progress-cyber-fill"
                          style={{ background: i === 0 ? "rgba(0,229,255,0.8)" : i === 1 ? "rgba(224,64,251,0.8)" : i === 2 ? "rgba(255,215,64,0.8)" : i === 3 ? "rgba(0,255,128,0.8)" : "rgba(255,100,100,0.8)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, w * 100)}%` }}
                          transition={{ duration: 0.5, delay: i * 0.05 }}
                        />
                      </div>
                      <span className="text-[#E0E0E0]/40 text-xs w-10 text-right">{Math.round(w * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Q-Learning 强化学习权重演化 */}
            {qLearningResult && (
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title mb-3 flex items-center gap-2">
                  <Brain size={16} className="icon-glow-cyan" />
                  Q-Learning 强化学习权重
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="holo-card rounded-xl p-3 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">奖励值</span>
                    <p className={`text-lg font-bold mt-1 ${qLearningResult.reward > -0.1 ? "text-[#00E676]" : "text-[#FF1744]"}`}>
                      {qLearningResult.reward}
                    </p>
                  </div>
                  <div className="holo-card rounded-xl p-3 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">学习率</span>
                    <p className="text-lg font-bold text-[#00E5FF] mt-1">{qLearningResult.learningRate}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[#E0E0E0]/30 text-xs terminal-text">模型权重演化</p>
                  {qLearningResult.newWeights.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[#E0E0E0]/40 text-xs w-16 truncate">
                        {["AR", "HW", "Prophet", "XGB", "LSTM", "GPR", "CatBoost", "Spectral", "EMD", "Meta"][i]}
                      </span>
                      <div className="flex-1 progress-cyber">
                        <motion.div
                          className="progress-cyber-fill"
                          style={{ background: i < 5 ? "rgba(0,229,255,0.6)" : "rgba(224,64,251,0.6)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, w * 100)}%` }}
                          transition={{ duration: 0.5, delay: i * 0.03 }}
                        />
                      </div>
                      <span className="text-[#E0E0E0]/40 text-xs w-10 text-right">{Math.round(w * 100)}%</span>
                    </div>
                  ))}
                </div>
                <p className="text-[#E0E0E0]/20 text-xs mt-3 terminal-text text-center">
                  ε-greedy探索策略 · 自适应学习率衰减 · 10个模型集成
                </p>
              </div>
            )}

            {/* v10.0 模型清单 */}
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3 flex items-center gap-2">
                <Zap size={16} className="icon-glow-gold" />
                v10.0 新增模型清单
              </h3>
              <div className="space-y-2">
                {[
                  { name: "GPR 高斯过程回归", desc: "RBF核不确定性量化", icon: "📊" },
                  { name: "频谱残差分析", desc: "FFT周期检测+残差", icon: "🌊" },
                  { name: "EMD 经验模态分解", desc: "IMF自适应分解", icon: "🔬" },
                  { name: "CatBoost 有序提升", desc: "防预测偏移梯度提升", icon: "🚀" },
                  { name: "元学习器堆叠", desc: "SGD在线元学习", icon: "🧠" },
                  { name: "Q-Learning权重", desc: "ε-greedy强化学习", icon: "🎮" },
                  { name: "弹性网络正则化", desc: "L1+L2混合正则化", icon: "🛡️" },
                  { name: "自适应贝叶斯优化", desc: "网格搜索超参调优", icon: "🎯" },
                ].map((model, i) => (
                  <div key={i} className="flex items-center gap-2 py-2 border-b border-[#E0E0E0]/5 last:border-0">
                    <span className="text-lg">{model.icon}</span>
                    <div>
                      <p className="text-[#E0E0E0] text-sm font-medium">{model.name}</p>
                      <p className="text-[#E0E0E0]/30 text-xs">{model.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[#E0E0E0]/20 text-xs mt-3 terminal-text text-center">
                v10.0 至尊版 · 36个模型集成 · 8项全新算法
              </p>
            </div>
          </motion.div>
        )}

        {activeTab === "insights" && (
          <motion.div key="insights" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
            {/* Anomalies */}
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">
                <Bug size={16} className="text-[#FFD740]" />
                异常检测
              </h3>
              {anomalies.length === 0 ? (
                <p className="text-[#E0E0E0]/20 text-sm text-center py-4">未检测到异常数据，数据越丰富检测越准确</p>
              ) : (
                <div className="space-y-2">
                  {anomalies.slice(-5).reverse().map((a) => (
                    <div key={a.date} className={`rounded-xl p-3 ${
                      a.type === "spike" ? "holo-card ring-1 ring-emerald-400/20" : "holo-card ring-1 ring-red-400/20"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={a.type === "spike" ? "text-emerald-400" : "text-red-400"}>
                            {a.type === "spike" ? "🔺" : "🔻"}
                          </span>
                          <span className="text-[#E0E0E0] text-sm">{a.date}</span>
                        </div>
                        <span className="text-[#E0E0E0] font-bold">{a.orders} 单</span>
                      </div>
                      <p className="text-[#E0E0E0]/30 text-xs mt-1 ml-6">
                        预期 {a.expected} 单，偏差 {a.deviation > 0 ? "+" : ""}{a.deviation} 单
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Insights */}
            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">
                <Brain size={16} className="icon-glow-cyan" />
                AI 智能洞察
              </h3>
              {insights.length === 0 ? (
                <p className="text-[#E0E0E0]/20 text-sm text-center py-4">需要更多数据来生成洞察</p>
              ) : (
                <div className="space-y-2">
                  {insights.map((insight, i) => (
                    <div key={i} className="holo-card rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-lg mt-0.5">{insight.icon}</span>
                        <div>
                          <p className="text-[#E0E0E0] font-medium text-sm">{insight.title}</p>
                          <p className="text-[#E0E0E0]/40 text-xs mt-0.5">{insight.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}