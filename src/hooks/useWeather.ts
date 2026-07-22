import { useState, useEffect, useCallback } from "react";
import { WeatherData, fetchWeatherByCoords, getUserLocation } from "@/services/weather";

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchWeather = useCallback(async () => {
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
    } else {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWeather();
    // Refresh every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  return { weather, loading, error, refetch: fetchWeather };
}