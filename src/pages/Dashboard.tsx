import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, Sparkles, TrendingUp, Target, DollarSign, ShoppingBag, Zap } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import ProgressRing from "@/components/shared/ProgressRing";
import Confetti from "@/components/shared/Confetti";
import LiveClock from "@/components/shared/LiveClock";
import WeatherWidget from "@/components/shared/WeatherWidget";
import ShiftBadge from "@/components/shared/ShiftBadge";
import SyncIndicator from "@/components/shared/SyncIndicator";
import { showToast } from "@/components/shared/Toast";
import { today, getCurrentMonth } from "@/utils/date";
import { predictTomorrowEnhanced, predictMonthlyTotalEnhanced, predictIncome } from "@/utils/predictionEnhanced";
import { Weather, WEATHER_LABELS } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);
  const saveRecord = useStore((s) => s.saveRecord);
  const getEffectivePrice = useStore((s) => s.getEffectivePrice);
  const [showConfetti, setShowConfetti] = useState(false);
  const [realWeather, setRealWeather] = useState<Weather>("sunny");

  const handleWeatherChange = useCallback((w: Weather) => {
    setRealWeather(w);
  }, []);

  const todaysRecord = records[today()];
  const todayOrders = todaysRecord?.orders || 0;
  const todayIncome = todaysRecord?.income || 0;

  const { year, month } = getCurrentMonth();
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthRecords = Object.values(records).filter((r) => r.date.startsWith(prefix));
  const monthOrders = monthRecords.reduce((s, r) => s + r.orders, 0);
  const monthIncome = monthRecords.reduce((s, r) => s + r.income, 0);

  const effectivePrice = getEffectivePrice(monthOrders);

  const goalProgress = settings.monthlyGoal > 0
    ? Math.round((monthOrders / settings.monthlyGoal) * 100)
    : 0;

  const monthlyPrediction = useMemo(
    () => predictMonthlyTotalEnhanced(records, settings),
    [records, settings]
  );

  const predictedIncome = useMemo(
    () => predictIncome(monthlyPrediction.predicted, effectivePrice),
    [monthlyPrediction.predicted, effectivePrice]
  );

  const tomorrowPrediction = useMemo(
    () => predictTomorrowEnhanced(records, realWeather),
    [records, realWeather]
  );

  const handleQuickAdd = (delta: number) => {
    const newOrders = Math.max(0, todayOrders + delta);
    saveRecord({
      date: today(),
      orders: newOrders,
      income: 0,
      workHours: todaysRecord?.workHours || 8,
      weather: realWeather,
      note: todaysRecord?.note || "",
    });
    showToast(`${delta > 0 ? "+" : ""}${delta} 单`, "success");

    if (goalProgress >= 100 && !showConfetti) {
      setShowConfetti(true);
    }
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 6) return "夜深了";
    if (h < 9) return "早上好";
    if (h < 12) return "上午好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  };

  return (
    <motion.div
      className="px-4 pt-6 pb-4 space-y-5"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Header */}
      <motion.div variants={item} className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/50 text-sm">{getGreeting()}, <span className="text-white font-semibold">{settings.riderName}</span></p>
          </div>
          <SyncIndicator />
        </div>
          <LiveClock />
      </motion.div>
        <WeatherWidget onWeatherChange={handleWeatherChange} />
        <ShiftBadge />

      {/* Quick Entry */}
      <motion.div
        variants={item}
        className="glass rounded-3xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white/60 text-sm font-medium flex items-center gap-2">
            <Zap size={16} className="text-[#FFD100]" />
            今日单量
          </h3>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${effectivePrice > settings.basePrice ? "bg-[#FFD100]/20 text-[#FFD100]" : "bg-white/10 text-white/40"}`}>
              ¥{effectivePrice}/单{effectivePrice > settings.basePrice ? " 奖励" : ""}
            </span>
            <span className="text-white/30 text-xs">目标 {settings.dailyGoal} 单</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleQuickAdd(-1)}
            className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all active:scale-90"
          >
            <Minus size={24} className="text-[#FF6B35]" />
          </button>
          <div className="text-center">
            <AnimatedNumber
              value={todayOrders}
              className="text-5xl font-bold text-white tabular-nums"
            />
            <p className="text-white/40 text-sm mt-1">
              {todayOrders > 0 ? WEATHER_LABELS[todaysRecord?.weather || "sunny"] : "今日暂无记录"}
            </p>
          </div>
          <button
            onClick={() => handleQuickAdd(1)}
            className="w-14 h-14 rounded-full bg-[#FFD100] hover:bg-[#FFE44D] flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-[#FFD100]/20"
          >
            <Plus size={24} className="text-[#0F0F23]" />
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          {[5, 10, 20].map((n) => (
            <button
              key={n}
              onClick={() => handleQuickAdd(n)}
              className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-all"
            >
              +{n}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Metric Cards */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag size={16} className="text-[#FFD100]" />
            <span className="text-white/50 text-xs">本月累计</span>
          </div>
          <AnimatedNumber value={monthOrders} className="text-2xl font-bold text-white tabular-nums" />
          <span className="text-white/60 text-sm ml-1">单</span>
          <div className="mt-1.5 w-full bg-white/5 rounded-full h-1">
            <div
              className="bg-[#FFD100] h-1 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (monthOrders / settings.bonusThreshold) * 100)}%` }}
            />
          </div>
          <p className="text-white/30 text-[10px] mt-1">
            {monthOrders >= settings.bonusThreshold
              ? `已触发 ¥${settings.bonusPrice}/单 奖励！`
              : `距 ¥${settings.bonusPrice}/单 还差 ${settings.bonusThreshold - monthOrders} 单`}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-emerald-400" />
            <span className="text-white/50 text-xs">今日收入</span>
          </div>
          <AnimatedNumber value={todayIncome} prefix="¥" className="text-2xl font-bold text-white tabular-nums" />
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-[#7B2FF7]" />
            <span className="text-white/50 text-xs">目标进度</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{goalProgress}%</span>
            <ProgressRing progress={goalProgress} size={40} strokeWidth={3} />
          </div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-[#00D2FF]" />
            <span className="text-white/50 text-xs">本月收入</span>
          </div>
          <AnimatedNumber value={monthIncome} prefix="¥" className="text-2xl font-bold text-white tabular-nums" />
        </div>
      </motion.div>

      {/* Prediction Cards */}
      <motion.div variants={item} className="space-y-3">
        <h3 className="text-white/60 text-sm font-medium flex items-center gap-2">
          <Sparkles size={16} className="text-[#FFD100]" />
          智能预测
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-xs mb-1">明日预测单量</p>
            <span className="text-3xl font-bold text-white">{tomorrowPrediction.predictedOrders}</span>
            <span className="text-white/60 text-sm ml-1">单</span>
            <div className="flex items-center gap-1 mt-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                tomorrowPrediction.confidence === "high" ? "bg-emerald-400/20 text-emerald-400" :
                tomorrowPrediction.confidence === "medium" ? "bg-[#FFD100]/20 text-[#FFD100]" :
                "bg-white/10 text-white/40"
              }`}>
                {tomorrowPrediction.confidence === "high" ? "高置信度" :
                 tomorrowPrediction.confidence === "medium" ? "中置信度" : "低置信度"}
              </span>
            </div>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-xs mb-1">本月预计收入</p>
            <span className="text-3xl font-bold text-white">¥{predictedIncome.toLocaleString()}</span>
            <p className="text-white/40 text-[10px] mt-2">
              预计 {monthlyPrediction.predicted} 单 ({monthlyPrediction.lowEstimate}-{monthlyPrediction.highEstimate})
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}