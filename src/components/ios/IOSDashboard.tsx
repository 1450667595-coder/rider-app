import { useState, useCallback, useEffect, memo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Minus,
  TrendingUp,
  Target,
  DollarSign,
  ShoppingBag,
  Zap,
  CloudOff,
  ChevronRight,
  BarChart3,
  Calendar,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Activity,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import ProgressRing from "@/components/shared/ProgressRing";
import Confetti from "@/components/shared/Confetti";
import LiveClock from "@/components/shared/LiveClock";
import WeatherWidget from "@/components/shared/WeatherWidget";
import SmartShiftCard from "@/components/shared/SmartShiftCard";
import SyncIndicator from "@/components/shared/SyncIndicator";
import { showToast } from "@/components/shared/Toast";
import { today, formatDateShort } from "@/utils/date";
import { Weather, WEATHER_LABELS } from "@/types";
import { useDashboardData } from "@/hooks/useDashboardData";
import { isSupabaseConfigured } from "@/services/supabase";
import IOSCard from "./IOSCard";

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
};

const Sparkline = memo(function Sparkline({ data, color = "#007AFF", height = 28, width = 80 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 2;
  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

export default function IOSDashboard() {
  const navigate = useNavigate();
  const saveRecord = useStore((s) => s.saveRecord);
  const settings = useStore(useShallow((s) => s.settings));
  const [showConfetti, setShowConfetti] = useState(false);
  const [realWeather, setRealWeather] = useState<Weather>("sunny");

  const data = useDashboardData(realWeather);

  const handleWeatherChange = useCallback((w: Weather) => {
    setRealWeather(w);
    const todaysRec = data.todaysRecord;
    if (todaysRec && todaysRec.weather !== w) {
      saveRecord({ ...todaysRec, weather: w });
    }
  }, [data.todaysRecord, saveRecord]);

  useEffect(() => {
    const todaysRec = data.todaysRecord;
    if (todaysRec?.weather) setRealWeather(todaysRec.weather);
  }, [data.todaysRecord]);

  const handleQuickAdd = (delta: number) => {
    const newOrders = Math.max(0, data.todayOrders + delta);
    saveRecord({
      date: today(),
      orders: newOrders,
      income: 0,
      workHours: data.todaysRecord?.workHours || 8,
      weather: realWeather,
      note: data.todaysRecord?.note || "",
    });
    showToast(`${delta > 0 ? "+" : ""}${delta} 单`, "success");
    if (data.goalProgress >= 100 && !showConfetti) setShowConfetti(true);
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

  const {
    todayOrders,
    todayIncome,
    todayGoalPercent,
    monthOrders,
    monthIncome,
    goalProgress,
    effectivePrice,
    bonusGap,
    monthlyPrediction,
    predictedIncome,
    tomorrowPrediction,
    insights,
    weekComparison,
    monthComparison,
    weatherComparison,
    efficiencyData,
    dataHealth,
    goalProbability,
    bestWorkDays,
  } = data;

  return (
    <motion.div
      className="px-4 pt-4 pb-6 space-y-5"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.04 } } }}
    >
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* 顶部：问候 + 时间/同步 */}
      <motion.div variants={item} className="flex items-start justify-between">
        <div>
          <p
            className="text-sm"
            style={{ color: "var(--ios-label-secondary)" }}
          >
            {getGreeting()}
          </p>
          <h1
            className="text-2xl font-bold mt-0.5"
            style={{ color: "var(--ios-label)", letterSpacing: "-0.03em" }}
          >
            {settings.riderName || "骑手"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <LiveClock />
          <SyncIndicator />
        </div>
      </motion.div>

      <WeatherWidget onWeatherChange={handleWeatherChange} />
      <SmartShiftCard />

      {/* 今日单量主卡片 */}
      <motion.div variants={item}>
        <IOSCard radius="2xl" padding="lg" className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--ios-label)" }}
            >
              今日单量
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: effectivePrice > settings.basePrice
                  ? "rgba(255, 149, 0, 0.12)"
                  : "rgba(120, 120, 128, 0.12)",
                color: effectivePrice > settings.basePrice
                  ? "var(--ios-system-orange)"
                  : "var(--ios-label-secondary)",
              }}
            >
              ¥{effectivePrice}/单{effectivePrice > settings.basePrice ? " 奖励" : ""}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => handleQuickAdd(-1)}
              className="w-12 h-12 rounded-full flex items-center justify-center active:opacity-70"
              style={{ background: "var(--ios-fill-secondary)" }}
            >
              <Minus size={22} style={{ color: "var(--ios-system-orange)" }} />
            </button>

            <div className="text-center">
              <span style={{ color: "var(--ios-label)", lineHeight: 1 }}>
                <AnimatedNumber
                  value={todayOrders}
                  className="text-6xl font-bold tabular-nums tracking-tight"
                />
              </span>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--ios-label-secondary)" }}
              >
                {todayOrders > 0 ? WEATHER_LABELS[data.todaysRecord?.weather || "sunny"] : "暂无数据"}
              </p>
            </div>

            <button
              onClick={() => handleQuickAdd(1)}
              className="w-12 h-12 rounded-full flex items-center justify-center active:opacity-80"
              style={{ background: "var(--ios-system-blue)" }}
            >
              <Plus size={22} color="#ffffff" />
            </button>
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--ios-label-secondary)" }}>
              <span>今日目标进度</span>
              <span>{todayOrders}/{settings.dailyGoal} 单 ({todayGoalPercent}%)</span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--ios-fill)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${todayGoalPercent}%`,
                  background: todayGoalPercent >= 100
                    ? "var(--ios-system-green)"
                    : "var(--ios-system-blue)",
                }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[5, 10, 20].map((n) => (
              <button
                key={n}
                onClick={() => handleQuickAdd(n)}
                className="py-2 rounded-lg text-sm font-medium active:opacity-70"
                style={{
                  background: "var(--ios-fill-secondary)",
                  color: "var(--ios-system-blue)",
                }}
              >
                +{n}
              </button>
            ))}
          </div>
        </IOSCard>
      </motion.div>

      {/* 数据指标网格 */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        <IOSCard padding="md">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag size={15} style={{ color: "var(--ios-system-orange)" }} />
            <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>本月单量</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span style={{ color: "var(--ios-label)" }}>
              <AnimatedNumber
                value={monthOrders}
                className="text-2xl font-bold tabular-nums"
              />
            </span>
            <span className="text-sm" style={{ color: "var(--ios-label-secondary)" }}>单</span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden mt-2"
            style={{ background: "var(--ios-fill)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (monthOrders / settings.bonusThreshold) * 100)}%`,
                background: monthOrders >= settings.bonusThreshold
                  ? "var(--ios-system-green)"
                  : "var(--ios-system-blue)",
              }}
            />
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: "var(--ios-label-secondary)" }}>
            {monthOrders >= settings.bonusThreshold
              ? `奖励已激活 ¥${settings.bonusPrice}/单`
              : `距奖励还差 ${bonusGap} 单`}
          </p>
        </IOSCard>

        <IOSCard padding="md">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={15} style={{ color: "var(--ios-system-green)" }} />
            <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>今日收入</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span style={{ color: "var(--ios-label)" }}>
              <AnimatedNumber
                value={todayIncome}
                prefix="¥"
                className="text-2xl font-bold tabular-nums"
              />
            </span>
          </div>
          {efficiencyData && efficiencyData.recentOrders.length >= 2 && (
            <div className="mt-1 flex justify-end">
              <Sparkline data={efficiencyData.recentOrders.slice(-7)} color="#34C759" height={20} width={60} />
            </div>
          )}
        </IOSCard>

        <IOSCard padding="md">
          <div className="flex items-center gap-2 mb-2">
            <Target size={15} style={{ color: "var(--ios-system-purple)" }} />
            <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>目标进度</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: "var(--ios-label)" }}
            >
              {goalProgress}%
            </span>
            <ProgressRing
              progress={goalProgress}
              size={42}
              strokeWidth={3}
              color="#007AFF"
              bgColor="rgba(0,122,255,0.08)"
            />
          </div>
        </IOSCard>

        <IOSCard padding="md">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={15} style={{ color: "var(--ios-system-blue)" }} />
            <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>本月收入</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span style={{ color: "var(--ios-label)" }}>
              <AnimatedNumber
                value={monthIncome}
                prefix="¥"
                className="text-2xl font-bold tabular-nums"
              />
            </span>
          </div>
          {efficiencyData && efficiencyData.recentOrders.length >= 2 && (
            <div className="mt-1 flex justify-end">
              <Sparkline data={efficiencyData.recentOrders.slice(-7)} color="#007AFF" height={20} width={60} />
            </div>
          )}
        </IOSCard>
      </motion.div>

      {/* 智能建议 */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        <IOSCard padding="md">
          <div className="flex items-center gap-2 mb-2">
            <Target size={15} style={{ color: "var(--ios-system-purple)" }} />
            <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>目标达成概率</span>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ color: "var(--ios-label)" }}>
              <AnimatedNumber
                value={goalProbability.probability}
                suffix="%"
                className="text-3xl font-bold tabular-nums"
              />
            </span>
            <ProgressRing
              progress={goalProbability.probability}
              size={38}
              strokeWidth={3}
              color="#AF52DE"
              bgColor="rgba(175,82,222,0.08)"
            />
          </div>
          <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--ios-label-secondary)" }}>
            {goalProbability.message}
          </p>
        </IOSCard>

        <IOSCard padding="md">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={15} style={{ color: "var(--ios-system-orange)" }} />
            <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>最佳赚钱日</span>
          </div>
          {bestWorkDays.length > 0 ? (
            <div className="space-y-2.5">
              {bestWorkDays.slice(0, 2).map((d) => (
                <div key={d.date} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--ios-label)" }}>
                      {formatDateShort(d.date)}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--ios-label-secondary)" }}>
                      {WEATHER_LABELS[d.weather]} · {d.reason}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: "var(--ios-system-orange)" }}>
                      {d.predictedOrders}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--ios-label-secondary)" }}>单</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs py-2" style={{ color: "var(--ios-label-tertiary)" }}>
              记录更多数据后解锁推荐
            </p>
          )}
        </IOSCard>
      </motion.div>

      {/* 效率分析 */}
      {efficiencyData && (
        <motion.div variants={item} className="space-y-3">
          <h2
            className="text-sm font-semibold px-1"
            style={{ color: "var(--ios-label)" }}
          >
            效率分析
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <IOSCard padding="md">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={15} style={{ color: "var(--ios-system-orange)" }} />
                <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>每小时单量</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold" style={{ color: "var(--ios-label)" }}>
                  {efficiencyData.avgPerHour}
                </span>
                <span className="text-sm" style={{ color: "var(--ios-label-secondary)" }}>单/时</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span
                  className="text-[11px] font-medium"
                  style={{
                    color: efficiencyData.trend >= 0
                      ? "var(--ios-system-green)"
                      : "var(--ios-system-red)",
                  }}
                >
                  {efficiencyData.trend >= 0 ? "+" : ""}{efficiencyData.trend}%
                </span>
                {efficiencyData.trend >= 0 ? (
                  <ArrowUpRight size={12} style={{ color: "var(--ios-system-green)" }} />
                ) : (
                  <ArrowDownRight size={12} style={{ color: "var(--ios-system-red)" }} />
                )}
              </div>
            </IOSCard>

            <IOSCard padding="md">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={15} style={{ color: "var(--ios-system-purple)" }} />
                <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>效率评分</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold" style={{ color: "var(--ios-label)" }}>
                  {efficiencyData.efficiencyScore}
                </span>
                <span className="text-sm" style={{ color: "var(--ios-label-secondary)" }}>分</span>
              </div>
              <div
                className="h-1 rounded-full overflow-hidden mt-2"
                style={{ background: "var(--ios-fill)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, efficiencyData.efficiencyScore)}%`,
                    background: "var(--ios-system-blue)",
                  }}
                />
              </div>
            </IOSCard>

            <IOSCard padding="md">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={15} style={{ color: "var(--ios-system-green)" }} />
                <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>最佳时效率</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold" style={{ color: "var(--ios-label)" }}>
                  {efficiencyData.bestHourly}
                </span>
                <span className="text-sm" style={{ color: "var(--ios-label-secondary)" }}>单/时</span>
              </div>
              <p className="text-[11px] mt-1" style={{ color: "var(--ios-label-secondary)" }}>
                历史最高效率
              </p>
            </IOSCard>

            <IOSCard padding="md">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={15} style={{ color: "var(--ios-system-blue)" }} />
                <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>近7天趋势</span>
              </div>
              {efficiencyData.recentOrders.length >= 2 && (
                <Sparkline data={efficiencyData.recentOrders.slice(-7)} color="#007AFF" height={28} width={80} />
              )}
              <p className="text-[11px] mt-1" style={{ color: "var(--ios-label-secondary)" }}>
                {efficiencyData.trend >= 5 ? "上升趋势" : efficiencyData.trend <= -5 ? "下降趋势" : "趋势平稳"}
              </p>
            </IOSCard>
          </div>
        </motion.div>
      )}

      {/* AI 预测 */}
      <motion.div variants={item} className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold" style={{ color: "var(--ios-label)" }}>
            AI 预测
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <IOSCard padding="md">
            <p className="text-xs mb-1" style={{ color: "var(--ios-label-secondary)" }}>明日预估</p>
            <span className="text-3xl font-bold" style={{ color: "var(--ios-label)" }}>
              {tomorrowPrediction.predictedOrders}
            </span>
            <span className="text-sm ml-1" style={{ color: "var(--ios-label-secondary)" }}>单</span>
            <div className="mt-2">
              <span
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background:
                    tomorrowPrediction.confidence === "high"
                      ? "rgba(52,199,89,0.12)"
                      : tomorrowPrediction.confidence === "medium"
                      ? "rgba(255,149,0,0.12)"
                      : "rgba(120,120,128,0.12)",
                  color:
                    tomorrowPrediction.confidence === "high"
                      ? "var(--ios-system-green)"
                      : tomorrowPrediction.confidence === "medium"
                      ? "var(--ios-system-orange)"
                      : "var(--ios-label-secondary)",
                }}
              >
                {tomorrowPrediction.confidence === "high"
                  ? "高置信"
                  : tomorrowPrediction.confidence === "medium"
                  ? "中置信"
                  : "低置信"}
              </span>
            </div>
          </IOSCard>

          <IOSCard padding="md">
            <p className="text-xs mb-1" style={{ color: "var(--ios-label-secondary)" }}>本月预估收入</p>
            <span className="text-3xl font-bold" style={{ color: "var(--ios-label)" }}>
              ¥{predictedIncome.toLocaleString()}
            </span>
            <p className="text-[11px] mt-2" style={{ color: "var(--ios-label-secondary)" }}>
              预计 {monthlyPrediction.predicted} 单 ({monthlyPrediction.lowEstimate}-{monthlyPrediction.highEstimate})
            </p>
          </IOSCard>
        </div>
      </motion.div>

      {/* 智能洞察 */}
      {insights.length > 0 && (
        <motion.div variants={item} className="space-y-3">
          <h2 className="text-sm font-semibold px-1" style={{ color: "var(--ios-label)" }}>
            智能洞察
          </h2>
          <div className="space-y-2">
            {insights.slice(0, 3).map((insight, i) => (
              <IOSCard key={i} padding="md">
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{insight.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--ios-label)" }}>
                      {insight.title}
                    </p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--ios-label-secondary)" }}>
                      {insight.message}
                    </p>
                  </div>
                  {insight.priority === "high" && (
                    <span
                      className="shrink-0 text-[11px] px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(255,149,0,0.12)",
                        color: "var(--ios-system-orange)",
                      }}
                    >
                      重要
                    </span>
                  )}
                </div>
              </IOSCard>
            ))}
          </div>
        </motion.div>
      )}

      {/* 多维对比 */}
      <motion.div variants={item} className="space-y-3">
        <h2 className="text-sm font-semibold px-1" style={{ color: "var(--ios-label)" }}>
          多维对比
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <IOSCard padding="md">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={15} style={{ color: "var(--ios-system-blue)" }} />
              <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>本周 vs 上周</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold" style={{ color: "var(--ios-label)" }}>
                {weekComparison.currOrders}
              </span>
              <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>
                vs {weekComparison.prevOrders}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              {weekComparison.change !== 0 ? (
                <>
                  <span
                    className="text-[11px] font-medium"
                    style={{
                      color: weekComparison.change >= 0
                        ? "var(--ios-system-green)"
                        : "var(--ios-system-red)",
                    }}
                  >
                    {weekComparison.change >= 0 ? "+" : ""}{Math.round(weekComparison.change)}%
                  </span>
                  {weekComparison.change >= 0 ? (
                    <ArrowUpRight size={12} style={{ color: "var(--ios-system-green)" }} />
                  ) : (
                    <ArrowDownRight size={12} style={{ color: "var(--ios-system-red)" }} />
                  )}
                </>
              ) : (
                <span className="text-[11px]" style={{ color: "var(--ios-label-secondary)" }}>持平</span>
              )}
            </div>
            <p className="text-[10px] mt-1" style={{ color: "var(--ios-label-secondary)" }}>
              本周 {weekComparison.currDays} 天 vs 上周 {weekComparison.prevDays} 天
            </p>
          </IOSCard>

          <IOSCard padding="md">
            <div className="flex items-center gap-2 mb-2">
              <Compass size={15} style={{ color: "var(--ios-system-purple)" }} />
              <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>本月 vs 上月</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold" style={{ color: "var(--ios-label)" }}>
                {monthComparison.currMOrders}
              </span>
              <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>
                vs {monthComparison.prevMOrders}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              {monthComparison.change !== 0 ? (
                <>
                  <span
                    className="text-[11px] font-medium"
                    style={{
                      color: monthComparison.change >= 0
                        ? "var(--ios-system-green)"
                        : "var(--ios-system-red)",
                    }}
                  >
                    {monthComparison.change >= 0 ? "+" : ""}{Math.round(monthComparison.change)}%
                  </span>
                  {monthComparison.change >= 0 ? (
                    <ArrowUpRight size={12} style={{ color: "var(--ios-system-green)" }} />
                  ) : (
                    <ArrowDownRight size={12} style={{ color: "var(--ios-system-red)" }} />
                  )}
                </>
              ) : (
                <span className="text-[11px]" style={{ color: "var(--ios-label-secondary)" }}>持平</span>
              )}
            </div>
            <p className="text-[10px] mt-1" style={{ color: "var(--ios-label-secondary)" }}>
              {monthComparison.prevMOrders > 0 ? "数据对比可用" : "上月暂无数据"}
            </p>
          </IOSCard>

          <IOSCard padding="md" className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={15} style={{ color: "var(--ios-system-orange)" }} />
              <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>天气 vs 订单对比</span>
            </div>
            {weatherComparison.entries.length >= 2 ? (
              <div className="flex items-end gap-3 justify-around">
                {weatherComparison.entries.slice(0, 5).map((entry) => (
                  <div key={entry.weather} className="flex flex-col items-center gap-1">
                    <span className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>
                      {entry.label.split(" ")[0]}
                    </span>
                    <div
                      style={{
                        height: `${Math.max(8, (entry.avg / Math.max(1, weatherComparison.best?.avg || 1)) * 48)}px`,
                        width: "24px",
                        background:
                          entry.weather === weatherComparison.best?.weather
                            ? "var(--ios-system-green)"
                            : entry.weather === weatherComparison.worst?.weather
                            ? "var(--ios-system-red)"
                            : "var(--ios-system-blue)",
                        borderRadius: "4px 4px 0 0",
                      }}
                    />
                    <span className="text-[10px]" style={{ color: "var(--ios-label-secondary)" }}>
                      {entry.avg}单
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--ios-label-tertiary)" }}>需要更多天气数据</p>
            )}
          </IOSCard>
        </div>
      </motion.div>

      {/* 数据健康 */}
      {dataHealth.visible && (
        <motion.div variants={item} className="space-y-3">
          <h2 className="text-sm font-semibold px-1" style={{ color: "var(--ios-label)" }}>
            数据健康
          </h2>
          <IOSCard padding="md">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[11px]" style={{ color: "var(--ios-label-secondary)" }}>记录数</p>
                <p className="text-lg font-bold" style={{ color: "var(--ios-label)" }}>{dataHealth.totalRecords}</p>
                <p className="text-[10px]" style={{ color: "var(--ios-label-tertiary)" }}>{dataHealth.maxStreak} 天连记</p>
              </div>
              <div>
                <p className="text-[11px]" style={{ color: "var(--ios-label-secondary)" }}>近7天覆盖</p>
                <p className="text-lg font-bold" style={{ color: "var(--ios-system-green)" }}>
                  {dataHealth.coveragePercent}%
                </p>
                <p className="text-[10px]" style={{ color: "var(--ios-label-tertiary)" }}>近30天 {dataHealth.coverage30Percent}%</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-[11px]" style={{ color: "var(--ios-label-secondary)" }}>数据质量</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-lg font-bold" style={{ color: dataHealth.statusColor }}>
                    {dataHealth.dataQualityScore}
                  </span>
                  <ProgressRing
                    progress={dataHealth.dataQualityScore}
                    size={24}
                    strokeWidth={2.5}
                    color={dataHealth.statusColor}
                    bgColor={`${dataHealth.statusColor}20`}
                  />
                </div>
                <p className="text-[10px]" style={{ color: dataHealth.statusColor }}>{dataHealth.statusLabel}</p>
              </div>
            </div>
          </IOSCard>
        </motion.div>
      )}

      {/* 未配置云端同步 */}
      {!isSupabaseConfigured() && (
        <motion.div variants={item}>
          <IOSCard padding="md" onClick={() => navigate("/settings")} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,122,255,0.12)" }}
              >
                <CloudOff size={20} style={{ color: "var(--ios-system-blue)" }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--ios-label)" }}>未配置云端同步</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ios-label-secondary)" }}>
                  点击配置 Supabase，实现全平台数据自动同步
                </p>
              </div>
            </div>
            <ChevronRight size={20} style={{ color: "var(--ios-system-gray3)" }} />
          </IOSCard>
        </motion.div>
      )}
    </motion.div>
  );
}
