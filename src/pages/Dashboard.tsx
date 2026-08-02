import { useState, useCallback, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, TrendingUp, Target, DollarSign, ShoppingBag, Zap, Download, Upload, Cpu, Activity, Shield, Database, Clock, BarChart3, Compass, ArrowUpRight, ArrowDownRight, Layers, Wrench, PenTool, X, Brain, Calendar } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import ProgressRing from "@/components/shared/ProgressRing";
import Confetti from "@/components/shared/Confetti";
import LiveClock from "@/components/shared/LiveClock";
import WeatherWidget from "@/components/shared/WeatherWidget";
import ShiftBadge from "@/components/shared/ShiftBadge";
import SyncIndicator from "@/components/shared/SyncIndicator";
import { showToast } from "@/components/shared/Toast";
import { today } from "@/utils/date";
import { exportBackup, importBackup } from "@/utils/storage";
import { Weather, WEATHER_LABELS } from "@/types";
import { useDashboardData } from "@/hooks/useDashboardData";

// ── 动画配置 ──
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.01 } },
};
const item = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] } },
};

// ── 迷你趋势图（memoized） ──
const Sparkline = memo(function Sparkline({ data, color = "#00E5FF", height = 28, width = 80 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 2;
  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  const gradId = `sg-${color.replace('#', '')}`;
  return (
    <svg width={width} height={height} className="sparkline-svg">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}40)` }} />
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
});

export default function Dashboard() {
  const saveRecord = useStore((s) => s.saveRecord);
  const settings = useStore(useShallow((s) => s.settings));
  const [showConfetti, setShowConfetti] = useState(false);
  const [realWeather, setRealWeather] = useState<Weather>("sunny");
  const [showFab, setShowFab] = useState(false);

  // 使用集中式数据 hook — 所有重计算在此完成，Dashboard 仅负责渲染
  const data = useDashboardData(realWeather);

  const handleWeatherChange = useCallback((w: Weather) => {
    setRealWeather(w);
    const todaysRec = data.todaysRecord;
    if (todaysRec && todaysRec.weather !== w) {
      saveRecord({ ...todaysRec, weather: w });
    }
  }, [data.todaysRecord, saveRecord]);

  useEffect(() => {
    const todaysRec = data.todaysRecord;
    if (todaysRec?.weather) setRealWeather(todaysRec.weather);
  }, []);

  const handleExportJSON = () => {
    const json = exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Power数据备份_${today()}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast("数据备份成功", "success");
  };

  const handleImportJSON = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (importBackup(text)) {
          window.location.reload();
          showToast("数据恢复成功", "success");
        } else showToast("备份文件格式无效", "error");
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExportCSV = () => {
    const allRecords = Object.values(useStore.getState().records).sort((a, b) => a.date.localeCompare(b.date));
    if (allRecords.length === 0) { showToast("暂无数据可导出", "error"); return; }
    const header = "日期,单量,收入,工时,天气,备注";
    const rows = allRecords.map((r) =>
      `${r.date},${r.orders},${r.income},${r.workHours},${WEATHER_LABELS[r.weather]},${r.note || ""}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Power数据_${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast("CSV导出成功", "success");
  };

  const handleImportCSV = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".csv";
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const lines = text.trim().split("\n");
        if (lines.length < 2) { showToast("CSV格式无效", "error"); return; }
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",");
          if (cols.length < 4) continue;
          const date = cols[0].trim();
          const orders = parseInt(cols[1]) || 0;
          const income = parseInt(cols[2]) || 0;
          const workHours = parseFloat(cols[3]) || 8;
          const weatherLabel = cols[4]?.trim() || "";
          const note = cols.slice(5).join(",").trim();
          let weather: Weather = "sunny";
          if (weatherLabel.includes("晴")) weather = "sunny";
          else if (weatherLabel.includes("云")) weather = "cloudy";
          else if (weatherLabel.includes("雨")) weather = "rainy";
          else if (weatherLabel.includes("雪")) weather = "snowy";
          else if (weatherLabel.includes("风")) weather = "windy";
          if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            saveRecord({ date, orders, income, workHours, weather, note });
            imported++;
          }
        }
        showToast(`成功导入 ${imported} 条记录`, "success");
      };
      reader.readAsText(file, "UTF-8");
    };
    input.click();
  };

  const handleQuickAdd = (delta: number) => {
    const newOrders = Math.max(0, data.todayOrders + delta);
    saveRecord({
      date: today(), orders: newOrders, income: 0,
      workHours: data.todaysRecord?.workHours || 8,
      weather: realWeather, note: data.todaysRecord?.note || "",
    });
    showToast(`${delta > 0 ? "+" : ""}${delta} 单`, "success");
    if (data.goalProgress >= 100 && !showConfetti) setShowConfetti(true);
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 6) return "夜深了";
    if (h < 9) return "早上好";
    if (h < 12) return "上午好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  };

  const { todayOrders, todayIncome, todayGoalPercent, monthOrders, monthIncome, goalProgress, effectivePrice, bonusGap,
    monthlyPrediction, predictedIncome, tomorrowPrediction, insights,
    weekComparison, monthComparison, weatherComparison, efficiencyData, dataHealth } = data;

  return (
    <motion.div className="px-4 pt-6 pb-4 space-y-4" variants={container} initial="hidden" animate="show">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* 头部 */}
      <motion.div variants={item} className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="terminal-text text-[10px] bg-[#00E5FF]/5 border border-[#00E5FF]/10 rounded-full px-2.5 py-0.5">系统在线</span>
            <span className="text-[#E0E0E0]/30 text-sm tracking-tight">
              {getGreeting()}, <span className="text-[#E0E0E0]/70 font-semibold">{settings.riderName}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SyncIndicator />
          </div>
        </div>
        <LiveClock />
      </motion.div>

      <WeatherWidget onWeatherChange={handleWeatherChange} />
      <ShiftBadge />

      {/* 主单量卡片 */}
      <motion.div variants={item} className="holo-card-strong rounded-[24px] p-6 relative overflow-hidden stat-card-enhanced">
        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="cyber-section-title"><Zap size={15} className="icon-glow-cyan" />今日单量</div>
          <div className="flex items-center gap-2">
            <span className="badge-cyber-gold">¥{effectivePrice}/单{effectivePrice > settings.basePrice ? " 奖励" : ""}</span>
            <span className="terminal-text text-[10px] text-[#E0E0E0]/20">目标 {settings.dailyGoal}</span>
          </div>
        </div>
        <div className="flex items-center justify-between relative z-10">
          <button onClick={() => handleQuickAdd(-1)} className="tap-cyber w-[52px] h-[52px] rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.12)" }}>
            <Minus size={22} className="text-[#FF6D00]" />
          </button>
          <div className="text-center">
            <AnimatedNumber value={todayOrders} className="text-[56px] font-bold text-[#E0E0E0] tabular-nums tracking-[-0.02em] leading-none neon-cyan" />
            <p className="terminal-text text-[11px] text-[#00E5FF]/40 mt-1">
              {todayOrders > 0 ? WEATHER_LABELS[data.todaysRecord?.weather || "sunny"] : "暂无数据"}
            </p>
          </div>
          <button onClick={() => handleQuickAdd(1)} className="tap-cyber w-[52px] h-[52px] rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #00E5FF, #00B0D0)", border: "none", boxShadow: "0 4px 20px rgba(0,229,255,0.35), 0 0 40px rgba(0,229,255,0.15)" }}>
            <Plus size={22} className="text-[#020408]" />
          </button>
        </div>
        <div className="mt-4 relative z-10">
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-[#E0E0E0]/30">今日目标进度</span>
            <span className="text-[#E0E0E0]/40">{todayOrders}/{settings.dailyGoal} 单 ({todayGoalPercent}%)</span>
          </div>
          <div className="progress-cyber"><div className="progress-cyber-fill" style={{ width: `${todayGoalPercent}%` }} /></div>
        </div>
        <div className="mt-5 flex gap-2 relative z-10">
          {[5, 10, 20].map((n) => (
            <button key={n} onClick={() => handleQuickAdd(n)} className="tap-cyber flex-1 py-2 rounded-xl text-[#E0E0E0]/40 hover:text-[#E0E0E0]/70 text-xs font-medium transition-all"
              style={{ background: "rgba(0,229,255,0.03)", border: "1px solid rgba(0,229,255,0.08)" }}>+{n}</button>
          ))}
        </div>
      </motion.div>

      {/* 指标卡片 */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        <div className="holo-card rounded-[22px] p-4 stat-card-enhanced">
          <div className="flex items-center gap-2 mb-2"><ShoppingBag size={15} className="icon-glow-gold" /><span className="terminal-text text-[10px] text-[#E0E0E0]/30">本月单量</span></div>
          <AnimatedNumber value={monthOrders} className="text-[26px] font-bold text-[#E0E0E0] tabular-nums tracking-[-0.01em]" />
          <span className="text-[#E0E0E0]/40 text-sm ml-1">单</span>
          <div className="mt-2 progress-cyber"><div className="progress-cyber-fill" style={{ width: `${Math.min(100, (monthOrders / settings.bonusThreshold) * 100)}%` }} /></div>
          <p className="terminal-text text-[9px] text-[#E0E0E0]/20 mt-1.5">
            {monthOrders >= settings.bonusThreshold ? `奖励已激活 ¥${settings.bonusPrice}/单` : `距奖励还差 ${bonusGap} 单`}
          </p>
        </div>
        <div className="holo-card rounded-[22px] p-4 stat-card-enhanced">
          <div className="flex items-center gap-2 mb-2"><DollarSign size={15} className="icon-glow-green" /><span className="terminal-text text-[10px] text-[#E0E0E0]/30">今日收入</span></div>
          <AnimatedNumber value={todayIncome} prefix="¥" className="text-[26px] font-bold text-[#E0E0E0] tabular-nums tracking-[-0.01em]" />
          {efficiencyData && efficiencyData.recentOrders.length >= 2 && (
            <div className="mt-1 flex justify-end"><Sparkline data={efficiencyData.recentOrders.slice(-7)} color="#00E676" height={20} width={60} /></div>
          )}
        </div>
        <div className="holo-card rounded-[22px] p-4 stat-card-enhanced">
          <div className="flex items-center gap-2 mb-2"><Target size={15} className="icon-glow-magenta" /><span className="terminal-text text-[10px] text-[#E0E0E0]/30">目标进度</span></div>
          <div className="flex items-center gap-2">
            <span className="text-[26px] font-bold text-[#E0E0E0] tracking-[-0.01em]">{goalProgress}%</span>
            <ProgressRing progress={goalProgress} size={40} strokeWidth={3} color="#00E5FF" bgColor="rgba(0,229,255,0.06)" />
          </div>
        </div>
        <div className="holo-card rounded-[22px] p-4 stat-card-enhanced">
          <div className="flex items-center gap-2 mb-2"><TrendingUp size={15} className="icon-glow-cyan" /><span className="terminal-text text-[10px] text-[#E0E0E0]/30">本月收入</span></div>
          <AnimatedNumber value={monthIncome} prefix="¥" className="text-[26px] font-bold text-[#E0E0E0] tabular-nums tracking-[-0.01em]" />
          {efficiencyData && efficiencyData.recentOrders.length >= 2 && (
            <div className="mt-1 flex justify-end"><Sparkline data={efficiencyData.recentOrders.slice(-7)} color="#00E5FF" height={20} width={60} /></div>
          )}
        </div>
      </motion.div>

      {/* 效率分析 */}
      {efficiencyData && (
        <motion.div variants={item} className="space-y-3">
          <div className="cyber-section-title"><BarChart3 size={14} className="icon-glow-cyan" />效率分析</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="holo-card rounded-[22px] p-4 stat-card-enhanced">
              <div className="flex items-center gap-2 mb-2"><Clock size={15} className="icon-glow-gold" /><span className="terminal-text text-[10px] text-[#E0E0E0]/30">每小时单量</span></div>
              <span className="text-[26px] font-bold text-[#E0E0E0] tracking-[-0.01em]">{efficiencyData.avgPerHour}</span>
              <span className="text-[#E0E0E0]/40 text-sm ml-1">单/时</span>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[10px] ${efficiencyData.trend >= 0 ? "text-[#00E676]" : "text-[#FF1744]"}`}>{efficiencyData.trend >= 0 ? "+" : ""}{efficiencyData.trend}%</span>
                {efficiencyData.trend >= 0 ? <ArrowUpRight size={10} className="text-[#00E676]" /> : <ArrowDownRight size={10} className="text-[#FF1744]" />}
              </div>
            </div>
            <div className="holo-card rounded-[22px] p-4 stat-card-enhanced">
              <div className="flex items-center gap-2 mb-2"><Zap size={15} className="icon-glow-magenta" /><span className="terminal-text text-[10px] text-[#E0E0E0]/30">效率评分</span></div>
              <span className="text-[26px] font-bold text-[#E0E0E0] tracking-[-0.01em]">{efficiencyData.efficiencyScore}</span>
              <span className="text-[#E0E0E0]/40 text-sm ml-1">分</span>
              <div className="mt-2 progress-cyber"><div className="progress-cyber-fill" style={{ width: `${Math.min(100, efficiencyData.efficiencyScore)}%` }} /></div>
            </div>
            <div className="holo-card rounded-[22px] p-4 stat-card-enhanced">
              <div className="flex items-center gap-2 mb-2"><TrendingUp size={15} className="icon-glow-green" /><span className="terminal-text text-[10px] text-[#E0E0E0]/30">最佳时效率</span></div>
              <span className="text-[26px] font-bold text-[#E0E0E0] tracking-[-0.01em]">{efficiencyData.bestHourly}</span>
              <span className="text-[#E0E0E0]/40 text-sm ml-1">单/时</span>
              <p className="terminal-text text-[9px] text-[#E0E0E0]/20 mt-1">历史最高效率</p>
            </div>
            <div className="holo-card rounded-[22px] p-4 stat-card-enhanced">
              <div className="flex items-center gap-2 mb-2"><Brain size={15} className="icon-glow-cyan" /><span className="terminal-text text-[10px] text-[#E0E0E0]/30">近7天趋势</span></div>
              {efficiencyData.recentOrders.length >= 2 && <Sparkline data={efficiencyData.recentOrders.slice(-7)} color="#00E5FF" height={28} width={80} />}
              <p className="terminal-text text-[9px] text-[#E0E0E0]/20 mt-1">{efficiencyData.trend >= 5 ? "上升趋势" : efficiencyData.trend <= -5 ? "下降趋势" : "趋势平稳"}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* AI预测 */}
      <motion.div variants={item} className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="cyber-section-title"><Cpu size={14} className="icon-glow-cyan" />AI预测</div>
          <div className="flex items-center gap-2">
            <button onClick={handleImportJSON} className="tap-cyber flex items-center gap-1 text-[#E0E0E0]/25 hover:text-[#E0E0E0]/50 text-xs transition-colors"><Database size={11} /> 恢复</button>
            <button onClick={handleExportJSON} className="tap-cyber flex items-center gap-1 text-[#E0E0E0]/25 hover:text-[#E0E0E0]/50 text-xs transition-colors"><Shield size={11} /> 备份</button>
            <button onClick={handleImportCSV} className="tap-cyber flex items-center gap-1 text-[#E0E0E0]/25 hover:text-[#E0E0E0]/50 text-xs transition-colors"><Upload size={11} /> 导入</button>
            <button onClick={handleExportCSV} className="tap-cyber flex items-center gap-1 text-[#E0E0E0]/25 hover:text-[#E0E0E0]/50 text-xs transition-colors"><Download size={11} /> 导出</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="holo-card rounded-[22px] p-4 stat-card-enhanced">
            <p className="terminal-text text-[10px] text-[#E0E0E0]/30 mb-1">明日预估</p>
            <span className="text-[32px] font-bold text-[#E0E0E0] tracking-[-0.02em] neon-cyan">{tomorrowPrediction.predictedOrders}</span>
            <span className="text-[#E0E0E0]/40 text-sm ml-1">单</span>
            <div className="flex items-center gap-1 mt-2">
              <span className={tomorrowPrediction.confidence === "high" ? "badge-cyber-green" : tomorrowPrediction.confidence === "medium" ? "badge-cyber-gold" : "badge-cyber"}>
                {tomorrowPrediction.confidence === "high" ? "高置信" : tomorrowPrediction.confidence === "medium" ? "中置信" : "低置信"}
              </span>
            </div>
          </div>
          <div className="holo-card rounded-[22px] p-4 stat-card-enhanced">
            <p className="terminal-text text-[10px] text-[#E0E0E0]/30 mb-1">本月预估收入</p>
            <span className="text-[32px] font-bold text-[#E0E0E0] tracking-[-0.02em] neon-gold">¥{predictedIncome.toLocaleString()}</span>
            <p className="terminal-text text-[9px] text-[#E0E0E0]/20 mt-2">预计 {monthlyPrediction.predicted} 单 ({monthlyPrediction.lowEstimate}-{monthlyPrediction.highEstimate})</p>
          </div>
        </div>
      </motion.div>

      {/* 智能洞察 */}
      {insights.length > 0 && (
        <motion.div variants={item} className="space-y-3">
          <div className="cyber-section-title"><Activity size={14} className="icon-glow-gold" />AI智能洞察</div>
          <div className="space-y-2">
            {insights.slice(0, 3).map((insight, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className={`holo-card rounded-[22px] p-4 ${insight.priority === "high" ? "!border-[#FFD740]/20" : ""}`}>
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{insight.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#E0E0E0]/85 font-medium text-sm">{insight.title}</p>
                    <p className="text-[#E0E0E0]/35 text-xs mt-0.5 leading-relaxed">{insight.message}</p>
                  </div>
                  {insight.priority === "high" && <span className="shrink-0 badge-cyber-gold">重要</span>}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 多维对比 */}
      <motion.div variants={item} className="space-y-3">
        <div className="cyber-section-title"><Layers size={14} className="icon-glow-cyan" />多维对比</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="holo-card rounded-[22px] p-4 stat-card-enhanced">
            <div className="flex items-center gap-2 mb-2"><Calendar size={15} className="icon-glow-cyan" /><span className="terminal-text text-[10px] text-[#E0E0E0]/30">本周 vs 上周</span></div>
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] font-bold text-[#E0E0E0] tracking-[-0.01em]">{weekComparison.currOrders}</span>
              <span className="text-[#E0E0E0]/30 text-xs">vs {weekComparison.prevOrders}</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              {weekComparison.change !== 0 ? (
                <>
                  <span className={`text-[11px] font-medium ${weekComparison.change >= 0 ? "text-[#00E676]" : "text-[#FF1744]"}`}>{weekComparison.change >= 0 ? "+" : ""}{Math.round(weekComparison.change)}%</span>
                  {weekComparison.change >= 0 ? <ArrowUpRight size={12} className="text-[#00E676]" /> : <ArrowDownRight size={12} className="text-[#FF1744]" />}
                </>
              ) : <span className="text-[11px] text-[#E0E0E0]/30">持平</span>}
            </div>
            <p className="terminal-text text-[9px] text-[#E0E0E0]/20 mt-1">本周 {weekComparison.currDays} 天 vs 上周 {weekComparison.prevDays} 天</p>
          </div>
          <div className="holo-card rounded-[22px] p-4 stat-card-enhanced">
            <div className="flex items-center gap-2 mb-2"><Compass size={15} className="icon-glow-magenta" /><span className="terminal-text text-[10px] text-[#E0E0E0]/30">本月 vs 上月</span></div>
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] font-bold text-[#E0E0E0] tracking-[-0.01em]">{monthComparison.currMOrders}</span>
              <span className="text-[#E0E0E0]/30 text-xs">vs {monthComparison.prevMOrders}</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              {monthComparison.change !== 0 ? (
                <>
                  <span className={`text-[11px] font-medium ${monthComparison.change >= 0 ? "text-[#00E676]" : "text-[#FF1744]"}`}>{monthComparison.change >= 0 ? "+" : ""}{Math.round(monthComparison.change)}%</span>
                  {monthComparison.change >= 0 ? <ArrowUpRight size={12} className="text-[#00E676]" /> : <ArrowDownRight size={12} className="text-[#FF1744]" />}
                </>
              ) : <span className="text-[11px] text-[#E0E0E0]/30">持平</span>}
            </div>
            <p className="terminal-text text-[9px] text-[#E0E0E0]/20 mt-1">{monthComparison.prevMOrders > 0 ? "数据对比可用" : "上月暂无数据"}</p>
          </div>
          <div className="holo-card rounded-[22px] p-4 col-span-2 stat-card-enhanced">
            <div className="flex items-center gap-2 mb-3"><Compass size={15} className="icon-glow-gold" /><span className="terminal-text text-[10px] text-[#E0E0E0]/30">天气 vs 订单对比</span></div>
            {weatherComparison.entries.length >= 2 ? (
              <div className="flex items-end gap-3 justify-around">
                {weatherComparison.entries.slice(0, 5).map((entry) => (
                  <div key={entry.weather} className="flex flex-col items-center gap-1">
                    <span className="text-[12px] text-[#E0E0E0]/60">{entry.label.split(" ")[0]}</span>
                    <div className="weather-bar" style={{
                      height: `${Math.max(8, (entry.avg / Math.max(1, weatherComparison.best?.avg || 1)) * 48)}px`,
                      width: "24px",
                      background: entry.weather === weatherComparison.best?.weather ? "linear-gradient(180deg, #00E676, #00E67640)" : entry.weather === weatherComparison.worst?.weather ? "linear-gradient(180deg, #FF1744, #FF174440)" : "linear-gradient(180deg, #00E5FF, #00E5FF40)",
                      borderRadius: "4px 4px 0 0",
                    }} />
                    <span className="text-[10px] text-[#E0E0E0]/40">{entry.avg}单</span>
                  </div>
                ))}
              </div>
            ) : <p className="terminal-text text-[10px] text-[#E0E0E0]/20">需要更多天气数据</p>}
            {weatherComparison.best && weatherComparison.worst && weatherComparison.best.weather !== weatherComparison.worst.weather && (
              <p className="terminal-text text-[9px] text-[#E0E0E0]/20 mt-2 text-center">
                {weatherComparison.best.label.split(" ")[0]}最高 {weatherComparison.best.avg}单 vs {weatherComparison.worst.label.split(" ")[0]}最低 {weatherComparison.worst.avg}单
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* 浮动操作按钮 */}
      <div className="fab-container">
        <AnimatePresence>
          {showFab && (
            <motion.div className="fab-menu" initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 10 }} transition={{ duration: 0.2 }}>
              <button className="fab-menu-item" onClick={() => { handleQuickAdd(1); setShowFab(false); }}><PenTool size={14} /><span>快速记录今日</span></button>
              <button className="fab-menu-item" onClick={() => { document.querySelector('[class*="weather"]')?.scrollIntoView({ behavior: "smooth" }); setShowFab(false); }}><Compass size={14} /><span>查看天气</span></button>
              <button className="fab-menu-item" onClick={() => { setShowFab(false); }}><Cpu size={14} /><span>查看预测</span></button>
              <button className="fab-menu-item" onClick={() => { handleExportJSON(); setShowFab(false); }}><Shield size={14} /><span>数据备份</span></button>
            </motion.div>
          )}
        </AnimatePresence>
        <button className="fab-button" onClick={() => setShowFab(!showFab)}>{showFab ? <X size={20} /> : <Wrench size={20} />}</button>
      </div>
    </motion.div>
  );
}