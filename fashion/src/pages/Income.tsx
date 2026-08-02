import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import useStore from "@/store/useStore";
import { Card, CardTitle } from "@/components/shared/Card";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import { formatCurrency } from "@/lib/utils";
import { getCurrentMonth, getMonthDateRange, today, formatDate } from "@/utils/date";

export default function Income() {
  const records = useStore((s) => s.records);
  const [yearMonth, setYearMonth] = useState(getCurrentMonth());

  const dateRange = useMemo(() => getMonthDateRange(yearMonth.year, yearMonth.month), [yearMonth]);
  const todayStr = today();

  const chartData = useMemo(() => {
    return dateRange
      .filter((d) => d <= todayStr || records[d]?.income > 0)
      .map((date) => ({
        date,
        day: new Date(date + "T00:00:00").getDate(),
        income: records[date]?.income || 0,
        orders: records[date]?.orders || 0,
      }));
  }, [dateRange, records, todayStr]);

  const stats = useMemo(() => {
    const list = Object.values(records).filter((r) => r.date.startsWith(`${yearMonth.year}-${String(yearMonth.month).padStart(2, "0")}`));
    const income = list.reduce((s, r) => s + r.income, 0);
    const orders = list.reduce((s, r) => s + r.orders, 0);
    const hours = list.reduce((s, r) => s + r.workHours, 0);
    const days = list.length;
    return { income, orders, hours, days, avgPerHour: hours > 0 ? income / hours : 0 };
  }, [records, yearMonth]);

  const changeMonth = (delta: number) => {
    setYearMonth((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m > 12) { m = 1; y++; }
      if (m < 1) { m = 12; y--; }
      return { year: y, month: m };
    });
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-mocha-800">收入分析</h1>
        <p className="text-sm text-mocha-400 mt-1">清晰掌握每一份付出</p>
      </header>

      <Card variant="gold">
        <div className="flex items-center justify-between">
          <CardTitle>{yearMonth.month}月收入</CardTitle>
          <div className="flex gap-2">
            <button onClick={() => changeMonth(-1)} className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-mocha-500 hover:bg-white">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => changeMonth(1)} className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-mocha-500 hover:bg-white">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="mt-4">
          <span className="text-4xl font-semibold text-mocha-800">{formatCurrency(stats.income)}</span>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5">
          <div>
            <p className="text-xs text-mocha-400">总单量</p>
            <p className="font-semibold text-mocha-700">{stats.orders}</p>
          </div>
          <div>
            <p className="text-xs text-mocha-400">工时</p>
            <p className="font-semibold text-mocha-700">{stats.hours}h</p>
          </div>
          <div>
            <p className="text-xs text-mocha-400">时薪</p>
            <p className="font-semibold text-mocha-700">{formatCurrency(Math.round(stats.avgPerHour))}</p>
          </div>
        </div>
      </Card>

      <Card className="h-72">
        <CardTitle>收入趋势</CardTitle>
        <div className="h-56 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFD54F" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#FFD54F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#BFA691", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#BFA691", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 4px 20px rgba(107,87,66,0.1)" }}
                formatter={(v: number) => [formatCurrency(v), "收入"]}
              />
              <Area type="monotone" dataKey="income" stroke="#FFC928" strokeWidth={3} fill="url(#incomeGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="h-72">
        <CardTitle>每日单量</CardTitle>
        <div className="h-56 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#BFA691", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#BFA691", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 4px 20px rgba(107,87,66,0.1)" }}
                formatter={(v: number) => [v + " 单", "单量"]}
              />
              <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.date === todayStr ? "#F2A8A8" : "#D9CABD"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
