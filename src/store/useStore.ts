import { create } from "zustand";
import {
  AppStorage,
  DailyRecord,
  UserSettings,
  Achievement,
  Weather,
  ShiftType,
} from "@/types";
import { loadStorage, saveStorage, generateDemoData } from "@/utils/storage";
import { today, getCurrentMonth } from "@/utils/date";
import {
  isSupabaseConfigured,
  syncFromCloud,
  pushSingleRecordToCloud,
  deleteRecordFromCloud,
  scheduleSync,
} from "@/services/supabase";

interface AppState extends AppStorage {
  // Actions
  loadData: () => void;
  saveRecord: (record: DailyRecord) => void;
  deleteRecord: (date: string) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  checkAchievements: () => void;
  loadDemoData: () => void;
  resetData: () => void;
  getEffectivePrice: (monthOrders: number) => number;

  // Computed helpers
  getTodaysRecord: () => DailyRecord | undefined;
  getMonthRecords: () => DailyRecord[];
  getMonthOrders: () => number;
  getMonthIncome: () => number;
  getTotalOrders: () => number;
  getTotalIncome: () => number;
  getStreak: () => number;
  getLastNDaysRecords: (n: number) => DailyRecord[];
}

const useStore = create<AppState>((set, get) => {
  const initialData = loadStorage();

  return {
    ...initialData,

    loadData: () => {
      const data = loadStorage();
      set(data);

      // Pull from cloud and merge (cloud wins for conflicts)
      if (isSupabaseConfigured()) {
        syncFromCloud().then(({ records, settings }) => {
          if (records || settings) {
            set((state) => {
              const merged = { ...state };
              if (records) {
                // Merge: cloud records take priority, cast weather type
                const typedRecords: Record<string, DailyRecord> = {};
                for (const [date, r] of Object.entries(records)) {
                  typedRecords[date] = {
                    ...r,
                    weather: (r.weather || "sunny") as Weather,
                  };
                }
                merged.records = { ...state.records, ...typedRecords };
              }
              if (settings) {
                merged.settings = {
                  ...state.settings,
                  ...settings,
                  currentShift: (settings.currentShift || "early_mid") as ShiftType,
                };
              }
              saveStorage(merged);
              return merged;
            });
          }
        });
      }
    },

    saveRecord: (record: DailyRecord) => {
      set((state) => {
        const newRecords = { ...state.records, [record.date]: record };
        const s = state.settings;

        // Get the month prefix for this record
        const recordMonth = record.date.slice(0, 7);

        // Recalculate income for all records in this month with effective price
        const monthKeys = Object.keys(newRecords).filter((k) =>
          k.startsWith(recordMonth)
        );
        const totalMonthOrders = monthKeys.reduce(
          (sum, k) => sum + newRecords[k].orders,
          0
        );
        const effectivePrice =
          totalMonthOrders >= s.bonusThreshold ? s.bonusPrice : s.basePrice;

        monthKeys.forEach((k) => {
          newRecords[k] = {
            ...newRecords[k],
            income: Math.round(newRecords[k].orders * effectivePrice),
          };
        });

        const newState = { ...state, records: newRecords };
        saveStorage(newState);

        // Sync to cloud
        scheduleSync(newRecords, newState.settings);

        return { records: newRecords };
      });
      get().checkAchievements();
    },

    deleteRecord: (date: string) => {
      set((state) => {
        const newRecords = { ...state.records };
        delete newRecords[date];
        const newState = { ...state, records: newRecords };
        saveStorage(newState);

        // Sync to cloud
        deleteRecordFromCloud(date);
        scheduleSync(newRecords, newState.settings);

        return { records: newRecords };
      });
    },

    updateSettings: (settings: Partial<UserSettings>) => {
      set((state) => {
        const newSettings = { ...state.settings, ...settings };
        const newState = { ...state, settings: newSettings };
        saveStorage(newState);

        // Sync to cloud
        scheduleSync(newState.records, newSettings);

        return { settings: newSettings };
      });
      get().checkAchievements();
    },

    checkAchievements: () => {
      const state = get();
      const allRecords = Object.values(state.records);
      const totalOrders = allRecords.reduce((s, r) => s + r.orders, 0);
      const maxDaily = allRecords.reduce((max, r) => Math.max(max, r.orders), 0);
      const { year, month } = getCurrentMonth();
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      const monthOrders = allRecords
        .filter((r) => r.date.startsWith(prefix))
        .reduce((s, r) => s + r.orders, 0);

      // Calculate streak
      let streak = 0;
      const todayStr = today();
      const todayDate = new Date(todayStr);
      for (let i = 0; i < 365; i++) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        if (state.records[ds] && state.records[ds].orders > 0) {
          streak++;
        } else {
          break;
        }
      }

      let changed = false;
      const newAchievements = state.achievements.map((a) => {
        if (a.unlocked) return a;
        let shouldUnlock = false;
        switch (a.type) {
          case "total_orders":
            shouldUnlock = totalOrders >= a.threshold;
            break;
          case "streak":
            shouldUnlock = streak >= a.threshold;
            break;
          case "daily_record":
            shouldUnlock = maxDaily >= a.threshold;
            break;
          case "monthly_record":
            shouldUnlock = monthOrders >= a.threshold;
            break;
        }
        if (shouldUnlock) {
          changed = true;
          return { ...a, unlocked: true, unlockedAt: today() };
        }
        return a;
      });

      if (changed) {
        set((state) => {
          const newState = { ...state, achievements: newAchievements };
          saveStorage(newState);
          return { achievements: newAchievements };
        });
      }
    },

    loadDemoData: () => {
      const data = generateDemoData();
      set(data);
      saveStorage(data);
      get().checkAchievements();
    },

    resetData: () => {
      const data = loadStorage();
      const empty = {
        ...data,
        records: {},
        achievements: data.achievements.map((a) => ({ ...a, unlocked: false, unlockedAt: null })),
      };
      set(empty);
      saveStorage(empty);
    },

    getEffectivePrice: (monthOrders: number) => {
      const s = get().settings;
      return monthOrders >= s.bonusThreshold ? s.bonusPrice : s.basePrice;
    },

    // Computed helpers
    getTodaysRecord: () => {
      return get().records[today()];
    },

    getMonthRecords: () => {
      const { year, month } = getCurrentMonth();
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      return Object.values(get().records)
        .filter((r) => r.date.startsWith(prefix))
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    getMonthOrders: () => {
      return get().getMonthRecords().reduce((s, r) => s + r.orders, 0);
    },

    getMonthIncome: () => {
      return get().getMonthRecords().reduce((s, r) => s + r.income, 0);
    },

    getTotalOrders: () => {
      return Object.values(get().records).reduce((s, r) => s + r.orders, 0);
    },

    getTotalIncome: () => {
      return Object.values(get().records).reduce((s, r) => s + r.income, 0);
    },

    getStreak: () => {
      let streak = 0;
      const todayDate = new Date(today());
      for (let i = 0; i < 365; i++) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        if (get().records[ds] && get().records[ds].orders > 0) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    },

    getLastNDaysRecords: (n: number) => {
      const records = get().records;
      const result: DailyRecord[] = [];
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        if (records[ds]) {
          result.push(records[ds]);
        }
      }
      return result;
    },
  };
});

export default useStore;