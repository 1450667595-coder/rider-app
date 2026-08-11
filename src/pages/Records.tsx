import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Edit3, Trash2, Coffee } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import BottomSheet from "@/components/shared/BottomSheet";
import { showToast } from "@/components/shared/Toast";
import { Weather, DailyRecord, WEATHER_OPTIONS } from "@/types";
import {
  fetchWeatherByCoords,
  fetchWeatherByCity,
  fetchWeatherForDate,
  weatherCodeToOurWeather,
  getUserLocation,
  searchCities,
} from "@/services/weather";
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
  show: { opacity: 1, transition: { staggerChildren: 0.005 } },
};

const item = {
  hidden: { opacity: 0, y: 2 },
  show: { opacity: 1, y: 0, transition: { duration: 0.08, ease: [0.25, 0.1, 0.25, 1] } },
};

export default function Records() {
  const records = useStore((s) => s.records);
  const saveRecord = useStore((s) => s.saveRecord);
  const deleteRecord = useStore((s) => s.deleteRecord);
  const getEffectivePrice = useStore((s) => s.getEffectivePrice);
  const city = useStore((s) => s.settings.city);
  const cityCoords = useStore((s) => s.settings.cityCoords);

  const [currentYear, setCurrentYear] = useState(getCurrentMonth().year);
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth().month);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<DailyRecord, "date">>({ ...EMPTY_RECORD });
  const [autoWeatherLoading, setAutoWeatherLoading] = useState(false);
  // 原始输入字符串，允许空值以便删除默认0后输入新数据
  const [ordersInput, setOrdersInput] = useState<string>("0");
  const [incomeInput, setIncomeInput] = useState<string>("0");
  const ordersInputRef = useRef<HTMLInputElement>(null);
  const fetchedDatesRef = useRef<Set<string>>(new Set());

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
    if (orders === 0) return { backgroundColor: "rgba(0,229,255,0.05)" };
    const opacity = 0.15 + (orders / maxOrders) * 0.65;
    return { backgroundColor: `rgba(0,229,255,${opacity})` };
  };

  const isToday = (d: string) => d === today();

  const openEditor = (date: string) => {
    const existing = records[date];
    const form = existing
      ? { orders: existing.orders, income: existing.income, workHours: existing.workHours, weather: existing.weather, note: existing.note, weatherDetail: existing.weatherDetail }
      : { ...EMPTY_RECORD };
    setEditForm(form);
    setOrdersInput(String(form.orders));
    setIncomeInput(String(form.income));
    setSelectedDate(date);
  };

  const closeEditor = () => setSelectedDate(null);

  // Auto-fetch weather for selected date (new records or records missing detail)
  useEffect(() => {
    if (!selectedDate) return;
    if (fetchedDatesRef.current.has(selectedDate)) return;
    const existing = records[selectedDate];
    if (existing?.weatherDetail) return;

    let cancelled = false;
    setAutoWeatherLoading(true);

    const resolveLatLon = async (): Promise<{ lat: number; lon: number } | null> => {
      if (cityCoords) return cityCoords;
      if (city) {
        const cities = await searchCities(city);
        if (cities.length > 0) return { lat: cities[0].lat, lon: cities[0].lon };
      }
      return await getUserLocation();
    };

    (async () => {
      try {
        const loc = await resolveLatLon();
        const lat = loc?.lat ?? 39.9;
        const lon = loc?.lon ?? 116.4;
        const todayStr = today();

        // 优先使用用户设置的城市（中国源更准确）
        if (selectedDate === todayStr) {
          const current = city
            ? await fetchWeatherByCity(city)
            : await fetchWeatherByCoords(lat, lon);
          if (!cancelled && current) {
            setEditForm((prev) => ({
              ...prev,
              weather: weatherCodeToOurWeather(current.weatherCode),
              weatherDetail: {
                temperature: current.temperature,
                weatherCode: current.weatherCode,
                weatherLabel: current.weatherLabel,
                weatherEmoji: current.weatherEmoji,
                windSpeed: current.windSpeed,
                humidity: current.humidity,
              },
            }));
          }
        } else {
          const dateWeather = await fetchWeatherForDate(lat, lon, selectedDate, city);
          if (!cancelled && dateWeather) {
            setEditForm((prev) => ({
              ...prev,
              weather: dateWeather.weatherType,
              weatherDetail: {
                temperature: Math.round((dateWeather.maxTemp + dateWeather.minTemp) / 2),
                weatherCode: dateWeather.weatherCode,
                weatherLabel: dateWeather.weatherLabel,
                weatherEmoji: dateWeather.weatherEmoji,
              },
            }));
          }
        }
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setAutoWeatherLoading(false);
        fetchedDatesRef.current.add(selectedDate);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedDate, records, city, cityCoords]);

  const handleSave = () => {
    if (!selectedDate) return;
    // 从当前输入框获取最新值（而非 editForm 中可能过时的值）
    const currentOrders = ordersInput === "" ? 0 : Number(ordersInput);
    const currentIncome = incomeInput === "" ? 0 : Number(incomeInput);
    saveRecord({
      date: selectedDate,
      orders: isNaN(currentOrders) ? 0 : currentOrders,
      income: isNaN(currentIncome) ? 0 : currentIncome,
      workHours: editForm.workHours,
      weather: editForm.weather,
      note: editForm.note,
      weatherDetail: editForm.weatherDetail,
    });
    showToast("记录已保存", "success");
    closeEditor();
  };

  const handleDelete = () => {
    if (!selectedDate) return;
    deleteRecord(selectedDate);
    showToast("记录已删除", "info");
    closeEditor();
  };

  const handleRest = () => {
    setEditForm((p) => ({ ...p, note: p.note === "休息" ? "" : "休息" }));
  };

  const todayStr = today();
  const todayRecord = records[todayStr];
  const isTodayUnrecorded =
    todayRecord &&
    todayRecord.orders === 0 &&
    todayRecord.income === 0 &&
    todayRecord.workHours === 0 &&
    todayRecord.note === "";

  const handleOrdersChange = (orders: number) => {
    setEditForm((p) => ({ ...p, orders, income: Math.round(orders * effectivePrice) }));
    setOrdersInput(String(orders));
    setIncomeInput(String(Math.round(orders * effectivePrice)));
  };

  const handleOrdersBlur = () => {
    // 失焦时：如果输入为空，保持空字符串（允许用户清空后重新输入）
    if (ordersInput === "") return;
    const num = Number(ordersInput);
    if (isNaN(num)) {
      setOrdersInput("");
      return;
    }
    handleOrdersChange(num);
  };

  return (
    <motion.div className="px-4 pt-6 pb-24 space-y-5" variants={container} initial="hidden" animate="show">
      {/* Month Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <button onClick={goToPrevMonth} className="flex items-center gap-1 px-3 py-2 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 active:bg-[#00E5FF]/20 tap-cyber">
          <ChevronLeft size={22} className="text-[#00E5FF] drop-shadow-[0_0_8px_rgba(0,229,255,0.6)]" />
          <span className="text-xs font-medium text-[#00E5FF]">上月</span>
        </button>
        <h2 className="text-xl font-bold text-[#E0E0E0] neon-cyan tracking-tight">{currentYear}年{currentMonth}月</h2>
        <button onClick={goToNextMonth} className="flex items-center gap-1 px-3 py-2 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 active:bg-[#00E5FF]/20 tap-cyber">
          <span className="text-xs font-medium text-[#00E5FF]">下月</span>
          <ChevronRight size={22} className="text-[#00E5FF] drop-shadow-[0_0_8px_rgba(0,229,255,0.6)]" />
        </button>
      </motion.div>

      {/* 今日未记录提示 */}
      {isTodayUnrecorded && (
        <motion.div variants={item} className="holo-card rounded-[26px] p-4 flex items-center justify-center gap-2 text-[#E0E0E0]/80">
          <span className="inline-block w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
          <span className="text-sm font-medium">今日跑单尚未结束，暂未记录</span>
        </motion.div>
      )}

      {/* Calendar Section */}
      <motion.div variants={item}>
        <h3 className="cyber-section-title mb-3">日历视图</h3>
        <div className="holo-card rounded-[26px] p-4">
          <div className="grid grid-cols-7 mb-3">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[#E0E0E0]/30 text-xs font-medium py-1 tracking-tight">{d}</div>
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
              const isRestDay = record?.note === "休息";
              const todayFlag = isToday(dateStr);
              return (
                <motion.button
                  key={dateStr}
                  onClick={() => openEditor(dateStr)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  className={`tap-cyber aspect-square rounded-xl flex flex-col items-center justify-center transition-colors ${todayFlag ? "ring-2 ring-[#00E5FF] ring-offset-1 ring-offset-[#020408]" : ""}`}
                  style={getHeatStyle(orders)}
                >
                  <span className={`text-xs font-medium ${todayFlag ? "text-[#00E5FF] drop-shadow-[0_0_6px_rgba(0,229,255,0.4)]" : orders > 0 ? "text-[#E0E0E0]" : "text-[#E0E0E0]/30"}`}>{day}</span>
                  {orders > 0 && <span className="text-[10px] text-[#E0E0E0]/55 font-semibold leading-none">{orders}</span>}
                  {isRestDay && <span className="text-[8px] text-[#E040FB]/60 leading-none">休</span>}
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Bottom Stats */}
      <motion.div variants={item}>
        <h3 className="cyber-section-title mb-3">月度统计</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="holo-card rounded-[26px] p-3 text-center">
            <p className="terminal-text text-xs mb-1 tracking-tight">本月累计单量</p>
            <AnimatedNumber value={monthStats.orders} className="text-xl font-bold text-[#E0E0E0] tabular-nums neon-cyan" />
            <span className="text-[#E0E0E0]/45 text-sm ml-0.5">单</span>
          </div>
          <div className="holo-card rounded-[26px] p-3 text-center">
            <p className="terminal-text text-xs mb-1 tracking-tight">本月累计收入</p>
            <AnimatedNumber value={monthStats.income} prefix="¥" className="text-xl font-bold text-[#E0E0E0] tabular-nums neon-cyan" />
          </div>
          <div className="holo-card rounded-[26px] p-3 text-center">
            <p className="terminal-text text-xs mb-1 tracking-tight">本月记录天数</p>
            <AnimatedNumber value={monthStats.recordDays} className="text-xl font-bold text-[#E0E0E0] tabular-nums neon-cyan" />
            <span className="text-[#E0E0E0]/45 text-sm ml-0.5">天</span>
          </div>
        </div>
      </motion.div>

      {/* Edit BottomSheet */}
      <BottomSheet isOpen={selectedDate !== null} onClose={closeEditor} title={selectedDate ? `编辑记录 ${formatDate(selectedDate)} 周${getDayOfWeek(selectedDate)}` : ""}>
        {selectedDate && (
          <div className="space-y-4 pb-20">
            {/* Orders */}
            <div>
              <label className="block terminal-text text-sm mb-2">单量</label>
              <div className="flex items-center gap-3">
                <button onClick={() => handleOrdersChange(Math.max(0, editForm.orders - 1))} className="btn-cyber w-10 h-10 rounded-full flex items-center justify-center">
                  <span className="text-[#E0E0E0] text-lg">−</span>
                </button>
                <input
                  ref={ordersInputRef}
                  type="number"
                  value={ordersInput}
                  onChange={(e) => setOrdersInput(e.target.value)}
                  onBlur={handleOrdersBlur}
                  onFocus={(e) => e.target.select()}
                  className="input-cyber text-center text-lg font-bold"
                />
                <button onClick={() => handleOrdersChange(editForm.orders + 1)} className="btn-cyber-primary w-10 h-10 rounded-full flex items-center justify-center">
                  <span className="text-[#020408] text-lg font-bold">+</span>
                </button>
              </div>
            </div>

            {/* Income */}
            <div>
              <label className="block terminal-text text-sm mb-2">收入 (¥)</label>
              <input type="number" value={editForm.income} onChange={(e) => setEditForm((p) => ({ ...p, income: Number(e.target.value) || 0 }))} className="input-cyber" />
            </div>

            {/* Work Hours */}
            <div>
              <label className="block terminal-text text-sm mb-2">工作时长 (小时)</label>
              <input type="number" step="0.5" value={editForm.workHours} onChange={(e) => setEditForm((p) => ({ ...p, workHours: Number(e.target.value) || 0 }))} className="input-cyber" />
            </div>

            {/* Weather */}
            <div>
              <label className="block terminal-text text-sm mb-2">
                天气
                {autoWeatherLoading && <span className="text-[#00E5FF]/60 text-xs ml-1 animate-pulse">⏳ 正在获取天气...</span>}
                {editForm.weatherDetail && !autoWeatherLoading && (
                  <span className="text-[#00E5FF]/80 text-xs ml-2">
                    已绑定 {editForm.weatherDetail.weatherEmoji} {editForm.weatherDetail.weatherLabel} {editForm.weatherDetail.temperature}°C
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {WEATHER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditForm((p) => ({ ...p, weather: opt.value }))}
                    className={`tap-cyber px-3 py-2 rounded-xl text-sm transition-all ${editForm.weather === opt.value ? "badge-cyber" : "text-[#E0E0E0]/45"}`}
                    style={editForm.weather !== opt.value ? { background: "rgba(0,229,255,0.04)", border: "0.5px solid rgba(0,229,255,0.06)" } : undefined}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block terminal-text text-sm mb-2">备注</label>
              <textarea value={editForm.note} onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))} rows={2} placeholder="输入备注..." className="input-cyber resize-none" />
            </div>

            {/* Action buttons inside BottomSheet */}
            <div className="flex gap-2 pt-4">
              <button onClick={handleDelete} className="btn-cyber-danger flex-1 py-3 rounded-xl flex items-center justify-center gap-1.5">
                <Trash2 size={15} />
                <span className="text-xs font-medium">删除</span>
              </button>
              <button
                onClick={handleRest}
                className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-1.5 border transition-colors ${
                  editForm.note === "休息"
                    ? "bg-[#FFD740]/20 text-[#FFD740] border-[#FFD740]/40"
                    : "bg-[#E0E0E0]/5 text-[#E0E0E0]/70 border-[#E0E0E0]/10 hover:bg-[#E0E0E0]/10"
                }`}
              >
                <Coffee size={15} />
                <span className="text-xs font-medium">{editForm.note === "休息" ? "已休息" : "休息"}</span>
              </button>
              <button onClick={handleSave} className="btn-cyber-primary flex-[1.5] py-3 rounded-xl font-bold flex items-center justify-center gap-1.5">
                <Edit3 size={15} />
                <span className="text-sm">保存</span>
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </motion.div>
  );
}