import { useState, useMemo, useCallback, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, BarChart, Bar, Cell,
} from "recharts";
import { Sparkles, TrendingUp, Calendar, Cloud, AlertCircle, Target, Brain, Zap, Bug, Activity, Clock, CloudRain, Shield, Wifi, WifiOff, Copy } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import WeatherWidget from "@/components/shared/WeatherWidget";
import BottomSheet from "@/components/shared/BottomSheet";
import { showToast } from "@/components/shared/Toast";
import {
  predictTomorrowAI,
  predictWeeklyAI,
  predictMonthlyAI,
  detectAnomalies,
  generateInsights,
  predictDailyDistribution,
  predictRainyDayImpact,
  backtestPredictionModel,
  SPECIAL_EVENTS,
  predictMonthlyAIWithNetworkWeather,
  predictWeeklyAIWithNetworkWeather,
  predictTomorrowAIWithNetworkWeather,
  fetchNetworkWeatherForecast,
  generateLLMPredictionPrompt,
  callLLMPrediction,
  type NetworkWeatherForecast,
} from "@/utils/aiPrediction";
import { getLastNDays, formatDateShort, getDayOfWeek } from "@/utils/date";
import { useWeather } from "@/hooks/useWeather";
import { weatherCodeToOurWeather } from "@/services/weather";
import { Weather, WEATHER_OPTIONS, WEATHER_LABELS } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.005 } },
};

const item = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.08, ease: [0.25, 0.1, 0.25, 1] } },
};

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

function Predict() {
  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);
  const getEffectivePrice = useStore((s) => s.getEffectivePrice);
  const [activeTab, setActiveTab] = useState<"tomorrow" | "weekly" | "monthly" | "trend" | "insights" | "hourly" | "rainy" | "accuracy">("tomorrow");
  const [selectedWeather, setSelectedWeather] = useState<Weather>("sunny");
  const [realWeather, setRealWeather] = useState<Weather>("sunny");
  const { weather, forecast } = useWeather();

  // 联网 AI 预测状态
  const [networkPrediction, setNetworkPrediction] = useState<{
    predicted: number;
    completed: number;
    dailyNeeded: number;
    lowEstimate: number;
    highEstimate: number;
    weeklyBreakdown: { week: number; predicted: number; low: number; high: number }[];
    source: "network" | "fallback";
    cityName?: string;
  } | null>(null);
  const [weeklyNetwork, setWeeklyNetwork] = useState<{
    totalPredicted: number;
    dailyPredictions: { day: string; date: string; predicted: number; weather: import("@/types").Weather }[];
    source: "network" | "fallback";
    cityName?: string;
  } | null>(null);
  const [tomorrowNetwork, setTomorrowNetwork] = useState<{
    predictedOrders: number;
    confidence: "high" | "medium" | "low";
    factors: { label: string; impact: string }[];
    source: "network" | "fallback";
    cityName?: string;
    temperature?: number;
  } | null>(null);
  const [weatherForecast, setWeatherForecast] = useState<NetworkWeatherForecast | null>(null);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [llmApiKey, setLlmApiKey] = useState(() => localStorage.getItem("rider_llm_api_key") || "");
  const [llmBaseURL, setLlmBaseURL] = useState(() => localStorage.getItem("rider_llm_base_url") || "");
  const [llmModel, setLlmModel] = useState(() => localStorage.getItem("rider_llm_model") || "gpt-4o-mini");
  const [llmCustomModel, setLlmCustomModel] = useState(() => localStorage.getItem("rider_llm_custom_model") || "");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmResult, setLlmResult] = useState("");

  const handleWeatherChange = useCallback((w: Weather) => {
    setRealWeather(w);
    setSelectedWeather(w);
  }, []);

  const tomorrowTemp = weather?.temperature;
  const prediction = useMemo(
    () => predictTomorrowAI(records, selectedWeather, settings, { temperature: tomorrowTemp }),
    [records, selectedWeather, settings, tomorrowTemp]
  );

  const weeklyForecast = useMemo(() => {
    if (forecast.length > 0) {
      return forecast.slice(0, 7).map((d) => ({
        date: d.date,
        weather: weatherCodeToOurWeather(d.weatherCode),
        maxTemp: d.maxTemp,
        minTemp: d.minTemp,
      }));
    }
    return Array(7).fill(realWeather);
  }, [forecast, realWeather]);

  const weeklyPrediction = useMemo(() => {
    return predictWeeklyAI(records, weeklyForecast, settings);
  }, [records, weeklyForecast, settings]);

  const monthlyPrediction = useMemo(
    () => predictMonthlyAI(records, settings),
    [records, settings]
  );

  // 联网获取天气与增强预测
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      predictMonthlyAIWithNetworkWeather(records, settings),
      predictWeeklyAIWithNetworkWeather(records, settings),
      predictTomorrowAIWithNetworkWeather(records, settings),
      fetchNetworkWeatherForecast(7),
    ]).then(([month, week, tomorrow, weather]) => {
      if (cancelled) return;
      setNetworkPrediction(month);
      setWeeklyNetwork(week);
      setTomorrowNetwork(tomorrow);
      setWeatherForecast(weather);
    });
    return () => { cancelled = true; };
  }, [records, settings]);

  // 持久化 LLM API 配置（仅本地，不上传）
  useEffect(() => { localStorage.setItem("rider_llm_api_key", llmApiKey); }, [llmApiKey]);
  useEffect(() => { localStorage.setItem("rider_llm_base_url", llmBaseURL); }, [llmBaseURL]);
  useEffect(() => { localStorage.setItem("rider_llm_model", llmModel); }, [llmModel]);
  useEffect(() => { localStorage.setItem("rider_llm_custom_model", llmCustomModel); }, [llmCustomModel]);

  const llmPrompt = useMemo(
    () => generateLLMPredictionPrompt(records, settings, weatherForecast || undefined),
    [records, settings, weatherForecast]
  );

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(llmPrompt);
    showToast("AI 预测提示词已复制", "success");
  };

  const handleRunLLM = async () => {
    if (!llmApiKey.trim()) {
      showToast("请输入 API Key", "error");
      return;
    }
    const effectiveModel = llmModel === "custom" ? llmCustomModel.trim() : llmModel;
    if (!effectiveModel) {
      showToast("请输入自定义模型名", "error");
      return;
    }
    setLlmLoading(true);
    setLlmResult("");
    const res = await callLLMPrediction(llmPrompt, {
      apiKey: llmApiKey,
      baseURL: llmBaseURL || undefined,
      model: effectiveModel,
    });
    setLlmLoading(false);
    if (res.success) {
      setLlmResult(res.text || "");
      showToast("AI 大模型预测完成", "success");
    } else {
      showToast(`调用失败：${res.error?.slice(0, 60) || "未知错误"}`, "error");
    }
  };

  const activeNetworkPrediction = networkPrediction || monthlyPrediction;

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

  const backtest = useMemo(
    () => backtestPredictionModel(records, settings),
    [records, settings]
  );

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
        <h1 className="text-2xl font-bold text-[#E0E0E0] flex items-center gap-2 tracking-[-0.01em]">
          <Brain size={24} className="icon-glow-cyan" />
          <span className="cyber-glitch" data-text="AI 智能预测">AI 智能预测</span>
        </h1>
        <p className="text-[#E0E0E0]/30 text-xs mt-1 tracking-tight terminal-text">基于真实历史数据 · 天气因子 · 特殊事件 · AR(1) 残差修正</p>
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
            <div className="holo-card-strong rounded-[26px] p-6 text-center corner-brackets holo-shimmer neon-flicker">
              <p className="text-[#E0E0E0]/40 text-sm mb-2 flex items-center justify-center gap-2 tracking-tight">
                <Brain size={16} className="icon-glow-cyan" />
                AI 明日预测单量
              </p>
              <AnimatedNumber value={prediction.predictedOrders} className="text-6xl font-bold text-[#E0E0E0] neon-cyan" />
              <span className="text-[#E0E0E0]/50 text-lg ml-2">单</span>
              {prediction.interval && (
                <p className="text-[#E0E0E0]/30 text-xs mt-2 terminal-text">
                  预测区间 {prediction.interval.low} - {prediction.interval.high} 单
                </p>
              )}
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

            {prediction.modelWeights && prediction.modelWeights.some(w => w.weight > 0) && (
              <div className="holo-card rounded-[26px] p-4">
                <h3 className="cyber-section-title mb-3">
                  <Activity size={16} />
                  模型权重
                </h3>
                <div className="space-y-2.5">
                  {prediction.modelWeights.filter(w => w.weight > 0).map((w) => (
                    <div key={w.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#E0E0E0]/40">{w.label}</span>
                        <span className="text-[#E0E0E0]/70">{w.weight}%</span>
                      </div>
                      <div className="progress-cyber h-1.5">
                        <motion.div
                          className="progress-cyber-fill h-1.5"
                          style={{ background: w.label === "同星期几" ? "#00E5FF" : w.label === "近期趋势" ? "#E040FB" : "#FFD740" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${w.weight}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  <div key={i} className="holo-card rounded-xl p-3 stat-card-enhanced corner-brackets">
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
                模型回测准确率
              </p>
              {backtest.totalDays > 0 ? (
                <>
                  <AnimatedNumber
                    value={Math.max(0, 100 - backtest.mape)}
                    className="text-5xl font-bold text-[#E0E0E0] neon-cyan"
                  />
                  <span className="text-[#E0E0E0]/50 text-lg ml-1">%</span>
                  <p className="text-[#E0E0E0]/30 text-xs mt-2 terminal-text">
                    MAPE {backtest.mape}% · RMSE {backtest.rmse} · R² {backtest.r2}
                  </p>
                  <p className="text-[#E0E0E0]/30 text-[10px] mt-1">
                    基于近 {backtest.totalDays} 天 Walk-forward 回测 · 区间覆盖率 {backtest.coverage80}%
                  </p>
                </>
              ) : (
                <p className="text-[#E0E0E0]/20 text-sm py-4">需要至少 28 天历史数据才能进行模型回测</p>
              )}
            </div>

            {backtest.totalDays > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="holo-card rounded-[26px] p-4 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">平均绝对误差</span>
                    <p className="text-2xl font-bold text-[#E0E0E0] neon-cyan mt-1">{backtest.mae}</p>
                    <span className="text-[#E0E0E0]/30 text-[10px]">单</span>
                  </div>
                  <div className="holo-card rounded-[26px] p-4 text-center">
                    <span className="text-[#E0E0E0]/30 text-xs terminal-text">近期 MAPE</span>
                    <p className="text-2xl font-bold text-[#E0E0E0] neon-cyan mt-1">{backtest.recentMape}%</p>
                    <span className="text-[#E0E0E0]/30 text-[10px]">近14天</span>
                  </div>
                </div>

                {Object.keys(backtest.byWeather).length > 0 && (
                  <div className="holo-card rounded-[26px] p-4">
                    <h3 className="cyber-section-title mb-3">按天气准确率</h3>
                    <div className="space-y-2">
                      {Object.entries(backtest.byWeather).map(([w, d]) => (
                        <div key={w} className="flex items-center justify-between py-2 border-b border-[#E0E0E0]/5 last:border-0">
                          <span className="text-[#E0E0E0]/50 text-sm">{WEATHER_LABELS[w as Weather] || w}</span>
                          <span className="text-[#E0E0E0]/70 text-xs">{d.count} 天 · MAPE {d.mape}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(backtest.byDOW).length > 0 && (
                  <div className="holo-card rounded-[26px] p-4">
                    <h3 className="cyber-section-title mb-3">按星期准确率</h3>
                    <div className="space-y-2">
                      {Object.entries(backtest.byDOW).map(([d, s]) => (
                        <div key={d} className="flex items-center justify-between py-2 border-b border-[#E0E0E0]/5 last:border-0">
                          <span className="text-[#E0E0E0]/50 text-sm">{d}</span>
                          <span className="text-[#E0E0E0]/70 text-xs">{s.count} 天 · MAPE {s.mape}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
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

      {/* AI 联网预测 */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#E040FB]/10 to-transparent rounded-bl-full -mr-8 -mt-8 pointer-events-none" />
        <div className="flex items-center justify-between mb-4 relative z-10">
          <h3 className="cyber-section-title text-sm tracking-tight">
            <Sparkles size={16} className="icon-glow-cyan" />
            AI 联网预测
          </h3>
          <div className="flex items-center gap-1.5">
            {weatherForecast?.source === "network" ? (
              <Wifi size={12} className="text-[#00E676]" />
            ) : (
              <WifiOff size={12} className="text-[#E0E0E0]/40" />
            )}
            <span className="text-[10px] text-[#E0E0E0]/40 terminal-text">
              {weatherForecast?.source === "network" ? `已联网${weatherForecast.cityName ? ` · ${weatherForecast.cityName}` : ""}` : "离线模式"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div className="p-3 rounded-2xl bg-[#00E5FF]/8 border border-[#00E5FF]/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Cloud size={12} className="text-[#00E5FF]" />
              <span className="text-[#E0E0E0]/50 text-[10px] terminal-text">明日预测</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[#E0E0E0]">{tomorrowNetwork?.predictedOrders ?? "-"}</span>
              <span className="text-[#E0E0E0]/40 text-xs">单</span>
            </div>
            {tomorrowNetwork?.temperature !== undefined && (
              <p className="text-[10px] text-[#E0E0E0]/30 mt-0.5">
                {tomorrowNetwork.temperature}°C · {WEATHER_LABELS[weeklyNetwork?.dailyPredictions[0]?.weather || "sunny"]}
              </p>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-[#E040FB]/8 border border-[#E040FB]/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity size={12} className="text-[#E040FB]" />
              <span className="text-[#E0E0E0]/50 text-[10px] terminal-text">未来7天</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[#E0E0E0]">{weeklyNetwork?.totalPredicted ?? "-"}</span>
              <span className="text-[#E0E0E0]/40 text-xs">单</span>
            </div>
            <p className="text-[10px] text-[#E0E0E0]/30 mt-0.5">
              {weeklyNetwork?.dailyPredictions.slice(0, 3).map((d) => d.day).join(" / ")}
            </p>
          </div>
        </div>

        {activeNetworkPrediction.lowEstimate > 0 && activeNetworkPrediction.highEstimate > 0 && (
          <div className="mt-3 p-3 rounded-2xl bg-[#E0E0E0]/4 border border-[#E0E0E0]/5 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[#E0E0E0]/50 text-xs">本月预计区间</span>
              <span className="text-[#E0E0E0] font-bold text-sm">
                {activeNetworkPrediction.lowEstimate} - {activeNetworkPrediction.highEstimate} 单
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => setAiSheetOpen(true)}
          className="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-[#00E5FF]/15 to-[#E040FB]/15 border border-[#00E5FF]/20 text-[#00E5FF] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#00E5FF]/10 transition-colors relative z-10"
        >
          <Brain size={16} />
          AI 大模型深度预测
        </button>
      </motion.div>

      {/* AI 大模型预测 Bottom Sheet */}
      <BottomSheet isOpen={aiSheetOpen} onClose={() => setAiSheetOpen(false)} title="AI 大模型深度预测">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-[#00E5FF]/5 border border-[#00E5FF]/10">
            <p className="text-[#E0E0E0]/60 text-xs leading-relaxed">
              已自动生成本地历史数据 + 联网天气 + 季节因素的提示词。你可以：
            </p>
            <ul className="mt-2 text-[#E0E0E0]/50 text-xs space-y-1 list-disc list-inside">
              <li>一键复制提示词，粘贴到 ChatGPT / 豆包 / Kimi 等在线 AI</li>
              <li>或填入自己的 OpenAI 兼容 API Key，直接在本页调用</li>
            </ul>
          </div>

          <div>
            <label className="block terminal-text text-xs mb-1.5 text-[#E0E0E0]/60">API Key（可选，仅保存在本地）</label>
            <input
              type="password"
              value={llmApiKey}
              onChange={(e) => setLlmApiKey(e.target.value)}
              className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] placeholder-[#E0E0E0]/20 transition-colors text-sm"
              placeholder="sk-..."
            />
          </div>

          <div>
            <label className="block terminal-text text-xs mb-1.5 text-[#E0E0E0]/60">API 地址（可选，默认 OpenAI）</label>
            <input
              type="text"
              value={llmBaseURL}
              onChange={(e) => setLlmBaseURL(e.target.value)}
              className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] placeholder-[#E0E0E0]/20 transition-colors text-sm"
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div>
            <label className="block terminal-text text-xs mb-1.5 text-[#E0E0E0]/60">模型</label>
            <select
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] text-sm bg-transparent"
            >
              <option value="gpt-4o-mini">OpenAI gpt-4o-mini</option>
              <option value="gpt-4o">OpenAI gpt-4o</option>
              <option value="deepseek-v4-flash">DeepSeek deepseek-v4-flash</option>
              <option value="deepseek-v4-pro">DeepSeek deepseek-v4-pro</option>
              <option value="qwen-plus">通义千问 qwen-plus</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          {llmModel === "custom" && (
            <div>
              <label className="block terminal-text text-xs mb-1.5 text-[#E0E0E0]/60">自定义模型名</label>
              <input
                type="text"
                value={llmCustomModel}
                onChange={(e) => setLlmCustomModel(e.target.value)}
                className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] placeholder-[#E0E0E0]/20 transition-colors text-sm"
                placeholder="例如：deepseek-v4-flash"
              />
            </div>
          )}

          <div className="p-3 rounded-xl bg-[#FFD740]/5 border border-[#FFD740]/10">
            <p className="text-[#FFD740]/80 text-xs leading-relaxed">
              支持 OpenAI 官方及任何兼容 <code className="bg-[#020408]/40 px-1 rounded">/v1/chat/completions</code> 的 API。模型名必须和提供商对应，例如 DeepSeek 用 <code className="bg-[#020408]/40 px-1 rounded">deepseek-v4-flash</code> 或 <code className="bg-[#020408]/40 px-1 rounded">deepseek-v4-pro</code>，API 地址填 <code className="bg-[#020408]/40 px-1 rounded">https://api.deepseek.com</code>。浏览器直接调用需 API 端开启 CORS，若调用失败可复制提示词到在线 AI 使用。
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopyPrompt}
              className="flex-1 py-3 rounded-xl bg-[#E0E0E0]/5 border border-[#E0E0E0]/10 text-[#E0E0E0] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#E0E0E0]/10 transition-colors"
            >
              <Copy size={16} />
              复制提示词
            </button>
            <button
              onClick={handleRunLLM}
              disabled={llmLoading}
              className="flex-1 py-3 rounded-xl bg-[#00E5FF]/15 border border-[#00E5FF]/30 text-[#00E5FF] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#00E5FF]/25 transition-colors disabled:opacity-50"
            >
              {llmLoading ? <Activity size={16} className="animate-spin" /> : <Brain size={16} />}
              {llmLoading ? "预测中..." : "直接调用"}
            </button>
          </div>

          {llmResult && (
            <div className="p-4 rounded-xl bg-[#020408]/60 border border-[#E0E0E0]/10">
              <h4 className="text-[#00E5FF] text-xs font-medium mb-2 terminal-text">AI 预测结果</h4>
              <pre className="text-[#E0E0E0]/80 text-xs whitespace-pre-wrap font-sans leading-relaxed">{llmResult}</pre>
            </div>
          )}
        </div>
      </BottomSheet>
    </motion.div>
  );
}

export default memo(Predict);
