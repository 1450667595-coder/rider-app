import { create } from "zustand";
import {
  AppStorage,
  DailyRecord,
  UserSettings,
  Achievement,
  Weather,
  ShiftType,
} from "@/types";
import { loadStorage, saveStorage, saveStorageImmediate, generateDemoData, validateAndRepair, startDataHeartbeat, stopDataHeartbeat } from "@/utils/storage";
import { today, getCurrentMonth } from "@/utils/date";
import {
  isSupabaseConfigured,
  SHARED_USER_ID,
  syncFromCloud,
  pushSingleRecordToCloud,
  pushRecordsToCloud,
  pushSettingsToCloud,
  deleteRecordFromCloud,
  scheduleSync,
} from "@/services/supabase";

// 带超时的 Promise 包装器
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
import {
  getDeviceId,
  fetchRecords,
  saveRecord as apiSaveRecord,
  deleteRecord as apiDeleteRecord,
  fetchSettings,
  saveSettings as apiSaveSettings,
  checkServerHealth,
  batchSaveRecords,
} from "@/services/api";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

interface AppState extends AppStorage {
  syncStatus: SyncStatus;
  loadData: () => void;
  saveRecord: (record: DailyRecord) => void;
  deleteRecord: (date: string) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  checkAchievements: () => void;
  loadDemoData: () => void;
  resetData: () => void;
  getEffectivePrice: (monthOrders: number) => number;
  getTodaysRecord: () => DailyRecord | undefined;
  getMonthRecords: () => DailyRecord[];
  getMonthOrders: () => number;
  getMonthIncome: () => number;
  getTotalOrders: () => number;
  getTotalIncome: () => number;
  getStreak: () => number;
  getLastNDaysRecords: (n: number) => DailyRecord[];
}

const toStorageData = (state: AppState): AppStorage => ({
  version: state.version,
  records: state.records,
  settings: state.settings,
  achievements: state.achievements,
});

// 云端数据同步配置
function toSyncSettings(s: UserSettings) {
  return {
    riderName: s.riderName,
    monthlyGoal: s.monthlyGoal,
    dailyGoal: s.dailyGoal,
    basePrice: s.basePrice,
    bonusPrice: s.bonusPrice,
    bonusThreshold: s.bonusThreshold,
    workDaysPerWeek: s.workDaysPerWeek,
    currentShift: s.currentShift,
  };
}

// 将云端数据合并到本地
function mergeCloudData(
  state: AppState,
  cloudRecords: Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }> | null,
  cloudSettings: {
    riderName: string; monthlyGoal: number; dailyGoal: number; basePrice: number;
    bonusPrice: number; bonusThreshold: number; workDaysPerWeek: number;
    currentShift: string;
  } | null
): AppState {
  const merged = { ...state };
  if (cloudRecords) {
    const typedRecords: Record<string, DailyRecord> = {};
    for (const [date, r] of Object.entries(cloudRecords)) {
      typedRecords[date] = {
        date: r.date, orders: r.orders, income: r.income,
        workHours: r.workHours, weather: (r.weather || "sunny") as Weather,
        note: r.note || "",
      };
    }
    merged.records = { ...state.records, ...typedRecords };
  }
  if (cloudSettings) {
    merged.settings = {
      ...state.settings, ...cloudSettings,
      currentShift: (cloudSettings.currentShift || "early_mid") as ShiftType,
    };
  }
  return merged;
}

// API sync helpers
let apiSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleApiSync(state: AppState) {
  if (apiSyncTimer) clearTimeout(apiSyncTimer);
  apiSyncTimer = setTimeout(async () => {
    const userId = getDeviceId();
    const serverOnline = await checkServerHealth();
    if (!serverOnline) return;
    useStore.setState({ syncStatus: "syncing" });
    try {
      const s = state;
      const records = Object.values(s.records);
      if (records.length > 0) {
        await apiSaveSettings(userId, {
          riderName: s.settings.riderName, monthlyGoal: s.settings.monthlyGoal,
          dailyGoal: s.settings.dailyGoal, basePrice: s.settings.basePrice,
          bonusPrice: s.settings.bonusPrice, bonusThreshold: s.settings.bonusThreshold,
          workDaysPerWeek: s.settings.workDaysPerWeek, currentShift: s.settings.currentShift,
        });
        await batchSaveRecords(userId, records.map(r => ({
          date: r.date, orders: r.orders, income: r.income,
          workHours: r.workHours, weather: r.weather, note: r.note,
        })));
      }
      useStore.setState({ syncStatus: "synced" });
    } catch { /* ignore */ }
  }, 1000);
}

const useStore = create<AppState>((set, get) => {
  const initialData = loadStorage();

  return {
    ...initialData,
    syncStatus: "idle",

    loadData: () => {
      const data = loadStorage();
      const { issues } = validateAndRepair(data);
      if (issues.length > 0) {
        console.warn("数据修复:", issues);
      }
      set((s) => ({ ...s, ...data }));

      startDataHeartbeat(() => {
        const state = get();
        return { version: state.version, records: state.records, settings: state.settings, achievements: state.achievements };
      });

      // 从 Supabase 云端拉取数据（使用共享用户ID，自动同步）
      if (isSupabaseConfigured()) {
        const userId = SHARED_USER_ID;

        set({ syncStatus: "syncing" });
        withTimeout(syncFromCloud(userId), 5000, { records: null, settings: null }).then(
          async ({ records: cloudRecords, settings: cloudSettings }) => {
            if (cloudRecords || cloudSettings) {
              // 云端有数据 → 合并云端数据到本地
              set((state) => {
                const merged = mergeCloudData(state, cloudRecords, cloudSettings);
                saveStorageImmediate(toStorageData(merged));
                return { ...merged, syncStatus: "synced" };
              });
              // 合并后把本地多余的数据也推上云端
              set((state) => {
                const localOnly: Record<string, any> = {};
                const cloudKeys = new Set(cloudRecords ? Object.keys(cloudRecords) : []);
                for (const [date, rec] of Object.entries(state.records)) {
                  if (!cloudKeys.has(date)) {
                    localOnly[date] = rec;
                  }
                }
                if (Object.keys(localOnly).length > 0) {
                  pushRecordsToCloud(userId, localOnly);
                }
                return state;
              });
            } else {
              // 云端无数据 → 立即把本地数据全部推上去
              const state = get();
              if (Object.keys(state.records).length > 0) {
                set({ syncStatus: "syncing" });
                try {
                  const [recordsOk] = await Promise.all([
                    pushRecordsToCloud(userId, state.records),
                    pushSettingsToCloud(userId, toSyncSettings(state.settings)),
                  ]);
                  set({ syncStatus: recordsOk ? "synced" : "error" });
                } catch {
                  set({ syncStatus: "error" });
                }
              } else {
                set({ syncStatus: "synced" });
              }
            }
          }
        ).catch(() => {
          set({ syncStatus: "offline" });
          tryApiServerFallback();
        });
      } else {
        tryApiServerFallback();
      }

      function tryApiServerFallback() {
        const userId = getDeviceId();
        withTimeout(
          Promise.all([fetchRecords(userId), fetchSettings(userId), checkServerHealth()]),
          4000, [null, null, false]
        ).then(([serverRecords, serverSettings, serverOnline]) => {
          if (!serverOnline) { set({ syncStatus: "offline" }); return; }
          set({ syncStatus: "syncing" });
          if (serverRecords || serverSettings) {
            set((state) => {
              const merged = mergeCloudData(state, serverRecords as any, serverSettings as any);
              saveStorageImmediate(toStorageData(merged));
              set({ syncStatus: "synced" });
              return merged;
            });
          } else {
            set({ syncStatus: "synced" });
          }
        }).catch(() => { set({ syncStatus: "offline" }); });
      }
    },

    saveRecord: (record: DailyRecord) => {
      set((state) => {
        const newRecords = { ...state.records, [record.date]: record };
        const s = state.settings;
        const recordMonth = record.date.slice(0, 7);

        const monthKeys = Object.keys(newRecords).filter((k) => k.startsWith(recordMonth));
        const totalMonthOrders = monthKeys.reduce((sum, k) => sum + newRecords[k].orders, 0);
        const effectivePrice = totalMonthOrders >= s.bonusThreshold ? s.bonusPrice : s.basePrice;

        monthKeys.forEach((k) => {
          newRecords[k] = {
            ...newRecords[k],
            income: Math.round(newRecords[k].orders * effectivePrice),
          };
        });

        const newState = { ...state, records: newRecords };
        saveStorage(toStorageData(newState));

        // 立即推送到 Supabase 云端
        if (isSupabaseConfigured()) {
          const userId = SHARED_USER_ID;
          const updatedRecord = newRecords[record.date];
          pushSingleRecordToCloud(userId, {
            date: updatedRecord.date,
            orders: updatedRecord.orders,
            income: updatedRecord.income,
            workHours: updatedRecord.workHours,
            weather: updatedRecord.weather,
            note: updatedRecord.note,
          });
          scheduleSync(userId, newRecords, toSyncSettings(newState.settings));
        }

        scheduleApiSync(newState);
        return { records: newRecords };
      });
      // 延迟成就检查，避免阻塞点击响应
      setTimeout(() => get().checkAchievements(), 0);
    },

    deleteRecord: (date: string) => {
      set((state) => {
        const newRecords = { ...state.records };
        delete newRecords[date];

        const userId = getDeviceId();
        apiDeleteRecord(userId, date);

        const newState = { ...state, records: newRecords };
        saveStorage(toStorageData(newState));

        if (isSupabaseConfigured()) {
          const authUserId = SHARED_USER_ID;
          deleteRecordFromCloud(authUserId, date);
          scheduleSync(authUserId, newRecords, toSyncSettings(newState.settings));
        }

        return { records: newRecords };
      });
    },

    updateSettings: (settings: Partial<UserSettings>) => {
      set((state) => {
        const newSettings = { ...state.settings, ...settings };
        const newState = { ...state, settings: newSettings };
        saveStorage(toStorageData(newState));

        if (isSupabaseConfigured()) {
          const userId = SHARED_USER_ID;
          scheduleSync(userId, newState.records, toSyncSettings(newSettings));
        }

        scheduleApiSync(newState);
        return { settings: newSettings };
      });
      setTimeout(() => get().checkAchievements(), 0);
    },

    checkAchievements: () => {
      const state = get();
      const allRecords = Object.values(state.records) as DailyRecord[];
      const totalOrders = allRecords.reduce((s, r) => s + r.orders, 0);
      const maxDaily = allRecords.reduce((max, r) => Math.max(max, r.orders), 0);
      const { year, month } = getCurrentMonth();
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      const monthOrders = allRecords
        .filter((r) => r.date.startsWith(prefix))
        .reduce((s, r) => s + r.orders, 0);

      let streak = 0;
      const todayStr = today();
      const todayDate = new Date(todayStr);
      for (let i = 0; i < 365; i++) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        if (state.records[ds] && state.records[ds].orders > 0) streak++;
        else break;
      }

      let changed = false;
      const newAchievements = state.achievements.map((a) => {
        if (a.unlocked) return a;
        let shouldUnlock = false;
        switch (a.type) {
          case "total_orders": shouldUnlock = totalOrders >= a.threshold; break;
          case "streak": shouldUnlock = streak >= a.threshold; break;
          case "daily_record": shouldUnlock = maxDaily >= a.threshold; break;
          case "monthly_record": shouldUnlock = monthOrders >= a.threshold; break;
        }
        if (shouldUnlock) { changed = true; return { ...a, unlocked: true, unlockedAt: today() }; }
        return a;
      });

      if (changed) {
        set((state) => {
          const newState = { ...state, achievements: newAchievements };
          saveStorage(toStorageData(newState));
          return { achievements: newAchievements };
        });
      }
    },

    loadDemoData: () => {
      const data = generateDemoData();
      set((s) => ({ ...s, ...data }));
      saveStorage(toStorageData({ ...get(), ...data }));
      get().checkAchievements();
    },

    resetData: () => {
      const data = loadStorage();
      const empty = {
        ...data, records: {},
        achievements: data.achievements.map((a) => ({ ...a, unlocked: false, unlockedAt: null })),
      };
      set((s) => ({ ...s, ...empty }));
      saveStorage(empty);
    },

    getEffectivePrice: (monthOrders: number) => {
      const s = get().settings;
      return monthOrders >= s.bonusThreshold ? s.bonusPrice : s.basePrice;
    },

    getTodaysRecord: () => get().records[today()],
    getMonthRecords: () => {
      const { year, month } = getCurrentMonth();
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      return (Object.values(get().records) as DailyRecord[])
        .filter((r) => r.date.startsWith(prefix))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    getMonthOrders: () => get().getMonthRecords().reduce((s, r) => s + r.orders, 0),
    getMonthIncome: () => get().getMonthRecords().reduce((s, r) => s + r.income, 0),
    getTotalOrders: () => (Object.values(get().records) as DailyRecord[]).reduce((s, r) => s + r.orders, 0),
    getTotalIncome: () => (Object.values(get().records) as DailyRecord[]).reduce((s, r) => s + r.income, 0),
    getStreak: () => {
      let streak = 0;
      const todayDate = new Date(today());
      for (let i = 0; i < 365; i++) {
        const d = new Date(todayDate); d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        if (get().records[ds] && get().records[ds].orders > 0) streak++;
        else break;
      }
      return streak;
    },
    getLastNDaysRecords: (n: number) => {
      const records = get().records;
      const result: DailyRecord[] = [];
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        if (records[ds]) result.push(records[ds]);
      }
      return result;
    },
  };
});

export default useStore;