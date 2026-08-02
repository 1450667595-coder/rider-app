import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import { getCurrentMonth, getMonthDateRange } from "@/utils/date";
import { predictMonthlyAI } from "@/utils/aiPrediction";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { Weather, WEATHER_LABELS } from "@/types";

const WEATHER_FILTER_OPTIONS: { value: Weather | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "sunny", label: "☀️" },
  { value: "cloudy", label: "⛅" },
  { value: "rainy", label: "🌧️" },
  { value: "snowy", label: "❄️" },
  { value: "windy", label: "💨" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

const item = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export default function Income() {
  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);
  const getEffectivePrice = useStore((s) => s.getEffectivePrice);
  const [weatherFilter, setWeatherFilter] = useState<Weather | "all">("all");
  const [viewMode, setViewMode] = useState<"chart" | "heatmap">("chart");

  const currentDate = getCurrentMonth();
  const [currentYear, setCurrentYear] = useState(currentDate.year);
  const [currentMonth, setCurrentMonth] = useState(currentDate.month);

  const isCurrentMonth = currentYear === currentDate.year && currentMonth === currentDate.month;
  const { year: prevYear, month: prevMonth } = getPreviousMonth(currentYear, currentMonth);

  const monthRecords = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
    return Object.values(records)
      .filter((r) => r.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [records, currentYear, currentMonth]);

  const prevMonthRecords = useMemo(() => {
    const prefix = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
    return Object.values(records).filter((r) => r.date.startsWith(prefix));
  }, [records, prevYear, prevMonth]);

  const monthIncome = useMemo(
    () => monthRecords.reduce((s, r) => s + r.income, 0),
    [monthRecords]
  );

  const prevMonthIncome = useMemo(
    () => prevMonthRecords.reduce((s, r) => s + r.income, 0),
    [prevMonthRecords]
  );

  const incomeChangePercent = useMemo(() => {
    if (prevMonthIncome === 0) return monthIncome > 0 ? 100 : 0;
    return Math.round(((monthIncome - prevMonthIncome) / prevMonthIncome) * 100);
  }, [monthIncome, prevMonthIncome]);

  const prediction = useMemo(
    () => predictMonthlyAI(records, settings),
    [records, settings]
  );

  const predictedIncome = useMemo(
    () => prediction.predicted * getEffectivePrice(prediction.completed),
    [prediction.predicted, prediction.completed, getEffectivePrice]
  );

  const avgDailyIncome = useMemo(() => {
    const days = monthRecords.filter((r) => r.orders > 0).length;
    return days > 0 ? Math.round(monthIncome / days) : 0;
  }, [monthIncome, monthRecords]);

  // Weather statistics
  const weatherStats = useMemo(() => {
    const stats: Record<string, { count: number; totalOrders: number; totalIncome: number }> = {};
    for (const r of monthRecords) {
      if (!stats[r.weather]) stats[r.weather] = { count: 0, totalOrders: 0, totalIncome: 0 };
      stats[r.weather].count++;
      stats[r.weather].totalOrders += r.orders;
      stats[r.weather].totalIncome += r.income;
    }
    return stats;
  }, [monthRecords]);

  const chartData = useMemo(() => {
    const dateRange = getMonthDateRange(currentYear, currentMonth);
    const todayStr = new Date().toISOString().slice(0, 10);
    return dateRange
      .filter((d) => d <= todayStr)
      .map((date) => {
        const record = records[date];
        return {
          date: date.slice(8),
          fullDate: date,
          income: record?.income || 0,
          orders: record?.orders || 0,
          weather: record?.weather || "sunny",
        };
      });
  }, [records, currentYear, currentMonth]);

  // Heatmap data
  const heatmapData = useMemo(() => {
    const dateRange = getMonthDateRange(currentYear, currentMonth);
    const todayStr = new Date().toISOString().slice(0, 10);
    const maxIncome = Math.max(...dateRange.map((d) => records[d]?.income || 0), 1);
    const firstDay = new Date(dateRange[0]).getDay();
    const weeks: { day: number; date: string; income: number; orders: number; weather: Weather }[][] = [];
    let currentWeek: { day: number; date: string; income: number; orders: number; weather: Weather }[] = [];

    // Fill empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push({ day: 0, date: "", income: 0, orders: 0, weather: "sunny" });
    }

    dateRange.forEach((date) => {
      if (date > todayStr) return;
      const r = records[date];
      const day = new Date(date).getDay();
      currentWeek.push({
        day,
        date,
        income: r?.income || 0,
        orders: r?.orders || 0,
        weather: r?.weather || "sunny",
      });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ day: 0, date: "", income: 0, orders: 0, weather: "sunny" });
      }
      weeks.push(currentWeek);
    }

    return { weeks, maxIncome };
  }, [records, currentYear, currentMonth]);

  const filteredRecords = useMemo(() => {
    if (weatherFilter === "all") return monthRecords;
    return monthRecords.filter((r) => r.weather === weatherFilter);
  }, [monthRecords, weatherFilter]);

  const getHeatColor = (value: number, max: number): string => {
    if (value === 0) return "rgba(255,255,255,0.04)";
    const intensity = value / max;
    if (intensity < 0.25) return `rgba(0,230,118,${0.2 + intensity * 0.8})`;
    if (intensity < 0.5) return `rgba(255,215,64,${0.3 + intensity * 0.7})`;
    if (intensity < 0.75) return `rgba(249,115,22,${0.4 + intensity * 0.6})`;
    return `rgba(255,23,68,${0.5 + intensity * 0.5})`;
  };

  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    const now = getCurrentMonth();
    if (currentYear === now.year && currentMonth === now.month) return;
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToCurrentMonth = () => {
    setCurrentYear(currentDate.year);
    setCurrentMonth(currentDate.month);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="holo-card rounded-lg px-3 py-2">
        <p className="text-[#E0E0E0]/30 text-xs">{label}日</p>
        <p className="text-[#00E5FF] text-sm font-bold">¥{payload[0].value.toLocaleString()}</p>
      </div>
    );
  };

  const WEEKDAYS_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <motion.div className="px-4 pt-6 pb-24 space-y-5" variants={container} initial="hidden" animate="show">
      {/* Month Navigation */}
      <motion.div variants={item} className="flex items-center justify-between">
        <button onClick={goToPrevMonth} className="btn-cyber w-10 h-10 rounded-full flex items-center justify-center">
          <ChevronLeft size={20} className="text-[#E0E0E0]/45 icon-glow-cyan" />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-[#E0E0E0] neon-cyan tracking-tight">
            {currentYear}年{currentMonth}月
          </h2>
          {!isCurrentMonth && (
            <button
              onClick={goToCurrentMonth}
              className="text-[#00E5FF]/60 text-xs mt-1 hover:text-[#00E5FF] transition-colors"
            >
              返回本月
            </button>
          )}
        </div>
        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          className={`w-10 h-10 rounded-full flex items-center justify-center ${isCurrentMonth ? "opacity-20 cursor-not-allowed" : "btn-cyber"}`}
        >
          <ChevronRight size={20} className={`${isCurrentMonth ? "text-[#E0E0E0]/20" : "text-[#E0E0E0]/45 icon-glow-cyan"}`} />
        </button>
      </motion.div>

      {/* Header */}
      <motion.div variants={item} className="text-center">
        <h1 className="text-4xl font-bold text-[#E0E0E0] mt-1 flex items-center justify-center gap-2 neon-cyan tracking-[-0.02em]">
          <DollarSign size={32} className="text-[#00E676] icon-glow-cyan" />
          <AnimatedNumber value={monthIncome} className="tabular-nums" />
        </h1>
        <p className="terminal-text text-xs mt-1 tracking-tight">
          {isCurrentMonth ? "本月累计收入" : `${currentYear}年${currentMonth}月累计收入`}
        </p>
      </motion.div>

      {/* Comparison & Prediction Cards */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <div className="holo-card rounded-[26px] p-4">
          <div className="flex items-center gap-1.5 mb-2">
            {incomeChangePercent >= 0 ? (
              <TrendingUp size={14} className="text-[#00E676] icon-glow-cyan" />
            ) : (
              <TrendingDown size={14} className="text-[#FF1744]" />
            )}
            <span className="text-[#E0E0E0]/30 text-xs tracking-tight">环比上月</span>
          </div>
          <span className={`text-xl font-bold neon-cyan ${incomeChangePercent >= 0 ? "text-[#00E676]" : "text-[#FF1744]"}`}>
            {incomeChangePercent >= 0 ? "+" : ""}{incomeChangePercent}%
          </span>
          <p className="terminal-text text-[10px] mt-0.5">
            {prevMonth}月 ¥{prevMonthIncome.toLocaleString()}
          </p>
        </div>
        {isCurrentMonth && (
          <div className="holo-card rounded-[26px] p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowUpRight size={14} className="text-[#00E5FF] icon-glow-cyan" />
              <span className="text-[#E0E0E0]/30 text-xs tracking-tight">预计本月</span>
            </div>
            <span className="text-xl font-bold text-[#E0E0E0] neon-cyan">¥{predictedIncome.toLocaleString()}</span>
            <p className="terminal-text text-[10px] mt-0.5">预计 {prediction.predicted} 单</p>
          </div>
        )}
        <div className={`holo-card rounded-[26px] p-4 ${!isCurrentMonth ? "col-span-2" : ""}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign size={14} className="text-[#FFD740] icon-glow-gold" />
            <span className="text-[#E0E0E0]/30 text-xs tracking-tight">日均收入</span>
          </div>
          <span className="text-xl font-bold text-[#E0E0E0] neon-cyan">¥{avgDailyIncome.toLocaleString()}</span>
          <p className="terminal-text text-[10px] mt-0.5">{monthRecords.filter((r) => r.orders > 0).length} 天</p>
        </div>
      </motion.div>

      {/* Weather Stats */}
      {Object.keys(weatherStats).length > 0 && (
        <motion.div variants={item} className="holo-card rounded-[26px] p-4">
          <h3 className="cyber-section-title text-sm font-medium mb-3 tracking-tight">天气收入分析</h3>
          <div className="grid grid-cols-5 gap-2">
            {(Object.entries(weatherStats) as [Weather, { count: number; totalOrders: number; totalIncome: number }][])
              .sort(([, a], [, b]) => b.totalIncome - a.totalIncome)
              .slice(0, 5)
              .map(([w, s]) => (
                <div key={w} className="text-center">
                  <p className="text-lg">{WEATHER_LABELS[w].split(" ")[0]}</p>
                  <p className="text-[#E0E0E0] font-bold text-xs">{s.count}天</p>
                  <p className="text-[#E0E0E0]/30 text-[10px]">¥{Math.round(s.totalIncome / s.count).toLocaleString()}/天</p>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {/* View Mode Toggle */}
      <motion.div variants={item} className="flex gap-1 holo-card rounded-xl p-1">
        {[
          { key: "chart" as const, label: "趋势图" },
          { key: "heatmap" as const, label: "热力图" },
        ].map((mode) => (
          <button
            key={mode.key}
            onClick={() => setViewMode(mode.key)}
            className={`tap-cyber flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              viewMode === mode.key ? "bg-[#00E5FF] text-[#020408]" : "text-[#E0E0E0]/30 hover:text-[#E0E0E0]"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </motion.div>

      {viewMode === "chart" ? (
        <motion.div variants={item} className="holo-card rounded-[26px] p-4">
          <h3 className="cyber-section-title text-sm font-medium mb-3 tracking-tight">收入趋势</h3>
          {chartData.length === 0 ? (
            <div className="text-center py-8 text-[#E0E0E0]/30 text-sm">暂无数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFD100" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#FFD100" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,255,0.08)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(224,224,224,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "rgba(224,224,224,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="income" stroke="#FFD100" strokeWidth={2} fill="url(#incomeGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      ) : (
        <motion.div variants={item} className="holo-card rounded-[26px] p-4">
          <h3 className="cyber-section-title text-sm font-medium mb-3 flex items-center gap-2 tracking-tight">
            <Calendar size={14} />
            收入热力图
          </h3>
          {heatmapData.weeks.length === 0 ? (
            <div className="text-center py-8 text-[#E0E0E0]/30 text-sm">暂无数据</div>
          ) : (
            <>
              <div className="flex gap-1 mb-2">
                {WEEKDAYS_SHORT.map((d) => (
                  <div key={d} className="flex-1 text-center text-[#E0E0E0]/30 text-[10px]">{d}</div>
                ))}
              </div>
              <div className="space-y-1">
                {heatmapData.weeks.map((week, wi) => (
                  <div key={wi} className="flex gap-1">
                    {week.map((day, di) => (
                      <div
                        key={di}
                        className="flex-1 aspect-square rounded-md flex flex-col items-center justify-center text-[10px] relative group"
                        style={{ backgroundColor: day.date ? getHeatColor(day.income, heatmapData.maxIncome) : "transparent" }}
                        title={day.date ? `${day.date} ¥${day.income.toLocaleString()} ${day.orders}单` : ""}
                      >
                        {day.date && (
                          <>
                            <span className="text-[#E0E0E0]/70 font-medium leading-none">{day.date.slice(8)}</span>
                            {day.income > 0 && (
                              <span className="text-[#E0E0E0]/30 text-[8px] leading-none">¥{day.income}</span>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-1 mt-2">
                <span className="text-[#E0E0E0]/30 text-[10px]">低</span>
                {[0.1, 0.3, 0.5, 0.8, 1].map((i) => (
                  <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: getHeatColor(i * heatmapData.maxIncome, heatmapData.maxIncome) }} />
                ))}
                <span className="text-[#E0E0E0]/30 text-[10px]">高</span>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Detail List */}
      <motion.div variants={item} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="cyber-section-title text-sm font-medium tracking-tight">收入明细</h3>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {WEATHER_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setWeatherFilter(opt.value)}
                className={`tap-cyber shrink-0 px-2.5 py-1 rounded-full text-xs transition-all ${
                  weatherFilter === opt.value
                    ? "bg-[#00E5FF] text-[#020408] font-medium"
                    : "text-[#E0E0E0]/30 hover:text-[#E0E0E0]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-8 text-[#E0E0E0]/30 text-sm">暂无记录</div>
        ) : (
          <div className="space-y-2">
            {filteredRecords.slice().reverse().map((record) => (
              <motion.div
                key={record.date}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="holo-card rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[40px]">
                    <p className="text-[#E0E0E0] text-lg font-bold leading-tight">{record.date.slice(8)}</p>
                    <p className="text-[#E0E0E0]/30 text-[10px]">
                      {["日", "一", "二", "三", "四", "五", "六"][new Date(record.date).getDay()]}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#E0E0E0]/80 text-sm">{record.orders} 单</p>
                    <p className="text-[#E0E0E0]/30 text-xs">{WEATHER_LABELS[record.weather]}</p>
                  </div>
                </div>
                <span className="text-[#00E676] font-bold text-lg">¥{record.income.toLocaleString()}</span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}