import { AppStorage, UserSettings, Achievement } from "@/types";

const STORAGE_KEY = "rider-workbench-data";

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: "total_100", name: "初出茅庐", description: "累计完成 100 单", icon: "🚴", threshold: 100, type: "total_orders", unlocked: false, unlockedAt: null },
  { id: "total_500", name: "小有所成", description: "累计完成 500 单", icon: "⭐", threshold: 500, type: "total_orders", unlocked: false, unlockedAt: null },
  { id: "total_1000", name: "单王之路", description: "累计完成 1000 单", icon: "🏆", threshold: 1000, type: "total_orders", unlocked: false, unlockedAt: null },
  { id: "total_5000", name: "骑手大神", description: "累计完成 5000 单", icon: "👑", threshold: 5000, type: "total_orders", unlocked: false, unlockedAt: null },
  { id: "total_10000", name: "传奇骑手", description: "累计完成 10000 单", icon: "🌟", threshold: 10000, type: "total_orders", unlocked: false, unlockedAt: null },
  { id: "streak_7", name: "一周全勤", description: "连续 7 天有记录", icon: "🔥", threshold: 7, type: "streak", unlocked: false, unlockedAt: null },
  { id: "streak_30", name: "月度标兵", description: "连续 30 天有记录", icon: "💪", threshold: 30, type: "streak", unlocked: false, unlockedAt: null },
  { id: "daily_50", name: "日行五十", description: "单日完成 50 单", icon: "🎯", threshold: 50, type: "daily_record", unlocked: false, unlockedAt: null },
  { id: "daily_80", name: "暴走模式", description: "单日完成 80 单", icon: "⚡", threshold: 80, type: "daily_record", unlocked: false, unlockedAt: null },
  { id: "monthly_1500", name: "月入千五", description: "月度完成 1500 单", icon: "💎", threshold: 1500, type: "monthly_record", unlocked: false, unlockedAt: null },
];

const DEFAULT_SETTINGS: UserSettings = {
  riderName: "骑手小哥",
  monthlyGoal: 1000,
  dailyGoal: 40,
  basePrice: 4.2,
  bonusPrice: 4.5,
  bonusThreshold: 1500,
  workDaysPerWeek: 6,
};

function getDefaultStorage(): AppStorage {
  return {
    version: 1,
    records: {},
    settings: { ...DEFAULT_SETTINGS },
    achievements: DEFAULT_ACHIEVEMENTS.map((a) => ({ ...a })),
  };
}

export function loadStorage(): AppStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultStorage();
    const data = JSON.parse(raw) as AppStorage;
    if (data.version !== 1) return getDefaultStorage();
    return {
      ...getDefaultStorage(),
      ...data,
      settings: { ...DEFAULT_SETTINGS, ...data.settings },
      achievements: data.achievements || DEFAULT_ACHIEVEMENTS.map((a) => ({ ...a })),
    };
  } catch {
    return getDefaultStorage();
  }
}

export function saveStorage(data: AppStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function generateDemoData(): AppStorage {
  const storage = getDefaultStorage();
  const today = new Date();
  const records: AppStorage["records"] = {};

  for (let i = 60; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseOrders = isWeekend ? 28 : 38;
    const randomFactor = 0.7 + Math.random() * 0.6;
    const orders = Math.round(baseOrders * randomFactor);

    const weathers = ["sunny", "sunny", "sunny", "cloudy", "cloudy", "rainy", "windy"] as const;
    const weather = weathers[Math.floor(Math.random() * weathers.length)];

    records[dateStr] = {
      date: dateStr,
      orders,
      income: Math.round(orders * 4.2),
      workHours: Math.round((6 + Math.random() * 4) * 10) / 10,
      weather,
      note: "",
    };
  }

  storage.records = records;
  return storage;
}