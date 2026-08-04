export interface WeatherData {
  temperature: number;
  weatherCode: number;
  weatherLabel: string;
  weatherEmoji: string;
  windSpeed: number;
  humidity: number;
  forecast: WeatherForecastDay[];
  cityName?: string;
}

export interface WeatherForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  weatherLabel: string;
  weatherEmoji: string;
}

export interface ForecastSummary {
  dailyWeather: Array<{
    date: string;
    weatherType: "sunny" | "cloudy" | "rainy" | "snowy" | "windy";
    weatherLabel: string;
    weatherEmoji: string;
    maxTemp: number;
    minTemp: number;
  }>;
  temperatureTrend: "rising" | "falling" | "stable";
  rainProbability: number;
  bestWorkDay: { date: string; reason: string };
  worstWorkDay: { date: string; reason: string };
}

export interface TrendAnalysis {
  overallTrend: "warming" | "cooling" | "stable";
  precipitationTrend: "increasing" | "decreasing" | "none" | "stable";
  dailyPatterns: Array<{
    date: string;
    trend: string;
    changeFromPrevious: number;
  }>;
  significantChanges: Array<{
    date: string;
    description: string;
  }>;
}

export interface WeatherImpactScore {
  score: number;
  factors: {
    temperature: number;
    humidity: number;
    wind: number;
    weatherType: number;
    comfort: number;
  };
  recommendation: string;
}

// WMO Weather Codes mapping
const WMO_CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: "晴天", emoji: "☀️" },
  1: { label: "大部晴", emoji: "🌤️" },
  2: { label: "多云", emoji: "⛅" },
  3: { label: "阴天", emoji: "☁️" },
  45: { label: "雾", emoji: "🌫️" },
  48: { label: "霜雾", emoji: "🌫️" },
  51: { label: "小毛毛雨", emoji: "🌦️" },
  53: { label: "毛毛雨", emoji: "🌦️" },
  55: { label: "大毛毛雨", emoji: "🌧️" },
  61: { label: "小雨", emoji: "🌧️" },
  63: { label: "中雨", emoji: "🌧️" },
  65: { label: "大雨", emoji: "🌧️" },
  71: { label: "小雪", emoji: "🌨️" },
  73: { label: "中雪", emoji: "🌨️" },
  75: { label: "大雪", emoji: "❄️" },
  77: { label: "雪粒", emoji: "🌨️" },
  80: { label: "阵雨", emoji: "⛈️" },
  81: { label: "中阵雨", emoji: "⛈️" },
  82: { label: "大阵雨", emoji: "⛈️" },
  85: { label: "小阵雪", emoji: "🌨️" },
  86: { label: "大阵雪", emoji: "❄️" },
  95: { label: "雷暴", emoji: "⛈️" },
  96: { label: "雷暴+小冰雹", emoji: "⛈️" },
  99: { label: "雷暴+大冰雹", emoji: "⛈️" },
};

function getWeatherInfo(code: number): { label: string; emoji: string } {
  return WMO_CODES[code] || { label: "未知", emoji: "🌡️" };
}

export function weatherCodeToOurWeather(code: number): "sunny" | "cloudy" | "rainy" | "snowy" | "windy" {
  if (code === 0 || code === 1) return "sunny";
  if (code === 2 || code === 3) return "cloudy";
  if (code >= 51 && code <= 65 || code >= 80 && code <= 82 || code >= 95) return "rainy";
  if (code >= 71 && code <= 77 || code === 85 || code === 86) return "snowy";
  return "windy";
}

// Open-Meteo API - free, no API key needed
export async function fetchWeatherByCoords(
  lat: number,
  lon: number
): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
    const res = await fetch(url);
    const data = await res.json();

    const currentCode = data.current.weather_code;
    const info = getWeatherInfo(currentCode);

    const forecast: WeatherForecastDay[] = data.daily.time.map((date: string, i: number) => {
      const fc = getWeatherInfo(data.daily.weather_code[i]);
      return {
        date,
        maxTemp: Math.round(data.daily.temperature_2m_max[i]),
        minTemp: Math.round(data.daily.temperature_2m_min[i]),
        weatherCode: data.daily.weather_code[i],
        weatherLabel: fc.label,
        weatherEmoji: fc.emoji,
      };
    });

    return {
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: currentCode,
      weatherLabel: info.label,
      weatherEmoji: info.emoji,
      windSpeed: Math.round(data.current.wind_speed_10m),
      humidity: data.current.relative_humidity_2m,
      forecast,
    };
  } catch {
    return null;
  }
}

export async function fetchWeatherByCity(city: string): Promise<WeatherData | null> {
  try {
    // Geocode city name to coordinates
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) return null;

    const { latitude, longitude, name } = geoData.results[0];
    const weather = await fetchWeatherByCoords(latitude, longitude);
    if (weather) {
      weather.cityName = name;
    }
    return weather;
  } catch {
    return null;
  }
}

// Get user's location
export function getUserLocation(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
    );
  });
}

// ---------------------------------------------------------------------------
// Enhanced weather functions
// ---------------------------------------------------------------------------

/** Estimate rain probability from WMO weather code (0–100) */
function estimateRainProbability(code: number): number {
  if (code === 0 || code === 1) return 0;
  if (code === 2) return 10;
  if (code === 3) return 20;
  if (code === 45 || code === 48) return 15;
  if (code === 51) return 40;
  if (code === 53) return 50;
  if (code === 55) return 60;
  if (code === 61) return 60;
  if (code === 63) return 75;
  if (code === 65) return 90;
  if (code === 71 || code === 73) return 30;
  if (code === 75 || code === 77) return 50;
  if (code === 80) return 70;
  if (code === 81) return 80;
  if (code === 82) return 95;
  if (code === 85 || code === 86) return 40;
  if (code === 95) return 85;
  if (code === 96) return 90;
  if (code === 99) return 100;
  return 0;
}

/** Score a single forecast day for "work suitability" (higher = better for work) */
function workDayScore(day: WeatherForecastDay): number {
  const type = weatherCodeToOurWeather(day.weatherCode);
  const avgTemp = (day.maxTemp + day.minTemp) / 2;

  let score = 50;

  // Weather type bonus
  if (type === "sunny") score += 30;
  else if (type === "cloudy") score += 15;
  else if (type === "rainy") score -= 25;
  else if (type === "snowy") score -= 20;
  else score -= 10;

  // Temperature bonus (sweet spot 18-25°C)
  if (avgTemp >= 18 && avgTemp <= 25) score += 20;
  else if (avgTemp >= 10 && avgTemp <= 32) score += 5;
  else score -= 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * getWeatherForecastSummary – returns a summary of the upcoming 7-day weather
 */
export function getWeatherForecastSummary(weather: WeatherData): ForecastSummary {
  const { forecast } = weather;

  const dailyWeather = forecast.map((day) => ({
    date: day.date,
    weatherType: weatherCodeToOurWeather(day.weatherCode),
    weatherLabel: day.weatherLabel,
    weatherEmoji: day.weatherEmoji,
    maxTemp: day.maxTemp,
    minTemp: day.minTemp,
  }));

  // Temperature trend: compare first-half average vs second-half average
  const mid = Math.floor(forecast.length / 2);
  const firstHalfAvg = forecast.slice(0, mid).reduce((s, d) => s + (d.maxTemp + d.minTemp) / 2, 0) / mid;
  const secondHalfAvg = forecast.slice(mid).reduce((s, d) => s + (d.maxTemp + d.minTemp) / 2, 0) / (forecast.length - mid);
  const diff = secondHalfAvg - firstHalfAvg;
  let temperatureTrend: "rising" | "falling" | "stable";
  if (diff > 2) temperatureTrend = "rising";
  else if (diff < -2) temperatureTrend = "falling";
  else temperatureTrend = "stable";

  // Average rain probability across all forecast days
  const rainProbs = forecast.map((d) => estimateRainProbability(d.weatherCode));
  const rainProbability = Math.round(rainProbs.reduce((a, b) => a + b, 0) / rainProbs.length);

  // Best and worst work days
  const scored = forecast.map((day) => ({ day, score: workDayScore(day) }));
  const best = scored.reduce((a, b) => (a.score > b.score ? a : b));
  const worst = scored.reduce((a, b) => (a.score < b.score ? a : b));

  const bestReasons: string[] = [];
  if (weatherCodeToOurWeather(best.day.weatherCode) === "sunny") bestReasons.push("天气晴朗");
  if (best.day.maxTemp >= 18 && best.day.maxTemp <= 25) bestReasons.push("温度舒适");
  const worstReasons: string[] = [];
  if (weatherCodeToOurWeather(worst.day.weatherCode) === "rainy") worstReasons.push("有降雨");
  if (worst.day.maxTemp > 35) worstReasons.push("高温");
  if (worst.day.minTemp < 0) worstReasons.push("低温");

  return {
    dailyWeather,
    temperatureTrend,
    rainProbability,
    bestWorkDay: { date: best.day.date, reason: bestReasons.join("，") || "综合条件最佳" },
    worstWorkDay: { date: worst.day.date, reason: worstReasons.join("，") || "综合条件较差" },
  };
}

/**
 * weatherTrendAnalysis – analyzes weather patterns over the forecast period
 */
export function weatherTrendAnalysis(weather: WeatherData): TrendAnalysis {
  const { forecast } = weather;

  if (forecast.length < 2) {
    return {
      overallTrend: "stable",
      precipitationTrend: "none",
      dailyPatterns: [],
      significantChanges: [],
    };
  }

  const dailyPatterns: TrendAnalysis["dailyPatterns"] = [];
  const significantChanges: TrendAnalysis["significantChanges"] = [];

  for (let i = 1; i < forecast.length; i++) {
    const prevAvg = (forecast[i - 1].maxTemp + forecast[i - 1].minTemp) / 2;
    const currAvg = (forecast[i].maxTemp + forecast[i].minTemp) / 2;
    const change = Math.round((currAvg - prevAvg) * 10) / 10;

    let trend: string;
    if (change > 2) trend = "明显升温";
    else if (change > 0.5) trend = "小幅升温";
    else if (change < -2) trend = "明显降温";
    else if (change < -0.5) trend = "小幅降温";
    else trend = "稳定";

    dailyPatterns.push({
      date: forecast[i].date,
      trend,
      changeFromPrevious: change,
    });

    if (Math.abs(change) >= 3) {
      significantChanges.push({
        date: forecast[i].date,
        description: change > 0 ? `气温骤升 ${change}°C` : `气温骤降 ${Math.abs(change)}°C`,
      });
    }

    // Detect significant weather type shifts
    const prevType = weatherCodeToOurWeather(forecast[i - 1].weatherCode);
    const currType = weatherCodeToOurWeather(forecast[i].weatherCode);
    if (prevType !== currType) {
      const typeMap: Record<string, string> = {
        sunny: "晴", cloudy: "多云", rainy: "雨", snowy: "雪", windy: "风",
      };
      significantChanges.push({
        date: forecast[i].date,
        description: `天气由${typeMap[prevType]}转${typeMap[currType]}`,
      });
    }
  }

  // Overall temperature trend
  const firstAvg = (forecast[0].maxTemp + forecast[0].minTemp) / 2;
  const lastAvg = (forecast[forecast.length - 1].maxTemp + forecast[forecast.length - 1].minTemp) / 2;
  const totalChange = lastAvg - firstAvg;
  let overallTrend: TrendAnalysis["overallTrend"];
  if (totalChange > 2) overallTrend = "warming";
  else if (totalChange < -2) overallTrend = "cooling";
  else overallTrend = "stable";

  // Precipitation trend
  const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
  const precipProbs = forecast.map((d) => (rainCodes.includes(d.weatherCode) ? 1 : 0));
  const firstHalfPrecip = precipProbs.slice(0, Math.floor(precipProbs.length / 2)).reduce((a, b) => a + b, 0);
  const secondHalfPrecip = precipProbs.slice(Math.floor(precipProbs.length / 2)).reduce((a, b) => a + b, 0);
  let precipitationTrend: TrendAnalysis["precipitationTrend"];
  if (secondHalfPrecip > firstHalfPrecip) precipitationTrend = "increasing";
  else if (secondHalfPrecip < firstHalfPrecip) precipitationTrend = "decreasing";
  else if (firstHalfPrecip === 0) precipitationTrend = "none";
  else precipitationTrend = "stable";

  return {
    overallTrend,
    precipitationTrend,
    dailyPatterns,
    significantChanges,
  };
}

/**
 * bindWeatherToRecord – auto-match today's weather to a data record
 */
export function bindWeatherToRecord<T extends Record<string, unknown>>(
  record: T,
  weather: WeatherData
): T & {
  weather: {
    temperature: number;
    weatherCode: number;
    weatherLabel: string;
    weatherEmoji: string;
    windSpeed: number;
    humidity: number;
    weatherType: "sunny" | "cloudy" | "rainy" | "snowy" | "windy";
  };
} {
  return {
    ...record,
    weather: {
      temperature: weather.temperature,
      weatherCode: weather.weatherCode,
      weatherLabel: weather.weatherLabel,
      weatherEmoji: weather.weatherEmoji,
      windSpeed: weather.windSpeed,
      humidity: weather.humidity,
      weatherType: weatherCodeToOurWeather(weather.weatherCode),
    },
  };
}

/**
 * getWeatherImpactScore – calculates a composite weather impact score (0–100)
 * Higher score = higher weather impact / more disruptive weather
 */
export function getWeatherImpactScore(weather: WeatherData): WeatherImpactScore {
  const { temperature, humidity, windSpeed, weatherCode } = weather;

  // Temperature factor (0–100): extreme temps have higher impact
  let temperatureFactor: number;
  if (temperature < 0) temperatureFactor = Math.min(100, Math.abs(temperature) * 5);
  else if (temperature > 35) temperatureFactor = Math.min(100, (temperature - 35) * 5);
  else if (temperature >= 18 && temperature <= 25) temperatureFactor = 0;
  else if (temperature > 25) temperatureFactor = (temperature - 25) * 5;
  else temperatureFactor = (18 - temperature) * 3;

  // Humidity factor (0–100)
  let humidityFactor: number;
  if (humidity >= 40 && humidity <= 60) humidityFactor = 0;
  else if (humidity > 60) humidityFactor = Math.min(100, (humidity - 60) * 2);
  else humidityFactor = (40 - humidity) * 1.5;

  // Wind factor (0–100)
  let windFactor: number;
  if (windSpeed <= 10) windFactor = 0;
  else if (windSpeed <= 20) windFactor = (windSpeed - 10) * 3;
  else if (windSpeed <= 40) windFactor = 30 + (windSpeed - 20) * 2;
  else windFactor = Math.min(100, 70 + (windSpeed - 40));

  // Weather type factor (0–100)
  let weatherTypeFactor: number;
  const type = weatherCodeToOurWeather(weatherCode);
  if (type === "sunny") weatherTypeFactor = 0;
  else if (type === "cloudy") weatherTypeFactor = 15;
  else if (type === "rainy") {
    if (weatherCode <= 55) weatherTypeFactor = 30;
    else if (weatherCode <= 65) weatherTypeFactor = 50;
    else weatherTypeFactor = 70;
  } else if (type === "snowy") {
    weatherTypeFactor = 40;
  } else {
    weatherTypeFactor = 25;
  }

  // Comfort factor: composite of all others
  const comfortFactor = Math.round(
    temperatureFactor * 0.35 + humidityFactor * 0.2 + windFactor * 0.15 + weatherTypeFactor * 0.3
  );

  // Composite score
  const score = Math.round(
    temperatureFactor * 0.25 +
    humidityFactor * 0.15 +
    windFactor * 0.15 +
    weatherTypeFactor * 0.25 +
    comfortFactor * 0.2
  );

  let recommendation: string;
  if (score <= 20) recommendation = "天气条件极佳，适合户外活动";
  else if (score <= 40) recommendation = "天气条件良好，正常活动不受影响";
  else if (score <= 60) recommendation = "天气条件一般，建议适当防护";
  else if (score <= 80) recommendation = "天气条件较差，减少户外活动";
  else recommendation = "天气恶劣，建议避免外出";

  return {
    score: Math.round(score),
    factors: {
      temperature: Math.round(temperatureFactor),
      humidity: Math.round(humidityFactor),
      wind: Math.round(windFactor),
      weatherType: Math.round(weatherTypeFactor),
      comfort: Math.round(comfortFactor),
    },
    recommendation,
  };
}