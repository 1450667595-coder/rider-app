import { create } from "zustand";
import { AppState, DailyRecord, MonthlyGoal, UserSettings, Weather } from "@/types";
import { loadState, saveState, getDefaultState } from "@/utils/storage";
import { today } from "@/utils/date";

interface Store extends AppState {
  init: () => void;
  addRecord: (record: Partial<DailyRecord>) => void;
  updateRecord: (date: string, record: Partial<DailyRecord>) => void;
  removeRecord: (date: string) => void;
  setGoal: (goal: MonthlyGoal) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  getTodayRecord: () => DailyRecord | undefined;
  getMonthRecords: (year?: number, month?: number) => DailyRecord[];
  getMonthStats: (year?: number, month?: number) => { orders: number; income: number; hours: number; days: number };
  getStreak: () => number;
}

function persist(state: AppState) {
  saveState(state);
}

export const useStore = create<Store>((set, get) => ({
  ...getDefaultState(),

  init: () => {
    set(loadState());
  },

  addRecord: (record) => {
    const date = record.date || today();
    const existing = get().records[date];
    const now = Date.now();
    const newRecord: DailyRecord = {
      date,
      orders: 0,
      income: 0,
      workHours: 0,
      weather: get().settings.defaultWeather,
      note: "",
      createdAt: now,
      updatedAt: now,
      ...(existing || {}),
      ...record,
    };
    const next = { ...get(), records: { ...get().records, [date]: newRecord } };
    set(next);
    persist(next);
  },

  updateRecord: (date, record) => {
    const existing = get().records[date];
    if (!existing) {
      get().addRecord({ date, ...record });
      return;
    }
    const newRecord = { ...existing, ...record, updatedAt: Date.now() };
    const next = { ...get(), records: { ...get().records, [date]: newRecord } };
    set(next);
    persist(next);
  },

  removeRecord: (date) => {
    const records = { ...get().records };
    delete records[date];
    const next = { ...get(), records };
    set(next);
    persist(next);
  },

  setGoal: (goal) => {
    const goals = get().goals.filter((g) => !(g.year === goal.year && g.month === goal.month));
    goals.push(goal);
    const next = { ...get(), goals };
    set(next);
    persist(next);
  },

  updateSettings: (settings) => {
    const next = { ...get(), settings: { ...get().settings, ...settings } };
    set(next);
    persist(next);
  },

  getTodayRecord: () => get().records[today()],

  getMonthRecords: (year, month) => {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const prefix = `${y}-${String(m).padStart(2, "0")}`;
    return Object.values(get().records)
      .filter((r) => r.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  getMonthStats: (year, month) => {
    const records = get().getMonthRecords(year, month);
    return records.reduce(
      (acc, r) => ({
        orders: acc.orders + r.orders,
        income: acc.income + r.income,
        hours: acc.hours + r.workHours,
        days: acc.days + 1,
      }),
      { orders: 0, income: 0, hours: 0, days: 0 }
    );
  },

  getStreak: () => {
    const records = get().records;
    const todayDate = new Date(today() + "T00:00:00");
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const ds = `${y}-${m}-${dd}`;
      if (records[ds] && records[ds].orders > 0) {
        streak++;
      } else if (streak > 0) {
        break;
      }
    }
    return streak;
  },
}));

export default useStore;
