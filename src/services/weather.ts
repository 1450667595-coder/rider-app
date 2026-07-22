export interface WeatherData {
  temperature: number;
  weatherCode: number;
  weatherLabel: string;
  weatherEmoji: string;
  windSpeed: number;
  humidity: number;
  forecast: WeatherForecastDay[];
}

export interface WeatherForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  weatherLabel: string;
  weatherEmoji: string;
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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;
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
      (weather as any).cityName = name;
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