import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import useStore from "@/store/useStore";
import { Card, CardTitle } from "@/components/shared/Card";
import RecordSheet from "@/components/shared/RecordSheet";
import { formatCurrency, cn } from "@/lib/utils";
import { getMonthDateRange, getCurrentMonth, formatDate, getDayOfWeek, today } from "@/utils/date";
import type { DailyRecord } from "@/types";

export default function Records() {
  const records = useStore((s) => s.records);
  const updateRecord = useStore((s) => s.updateRecord);
  const removeRecord = useStore((s) => s.removeRecord);

  const [yearMonth, setYearMonth] = useState(getCurrentMonth());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dateRange = useMemo(
    () => getMonthDateRange(yearMonth.year, yearMonth.month),
    [yearMonth]
  );

  const firstDayOffset = useMemo(() => {
    const first = new Date(dateRange[0] + "T00:00:00").getDay();
    return first === 0 ? 6 : first - 1;
  }, [dateRange]);

  const monthStats = useMemo(() => {
    return Object.values(records)
      .filter((r) => r.date.startsWith(`${yearMonth.year}-${String(yearMonth.month).padStart(2, "0")}`))
      .reduce((acc, r) => ({ orders: acc.orders + r.orders, income: acc.income + r.income }), { orders: 0, income: 0 });
  }, [records, yearMonth]);

  const openDate = (date: string) => {
    setSelectedDate(date);
    setSheetOpen(true);
  };

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
        <h1 className="text-2xl font-semibold text-mocha-800">打卡日历</h1>
        <p className="text-sm text-mocha-400 mt-1">记录每一天的努力</p>
      </header>

      <Card variant="blush">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{yearMonth.year}年{yearMonth.month}月</CardTitle>
            <p className="text-sm text-mocha-500 mt-1">{monthStats.orders} 单 · {formatCurrency(monthStats.income)}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className="w-9 h-9 rounded-full bg-white border border-mocha-100 flex items-center justify-center text-mocha-500 hover:bg-mocha-50"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => changeMonth(1)}
              className="w-9 h-9 rounded-full bg-white border border-mocha-100 flex items-center justify-center text-mocha-500 hover:bg-mocha-50"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-7 gap-1 text-center mb-3">
          {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
            <span key={d} className="text-xs font-medium text-mocha-400">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {dateRange.map((date) => {
            const record = records[date];
            const hasData = record && record.orders > 0;
            const isToday = date === today();
            return (
              <button
                key={date}
                onClick={() => openDate(date)}
                className={cn(
                  "aspect-square rounded-2xl flex flex-col items-center justify-center text-xs transition-all relative",
                  isToday
                    ? "bg-mocha-800 text-white shadow-soft"
                    : hasData
                    ? "bg-blush-50 text-mocha-700 hover:bg-blush-100"
                    : "bg-mocha-50 text-mocha-400 hover:bg-mocha-100"
                )}
              >
                <span className="font-medium">{new Date(date + "T00:00:00").getDate()}</span>
                {hasData && (
                  <span className={cn("text-[9px] mt-0.5", isToday ? "text-white/80" : "text-blush-400")}>
                    {record.orders}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>最近记录</CardTitle>
        <div className="mt-4 space-y-3">
          {Object.values(records)
            .filter((r) => r.orders > 0)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 10)
            .map((r) => (
              <button
                key={r.date}
                onClick={() => openDate(r.date)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-mocha-50 hover:bg-mocha-100 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-mocha-700">{formatDate(r.date)} · {getDayOfWeek(r.date)}</p>
                  {r.note && <p className="text-xs text-mocha-400 mt-0.5 truncate max-w-[160px]">{r.note}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-mocha-800">{r.orders} 单</p>
                  <p className="text-xs text-mocha-400">{formatCurrency(r.income)}</p>
                </div>
              </button>
            ))}
          {Object.values(records).filter((r) => r.orders > 0).length === 0 && (
            <p className="text-sm text-mocha-400 text-center py-6">还没有记录，点击日历开始打卡</p>
          )}
        </div>
      </Card>

      {selectedDate && (
        <RecordSheet
          date={selectedDate}
          record={records[selectedDate]}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onSave={(r) => updateRecord(selectedDate, r)}
          onDelete={() => removeRecord(selectedDate)}
        />
      )}
    </div>
  );
}
