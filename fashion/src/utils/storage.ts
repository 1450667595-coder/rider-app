import { AppState, DailyRecord, MonthlyGoal, UserSettings } from "@/types";

const KEY = "rider-fashion-state-v1";

export function getDefaultState(): AppState {
  return {
    records: {},
    goals: [],
    settings: {
      nickname: "骑手",
      city: "北京",
      defaultWeather: "sunny",
      workDaysPerWeek: 6,
      dailyGoal: 40,
    },
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const defaults = getDefaultState();
    return {
      records: parsed.records || defaults.records,
      goals: parsed.goals || defaults.goals,
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return getDefaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function exportData(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importData(json: string): AppState | null {
  try {
    const parsed = JSON.parse(json) as AppState;
    if (!parsed.records || !parsed.settings) return null;
    return {
      ...getDefaultState(),
      ...parsed,
      settings: { ...getDefaultState().settings, ...parsed.settings },
    };
  } catch {
    return null;
  }
}
