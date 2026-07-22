export type Weather = "sunny" | "cloudy" | "rainy" | "snowy" | "windy";

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  orders: number;
  income: number;
  workHours: number;
  weather: Weather;
  note: string;
}

export interface UserSettings {
  riderName: string;
  monthlyGoal: number;
  dailyGoal: number;
  basePrice: number;
  bonusPrice: number;
  bonusThreshold: number;
  workDaysPerWeek: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  threshold: number;
  type: "total_orders" | "streak" | "daily_record" | "monthly_record";
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface AppStorage {
  version: number;
  records: Record<string, DailyRecord>;
  settings: UserSettings;
  achievements: Achievement[];
}

export interface PredictionResult {
  predictedOrders: number;
  confidence: "high" | "medium" | "low";
  factors: { label: string; impact: string }[];
}

export const WEATHER_LABELS: Record<Weather, string> = {
  sunny: "☀️ 晴天",
  cloudy: "⛅ 多云",
  rainy: "🌧️ 雨天",
  snowy: "❄️ 雪天",
  windy: "💨 大风",
};

export const WEATHER_OPTIONS: { value: Weather; label: string }[] = [
  { value: "sunny", label: "☀️ 晴天" },
  { value: "cloudy", label: "⛅ 多云" },
  { value: "rainy", label: "🌧️ 雨天" },
  { value: "snowy", label: "❄️ 雪天" },
  { value: "windy", label: "💨 大风" },
];