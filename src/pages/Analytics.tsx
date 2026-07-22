import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3, TrendingUp, Calendar, Cloud, Sun, CloudRain, Wind } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import { getCurrentMonth, getLastNDays, formatDate, getDayOfWeek } from "@/utils/date";
import { Weather, WEATHER_LABELS } from "@/types";

const WEEK_DAYS = ["日", "一", "二", "三", "四", "五", "六"];

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
  const [viewMode, setViewMode] = useState<"week" | "month" | "weather">("week");

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

    return {
      orders: monthlyOrders,
      income: monthlyIncome,
      avgDaily,
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

  const weatherIcons: Record<Weather, React.ReactNode> = {
    sunny: <Sun size={16} />,
    cloudy: <Cloud size={16} />,
    rainy: <CloudRain size={16} />,
    snowy: <Cloud size={16} />,
    windy: <Wind size={16} />,
  };

  return (
    <motion.div
      className="px-4 pt-6 pb-4 space-y-5"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 size={24} className="text-[#FFD100]" />
          数据看板
        </h1>
      </motion.div>

      {/* View Tabs */}
      <motion.div variants={item} className="flex gap-2 bg-[#16213E] rounded-xl p-1">
        {[
          { key: "week", label: "本周趋势" },
          { key: "month", label: "本月概览" },
          { key: "weather", label: "天气关联" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key as typeof viewMode)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === tab.key
                ? "bg-[#FFD100] text-[#0F0F23]"
                : "text-white/50 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </motion.div>

      {viewMode === "week" && (
        <motion.div
          variants={item}
          className="bg-[#16213E] rounded-2xl p-4 border border-white/5"
        >
          <h3 className="text-white/60 text-sm font-medium mb-4 flex items-center gap-2">
            <TrendingUp size={16} />
            本周每日单量
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="label"
                stroke="rgba(255,255,255,0.3)"
                fontSize={12}
                tickLine={false}
              />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1A1A2E",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#fff",
                }}
                formatter={(value: number) => [`${value} 单`, "单量"]}
              />
              <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
                {weekData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.date === new Date().toISOString().slice(0, 10) ? "#FFD100" : entry.day === "六" || entry.day === "日" ? "#7B2FF7" : "#00D2FF"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-[#FFD100]" />
              <span className="text-white/40 text-xs">今日</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-[#00D2FF]" />
              <span className="text-white/40 text-xs">工作日</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-[#7B2FF7]" />
              <span className="text-white/40 text-xs">周末</span>
            </div>
          </div>
        </motion.div>
      )}

      {viewMode === "month" && (
        <motion.div variants={item} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#16213E] rounded-2xl p-4 border border-white/5">
              <span className="text-white/50 text-xs">本月总单量</span>
              <AnimatedNumber
                value={monthData.orders}
                className="block text-2xl font-bold text-white mt-1"
              />
            </div>
            <div className="bg-[#16213E] rounded-2xl p-4 border border-white/5">
              <span className="text-white/50 text-xs">本月总收入</span>
              <AnimatedNumber
                value={monthData.income}
                prefix="¥"
                className="block text-2xl font-bold text-white mt-1"
              />
            </div>
            <div className="bg-[#16213E] rounded-2xl p-4 border border-white/5">
              <span className="text-white/50 text-xs">日均单量</span>
              <span className="block text-2xl font-bold text-white mt-1">
                {monthData.avgDaily}
              </span>
            </div>
            <div className="bg-[#16213E] rounded-2xl p-4 border border-white/5">
              <span className="text-white/50 text-xs">记录天数</span>
              <span className="block text-2xl font-bold text-white mt-1">
                {monthData.recordDays}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {viewMode === "weather" && (
        <motion.div variants={item} className="space-y-3">
          <h3 className="text-white/60 text-sm font-medium flex items-center gap-2">
            <Calendar size={16} />
            本月天气与单量关系
          </h3>
          {weatherStats.length === 0 ? (
            <div className="bg-[#16213E] rounded-2xl p-8 border border-white/5 text-center">
              <p className="text-white/40">暂无本月数据</p>
            </div>
          ) : (
            weatherStats.map((stat) => (
              <div
                key={stat.weather}
                className="bg-[#16213E] rounded-2xl p-4 border border-white/5 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/60">
                  {weatherIcons[stat.weather]}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{stat.label}</p>
                  <p className="text-white/40 text-xs">{stat.count} 天</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{stat.avgOrders}</p>
                  <p className="text-white/40 text-xs">日均单量</p>
                </div>
              </div>
            ))
          )}
        </motion.div>
      )}
    </motion.div>
  );
}