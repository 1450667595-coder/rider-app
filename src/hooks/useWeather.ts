import { useState, useEffect, useCallback, useRef } from "react";
import {
  WeatherData,
  WeatherForecastDay,
  fetchWeatherByCoords,
  getUserLocation,
} from "@/services/weather";

const CACHE_KEY = "weather_7day_cache";
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface WeatherCacheEntry {
  data: WeatherData;
  timestamp: number;
}

function readCache(): WeatherCacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: WeatherCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_DURATION_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeCache(data: WeatherData): void {
  try {
    const entry: WeatherCacheEntry = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable – silently ignore
  }
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const cacheRestored = useRef(false);

  const fetchWeather = useCallback(async (skipCache = false) => {
    // Try cache first (only on initial load)
    if (!skipCache && !cacheRestored.current) {
      const cached = readCache();
      if (cached) {
        setWeather(cached.data);
        setForecast(cached.data.forecast);
        setLoading(false);
        cacheRestored.current = true;
        return;
      }
    }

    setLoading(true);
    setError(false);

    const location = await getUserLocation();
    if (!location) {
      setError(true);
      setLoading(false);
      return;
    }

    const data = await fetchWeatherByCoords(location.lat, location.lon);
    if (data) {
      setWeather(data);
      setForecast(data.forecast);
      writeCache(data);
    } else {
      setError(true);
    }
    setLoading(false);
    cacheRestored.current = true;
  }, []);

  useEffect(() => {
    fetchWeather();
    // Refresh every 30 minutes
    const interval = setInterval(() => fetchWeather(true), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  return { weather, forecast, loading, error, refetch: () => fetchWeather(true) };
}