import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, ReferenceLine,
} from "recharts";
import { Sparkles, TrendingUp, Calendar, Cloud, AlertCircle, Target } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import WeatherWidget from "@/components/shared/WeatherWidget";
import { predictTomorrowEnhanced, predictMonthlyTotalEnhanced } from "@/utils/predictionEnhanced";
import { today, getLastNDays, formatDateShort, getDayOfWeek } from "@/utils/date";
import { Weather, WEATHER_OPTIONS } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Predict() {
  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);
  const getEffectivePrice = useStore((s) => s.getEffectivePrice);
  const [activeTab, setActiveTab] = useState<"tomorrow" | "monthly" | "trend">("tomorrow");
  const [selectedWeather, setSelectedWeather] = useState<Weather>("sunny");
  const [realWeather, setRealWeather] = useState<Weather>("sunny");

  const handleWeatherChange = useCallback((w: Weather) => {
    setRealWeather(w);
    setSelectedWeather(w);
  }, []);

  const prediction = useMemo(
    () => predictTomorrowEnhanced(records, selectedWeather),
    [records, selectedWeather]
  );

  const monthlyPrediction = useMemo(
    () => predictMonthlyTotalEnhanced(records, settings),
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

  return (
    <motion.div
      className="px-4 pt-6 pb-4 space-y-5"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles size={24} className="text-[#FFD100]" />
          智能预测
        </h1>
      </motion.div>

      <WeatherWidget onWeatherChange={handleWeatherChange} />

      {/* Tabs */}
      <motion.div variants={item} className="flex gap-2 bg-[#16213E] rounded-xl p-1">
        {[
          { key: "tomorrow" as const, label: "明日预测" },
          { key: "monthly" as const, label: "月度预测" },
          { key: "trend" as const, label: "趋势分析" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-[#FFD100] text-[#0F0F23]"
                : "text-white/50 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {activeTab === "tomorrow" && (
          <motion.div
            key="tomorrow"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {/* Prediction Card */}
            <div className="bg-gradient-to-br from-[#7B2FF7]/20 to-[#16213E] rounded-2xl p-6 border border-[#7B2FF7]/20 text-center">
              <p className="text-white/50 text-sm mb-2">明日预计单量</p>
              <AnimatedNumber
                value={prediction.predictedOrders}
                className="text-6xl font-bold text-white"
              />
              <span className="text-white/60 text-lg ml-2">单</span>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className={`text-xs px-2.5 py-1 rounded-full ${
                  prediction.confidence === "high" ? "bg-emerald-400/20 text-emerald-400" :
                  prediction.confidence === "medium" ? "bg-[#FFD100]/20 text-[#FFD100]" :
                  "bg-white/10 text-white/40"
                }`}>
                  {prediction.confidence === "high" ? "🟢 高置信度" :
                   prediction.confidence === "medium" ? "🟡 中置信度" : "⚪ 低置信度"}
                </span>
              </div>
            </div>

            {/* Weather Selector */}
            <div className="bg-[#16213E] rounded-2xl p-4 border border-white/5">
              <p className="text-white/50 text-xs mb-3 flex items-center gap-2">
                <Cloud size={14} />
                切换天气查看预测变化
              </p>
              <div className="flex gap-2 flex-wrap">
                {WEATHER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedWeather(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedWeather === opt.value
                        ? "bg-[#FFD100] text-[#0F0F23]"
                        : "bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Factors */}
            <div className="bg-[#16213E] rounded-2xl p-4 border border-white/5">
              <h3 className="text-white/60 text-sm font-medium mb-3 flex items-center gap-2">
                <AlertCircle size={16} />
                影响因素分析
              </h3>
              <div className="space-y-2.5">
                {prediction.factors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <span className="text-white/50 text-sm">{f.label}</span>
                    <span className="text-white/80 text-xs text-right max-w-[60%]">{f.impact}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "monthly" && (
          <motion.div
            key="monthly"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <div className="bg-gradient-to-br from-[#00D2FF]/20 to-[#16213E] rounded-2xl p-6 border border-[#00D2FF]/20 text-center">
              <p className="text-white/50 text-sm mb-2">本月预计总单量</p>
              <AnimatedNumber
                value={monthlyPrediction.predicted}
                className="text-6xl font-bold text-white"
              />
              <span className="text-white/60 text-lg ml-2">单</span>
              <p className="text-white/40 text-xs mt-2">
                预估区间: {monthlyPrediction.lowEstimate} - {monthlyPrediction.highEstimate} 单
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#16213E] rounded-2xl p-4 border border-white/5">
                <span className="text-white/50 text-xs">已完成</span>
                <AnimatedNumber value={monthlyPrediction.completed} className="block text-2xl font-bold text-white mt-1" />
                <span className="text-white/60 text-sm">单</span>
              </div>
              <div className="bg-[#16213E] rounded-2xl p-4 border border-white/5">
                <span className="text-white/50 text-xs">预计收入</span>
                <span className="block text-2xl font-bold text-white mt-1">¥{predictedIncome.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-[#16213E] rounded-2xl p-4 border border-white/5">
              <h3 className="text-white/60 text-sm font-medium mb-3 flex items-center gap-2">
                <Target size={16} />
                目标进度
              </h3>
              <div className="w-full bg-white/5 rounded-full h-3 mb-2">
                <motion.div
                  className="h-3 rounded-full bg-gradient-to-r from-[#FFD100] to-[#FF6B35]"
                  initial={{ width: 0 }}
                  animate={{ width: `${goalProgress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">0</span>
                <span className="text-white/60">{monthlyPrediction.completed} / {settings.monthlyGoal} 单</span>
                <span className="text-white/40">{settings.monthlyGoal}</span>
              </div>
              {monthlyPrediction.dailyNeeded > 0 && (
                <p className="text-[#FFD100] text-xs mt-3 text-center">
                  ⚡ 剩余工作日需每日完成 <strong>{monthlyPrediction.dailyNeeded}</strong> 单以达成目标
                </p>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "trend" && (
          <motion.div
            key="trend"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#16213E] rounded-2xl p-3 border border-white/5 text-center">
                <span className="text-white/40 text-xs">最高</span>
                <p className="text-lg font-bold text-white">{stats.max}</p>
                <span className="text-white/40 text-[10px]">单</span>
              </div>
              <div className="bg-[#16213E] rounded-2xl p-3 border border-white/5 text-center">
                <span className="text-white/40 text-xs">最低</span>
                <p className="text-lg font-bold text-white">{stats.min}</p>
                <span className="text-white/40 text-[10px]">单</span>
              </div>
              <div className="bg-[#16213E] rounded-2xl p-3 border border-white/5 text-center">
                <span className="text-white/40 text-xs">平均</span>
                <p className="text-lg font-bold text-white">{stats.avg}</p>
                <span className="text-white/40 text-[10px]">单</span>
              </div>
            </div>

            <div className="bg-[#16213E] rounded-2xl p-4 border border-white/5">
              <h3 className="text-white/60 text-sm font-medium mb-4 flex items-center gap-2">
                <TrendingUp size={16} />
                近30天单量趋势
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="orderGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFD100" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#FFD100" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(255,255,255,0.3)"
                    fontSize={10}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1A1A2E",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} 单`,
                      name === "ma7" ? "7日均线" : "单量",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="orders"
                    stroke="#FFD100"
                    strokeWidth={2}
                    fill="url(#orderGradient)"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ma7"
                    stroke="#FF6B35"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3 justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-[#FFD100]" />
                  <span className="text-white/40 text-xs">每日单量</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-[#FF6B35] border-dashed" />
                  <span className="text-white/40 text-xs">7日移动均线</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}