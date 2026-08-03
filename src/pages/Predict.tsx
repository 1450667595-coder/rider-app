import { useState, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, BarChart, Bar, Cell,
} from "recharts";
import { Sparkles, TrendingUp, Calendar, Cloud, AlertCircle, Target, Brain, Zap, Bug, Activity, Clock, CloudRain, Shield } from "lucide-react";
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
  SPECIAL_EVENTS,
} from "@/utils/aiPrediction";
import type { PredictionRecord } from "@/utils/aiPrediction";
import { today, getLastNDays, formatDateShort, getDayOfWeek } from "@/utils/date";
import { Weather, WEATHER_OPTIONS, WEATHER_LABELS } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.005 } },
};

const item = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.08, ease: [0.25, 0.1, 0.25, 1] } },
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

function Predict() {
  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);
  const getEffectivePrice = useStore((s) => s.getEffectivePrice);
  const [activeTab, setActiveTab] = useState<"tomorrow" | "weekly" | "monthly" | "trend" | "insights" | "hourly" | "rainy" | "accuracy">("tomorrow");
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

  const dailyDistribution = useMemo(
    () => predictDailyDistribution(records, selectedWeather),
    [records, selectedWeather]
  );

  const rainyDayImpact = useMemo(
    () => predictRainyDayImpact(records),
    [records]
  );

  const upcomingEvents = useMemo(() => {
    const events = [];
    const now = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const event = SPECIAL_EVENTS.find(e => e.date === mmdd);
      if (event) {
        events.push({
          ...event,
          dateStr: `${d.getMonth() + 1}月${d.getDate()}日`,
          fullDate: `${d.getFullYear()}-${mmdd}`,
        });
      }
    }
    return events;
  }, []);

  const accuracyTracker = useMemo(() => {
    const sorted = Object.values(records).sort(
      (a, b) => a.date.localeCompare(b.date)
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
    return computePredictionAccuracy(predictionRecords);
  }, [records]);

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

  const hourlyChartData = useMemo(() => {
    const maxPred = Math.max(...dailyDistribution.hourlyDistribution.map(x => x.predicted), 1);
    return dailyDistribution.hourlyDistribution.map((h) => ({
      ...h,
      color: h.predicted >= maxPred * 0.8
        ? "#00E5FF"
        : h.predicted >= maxPred * 0.5
        ? "#E040FB"
        : "rgba(255,255,255,0.3)",
    }));
  }, [dailyDistribution]);

  // 雨天影响格式化：外卖场景雨天=爆单（正增长）
  const rainyBoost = rainyDayImpact.overallImpact.changePercent;
  const rainyIsBoost = rainyBoost > 0;

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
        <p className="text-[#E0E0E0]/30 text-xs mt-1 tracking-tight terminal-text">基于真实历史数据 · 天气因子 · 特殊事件</p>
      </motion.div>

      <WeatherWidget onWeatherChange={handleWeatherChange} />

      {/* Tabs */}
      <motion.div variants={item} className="flex gap-1 holo-card rounded-xl p-1 overflow-x-auto">
        {[
          { key: "tomorrow" as const, label: "明日", icon: Zap },
          { key: "weekly" as const, label: "本周", icon: Calendar },
          { key: "monthly" as const, label: "本月", icon: Target },
          { key: "hourly" as const, label: "小时", icon: Clock },
          { key: "rainy" as const, label: "雨天", icon: CloudRain },
          { key: "trend" as const, label: "趋势", icon: TrendingUp },
          { key: "accuracy" as const, label: "准确率", icon: Shield },
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

      <AnimatePresence mode="sync">
        {activeTab === "tomorrow" && (
          <motion.div key="tomorrow" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }} className="space-y-4">
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

            {upcomingEvents.length > 0 && (
              <div className="holo-card rounded-[26px] p-4 space-y-2">
                <h3 className="cyber-section-title mb-2">
                  <Sparkles size={16} className="icon-glow-gold" />
                  未来爆单日
                </h3>
                {upcomingEvents.map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[#E0E0E0]/5 last:border-0">
                    <div>
                      <p className="text-[#E0E0E0] text-sm font-medium">{e.dateStr} · {e.name}</p>
                      <p className="text-[#E0E0E0]/40 text-xs">{e.description}</p>
                    </div>
                    <span className="badge-cyber-gold text-xs">+{Math.round((e.boost - 1) * 100)}%</span>
                  </div>
                ))}
              </div>
            )}

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
          <motion.div key="weekly" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }} className="space-y-4">
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
          <motion.div key="monthly" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }} className="space-y-4">
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
          <motion.div key="hourly" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }} className="space-y-4">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="text-[#E0E0E0]/30 text-xs mb-3 terminal-text">高峰时段</h3>
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
                <h3 className="text-[#E0E0E0]/30 text-xs mb-3 terminal-text">低谷时段</h3>
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
          </motion.div>
        )}

        {activeTab === "rainy" && (
          <motion.div key="rainy" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }} className="space-y-4">
            <div className="holo-card rounded-[26px] p-6 text-center">
              <p className="text-[#E0E0E0]/40 text-sm mb-2 flex items-center justify-center gap-2 tracking-tight">
                <CloudRain size={16} className="icon-glow-cyan" />
                雨天影响分析
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className={`text-5xl font-bold ${rainyIsBoost ? "text-[#00E676]" : "text-red-400"}`}>
                  {rainyIsBoost ? "+" : ""}{rainyBoost}%
                </span>
              </div>
              <p className="text-[#E0E0E0]/30 text-xs mt-2 terminal-text">
                外卖场景：雨天人们不出门 → 外卖订单{rainyIsBoost ? "暴增" : "减少"}
              </p>
              <span className={`text-xs px-2.5 py-1 rounded-full mt-2 inline-block ${
                rainyDayImpact.overallImpact.severity === "mild" ? "badge-cyber-green" :
                rainyDayImpact.overallImpact.severity === "moderate" ? "badge-cyber-gold" :
                "badge-cyber"
              }`}>
                {SEVERITY_LABELS[rainyDayImpact.overallImpact.severity]}
              </span>
            </div>

            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">数据概况</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-[#E0E0E0]/30 text-xs terminal-text">雨天样本</p>
                  <p className="text-lg font-bold text-[#E0E0E0] neon-cyan">{rainyDayImpact.dataQuality.totalRainyDays}</p>
                  <span className="text-[#E0E0E0]/30 text-[10px]">天</span>
                </div>
                <div className="text-center">
                  <p className="text-[#E0E0E0]/30 text-xs terminal-text">非雨天样本</p>
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

            <div className="holo-card rounded-[26px] p-4">
              <h3 className="cyber-section-title mb-3">
                <Sparkles size={16} className="icon-glow-cyan" />
                雨天策略建议
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
          </motion.div>
        )}

        {activeTab === "trend" && (
          <motion.div key="trend" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }} className="space-y-4">
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
          <motion.div key="accuracy" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }} className="space-y-4">
            <div className="holo-card rounded-[26px] p-6 text-center">
              <p className="text-[#E0E0E0]/40 text-sm mb-2 flex items-center justify-center gap-2 tracking-tight">
                <Shield size={16} className="icon-glow-cyan" />
                预测准确率
              </p>
              {accuracyTracker ? (
                <>
                  <AnimatedNumber
                    value={Math.max(0, 100 - accuracyTracker.overallAccuracy.mape)}
                    className="text-5xl font-bold text-[#E0E0E0] neon-cyan"
                  />
                  <span className="text-[#E0E0E0]/50 text-lg ml-1">%</span>
                  <p className="text-[#E0E0E0]/30 text-xs mt-2 terminal-text">
                    MAPE {accuracyTracker.overallAccuracy.mape}% · RMSE {accuracyTracker.overallAccuracy.rmse}
                  </p>
                </>
              ) : (
                <p className="text-[#E0E0E0]/20 text-sm py-4">需要更多预测数据来评估准确率（至少 3 天）</p>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "insights" && (
          <motion.div key="insights" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }} className="space-y-4">
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

export default memo(Predict);
