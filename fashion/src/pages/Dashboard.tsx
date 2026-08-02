import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, TrendingUp, Zap, CalendarDays, Plus, ChevronRight } from "lucide-react";
import useStore from "@/store/useStore";
import { Card, CardTitle } from "@/components/shared/Card";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import RecordSheet from "@/components/shared/RecordSheet";
import { formatCurrency, cn } from "@/lib/utils";
import { today, formatDateFull, getDayOfWeek, getLastNDays } from "@/utils/date";
import { predictMonthly } from "@/utils/prediction";

export default function Dashboard() {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);
  const updateRecord = useStore((s) => s.updateRecord);

  const todayStr = today();
  const weekdays = getLastNDays(7);

  const todayRecord = records[todayStr];
  const monthStats = useMemo(() => {
    const list = Object.values(records).filter((r) => r.date.startsWith(`${todayStr.slice(0, 7)}`));
    return list.reduce(
      (acc, r) => ({ orders: acc.orders + r.orders, income: acc.income + r.income, hours: acc.hours + r.workHours, days: acc.days + 1 }),
      { orders: 0, income: 0, hours: 0, days: 0 }
    );
  }, [records, todayStr]);

  const streak = useMemo(() => {
    const todayDate = new Date(todayStr + "T00:00:00");
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (records[ds] && records[ds].orders > 0) s++;
      else if (s > 0) break;
    }
    return s;
  }, [records, todayStr]);

  const goal = settings.dailyGoal * 30;
  const monthly = predictMonthly(records, goal);
  const progress = goal > 0 ? Math.min((monthly.completed / goal) * 100, 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-mocha-400 font-medium">{formatDateFull(todayStr)}</p>
          <h1 className="text-2xl font-semibold text-mocha-800 mt-1">
            早安，<span className="font-display italic">{settings.nickname}</span>
          </h1>
        </div>
        <button
          onClick={() => navigate("/settings")}
          className="w-10 h-10 rounded-full bg-white border border-mocha-100 flex items-center justify-center text-mocha-500 shadow-soft hover:text-mocha-700"
        >
          <Settings size={18} />
        </button>
      </header>

      {/* Today Card */}
      <Card variant="blush" className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blush-100 rounded-full -translate-y-1/2 translate-x-1/2 opacity-60" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <CardTitle>今日战绩</CardTitle>
            <button
              onClick={() => setSheetOpen(true)}
              className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-mocha-600 hover:bg-white transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="mt-4">
            <AnimatedNumber
              value={todayRecord?.orders || 0}
              className="text-5xl font-semibold text-mocha-800 tracking-tight"
            />
            <span className="text-mocha-500 ml-2">单</span>
          </div>
          <div className="flex gap-6 mt-4 text-sm">
            <div>
              <p className="text-mocha-400">收入</p>
              <p className="font-semibold text-mocha-700">{formatCurrency(todayRecord?.income || 0)}</p>
            </div>
            <div>
              <p className="text-mocha-400">工时</p>
              <p className="font-semibold text-mocha-700">{todayRecord?.workHours || 0}h</p>
            </div>
            <div>
              <p className="text-mocha-400">天气</p>
              <p className="font-semibold text-mocha-700">{todayRecord?.weather ? { sunny: "☀️", cloudy: "☁️", rainy: "🌧️", snowy: "❄️", windy: "🌬️" }[todayRecord.weather] : "-"}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Monthly Progress */}
      <Card variant="gold">
        <div className="flex items-center justify-between">
          <CardTitle>本月进度</CardTitle>
          <span className="text-xs font-medium text-mocha-400">目标 {goal} 单</span>
        </div>
        <div className="mt-4">
          <div className="flex items-end justify-between mb-2">
            <div>
              <AnimatedNumber value={monthly.completed} className="text-3xl font-semibold text-mocha-800" />
              <span className="text-mocha-500 text-sm ml-1">单</span>
            </div>
            <span className="text-lg font-medium text-gold-500">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 bg-mocha-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold-300 to-gold-400 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-mocha-400 mt-2">
            预计完成 {monthly.predicted} 单 · 剩余日均需 {monthly.dailyNeeded} 单
          </p>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card variant="sage">
          <CardTitle>连续开工</CardTitle>
          <div className="mt-3">
            <AnimatedNumber value={streak} className="text-3xl font-semibold text-mocha-800" />
            <span className="text-mocha-500 text-sm ml-1">天</span>
          </div>
        </Card>
        <Card variant="ocean">
          <CardTitle>本月收入</CardTitle>
          <div className="mt-3">
            <span className="text-3xl font-semibold text-mocha-800">{formatCurrency(monthStats.income)}</span>
          </div>
        </Card>
      </div>

      {/* Weekly Mini Chart */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>近7天</CardTitle>
          <button onClick={() => navigate("/records")} className="text-xs text-mocha-400 flex items-center hover:text-mocha-600">
            全部 <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex items-end justify-between h-28 gap-2">
          {weekdays.map((date) => {
            const record = records[date];
            const max = Math.max(...weekdays.map((d) => records[d]?.orders || 0), 1);
            const height = max > 0 ? ((record?.orders || 0) / max) * 100 : 0;
            const isToday = date === todayStr;
            return (
              <div key={date} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className={cn(
                    "w-full max-w-[36px] rounded-t-xl transition-all duration-500",
                    isToday ? "bg-blush-300" : "bg-mocha-100"
                  )}
                  style={{ height: `${Math.max(height, 8)}%` }}
                />
                <span className={cn("text-[10px] mt-2 font-medium", isToday ? "text-blush-500" : "text-mocha-400")}>
                  {getDayOfWeek(date).replace("周", "")}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <RecordSheet
        date={todayStr}
        record={todayRecord}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={(r) => updateRecord(todayStr, r)}
      />
    </div>
  );
}
