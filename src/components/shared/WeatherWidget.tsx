import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Wind, Droplets, RefreshCw, ChevronDown, ChevronUp, Calendar, TrendingUp, TrendingDown, Minus, Signal } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";
import { weatherCodeToOurWeather, getWeatherForecastSummary, getWeatherImpactScore } from "@/services/weather";
import type { Weather } from "@/types";

interface WeatherWidgetProps {
  onWeatherChange?: (weather: Weather) => void;
}

// 天气来源展示：用更友好的名字 + 可信度颜色标识
const SOURCE_META: Record<string, { label: string; color: string; hint: string }> = {
  wthrcdn: { label: "中国天气网", color: "#00E5FF", hint: "最准确" },
  sojson: { label: "Sojson", color: "#FFD740", hint: "较准确" },
  "open-meteo": { label: "Open-Meteo", color: "#9E9E9E", hint: "全球源" },
};

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const meta = SOURCE_META[source] || { label: source, color: "#9E9E9E", hint: "" };
  return (
    <span
      className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full"
      title={meta.hint ? `数据源: ${meta.label} · ${meta.hint}` : `数据源: ${meta.label}`}
      style={{
        background: `${meta.color}10`,
        color: meta.color,
        border: `1px solid ${meta.color}30`,
      }}
    >
      <Signal size={8} />
      {meta.label}
    </span>
  );
}

export default function WeatherWidget({ onWeatherChange }: WeatherWidgetProps) {
  const { weather, forecast, loading, error, refetch } = useWeather();
  const prevWeatherRef = useRef<Weather | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (weather && onWeatherChange) {
      const ourWeather = weatherCodeToOurWeather(weather.weatherCode);
      if (prevWeatherRef.current !== ourWeather) {
        prevWeatherRef.current = ourWeather;
        onWeatherChange(ourWeather);
      }
    }
  }, [weather, onWeatherChange]);

  // Auto-bind forecast weather to upcoming records
  const forecastSummary = weather ? getWeatherForecastSummary(weather) : null;
  const impactScore = weather ? getWeatherImpactScore(weather) : null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-full px-3 py-1.5"
        style={{
          background: "rgba(0,229,255,0.03)",
          border: "1px solid rgba(0,229,255,0.08)",
        }}>
        <Cloud size={14} className="text-[#E0E0E0]/25" />
        <span className="terminal-text text-[10px]">获取天气中...</span>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <button
        onClick={refetch}
        className="tap-cyber flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors"
        style={{
          background: "rgba(0,229,255,0.03)",
          border: "1px solid rgba(0,229,255,0.08)",
        }}>
        <RefreshCw size={14} className="text-[#E0E0E0]/35" />
        <span className="terminal-text text-[10px]">获取天气</span>
      </button>
    );
  }

  const CurrentBar = (
    <div className="flex items-center gap-3 rounded-full px-3 py-1.5 cursor-pointer"
      style={{
        background: "rgba(0,229,255,0.03)",
        border: "1px solid rgba(0,229,255,0.08)",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <span className="text-lg">{weather.weatherEmoji}</span>
      <span className="text-[#E0E0E0] text-sm font-medium">{weather.temperature}°C</span>
      <span className="terminal-text text-[9px]">{weather.weatherLabel}</span>
      <div className="flex items-center gap-1 text-[#E0E0E0]/25 text-[10px]">
        <Wind size={10} />
        <span>{weather.windSpeed}km/h</span>
      </div>
      <div className="flex items-center gap-1 text-[#E0E0E0]/25 text-[10px]">
        <Droplets size={10} />
        <span>{weather.humidity}%</span>
      </div>
      {impactScore && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
          impactScore.score <= 30 ? "badge-cyber-green" :
          impactScore.score <= 60 ? "badge-cyber-gold" : "badge-cyber-red"
        }`}>
          {impactScore.score}分
        </span>
      )}
      <SourceBadge source={weather.source} />
      <button onClick={(e) => { e.stopPropagation(); refetch(); }} className="tap-cyber text-[#E0E0E0]/20 hover:text-[#E0E0E0]/45 transition-colors ml-auto">
        <RefreshCw size={10} />
      </button>
      {expanded ? <ChevronUp size={12} className="text-[#E0E0E0]/25" /> : <ChevronDown size={12} className="text-[#E0E0E0]/25" />}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-2"
    >
      {/* Current Weather Bar */}
      {CurrentBar}

      {/* 7-Day Forecast (Expanded) */}
      <AnimatePresence>
        {expanded && forecast.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden holo-card rounded-[20px] p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={12} className="text-[#00E5FF]/60" />
              <span className="text-[10px] terminal-text text-[#E0E0E0]/40">7日天气预报</span>
              {forecastSummary && (
                <span className="text-[9px] ml-auto text-[#E0E0E0]/25">
                  降雨概率 {forecastSummary.rainProbability}%
                </span>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {forecast.slice(0, 7).map((day, i) => {
                const dayWeather = weatherCodeToOurWeather(day.weatherCode);
                const isToday = i === 0;
                return (
                  <div
                    key={day.date}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[60px] ${
                      isToday
                        ? "bg-[#00E5FF]/10 border border-[#00E5FF]/20"
                        : "bg-[#00E5FF]/3"
                    }`}
                  >
                    <span className="text-[9px] text-[#E0E0E0]/40">
                      {isToday ? "今天" : new Date(day.date).getDate() + "日"}
                    </span>
                    <span className="text-base">{day.weatherEmoji}</span>
                    <span className="text-[11px] font-medium text-[#E0E0E0]">{day.maxTemp}°</span>
                    <span className="text-[9px] text-[#E0E0E0]/30">{day.minTemp}°</span>
                    <span className={`text-[8px] ${
                      dayWeather === "rainy" ? "text-[#E040FB]" : dayWeather === "sunny" ? "text-[#FFD740]" : "text-[#E0E0E0]/40"
                    }`}>
                      {day.weatherLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Temperature Trend */}
            {forecastSummary && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#00E5FF]/8">
                <span className="text-[9px] text-[#E0E0E0]/30">气温趋势:</span>
                {forecastSummary.temperatureTrend === "rising" ? (
                  <span className="text-[9px] flex items-center gap-1 text-[#FF6D00]"><TrendingUp size={10} /> 升温</span>
                ) : forecastSummary.temperatureTrend === "falling" ? (
                  <span className="text-[9px] flex items-center gap-1 text-[#00E5FF]"><TrendingDown size={10} /> 降温</span>
                ) : (
                  <span className="text-[9px] flex items-center gap-1 text-[#E0E0E0]/40"><Minus size={10} /> 稳定</span>
                )}
                <span className="text-[9px] ml-auto text-[#E0E0E0]/20">
                  最佳工作日: {forecastSummary.bestWorkDay.date.slice(5)}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
