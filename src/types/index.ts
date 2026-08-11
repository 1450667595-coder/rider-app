export type Weather = "sunny" | "cloudy" | "rainy" | "snowy" | "windy";

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  orders: number;
  income: number;
  workHours: number;
  weather: Weather;
  note: string;
  /** 自动绑定的详细天气信息（可选，旧数据可能没有） */
  weatherDetail?: {
    temperature: number;
    weatherCode: number;
    weatherLabel: string;
    weatherEmoji: string;
    windSpeed?: number;
    humidity?: number;
  };
}

export type ShiftType = "early_mid" | "early" | "late_mid" | "late" | "night";

export interface ShiftInfo {
  type: ShiftType;
  name: string;
  timeRange: string;
  startTime: string;
  endTime: string;
  restTime: string;
  emoji: string;
  color: string;
}

export const SHIFT_DEFINITIONS: ShiftInfo[] = [
  { type: "early_mid", name: "早中班", timeRange: "9:00-21:00", startTime: "09:00", endTime: "21:00", restTime: "13:30-15:20", emoji: "🌅", color: "#FFD100" },
  { type: "early", name: "早班", timeRange: "6:25-20:00", startTime: "06:25", endTime: "20:00", restTime: "13:30-15:20", emoji: "☀️", color: "#FF8C00" },
  { type: "late_mid", name: "晚中班", timeRange: "10:00-22:00", startTime: "10:00", endTime: "22:00", restTime: "", emoji: "🌆", color: "#7B2FF7" },
  { type: "late", name: "晚班", timeRange: "11:00-23:00", startTime: "11:00", endTime: "23:00", restTime: "15:30-17:20", emoji: "🌙", color: "#4B6BFB" },
  { type: "night", name: "大夜班", timeRange: "12:00-01:05", startTime: "12:00", endTime: "01:05", restTime: "15:30-17:20", emoji: "🌃", color: "#FF6B9D" },
];

export const SHIFT_MAP: Record<ShiftType, ShiftInfo> = Object.fromEntries(
  SHIFT_DEFINITIONS.map((s) => [s.type, s])
) as Record<ShiftType, ShiftInfo>;

export interface UserSettings {
  riderName: string;
  monthlyGoal: number;
  dailyGoal: number;
  basePrice: number;
  bonusPrice: number;
  bonusThreshold: number;
  workDaysPerWeek: number;
  currentShift: ShiftType;
  // 班次基准：从该周一开始，每周自动轮换
  shiftStartDate?: string;
  // 每周班次覆盖：key 为周一日期 YYYY-MM-DD，value 为班次
  weeklyShifts?: Record<string, ShiftType>;
  // 班次覆盖最后修改时间戳，用于多设备同步冲突时以最新为准
  weeklyShiftsUpdatedAt?: number;
  // 城市设置：用于获取更准确的天气
  city?: string;
  // 城市坐标：lat,lon
  cityCoords?: { lat: number; lon: number };
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
  interval?: { low: number; high: number };
  modelWeights?: { label: string; weight: number }[];
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