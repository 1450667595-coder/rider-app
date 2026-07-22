import { motion } from "framer-motion";
import { Cloud, Thermometer, Wind, Droplets, RefreshCw } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";
import { weatherCodeToOurWeather } from "@/services/weather";

interface WeatherWidgetProps {
  onWeatherChange?: (weather: "sunny" | "cloudy" | "rainy" | "snowy" | "windy") => void;
}

export default function WeatherWidget({ onWeatherChange }: WeatherWidgetProps) {
  const { weather, loading, error, refetch } = useWeather();

  // Notify parent of weather change
  if (weather && onWeatherChange) {
    const ourWeather = weatherCodeToOurWeather(weather.weatherCode);
    onWeatherChange(ourWeather);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5 animate-pulse">
        <Cloud size={14} className="text-white/30" />
        <span className="text-white/30 text-xs">获取天气...</span>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <button
        onClick={refetch}
        className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5 hover:bg-white/10 transition-colors"
      >
        <RefreshCw size={14} className="text-white/40" />
        <span className="text-white/40 text-xs">获取天气</span>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 bg-white/5 rounded-full px-3 py-1.5"
    >
      <span className="text-lg">{weather.weatherEmoji}</span>
      <span className="text-white text-sm font-medium">{weather.temperature}°C</span>
      <span className="text-white/40 text-[10px]">{weather.weatherLabel}</span>
      <div className="flex items-center gap-1 text-white/30 text-[10px]">
        <Wind size={10} />
        <span>{weather.windSpeed}km/h</span>
      </div>
      <div className="flex items-center gap-1 text-white/30 text-[10px]">
        <Droplets size={10} />
        <span>{weather.humidity}%</span>
      </div>
      <button onClick={refetch} className="text-white/20 hover:text-white/50 transition-colors">
        <RefreshCw size={10} />
      </button>
    </motion.div>
  );
}