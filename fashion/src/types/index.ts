export type Weather = "sunny" | "cloudy" | "rainy" | "snowy" | "windy";

export interface DailyRecord {
  date: string;
  orders: number;
  income: number;
  workHours: number;
  weather: Weather;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface MonthlyGoal {
  year: number;
  month: number;
  orders: number;
  income: number;
}

export interface UserSettings {
  nickname: string;
  city: string;
  defaultWeather: Weather;
  workDaysPerWeek: number;
  dailyGoal: number;
}

export interface AppState {
  records: Record<string, DailyRecord>;
  goals: MonthlyGoal[];
  settings: UserSettings;
}

export interface PredictionResult {
  predictedOrders: number;
  confidence: "low" | "medium" | "high";
  factors: { label: string; impact: string }[];
}

export const WEATHER_OPTIONS: { value: Weather; label: string; icon: string }[] = [
  { value: "sunny", label: "晴朗", icon: "☀️" },
  { value: "cloudy", label: "多云", icon: "☁️" },
  { value: "rainy", label: "雨天", icon: "🌧️" },
  { value: "snowy", label: "雪天", icon: "❄️" },
  { value: "windy", label: "大风", icon: "🌬️" },
];

export const WEATHER_LABELS: Record<Weather, string> = {
  sunny: "晴朗",
  cloudy: "多云",
  rainy: "雨天",
  snowy: "雪天",
  windy: "大风",
};
