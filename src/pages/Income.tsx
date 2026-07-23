import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import { today, getCurrentMonth, getPreviousMonth, getMonthDateRange } from "@/utils/date";
import { predictMonthlyTotalEnhanced, predictIncome } from "@/utils/predictionEnhanced";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Weather, WEATHER_LABELS } from "@/types";

const WEATHER_FILTER_OPTIONS: { value: Weather | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "sunny", label: "☀️ 晴天" },
  { value: "cloudy", label: "⛅ 多云" },
  { value: "rainy", label: "🌧️ 雨天" },
  { value: "snowy", label: "❄️ 雪天" },
  { value: "windy", label: "💨 大风" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Income() {
  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);
  const getEffectivePrice = useStore((s) => s.getEffectivePrice);
  const [weatherFilter, setWeatherFilter] = useState<Weather | "all">("all");

  const { year, month } = getCurrentMonth();
  const { year: prevYear, month: prevMonth } = getPreviousMonth();

  const monthRecords = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return Object.values(records)
      .filter((r) => r.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [records, year, month]);

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
    if (prevMonthIncome === 0) return 0;
    return Math.round(((monthIncome - prevMonthIncome) / prevMonthIncome) * 100);
  }, [monthIncome, prevMonthIncome]);

  const prediction = useMemo(
    () => predictMonthlyTotalEnhanced(records, settings),
    [records, settings]
  );

  const predictedIncome = useMemo(
    () => predictIncome(prediction.predicted, getEffectivePrice(prediction.completed)),
    [prediction.predicted, prediction.completed, getEffectivePrice]
  );

  const avgDailyIncome = useMemo(() => {
    const days = monthRecords.length;
    return days > 0 ? Math.round(monthIncome / days) : 0;
  }, [monthIncome, monthRecords]);

  const chartData = useMemo(() => {
    const dateRange = getMonthDateRange(year, month);
    const todayStr = today();
    return dateRange
      .filter((d) => d <= todayStr)
      .map((date) => {
        const record = records[date];
        return {
          date: date.slice(8),
          income: record?.income || 0,
          orders: record?.orders || 0,
        };
      });
  }, [records, year, month]);

  const filteredRecords = useMemo(() => {
    if (weatherFilter === "all") return monthRecords;
    return monthRecords.filter((r) => r.weather === weatherFilter);
  }, [monthRecords, weatherFilter]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass rounded-lg px-3 py-2">
        <p className="text-white/50 text-xs">{label}日</p>
        <p className="text-[#FFD100] text-sm font-bold">
          ¥{payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  };

  return (
    <motion.div
      className="px-4 pt-6 pb-24 space-y-5"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item} className="text-center">
        <p className="text-white/40 text-sm">
          {year}年{month}月
        </p>
        <h1 className="text-4xl font-bold text-white mt-1 flex items-center justify-center gap-2">
          <DollarSign size={32} className="text-emerald-400" />
          <AnimatedNumber value={monthIncome} className="tabular-nums" />
        </h1>
        <p className="text-white/40 text-xs mt-1">本月累计收入</p>
      </motion.div>

      {/* Comparison & Prediction Cards */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            {incomeChangePercent >= 0 ? (
              <TrendingUp size={14} className="text-emerald-400" />
            ) : (
              <TrendingDown size={14} className="text-red-400" />
            )}
            <span className="text-white/50 text-xs">环比上月</span>
          </div>
          <span
            className={`text-xl font-bold ${
              incomeChangePercent >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {incomeChangePercent >= 0 ? "+" : ""}
            {incomeChangePercent}%
          </span>
          <p className="text-white/30 text-[10px] mt-0.5">
            上月 ¥{prevMonthIncome.toLocaleString()}
          </p>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowUpRight size={14} className="text-[#00D2FF]" />
            <span className="text-white/50 text-xs">预计本月</span>
          </div>
          <span className="text-xl font-bold text-white">
            ¥{predictedIncome.toLocaleString()}
          </span>
          <p className="text-white/30 text-[10px] mt-0.5">
            预计 {prediction.predicted} 单
          </p>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign size={14} className="text-[#FFD100]" />
            <span className="text-white/50 text-xs">日均收入</span>
          </div>
          <span className="text-xl font-bold text-white">
            ¥{avgDailyIncome.toLocaleString()}
          </span>
          <p className="text-white/30 text-[10px] mt-0.5">
            {monthRecords.length} 天数据
          </p>
        </div>
      </motion.div>

      {/* Trend Chart */}
      <motion.div
        variants={item}
        className="glass rounded-2xl p-4"
      >
        <h3 className="text-white/60 text-sm font-medium mb-3">收入趋势</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFD100" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#FFD100" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#FFD100"
              strokeWidth={2}
              fill="url(#incomeGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Detail List */}
      <motion.div variants={item} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white/60 text-sm font-medium">收入明细</h3>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {WEATHER_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setWeatherFilter(opt.value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs transition-all ${
                  weatherFilter === opt.value
                    ? "bg-[#FFD100] text-[#0F0F23] font-medium"
                    : "bg-white/5 text-white/50 hover:bg-white/10"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">
            暂无记录
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecords
              .slice()
              .reverse()
              .map((record) => (
                <motion.div
                  key={record.date}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[40px]">
                      <p className="text-white text-lg font-bold leading-tight">
                        {record.date.slice(8)}
                      </p>
                      <p className="text-white/30 text-[10px]">
                        {["日", "一", "二", "三", "四", "五", "六"][
                          new Date(record.date).getDay()
                        ]}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/80 text-sm">
                        {record.orders} 单
                      </p>
                      <p className="text-white/30 text-xs">
                        {WEATHER_LABELS[record.weather]}
                      </p>
                    </div>
                  </div>
                  <span className="text-emerald-400 font-bold text-lg">
                    ¥{record.income.toLocaleString()}
                  </span>
                </motion.div>
              ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}