import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Target, Trophy, Calendar, Edit3, CheckCircle, Briefcase, RotateCcw, ChevronRight, Activity, Cloud, Brain, Copy, Sparkles, Wifi, WifiOff, Lock } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import ProgressRing from "@/components/shared/ProgressRing";
import Confetti from "@/components/shared/Confetti";
import { showToast } from "@/components/shared/Toast";
import { getCurrentMonth, daysInCurrentMonth, daysRemainingInMonth, getUpcomingShifts, getWeekStart, getBaseShiftForDate, getShiftForDate, getWeekShiftDays } from "@/utils/date";
import {
  predictMonthlyAI,
  analyzeShiftPerformance,
  predictMonthlyAIWithNetworkWeather,
  predictWeeklyAIWithNetworkWeather,
  predictTomorrowAIWithNetworkWeather,
  fetchNetworkWeatherForecast,
  generateLLMPredictionPrompt,
  callLLMPrediction,
  type NetworkWeatherForecast,
} from "@/utils/aiPrediction";
import BottomSheet from "@/components/shared/BottomSheet";
import { SHIFT_DEFINITIONS, SHIFT_MAP, type ShiftType, WEATHER_LABELS } from "@/types";

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
  const lockShift = useStore((s) => s.lockShift);
  const unlockShift = useStore((s) => s.unlockShift);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [shiftSheetOpen, setShiftSheetOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [draftShift, setDraftShift] = useState<ShiftType | null>(null);
  const [savingShift, setSavingShift] = useState(false);
  const [pendingShift, setPendingShift] = useState<ShiftType | null>(null);
  const [savingSheetShift, setSavingSheetShift] = useState(false);

  // 联网 AI 预测状态
  const [networkPrediction, setNetworkPrediction] = useState<{
    predicted: number;
    completed: number;
    dailyNeeded: number;
    lowEstimate: number;
    highEstimate: number;
    weeklyBreakdown: { week: number; predicted: number; low: number; high: number }[];
    source: "network" | "fallback";
    cityName?: string;
  } | null>(null);
  const [weeklyNetwork, setWeeklyNetwork] = useState<{
    totalPredicted: number;
    dailyPredictions: { day: string; date: string; predicted: number; weather: import("@/types").Weather }[];
    source: "network" | "fallback";
    cityName?: string;
  } | null>(null);
  const [tomorrowNetwork, setTomorrowNetwork] = useState<{
    predictedOrders: number;
    confidence: "high" | "medium" | "low";
    factors: { label: string; impact: string }[];
    source: "network" | "fallback";
    cityName?: string;
    temperature?: number;
  } | null>(null);
  const [weatherForecast, setWeatherForecast] = useState<NetworkWeatherForecast | null>(null);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [llmApiKey, setLlmApiKey] = useState(() => localStorage.getItem("rider_llm_api_key") || "");
  const [llmBaseURL, setLlmBaseURL] = useState(() => localStorage.getItem("rider_llm_base_url") || "");
  const [llmModel, setLlmModel] = useState(() => localStorage.getItem("rider_llm_model") || "gpt-4o-mini");
  const [llmCustomModel, setLlmCustomModel] = useState(() => localStorage.getItem("rider_llm_custom_model") || "");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmResult, setLlmResult] = useState("");

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

  // 联网获取天气与增强预测
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      predictMonthlyAIWithNetworkWeather(records, settings),
      predictWeeklyAIWithNetworkWeather(records, settings),
      predictTomorrowAIWithNetworkWeather(records, settings),
      fetchNetworkWeatherForecast(7),
    ]).then(([month, week, tomorrow, weather]) => {
      if (cancelled) return;
      setNetworkPrediction(month);
      setWeeklyNetwork(week);
      setTomorrowNetwork(tomorrow);
      setWeatherForecast(weather);
    });
    return () => { cancelled = true; };
  }, [records, settings]);

  // 持久化 LLM API 配置（仅本地，不上传）
  useEffect(() => { localStorage.setItem("rider_llm_api_key", llmApiKey); }, [llmApiKey]);
  useEffect(() => { localStorage.setItem("rider_llm_base_url", llmBaseURL); }, [llmBaseURL]);
  useEffect(() => { localStorage.setItem("rider_llm_model", llmModel); }, [llmModel]);
  useEffect(() => { localStorage.setItem("rider_llm_custom_model", llmCustomModel); }, [llmCustomModel]);

  const llmPrompt = useMemo(
    () => generateLLMPredictionPrompt(records, settings, weatherForecast || undefined),
    [records, settings, weatherForecast]
  );

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(llmPrompt);
    showToast("AI 预测提示词已复制", "success");
  };

  const handleRunLLM = async () => {
    if (!llmApiKey.trim()) {
      showToast("请输入 API Key", "error");
      return;
    }
    const effectiveModel = llmModel === "custom" ? llmCustomModel.trim() : llmModel;
    if (!effectiveModel) {
      showToast("请输入自定义模型名", "error");
      return;
    }
    setLlmLoading(true);
    setLlmResult("");
    const res = await callLLMPrediction(llmPrompt, {
      apiKey: llmApiKey,
      baseURL: llmBaseURL || undefined,
      model: effectiveModel,
    });
    setLlmLoading(false);
    if (res.success) {
      setLlmResult(res.text || "");
      showToast("AI 大模型预测完成", "success");
    } else {
      showToast(`调用失败：${res.error?.slice(0, 60) || "未知错误"}`, "error");
    }
  };

  const remaining = daysRemainingInMonth();
  const total = daysInCurrentMonth();
  const activePrediction = networkPrediction || prediction;
  const dailyNeeded = activePrediction.dailyNeeded;

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

  // 本周班次草稿跟随已锁定值
  useEffect(() => {
    setDraftShift(settings.weeklyShifts?.[thisMonday] || null);
  }, [settings.weeklyShifts, thisMonday]);

  // 弹窗里的班次草稿
  useEffect(() => {
    if (selectedWeek) {
      setPendingShift(settings.weeklyShifts?.[selectedWeek] || null);
    }
  }, [selectedWeek, settings.weeklyShifts]);

  const openShiftSheet = (weekStart: string) => {
    setSelectedWeek(weekStart);
    setShiftSheetOpen(true);
  };

  const handleLockCurrentWeek = async () => {
    setSavingShift(true);
    try {
      if (draftShift) {
        await lockShift(thisMonday, draftShift);
        showToast("本周班次已锁定并保存到云端", "success");
      } else {
        await unlockShift(thisMonday);
        showToast("已恢复本周自动轮换", "info");
      }
    } finally {
      setSavingShift(false);
    }
  };

  const handleSaveSheetShift = async () => {
    if (!selectedWeek) return;
    setSavingSheetShift(true);
    try {
      if (pendingShift) {
        await lockShift(selectedWeek, pendingShift);
        showToast("班次已锁定并保存到云端", "success");
      } else {
        await unlockShift(selectedWeek);
        showToast("已恢复自动轮换", "info");
      }
      setShiftSheetOpen(false);
    } finally {
      setSavingSheetShift(false);
    }
  };

  const handleClearSheetShift = async (weekStart: string) => {
    setSavingSheetShift(true);
    try {
      await unlockShift(weekStart);
      showToast("已恢复自动轮换", "info");
    } finally {
      setSavingSheetShift(false);
    }
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

      {/* AI 联网预测 */}
      <motion.div variants={child} className="holo-card rounded-[26px] p-5 corner-brackets relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#E040FB]/10 to-transparent rounded-bl-full -mr-8 -mt-8 pointer-events-none" />
        <div className="flex items-center justify-between mb-4 relative z-10">
          <h3 className="cyber-section-title text-sm tracking-tight">
            <Sparkles size={16} className="icon-glow-cyan" />
            AI 联网预测
          </h3>
          <div className="flex items-center gap-1.5">
            {weatherForecast?.source === "network" ? (
              <Wifi size={12} className="text-[#00E676]" />
            ) : (
              <WifiOff size={12} className="text-[#E0E0E0]/40" />
            )}
            <span className="text-[10px] text-[#E0E0E0]/40 terminal-text">
              {weatherForecast?.source === "network" ? `已联网${weatherForecast.cityName ? ` · ${weatherForecast.cityName}` : ""}` : "离线模式"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div className="p-3 rounded-2xl bg-[#00E5FF]/8 border border-[#00E5FF]/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Cloud size={12} className="text-[#00E5FF]" />
              <span className="text-[#E0E0E0]/50 text-[10px] terminal-text">明日预测</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[#E0E0E0]">{tomorrowNetwork?.predictedOrders ?? "-"}</span>
              <span className="text-[#E0E0E0]/40 text-xs">单</span>
            </div>
            {tomorrowNetwork?.temperature !== undefined && (
              <p className="text-[10px] text-[#E0E0E0]/30 mt-0.5">
                {tomorrowNetwork.temperature}°C · {WEATHER_LABELS[weeklyNetwork?.dailyPredictions[0]?.weather || "sunny"]}
              </p>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-[#E040FB]/8 border border-[#E040FB]/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity size={12} className="text-[#E040FB]" />
              <span className="text-[#E0E0E0]/50 text-[10px] terminal-text">未来7天</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[#E0E0E0]">{weeklyNetwork?.totalPredicted ?? "-"}</span>
              <span className="text-[#E0E0E0]/40 text-xs">单</span>
            </div>
            <p className="text-[10px] text-[#E0E0E0]/30 mt-0.5">
              {weeklyNetwork?.dailyPredictions.slice(0, 3).map((d) => d.day).join(" / ")}
            </p>
          </div>
        </div>

        {activePrediction.lowEstimate > 0 && activePrediction.highEstimate > 0 && (
          <div className="mt-3 p-3 rounded-2xl bg-[#E0E0E0]/4 border border-[#E0E0E0]/5 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[#E0E0E0]/50 text-xs">本月预计区间</span>
              <span className="text-[#E0E0E0] font-bold text-sm">
                {activePrediction.lowEstimate} - {activePrediction.highEstimate} 单
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => setAiSheetOpen(true)}
          className="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-[#00E5FF]/15 to-[#E040FB]/15 border border-[#00E5FF]/20 text-[#00E5FF] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#00E5FF]/10 transition-colors relative z-10"
        >
          <Brain size={16} />
          AI 大模型深度预测
        </button>
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
              {upcomingShifts[0]?.isOverride ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-[#FFD740]">
                  <Lock size={10} /> 已锁定
                </span>
              ) : (
                <span className="text-[10px] text-[#E0E0E0]/30">自动轮换</span>
              )}
            </div>
          </div>
        </div>

        {/* 本周班次独立锁定 */}
        <div className="mb-5 p-4 rounded-2xl bg-[#FFD740]/5 border border-[#FFD740]/15">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[#E0E0E0] text-sm font-medium flex items-center gap-2">
              <Lock size={14} className="text-[#FFD740]" />
              锁定本周班次
            </h4>
            <span className="text-[10px] text-[#FFD740]">
              {settings.weeklyShifts?.[thisMonday]
                ? `已锁定 · ${SHIFT_MAP[settings.weeklyShifts[thisMonday]].name}`
                : "自动轮换中"}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {SHIFT_DEFINITIONS.map((shift) => {
              const selected = draftShift === shift.type;
              return (
                <button
                  key={shift.type}
                  onClick={() => setDraftShift(shift.type)}
                  className={`py-2.5 rounded-xl text-center transition-all border ${
                    selected
                      ? "bg-[#FFD740] text-[#020408] border-[#FFD740] shadow-lg shadow-[#FFD740]/20"
                      : "bg-[#E0E0E0]/5 text-[#E0E0E0]/70 border-transparent hover:border-[#E0E0E0]/20"
                  }`}
                >
                  <div className="text-lg">{shift.emoji}</div>
                  <div className="text-[10px] font-medium mt-0.5">{shift.name}</div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDraftShift(null)}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-[#E0E0E0]/5 text-[#E0E0E0]/60 hover:bg-[#E0E0E0]/10 transition-colors"
            >
              恢复自动轮换
            </button>
            <button
              onClick={handleLockCurrentWeek}
              disabled={savingShift || draftShift === (settings.weeklyShifts?.[thisMonday] || null)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#FFD740] text-[#020408] disabled:opacity-40 transition-opacity"
            >
              {savingShift ? "保存中..." : "保存锁定"}
            </button>
          </div>
          <p className="mt-2 text-[#E0E0E0]/30 text-[10px]">
            点击上方班次后必须点「保存锁定」，设置会立即存到本地和云端，换浏览器也不变。
          </p>
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
                        onClick={() => handleClearSheetShift(item.weekStart)}
                        disabled={savingSheetShift}
                        className="p-1.5 rounded-lg text-[#E0E0E0]/40 hover:text-[#E0E0E0] hover:bg-[#E0E0E0]/5 disabled:opacity-30"
                        title="恢复自动轮换"
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => openShiftSheet(item.weekStart)}
                      className="tap-cyber flex items-center gap-1 px-2 py-1 rounded-lg text-[#00E5FF]/70 hover:text-[#00E5FF] hover:bg-[#00E5FF]/10 text-[10px] transition-colors"
                    >
                      设置/锁定 <ChevronRight size={12} />
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
            轮换顺序：早中班 → 早班 → 晚中班 → 晚班 → 大夜班。每周一自动推进，点击「设置/锁定」后必须保存，云端同步后换设备不变。
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
      <BottomSheet isOpen={shiftSheetOpen} onClose={() => setShiftSheetOpen(false)} title="设置/锁定班次">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-[#00E5FF]/5 border border-[#00E5FF]/10">
            <p className="text-[#E0E0E0]/50 text-xs">
              为 <span className="text-[#00E5FF] font-medium">{selectedWeek?.slice(5).replace("-", "/")}</span> 所在周选择班次，点击下方「保存锁定」后才会生效并同步云端。
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {SHIFT_DEFINITIONS.map((shift) => {
              const isSelected = pendingShift === shift.type;
              return (
                <button
                  key={shift.type}
                  onClick={() => setPendingShift(shift.type)}
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
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShiftSheetOpen(false)}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-[#E0E0E0]/5 text-[#E0E0E0]/60 hover:bg-[#E0E0E0]/10 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveSheetShift}
              disabled={savingSheetShift || pendingShift === (selectedWeek ? settings.weeklyShifts?.[selectedWeek] || null : null)}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#00E5FF] text-[#020408] disabled:opacity-40 transition-opacity"
            >
              {savingSheetShift ? "保存中..." : "保存锁定"}
            </button>
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
            {settings.weeklyShifts?.[thisMonday] && (
              <div className="mb-2 p-2 rounded-lg bg-[#FFD740]/10 border border-[#FFD740]/20 flex items-center gap-2">
                <CheckCircle size={14} className="text-[#FFD740]" />
                <span className="text-[10px] text-[#FFD740]">
                  本周已自定义锁定为「{SHIFT_MAP[settings.weeklyShifts[thisMonday]].name}」，刷新后保持不变
                </span>
              </div>
            )}
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

      {/* AI 大模型预测 Bottom Sheet */}
      <BottomSheet isOpen={aiSheetOpen} onClose={() => setAiSheetOpen(false)} title="AI 大模型深度预测">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-[#00E5FF]/5 border border-[#00E5FF]/10">
            <p className="text-[#E0E0E0]/60 text-xs leading-relaxed">
              已自动生成本地历史数据 + 联网天气 + 季节因素的提示词。你可以：
            </p>
            <ul className="mt-2 text-[#E0E0E0]/50 text-xs space-y-1 list-disc list-inside">
              <li>一键复制提示词，粘贴到 ChatGPT / 豆包 / Kimi 等在线 AI</li>
              <li>或填入自己的 OpenAI 兼容 API Key，直接在本页调用</li>
            </ul>
          </div>

          <div>
            <label className="block terminal-text text-xs mb-1.5 text-[#E0E0E0]/60">API Key（可选，仅保存在本地）</label>
            <input
              type="password"
              value={llmApiKey}
              onChange={(e) => setLlmApiKey(e.target.value)}
              className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] placeholder-[#E0E0E0]/20 transition-colors text-sm"
              placeholder="sk-..."
            />
          </div>

          <div>
            <label className="block terminal-text text-xs mb-1.5 text-[#E0E0E0]/60">API 地址（可选，默认 OpenAI）</label>
            <input
              type="text"
              value={llmBaseURL}
              onChange={(e) => setLlmBaseURL(e.target.value)}
              className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] placeholder-[#E0E0E0]/20 transition-colors text-sm"
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div>
            <label className="block terminal-text text-xs mb-1.5 text-[#E0E0E0]/60">模型</label>
            <select
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] text-sm bg-transparent"
            >
              <option value="gpt-4o-mini">OpenAI gpt-4o-mini</option>
              <option value="gpt-4o">OpenAI gpt-4o</option>
              <option value="deepseek-v4-flash">DeepSeek deepseek-v4-flash</option>
              <option value="deepseek-v4-pro">DeepSeek deepseek-v4-pro</option>
              <option value="qwen-plus">通义千问 qwen-plus</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          {llmModel === "custom" && (
            <div>
              <label className="block terminal-text text-xs mb-1.5 text-[#E0E0E0]/60">自定义模型名</label>
              <input
                type="text"
                value={llmCustomModel}
                onChange={(e) => setLlmCustomModel(e.target.value)}
                className="w-full px-4 py-3 rounded-xl input-cyber text-[#E0E0E0] placeholder-[#E0E0E0]/20 transition-colors text-sm"
                placeholder="例如：deepseek-v4-flash"
              />
            </div>
          )}

          <div className="p-3 rounded-xl bg-[#FFD740]/5 border border-[#FFD740]/10">
            <p className="text-[#FFD740]/80 text-xs leading-relaxed">
              支持 OpenAI 官方及任何兼容 <code className="bg-[#020408]/40 px-1 rounded">/v1/chat/completions</code> 的 API。模型名必须和提供商对应，例如 DeepSeek 用 <code className="bg-[#020408]/40 px-1 rounded">deepseek-v4-flash</code> 或 <code className="bg-[#020408]/40 px-1 rounded">deepseek-v4-pro</code>，API 地址填 <code className="bg-[#020408]/40 px-1 rounded">https://api.deepseek.com</code>。浏览器直接调用需 API 端开启 CORS，若调用失败可复制提示词到在线 AI 使用。
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopyPrompt}
              className="flex-1 py-3 rounded-xl bg-[#E0E0E0]/5 border border-[#E0E0E0]/10 text-[#E0E0E0] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#E0E0E0]/10 transition-colors"
            >
              <Copy size={16} />
              复制提示词
            </button>
            <button
              onClick={handleRunLLM}
              disabled={llmLoading}
              className="flex-1 py-3 rounded-xl bg-[#00E5FF]/15 border border-[#00E5FF]/30 text-[#00E5FF] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#00E5FF]/25 transition-colors disabled:opacity-50"
            >
              {llmLoading ? <Activity size={16} className="animate-spin" /> : <Brain size={16} />}
              {llmLoading ? "预测中..." : "直接调用"}
            </button>
          </div>

          {llmResult && (
            <div className="p-4 rounded-xl bg-[#020408]/60 border border-[#E0E0E0]/10">
              <h4 className="text-[#00E5FF] text-xs font-medium mb-2 terminal-text">AI 预测结果</h4>
              <pre className="text-[#E0E0E0]/80 text-xs whitespace-pre-wrap font-sans leading-relaxed">{llmResult}</pre>
            </div>
          )}
        </div>
      </BottomSheet>
    </motion.div>
  );
}