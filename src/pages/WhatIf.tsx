import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Cloud, Sun, CloudRain, Snowflake, Wind, Briefcase, RotateCcw } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import { whatIfAnalysis, type WhatIfScenario } from "@/utils/aiPrediction";
import { Weather, WEATHER_LABELS, SHIFT_DEFINITIONS, type ShiftType } from "@/types";
import { today } from "@/utils/date";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.005 } },
};

const item = {
  hidden: { opacity: 0, y: 2 },
  show: { opacity: 1, y: 0, transition: { duration: 0.08, ease: [0.25, 0.1, 0.25, 1] } },
};

const WEATHER_ICONS: Record<Weather, React.ReactNode> = {
  sunny: <Sun size={20} className="text-[#FFD740]" />,
  cloudy: <Cloud size={20} className="text-[#E0E0E0]/60" />,
  rainy: <CloudRain size={20} className="text-[#00E5FF]" />,
  snowy: <Snowflake size={20} className="text-[#E0E0E0]" />,
  windy: <Wind size={20} className="text-[#7B2FF7]" />,
};

export default function WhatIf() {
  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);

  const [selectedWeather, setSelectedWeather] = useState<Weather>("sunny");
  const [selectedShift, setSelectedShift] = useState<ShiftType>(settings.currentShift);

  const scenarios = useMemo(
    () => whatIfAnalysis(records, today(), selectedWeather, settings),
    [records, selectedWeather, settings]
  );

  const weatherScenarios = scenarios.filter(s => s.weather !== undefined);
  const shiftScenarios = scenarios.filter(s => s.shift !== undefined);

  return (
    <motion.div
      className="px-4 pt-6 pb-24 space-y-5"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item} className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sparkles size={24} className="text-[#E040FB] icon-glow-magenta" />
          <h1 className="text-2xl font-bold text-[#E0E0E0] neon-magenta tracking-[-0.01em]">
            反事实分析
          </h1>
        </div>
        <p className="terminal-text text-xs tracking-tight">What-If 情景模拟 · 探索不同选择的结果</p>
      </motion.div>

      {/* Base Scenario Selection */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets">
        <h3 className="cyber-section-title text-sm font-medium mb-4 tracking-tight">
          <Sparkles size={16} className="icon-glow-magenta" />
          基准场景
        </h3>

        {/* Weather Selection */}
        <div className="mb-4">
          <p className="terminal-text text-xs mb-2 tracking-tight">选择天气</p>
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(WEATHER_ICONS) as Weather[]).map((w) => (
              <button
                key={w}
                onClick={() => setSelectedWeather(w)}
                className={`tap-cyber flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
                  selectedWeather === w
                    ? "bg-[#00E5FF]/10 border border-[#00E5FF]/30"
                    : "bg-[#E0E0E0]/4 border border-[#E0E0E0]/5"
                }`}
              >
                {WEATHER_ICONS[w]}
                <span className="text-[10px] text-[#E0E0E0]/60">{WEATHER_LABELS[w].split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Shift Selection */}
        <div>
          <p className="terminal-text text-xs mb-2 tracking-tight">选择班次</p>
          <div className="grid grid-cols-2 gap-2">
            {SHIFT_DEFINITIONS.map((s) => (
              <button
                key={s.type}
                onClick={() => setSelectedShift(s.type)}
                className={`tap-cyber flex items-center gap-2 p-3 rounded-xl transition-all ${
                  selectedShift === s.type
                    ? "bg-[#E040FB]/10 border border-[#E040FB]/30"
                    : "bg-[#E0E0E0]/4 border border-[#E0E0E0]/5"
                }`}
              >
                <span className="text-xl">{s.emoji}</span>
                <div className="text-left">
                  <p className="text-[#E0E0E0] text-xs font-medium">{s.name}</p>
                  <p className="text-[#E0E0E0]/30 text-[9px]">{s.timeRange}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Weather Scenarios */}
      <motion.div variants={item} className="space-y-3">
        <h3 className="cyber-section-title text-sm font-medium tracking-tight">
          <Cloud size={16} className="icon-glow-cyan" />
          天气影响分析
        </h3>
        <div className="space-y-2">
          {weatherScenarios.map((scenario, i) => (
            <motion.div
              key={scenario.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="holo-card rounded-xl p-4 flex items-center justify-between stat-card-enhanced corner-brackets"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {scenario.weather === "sunny" ? "☀️" :
                   scenario.weather === "cloudy" ? "⛅" :
                   scenario.weather === "rainy" ? "🌧️" :
                   scenario.weather === "snowy" ? "❄️" : "💨"}
                </div>
                <div>
                  <p className="text-[#E0E0E0] text-sm font-medium">{scenario.name}</p>
                  <p className="text-[#E0E0E0]/30 text-xs">
                    预测单量 <AnimatedNumber value={scenario.predictedOrders} className="font-bold" /> 单
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${
                  scenario.change > 0 ? "text-[#00E676]" :
                  scenario.change < 0 ? "text-[#FF1744]" : "text-[#E0E0E0]/40"
                }`}>
                  {scenario.change > 0 ? "+" : ""}{scenario.change}
                </p>
                <p className={`text-xs ${
                  scenario.changePercent > 0 ? "text-[#00E676]" :
                  scenario.changePercent < 0 ? "text-[#FF1744]" : "text-[#E0E0E0]/40"
                }`}>
                  {scenario.changePercent > 0 ? "+" : ""}{scenario.changePercent}%
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Shift Scenarios */}
      <motion.div variants={item} className="space-y-3">
        <h3 className="cyber-section-title text-sm font-medium tracking-tight">
          <Briefcase size={16} className="icon-glow-gold" />
          班次效率对比
        </h3>
        <div className="space-y-2">
          {shiftScenarios.map((scenario, i) => (
            <motion.div
              key={scenario.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`holo-card rounded-xl p-4 flex items-center justify-between stat-card-enhanced corner-brackets ${
                scenario.shift === selectedShift ? "ring-1 ring-[#E040FB]/30" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {SHIFT_DEFINITIONS.find(s => s.type === scenario.shift)?.emoji || "📋"}
                </div>
                <div>
                  <p className="text-[#E0E0E0] text-sm font-medium">
                    {scenario.name}
                    {scenario.shift === selectedShift && (
                      <span className="ml-2 text-[9px] text-[#E040FB] badge-cyber">当前</span>
                    )}
                  </p>
                  <p className="text-[#E0E0E0]/30 text-xs">
                    预测单量 <AnimatedNumber value={scenario.predictedOrders} className="font-bold" /> 单
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${
                  scenario.change > 0 ? "text-[#00E676]" :
                  scenario.change < 0 ? "text-[#FF1744]" : "text-[#E0E0E0]/40"
                }`}>
                  {scenario.change > 0 ? "+" : ""}{scenario.change}
                </p>
                <p className={`text-xs ${
                  scenario.changePercent > 0 ? "text-[#00E676]" :
                  scenario.changePercent < 0 ? "text-[#FF1744]" : "text-[#E0E0E0]/40"
                }`}>
                  {scenario.changePercent > 0 ? "+" : ""}{scenario.changePercent}%
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Insights */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets data-pulse">
        <h3 className="cyber-section-title text-sm font-medium mb-3 tracking-tight">
          <Sparkles size={16} className="icon-glow-magenta" />
          智能洞察
        </h3>
        <div className="space-y-2">
          {weatherScenarios.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-lg">☀️</span>
              <div className="flex-1">
                <p className="text-[#E0E0E0]/80 text-sm font-medium">
                  最佳天气：{weatherScenarios[0]?.name}
                </p>
                <p className="text-[#E0E0E0]/40 text-xs mt-0.5">
                  相比当前天气，{weatherScenarios[0]?.name}可增加 {weatherScenarios[0]?.change} 单 ({weatherScenarios[0]?.changePercent}%)
                </p>
              </div>
            </div>
          )}
          {shiftScenarios.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-lg">⚡</span>
              <div className="flex-1">
                <p className="text-[#E0E0E0]/80 text-sm font-medium">
                  最优班次：{shiftScenarios[0]?.name}
                </p>
                <p className="text-[#E0E0E0]/40 text-xs mt-0.5">
                  基于历史数据，{shiftScenarios[0]?.name}效率最高，预计 {shiftScenarios[0]?.predictedOrders} 单
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
