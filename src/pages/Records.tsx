import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Edit3, Trash2 } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import BottomSheet from "@/components/shared/BottomSheet";
import { showToast } from "@/components/shared/Toast";
import { Weather, DailyRecord, WEATHER_OPTIONS, WEATHER_LABELS } from "@/types";
import {
  today,
  getCurrentMonth,
  getDaysInMonth,
  getFirstDayOfMonth,
  formatDate,
  getDayOfWeek,
} from "@/utils/date";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const EMPTY_RECORD: Omit<DailyRecord, "date"> = {
  orders: 0,
  income: 0,
  workHours: 0,
  weather: "sunny" as Weather,
  note: "",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function Records() {
  const records = useStore((s) => s.records);
  const saveRecord = useStore((s) => s.saveRecord);
  const deleteRecord = useStore((s) => s.deleteRecord);
  const getEffectivePrice = useStore((s) => s.getEffectivePrice);

  const [currentYear, setCurrentYear] = useState(getCurrentMonth().year);
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth().month);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<DailyRecord, "date">>({ ...EMPTY_RECORD });

  const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  const monthRecords = useMemo(() => {
    return Object.values(records)
      .filter((r) => r.date.startsWith(monthPrefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [records, monthPrefix]);

  const monthOrders = useMemo(
    () => monthRecords.reduce((s, r) => s + r.orders, 0),
    [monthRecords]
  );
  const effectivePrice = getEffectivePrice(monthOrders);

  const monthStats = useMemo(() => {
    const orders = monthRecords.reduce((s, r) => s + r.orders, 0);
    const income = monthRecords.reduce((s, r) => s + r.income, 0);
    const recordDays = monthRecords.filter((r) => r.orders > 0).length;
    return { orders, income, recordDays };
  }, [monthRecords]);

  const maxOrders = useMemo(
    () => Math.max(...monthRecords.map((r) => r.orders), 1),
    [monthRecords],
  );

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfMonth(currentYear, currentMonth);

  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const getHeatStyle = (orders: number): React.CSSProperties => {
    if (orders === 0) return { backgroundColor: "rgba(255,255,255,0.05)" };
    const opacity = 0.15 + (orders / maxOrders) * 0.65;
    return { backgroundColor: `rgba(255,209,0,${opacity})` };
  };

  const isToday = (d: string) => d === today();

  const openEditor = (date: string) => {
    const existing = records[date];
    setEditForm(existing ? { orders: existing.orders, income: existing.income, workHours: existing.workHours, weather: existing.weather, note: existing.note } : { ...EMPTY_RECORD });
    setSelectedDate(date);
  };

  const closeEditor = () => setSelectedDate(null);

  const handleSave = () => {
    if (!selectedDate) return;
    saveRecord({ date: selectedDate, ...editForm });
    showToast("记录已保存", "success");
    closeEditor();
  };

  const handleDelete = () => {
    if (!selectedDate) return;
    deleteRecord(selectedDate);
    showToast("记录已删除", "info");
    closeEditor();
  };

  const handleOrdersChange = (orders: number) => {
    setEditForm((p) => ({ ...p, orders, income: Math.round(orders * effectivePrice) }));
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FFD100]/50";

  return (
    <motion.div className="px-4 pt-6 pb-24 space-y-5" variants={container} initial="hidden" animate="show">
      {/* Month Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <button onClick={goToPrevMonth} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
          <ChevronLeft size={20} className="text-white/60" />
        </button>
        <h2 className="text-xl font-bold text-white">{currentYear}年{currentMonth}月</h2>
        <button onClick={goToNextMonth} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
          <ChevronRight size={20} className="text-white/60" />
        </button>
      </motion.div>

      {/* Calendar Grid */}
      <motion.div variants={item} className="glass rounded-2xl p-4">
        <div className="grid grid-cols-7 mb-3">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-white/40 text-xs font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${monthPrefix}-${String(day).padStart(2, "0")}`;
            const record = records[dateStr];
            const orders = record?.orders || 0;
            const todayFlag = isToday(dateStr);
            return (
              <motion.button
                key={dateStr}
                onClick={() => openEditor(dateStr)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-colors ${todayFlag ? "ring-2 ring-[#FFD100] ring-offset-1 ring-offset-[#16213E]" : ""}`}
                style={getHeatStyle(orders)}
              >
                <span className={`text-xs font-medium ${todayFlag ? "text-[#FFD100]" : orders > 0 ? "text-white" : "text-white/40"}`}>{day}</span>
                {orders > 0 && <span className="text-[10px] text-white/70 font-semibold leading-none">{orders}</span>}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Bottom Stats */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-3 text-center">
          <p className="text-white/40 text-xs mb-1">本月累计单量</p>
          <AnimatedNumber value={monthStats.orders} className="text-xl font-bold text-white tabular-nums" />
          <span className="text-white/60 text-sm ml-0.5">单</span>
        </div>
        <div className="glass rounded-2xl p-3 text-center">
          <p className="text-white/40 text-xs mb-1">本月累计收入</p>
          <AnimatedNumber value={monthStats.income} prefix="¥" className="text-xl font-bold text-white tabular-nums" />
        </div>
        <div className="glass rounded-2xl p-3 text-center">
          <p className="text-white/40 text-xs mb-1">本月记录天数</p>
          <AnimatedNumber value={monthStats.recordDays} className="text-xl font-bold text-white tabular-nums" />
          <span className="text-white/60 text-sm ml-0.5">天</span>
        </div>
      </motion.div>

      {/* Edit BottomSheet */}
      <BottomSheet isOpen={selectedDate !== null} onClose={closeEditor} title={selectedDate ? `${formatDate(selectedDate)} 周${getDayOfWeek(selectedDate)}` : ""}>
        {selectedDate && (
          <div className="space-y-4">
            {/* Orders */}
            <div>
              <label className="block text-white/60 text-sm mb-2">单量</label>
              <div className="flex items-center gap-3">
                <button onClick={() => handleOrdersChange(Math.max(0, editForm.orders - 1))} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <span className="text-white text-lg">−</span>
                </button>
                <input type="number" value={editForm.orders} onChange={(e) => handleOrdersChange(Number(e.target.value) || 0)} className={`${inputClass} text-center text-lg font-bold`} />
                <button onClick={() => handleOrdersChange(editForm.orders + 1)} className="w-10 h-10 rounded-full bg-[#FFD100] hover:bg-[#FFE44D] flex items-center justify-center transition-colors">
                  <span className="text-[#0F0F23] text-lg font-bold">+</span>
                </button>
              </div>
            </div>

            {/* Income */}
            <div>
              <label className="block text-white/60 text-sm mb-2">收入 (¥)</label>
              <input type="number" value={editForm.income} onChange={(e) => setEditForm((p) => ({ ...p, income: Number(e.target.value) || 0 }))} className={inputClass} />
            </div>

            {/* Work Hours */}
            <div>
              <label className="block text-white/60 text-sm mb-2">工作时长 (小时)</label>
              <input type="number" step="0.5" value={editForm.workHours} onChange={(e) => setEditForm((p) => ({ ...p, workHours: Number(e.target.value) || 0 }))} className={inputClass} />
            </div>

            {/* Weather */}
            <div>
              <label className="block text-white/60 text-sm mb-2">天气</label>
              <div className="flex flex-wrap gap-2">
                {WEATHER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditForm((p) => ({ ...p, weather: opt.value }))}
                    className={`px-3 py-2 rounded-xl text-sm transition-all ${editForm.weather === opt.value ? "bg-[#FFD100]/20 border border-[#FFD100]/50 text-white" : "bg-white/5 border border-white/10 text-white/60"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-white/60 text-sm mb-2">备注</label>
              <textarea value={editForm.note} onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))} rows={3} placeholder="输入备注..." className={`${inputClass} resize-none`} />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={handleDelete} className="flex-1 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
                <Trash2 size={16} />
                <span className="text-sm font-medium">删除</span>
              </button>
              <button onClick={handleSave} className="flex-[2] py-3 rounded-xl bg-[#FFD100] hover:bg-[#FFE44D] text-[#0F0F23] font-bold transition-colors flex items-center justify-center gap-2">
                <Edit3 size={16} />
                <span>保存</span>
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </motion.div>
  );
}