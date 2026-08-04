import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Target, Trophy, Calendar, Edit3, CheckCircle, Briefcase, RotateCcw, ChevronRight, Activity } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import ProgressRing from "@/components/shared/ProgressRing";
import Confetti from "@/components/shared/Confetti";
import { showToast } from "@/components/shared/Toast";
import { getCurrentMonth, daysInCurrentMonth, daysRemainingInMonth, getUpcomingShifts, getWeekStart, getBaseShiftForDate, getShiftForDate, getWeekShiftDays } from "@/utils/date";
import { predictMonthlyAI, analyzeShiftPerformance } from "@/utils/aiPrediction";
import BottomSheet from "@/components/shared/BottomSheet";
import { SHIFT_DEFINITIONS, SHIFT_MAP, type ShiftType } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.005 } },
};

const child = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.08, ease: [0.25, 0.1, 0.25, 1] } },
};

function getProgressColor(pct: number): string {
  if (pct >= 80) return "#00E676";
  if (pct >= 50) return "#FFD740";
  return "#00E5FF";
}

export default function Goals() {
  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const resetData = useStore((s) => s.resetData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [shiftSheetOpen, setShiftSheetOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const [form, setForm] = useState({ ...settings });

  const { year, month } = getCurrentMonth();
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthRecords = Object.values(records).filter((r) => r.date.startsWith(prefix));
  const monthOrders = monthRecords.reduce((s, r) => s + r.orders, 0);

  const goalProgress = settings.monthlyGoal > 0
    ? Math.min(Math.round((monthOrders / settings.monthlyGoal) * 100), 100)
    : 0;

  const prediction = useMemo(
    () => predictMonthlyAI(records, settings),
    [records, settings]
  );

  const remaining = daysRemainingInMonth();
  const total = daysInCurrentMonth();
  const dailyNeeded = prediction.dailyNeeded;

  const upcomingShifts = useMemo(
    () => getUpcomingShifts(settings, 4),
    [settings]
  );

  const shiftPerformance = useMemo(
    () => analyzeShiftPerformance(records, settings),
    [records, settings]
  );

  const thisMonday = getWeekStart();
  const currentWeekShift = useMemo(
    () => getShiftForDate(thisMonday, settings),
    [thisMonday, settings]
  );
  const baseThisWeekShift = useMemo(
    () => getBaseShiftForDate(thisMonday, settings),
    [thisMonday, settings]
  );

  const openShiftSheet = (weekStart: string) => {
    setSelectedWeek(weekStart);
    setShiftSheetOpen(true);
  };

  const applyShift = (shiftType: ShiftType) => {
    if (!selectedWeek) return;
    const weeklyShifts = { ...(settings.weeklyShifts || {}), [selectedWeek]: shiftType };
    updateSettings({ weeklyShifts });
    showToast("班次已更新", "success");
    setShiftSheetOpen(false);
  };

  const clearShiftOverride = (weekStart: string) => {
    const weeklyShifts = { ...(settings.weeklyShifts || {}) };
    delete weeklyShifts[weekStart];
    updateSettings({ weeklyShifts });
    showToast("已恢复自动轮换", "info");
  };

  const progressColor = getProgressColor(goalProgress);

  const openSheet = () => {
    setForm({
      ...settings,
      // 编辑目标里编辑的是「轮换基准」，因此用基础班次（忽略本周临时覆盖）
      currentShift: baseThisWeekShift.type,
      shiftStartDate: settings.shiftStartDate || thisMonday,
    });
    setSheetOpen(true);
  };

  const handleSave = () => {
    updateSettings(form);
    showToast("目标设置已保存", "success");
    setSheetOpen(false);

    if (goalProgress >= 100 && !showConfetti) {
      setShowConfetti(true);
    }
  };

  const achieved = goalProgress >= 100;

  return (
    <motion.div
      className="px-4 pt-6 pb-4 space-y-5"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Header */}
      <motion.div variants={child} className="flex items-center justify-between">
        <div>
          <p className="terminal-text text-sm tracking-tight">目标追踪</p>
          <h1 className="text-2xl font-bold text-[#E0E0E0] neon-cyan tracking-[-0.01em]">{year}年{month}月</h1>
        </div>
        <button
          onClick={openSheet}
          className="tap-cyber flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "0.5px solid rgba(255,255,255,0.06)",
          }}
        >
          <Edit3 size={16} className="text-[#E0E0E0]/60" />
          <span className="text-[#E0E0E0]/60 text-sm">编辑目标</span>
        </button>
      </motion.div>

      {/* Progress Ring */}
      <motion.div
        variants={child}
        className="holo-card rounded-[32px] p-6 flex flex-col items-center"
      >
        <ProgressRing
          progress={goalProgress}
          size={200}
          strokeWidth={12}
          color={progressColor}
          bgColor="rgba(255,255,255,0.06)"
        >
          <div className="text-center">
            <AnimatedNumber
              value={goalProgress}
              suffix="%"
              className="text-4xl font-bold text-[#E0E0E0] tabular-nums"
            />
            <p className="terminal-text text-xs mt-1">月度目标</p>
          </div>
        </ProgressRing>

        {achieved && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-[#00E676]/20 border border-[#00E676]/30"
          >
            <Trophy size={18} className="text-[#00E676]" />
            <span className="text-[#00E676] font-semibold text-sm">目标达成！</span>
          </motion.div>
        )}
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={child} className="grid grid-cols-2 gap-3">
        <div className="holo-card rounded-[26px] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-[#FFD740] icon-glow-gold drop-shadow-[0_0_6px_rgba(255,215,64,0.25)]" />
            <span className="terminal-text text-xs tracking-tight">目标单量</span>
          </div>
          <AnimatedNumber
            value={settings.monthlyGoal}
            className="text-2xl font-bold text-[#E0E0E0] tabular-nums neon-cyan"
          />
          <span className="text-[#E0E0E0]/60 text-sm ml-1">单</span>
        </div>

        <div className="holo-card rounded-[26px] p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-[#00E676] drop-shadow-[0_0_6px_rgba(0,230,118,0.25)]" />
            <span className="terminal-text text-xs tracking-tight">已完成</span>
          </div>
          <AnimatedNumber
            value={monthOrders}
            className="text-2xl font-bold text-[#E0E0E0] tabular-nums neon-cyan"
          />
          <span className="text-[#E0E0E0]/60 text-sm ml-1">单</span>
        </div>

        <div className="holo-card rounded-[26px] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-[#00E5FF] icon-glow-cyan drop-shadow-[0_0_6px_rgba(0,229,255,0.25)]" />
            <span className="terminal-text text-xs tracking-tight">剩余天数</span>
          </div>
          <span className="text-2xl font-bold text-[#E0E0E0] neon-cyan">{remaining}</span>
          <span className="text-[#E0E0E0]/60 text-sm ml-1">/ {total} 天</span>
        </div>

        <div className="holo-card rounded-[26px] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={16} className="text-[#E040FB] drop-shadow-[0_0_6px_rgba(224,64,251,0.25)]" />
            <span className="terminal-text text-xs tracking-tight">每日需完成</span>
          </div>
          <span className="text-2xl font-bold text-[#E0E0E0] neon-cyan">{dailyNeeded}</span>
          <span className="text-[#E0E0E0]/60 text-sm ml-1">单</span>
        </div>
      </motion.div>

      {/* Progress Bar */}
      <motion.div variants={child} className="holo-card rounded-[26px] p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="cyber-section-title text-sm tracking-tight">进度</span>
          <span className="text-[#E0E0E0]/80 text-sm font-medium">{goalProgress}%</span>
        </div>
        <div className="progress-cyber">
          <motion.div
            className="progress-cyber-fill"
            initial={{ width: 0 }}
            animate={{ width: `${goalProgress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[#E0E0E0]/30 text-xs">0</span>
          <span className="text-[#E0E0E0]/30 text-xs">{settings.monthlyGoal} 单</span>
        </div>
      </motion.div>

      {/* 班次管理 */}
      <motion.div variants={child} className="holo-card rounded-[26px] p-5 neon-flicker corner-brackets">
        <div className="flex items-center justify-between mb-4">
          <h3 className="cyber-section-title text-sm tracking-tight">
            <Briefcase size={16} className="icon-glow-cyan" />
            班次管理
          </h3>
          <span className="text-[#E0E0E0]/30 text-[10px] terminal-text">每周一自动轮换 · 可临时覆盖</span>
        </div>

        {/* 当前班次高亮 */}
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-[#00E5FF]/10 via-[#E040FB]/5 to-[#00E5FF]/5 border border-[#00E5FF]/20 holo-shimmer relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: `linear-gradient(135deg, ${currentWeekShift.color}20, ${currentWeekShift.color}08)`, border: `1px solid ${currentWeekShift.color}40` }}>
                {currentWeekShift.emoji}
              </div>
              <div>
                <p className="text-[#E0E0E0] font-bold text-base">{currentWeekShift.name}</p>
                <p className="terminal-text text-[10px]">{currentWeekShift.timeRange}</p>
                {currentWeekShift.restTime && (
                  <p className="text-[#E0E0E0]/25 text-[9px] mt-0.5">休息 {currentWeekShift.restTime}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[#00E5FF] text-xs font-medium terminal-text">本周班次</p>
              <p className="text-[#E0E0E0]/30 text-[10px]">{thisMonday.slice(5).replace("-", "/")} 起</p>
              {upcomingShifts[0]?.isOverride && <span className="text-[10px] text-[#FFD740]">已自定义</span>}
            </div>
          </div>
        </div>

        {/* 未来两周班次日历 */}
        <div className="space-y-4">
          {upcomingShifts.slice(0, 2).map((item, idx) => {
            const isCurrentWeek = idx === 0;
            const weekDays = getWeekShiftDays(item.weekStart, settings);
            return (
              <div
                key={item.weekStart}
                className={`p-3 rounded-xl ${
                  isCurrentWeek ? "bg-[#00E5FF]/8 border border-[#00E5FF]/15" : "bg-[#E0E0E0]/4"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.shift.emoji}</span>
                    <p className="text-[#E0E0E0] text-sm font-medium">
                      {isCurrentWeek ? "本周" : "下周"} · {item.shift.name}
                    </p>
                    {item.isOverride && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FFD740]/10 text-[#FFD740] border border-[#FFD740]/20">已覆盖</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {item.isOverride && (
                      <button
                        onClick={() => clearShiftOverride(item.weekStart)}
                        className="p-1.5 rounded-lg text-[#E0E0E0]/40 hover:text-[#E0E0E0] hover:bg-[#E0E0E0]/5"
                        title="恢复自动轮换"
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => openShiftSheet(item.weekStart)}
                      className="tap-cyber flex items-center gap-1 px-2 py-1 rounded-lg text-[#00E5FF]/70 hover:text-[#00E5FF] hover:bg-[#00E5FF]/10 text-[10px] transition-colors"
                    >
                      调整 <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day) => (
                    <div key={day.date} className="flex flex-col items-center gap-1 p-1.5 rounded-lg bg-[#020408]/40">
                      <span className="text-[9px] text-[#E0E0E0]/30">{day.dayLabel}</span>
                      <span className="text-xs">{day.shift.emoji}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* 轮换说明 */}
        <div className="mt-4 p-3 rounded-xl bg-[#E0E0E0]/4 border border-[#E0E0E0]/5">
          <p className="text-[#E0E0E0]/30 text-[10px] leading-relaxed">
            轮换顺序：早中班 → 早班 → 晚中班 → 晚班 → 大夜班。每周一自动推进，点击「调整」可临时覆盖任意一周。
          </p>
        </div>
      </motion.div>

      {/* 班次表现分析 */}
      {shiftPerformance.some(s => s.sampleDays >= 3) && (
        <motion.div variants={child} className="holo-card rounded-[26px] p-5 corner-brackets">
          <div className="flex items-center justify-between mb-4">
            <h3 className="cyber-section-title text-sm tracking-tight">
              <Activity size={16} className="icon-glow-cyan" />
              班次效率分析
            </h3>
            <span className="text-[#E0E0E0]/30 text-[10px] terminal-text">基于历史数据</span>
          </div>
          <div className="space-y-2">
            {shiftPerformance.slice(0, 3).map((s, idx) => {
              const shiftColor = SHIFT_MAP[s.shift].color;
              return (
                <div key={s.shift} className="flex items-center justify-between p-3 rounded-xl bg-[#E0E0E0]/5 border border-[#E0E0E0]/5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ background: `${shiftColor}15`, border: `1px solid ${shiftColor}35` }}>
                      {SHIFT_MAP[s.shift].emoji}
                    </div>
                    <div>
                      <p className="text-[#E0E0E0] text-sm font-medium">
                        {s.name}
                        {idx === 0 && <span className="ml-1.5 text-[10px] text-[#00E676]">最适合你</span>}
                      </p>
                      <p className="text-[#E0E0E0]/40 text-[10px]">
                        日均 {s.avgOrders} 单 · {s.avgEfficiency > 0 ? `${s.avgEfficiency} 单/时` : "暂无工时数据"} · {s.sampleDays} 天样本
                      </p>
                    </div>
                  </div>
                  <div className="text-right min-w-[48px]">
                    <p className="font-bold text-sm" style={{ color: shiftColor }}>{s.score}</p>
                    <p className="text-[#E0E0E0]/30 text-[10px]">分</p>
                    <div className="progress-cyber h-1 mt-1"><div className="progress-cyber-fill" style={{ width: `${s.score}%`, background: shiftColor }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* 班次选择 Bottom Sheet */}
      <BottomSheet isOpen={shiftSheetOpen} onClose={() => setShiftSheetOpen(false)} title="设置本周班次">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-[#00E5FF]/5 border border-[#00E5FF]/10">
            <p className="text-[#E0E0E0]/50 text-xs">
              为 <span className="text-[#00E5FF] font-medium">{selectedWeek?.slice(5).replace("-", "/")}</span> 所在周选择班次，覆盖自动轮换。
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {SHIFT_DEFINITIONS.map((shift) => {
              const isSelected = selectedWeek && settings.weeklyShifts?.[selectedWeek] === shift.type;
              return (
                <button
                  key={shift.type}
                  onClick={() => applyShift(shift.type)}
                  className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    isSelected
                      ? "bg-[#00E5FF]/10 border border-[#00E5FF]/30"
                      : "bg-[#E0E0E0]/5 hover:bg-[#00E5FF]/8 border border-transparent"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: `${shift.color}18`, border: `1px solid ${shift.color}40` }}>
                    {shift.emoji}
                  </div>
                  <div className="flex-1">
                    <p className="text-[#E0E0E0] text-sm font-medium">{shift.name}</p>
                    <p className="text-[#E0E0E0]/40 text-xs">{shift.timeRange}</p>
                  </div>
                  {isSelected && <CheckCircle size={18} className="text-[#00E5FF]" />}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>

      {/* Bottom Sheet */}
      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="目标设置">
        <div className="space-y-4">
          <div>
            <label className="block terminal-text text-sm mb-1.5">骑手名称</label>
            <input
              type="text"
              value={form.riderName}
              onChange={(e) => setForm((f) => ({ ...f, riderName: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] placeholder-[#E0E0E0]/20 transition-colors"
              placeholder="输入名称"
            />
          </div>

          <div>
            <label className="block terminal-text text-sm mb-1.5">月度目标单量</label>
            <input
              type="number"
              value={form.monthlyGoal}
              onChange={(e) => setForm((f) => ({ ...f, monthlyGoal: Number(e.target.value) }))}
              className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] placeholder-[#E0E0E0]/20 transition-colors"
              min={1}
            />
          </div>

          <div>
            <label className="block terminal-text text-sm mb-1.5">每日目标单量</label>
            <input
              type="number"
              value={form.dailyGoal}
              onChange={(e) => setForm((f) => ({ ...f, dailyGoal: Number(e.target.value) }))}
              className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] placeholder-[#E0E0E0]/20 transition-colors"
              min={1}
            />
          </div>

          <div>
            <label className="block terminal-text text-sm mb-1.5">基础单价 (¥)</label>
            <input
              type="number"
              step="0.1"
              value={form.basePrice}
              onChange={(e) => setForm((f) => ({ ...f, basePrice: Number(e.target.value) }))}
              className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] placeholder-[#E0E0E0]/20 transition-colors"
              min={0}
            />
          </div>

          <div>
            <label className="block terminal-text text-sm mb-1.5">奖励单价 (¥) — 月达{form.bonusThreshold}单触发</label>
            <input
              type="number"
              step="0.1"
              value={form.bonusPrice}
              onChange={(e) => setForm((f) => ({ ...f, bonusPrice: Number(e.target.value) }))}
              className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] placeholder-[#E0E0E0]/20 transition-colors"
              min={0}
            />
          </div>

          <div>
            <label className="block terminal-text text-sm mb-1.5">奖励触发阈值 (单)</label>
            <input
              type="number"
              value={form.bonusThreshold}
              onChange={(e) => setForm((f) => ({ ...f, bonusThreshold: Number(e.target.value) }))}
              className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] placeholder-[#E0E0E0]/20 transition-colors"
              min={0}
            />
          </div>

          <div>
            <label className="block terminal-text text-sm mb-1.5">每周工作天数</label>
            <div className="flex gap-2">
              {[5, 6, 7].map((day) => (
                <button
                  key={day}
                  onClick={() => setForm((f) => ({ ...f, workDaysPerWeek: day }))}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    form.workDaysPerWeek === day
                      ? "bg-[#00E5FF] text-[#020408]"
                      : "holo-card rounded-xl text-[#E0E0E0]/60 hover:border-[#E0E0E0]/30"
                  }`}
                >
                  {day} 天
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block terminal-text text-sm mb-1.5">轮换基准班次</label>
            <p className="text-[#E0E0E0]/30 text-[10px] mb-2">
              选择本周的基础班次作为轮换起点，系统按 5 班制每 7 天自动轮换。上方「班次管理」可对任意单周临时覆盖，不影响整体轮换。
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {SHIFT_DEFINITIONS.map((shift) => (
                <button
                  key={shift.type}
                  onClick={() => setForm((f) => ({
                    ...f,
                    currentShift: shift.type as ShiftType,
                    shiftStartDate: thisMonday,
                  }))}
                  className={`py-2.5 rounded-xl text-center transition-all ${
                    form.currentShift === shift.type
                      ? "bg-[#00E5FF] text-[#020408] shadow-lg shadow-[#00E5FF]/20"
                      : "holo-card text-[#E0E0E0]/50 hover:text-[#E0E0E0]/80"
                  }`}
                >
                  <div className="text-lg">{shift.emoji}</div>
                  <div className="text-[10px] mt-0.5 font-medium">{shift.name}</div>
                </button>
              ))}
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleSave}
            className="w-full py-3.5 rounded-xl bg-[#00E5FF] text-[#020408] font-bold text-base mt-2"
          >
            保存设置
          </motion.button>

          <button
            onClick={() => {
              if (confirm("确定要清空所有记录吗？此操作不可恢复！")) {
                resetData();
                showToast("所有数据已清空", "info");
                setSheetOpen(false);
              }
            }}
            className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium mt-3"
          >
            清空所有数据
          </button>
        </div>
      </BottomSheet>
    </motion.div>
  );
}