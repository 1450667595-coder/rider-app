import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Target, Trophy, Calendar, Edit3, CheckCircle } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import ProgressRing from "@/components/shared/ProgressRing";
import Confetti from "@/components/shared/Confetti";
import { showToast } from "@/components/shared/Toast";
import { getCurrentMonth, daysInCurrentMonth, daysRemainingInMonth } from "@/utils/date";
import { predictMonthlyAI } from "@/utils/aiPrediction";
import BottomSheet from "@/components/shared/BottomSheet";
import { SHIFT_DEFINITIONS, type ShiftType } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.015 } },
};

const child = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] } },
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

  const progressColor = getProgressColor(goalProgress);

  const openSheet = () => {
    setForm({ ...settings });
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
        <div className="h-3 rounded-full bg-[#E0E0E0]/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #00E5FF, #E040FB)" }}
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
            <label className="block terminal-text text-sm mb-1.5">当前班次</label>
            <div className="grid grid-cols-5 gap-1.5">
              {SHIFT_DEFINITIONS.map((shift) => (
                <button
                  key={shift.type}
                  onClick={() => setForm((f) => ({ ...f, currentShift: shift.type as ShiftType }))}
                  className={`py-2.5 rounded-xl text-center transition-all ${
                    (form.currentShift || settings.currentShift) === shift.type
                      ? "bg-[#00E5FF] text-[#020408] shadow-lg shadow-[#00E5FF]/20"
                      : "holo-card text-[#E0E0E0]/50 hover:text-[#E0E0E0]/80"
                  }`}
                >
                  <div className="text-lg">{shift.emoji}</div>
                  <div className="text-[10px] mt-0.5 font-medium">{shift.name}</div>
                </button>
              ))}
            </div>
            <p className="text-[#E0E0E0]/30 text-[10px] mt-1">点击左右箭头可在仪表盘快速切换</p>
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