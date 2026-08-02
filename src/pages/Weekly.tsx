import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Calendar, TrendingUp, TrendingDown, DollarSign,
  ShoppingBag, Clock, Award, Zap, ArrowUp, ArrowDown,
} from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import ShiftBadge from "@/components/shared/ShiftBadge";
import { getWeekRange, getPreviousWeekRange, formatDate, getDayOfWeek } from "@/utils/date";
import { WEATHER_LABELS } from "@/types";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.015 } },
};

const item = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] } },
};

export default function Weekly() {
  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);

  const thisWeek = useMemo(() => getWeekRange(), []);
  const prevWeek = useMemo(() => getPreviousWeekRange(), []);

  const thisWeekData = useMemo(() => {
    return thisWeek.days.map((date) => {
      const r = records[date];
      return {
        date,
        label: formatDate(date).slice(2),
        day: getDayOfWeek(date),
        orders: r?.orders || 0,
        income: r?.income || 0,
        hours: r?.workHours || 0,
        weather: r?.weather || "sunny",
      };
    });
  }, [records, thisWeek]);

  const prevWeekData = useMemo(() => {
    return prevWeek.days.map((date) => {
      const r = records[date];
      return {
        date,
        orders: r?.orders || 0,
        income: r?.income || 0,
        hours: r?.workHours || 0,
      };
    });
  }, [records, prevWeek]);

  const thisWeekStats = useMemo(() => {
    const totalOrders = thisWeekData.reduce((s, d) => s + d.orders, 0);
    const totalIncome = thisWeekData.reduce((s, d) => s + d.income, 0);
    const totalHours = thisWeekData.reduce((s, d) => s + d.hours, 0);
    const workDays = thisWeekData.filter((d) => d.orders > 0).length;
    const avgDaily = workDays > 0 ? Math.round(totalOrders / workDays) : 0;
    const hourlyRate = totalHours > 0 ? Math.round(totalOrders / totalHours * 10) / 10 : 0;
    const maxDay = thisWeekData.reduce((max, d) => d.orders > max.orders ? d : max, thisWeekData[0]);

    return { totalOrders, totalIncome, totalHours, workDays, avgDaily, hourlyRate, maxDay };
  }, [thisWeekData]);

  const prevWeekStats = useMemo(() => {
    const totalOrders = prevWeekData.reduce((s, d) => s + d.orders, 0);
    const totalIncome = prevWeekData.reduce((s, d) => s + d.income, 0);
    return { totalOrders, totalIncome };
  }, [prevWeekData]);

  const orderChange = prevWeekStats.totalOrders > 0
    ? Math.round(((thisWeekStats.totalOrders - prevWeekStats.totalOrders) / prevWeekStats.totalOrders) * 100)
    : 0;

  const incomeChange = prevWeekStats.totalIncome > 0
    ? Math.round(((thisWeekStats.totalIncome - prevWeekStats.totalIncome) / prevWeekStats.totalIncome) * 100)
    : 0;

  const bestDayLabel = thisWeekStats.maxDay.orders > 0
    ? `${formatDate(thisWeekStats.maxDay.date)} 周${thisWeekStats.maxDay.day}`
    : "暂无";

  return (
    <motion.div
      className="px-4 pt-6 pb-24 space-y-5"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <p className="terminal-text text-sm tracking-tight">周报总结</p>
          <h1 className="text-2xl font-bold text-[#E0E0E0] flex items-center gap-2 tracking-[-0.01em]">
            <Calendar size={22} className="icon-glow-cyan" />
            {formatDate(thisWeek.start)} - {formatDate(thisWeek.end)}
          </h1>
        </div>
      </motion.div>

      {/* Shift Info */}
      <motion.div variants={item}>
        <ShiftBadge />
      </motion.div>

      {/* Big Numbers */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        <div className="holo-card rounded-[26px] p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag size={16} className="icon-glow-cyan" />
            <span className="terminal-text text-xs tracking-tight">本周单量</span>
          </div>
          <AnimatedNumber value={thisWeekStats.totalOrders} className="text-3xl font-bold text-[#E0E0E0] tabular-nums" />
          <span className="text-[#E0E0E0]/40 text-sm ml-1">单</span>
          <div className="flex items-center gap-1 mt-1">
            {orderChange >= 0 ? (
              <ArrowUp size={12} className="text-[#00E676]" />
            ) : (
              <ArrowDown size={12} className="text-red-400" />
            )}
            <span className={`text-xs ${orderChange >= 0 ? "text-[#00E676]" : "text-red-400"}`}>
              {orderChange >= 0 ? "+" : ""}{orderChange}% 环比
            </span>
          </div>
        </div>
        <div className="holo-card rounded-[26px] p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="text-[#00E676]" />
            <span className="terminal-text text-xs tracking-tight">本周收入</span>
          </div>
          <AnimatedNumber value={thisWeekStats.totalIncome} prefix="¥" className="text-3xl font-bold text-[#E0E0E0] tabular-nums" />
          <div className="flex items-center gap-1 mt-1">
            {incomeChange >= 0 ? (
              <ArrowUp size={12} className="text-[#00E676]" />
            ) : (
              <ArrowDown size={12} className="text-red-400" />
            )}
            <span className={`text-xs ${incomeChange >= 0 ? "text-[#00E676]" : "text-red-400"}`}>
              {incomeChange >= 0 ? "+" : ""}{incomeChange}% 环比
            </span>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <div className="holo-card rounded-[26px] p-3 text-center">
          <Clock size={16} className="icon-glow-cyan mx-auto mb-1" />
          <p className="text-lg font-bold text-[#E0E0E0]">{thisWeekStats.hourlyRate}</p>
          <p className="terminal-text text-[10px] tracking-tight">单/小时</p>
        </div>
        <div className="holo-card rounded-[26px] p-3 text-center">
          <Zap size={16} className="icon-glow-gold mx-auto mb-1" />
          <p className="text-lg font-bold text-[#E0E0E0]">{thisWeekStats.avgDaily}</p>
          <p className="terminal-text text-[10px] tracking-tight">日均单量</p>
        </div>
        <div className="holo-card rounded-[26px] p-3 text-center">
          <Award size={16} className="text-[#E040FB] mx-auto mb-1" />
          <p className="text-lg font-bold text-[#E0E0E0]">{thisWeekStats.workDays}</p>
          <p className="terminal-text text-[10px] tracking-tight">出勤天数</p>
        </div>
      </motion.div>

      {/* Best Day */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-4 ring-1 ring-[#00E5FF]/10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <div>
            <p className="text-[#E0E0E0] font-bold text-sm">本周最佳</p>
            <p className="text-[#E0E0E0]/40 text-xs">
              {bestDayLabel} — {thisWeekStats.maxDay.orders} 单
            </p>
          </div>
        </div>
      </motion.div>

      {/* Daily Breakdown */}
      <motion.div variants={item} className="space-y-2">
        <h3 className="cyber-section-title text-sm font-medium tracking-tight">每日明细</h3>
        {thisWeekData.map((day, i) => {
          const isToday = day.date === new Date().toISOString().slice(0, 10);
          const maxOrders = Math.max(...thisWeekData.map((d) => d.orders), 1);
          const barWidth = (day.orders / maxOrders) * 100;
          return (
            <motion.div
              key={day.date}
              variants={item}
              className={`tap-cyber rounded-xl p-3 ${isToday ? "holo-card ring-1 ring-[#00E5FF]/20" : "holo-card"}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 text-center">
                  <p className="terminal-text text-[10px]">{WEEKDAYS[i]}</p>
                  <p className={`text-xs font-bold ${isToday ? "text-[#FFD740]" : "text-[#E0E0E0]/40"}`}>
                    {day.date.slice(8)}
                  </p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#E0E0E0] text-sm font-medium">
                      {day.orders > 0 ? `${day.orders} 单` : "休息"}
                    </span>
                    {day.income > 0 && (
                      <span className="text-[#00E676] text-xs">¥{day.income}</span>
                    )}
                  </div>
                  <div className="w-full bg-[#E0E0E0]/5 rounded-full h-1.5">
                    <motion.div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${barWidth}%`,
                        background: isToday
                          ? "linear-gradient(90deg, #00E5FF, #E040FB)"
                          : day.orders > 0
                          ? "#E040FB"
                          : "transparent",
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                    />
                  </div>
                </div>
                <span className="text-[#E0E0E0]/30 text-xs w-10 text-right">
                  {WEATHER_LABELS[day.weather as keyof typeof WEATHER_LABELS]}
                </span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}