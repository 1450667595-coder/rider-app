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
  syncFromCloud,
  pushSingleRecordToCloud,
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
  // Sync status
  syncStatus: SyncStatus;

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

// Extract only data fields for persistence (exclude methods)
const toStorageData = (state: AppState): AppStorage => ({
  version: state.version,
  records: state.records,
  settings: state.settings,
  achievements: state.achievements,
});

// API sync helpers
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleApiSync(state: AppState) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const userId = getDeviceId();
    const serverOnline = await checkServerHealth();
    if (!serverOnline) {
      // 不要覆盖 Supabase 的同步状态（Vercel 部署时 API 服务器不可用是正常的）
      return;
    }
    useStore.setState({ syncStatus: "syncing" });
    try {
      const s = state;
      const records = Object.values(s.records);
      if (records.length > 0) {
        await apiSaveSettings(userId, {
          riderName: s.settings.riderName,
          monthlyGoal: s.settings.monthlyGoal,
          dailyGoal: s.settings.dailyGoal,
          basePrice: s.settings.basePrice,
          bonusPrice: s.settings.bonusPrice,
          bonusThreshold: s.settings.bonusThreshold,
          workDaysPerWeek: s.settings.workDaysPerWeek,
          currentShift: s.settings.currentShift,
        });
        await batchSaveRecords(userId, records.map(r => ({
          date: r.date,
          orders: r.orders,
          income: r.income,
          workHours: r.workHours,
          weather: r.weather,
          note: r.note,
        })));
      }
      useStore.setState({ syncStatus: "synced" });
    } catch {
      // 不要覆盖 Supabase 的状态
    }
  }, 1000);
}

const useStore = create<AppState>((set, get) => {
  const initialData = loadStorage();

  return {
    ...initialData,
    syncStatus: "idle",

    loadData: () => {
      const data = loadStorage();
      // 验证并修复数据完整性
      const { issues } = validateAndRepair(data);
      if (issues.length > 0) {
        console.warn("数据修复:", issues);
      }
      set((s) => ({ ...s, ...data }));

      // 启动数据持久化心跳
      startDataHeartbeat(() => {
        const state = get();
        return { version: state.version, records: state.records, settings: state.settings, achievements: state.achievements };
      });

      // 优先从 Supabase 云端拉取数据（Vercel 部署的主要数据源）
      // 添加 5 秒超时，避免 VPN 下 Supabase 连接慢阻塞页面
      if (isSupabaseConfigured()) {
        set({ syncStatus: "syncing" });
        withTimeout(syncFromCloud(), 5000, { records: null, settings: null }).then(({ records: cloudRecords, settings: cloudSettings }) => {
          if (cloudRecords || cloudSettings) {
            set((state) => {
              const merged = { ...state };
              if (cloudRecords) {
                const typedRecords: Record<string, DailyRecord> = {};
                for (const [date, r] of Object.entries(cloudRecords)) {
                  typedRecords[date] = {
                    date: r.date,
                    orders: r.orders,
                    income: r.income,
                    workHours: r.workHours,
                    weather: (r.weather || "sunny") as Weather,
                    note: r.note || "",
                  };
                }
                // 云端数据优先，合并本地独有的数据
                merged.records = { ...state.records, ...typedRecords };
              }
              if (cloudSettings) {
                merged.settings = {
                  ...state.settings,
                  ...cloudSettings,
                  currentShift: (cloudSettings.currentShift || "early_mid") as ShiftType,
                };
              }
              saveStorageImmediate(toStorageData(merged));
              set({ syncStatus: "synced" });
              return merged;
            });
          } else {
            set({ syncStatus: "synced" });
          }
        }).catch(() => {
          // Supabase 不可用时，尝试 API 服务器
          set({ syncStatus: "offline" });
          tryApiServerFallback();
        });
      } else {
        // 没有 Supabase 配置，尝试 API 服务器
        tryApiServerFallback();
      }

      function tryApiServerFallback() {
        const userId = getDeviceId();
        withTimeout(
          Promise.all([
            fetchRecords(userId),
            fetchSettings(userId),
            checkServerHealth(),
          ]),
          4000,
          [null, null, false]
        ).then(([serverRecords, serverSettings, serverOnline]) => {
          if (!serverOnline) {
            set({ syncStatus: "offline" });
            return;
          }
          set({ syncStatus: "syncing" });

          if (serverRecords || serverSettings) {
            set((state) => {
              const merged = { ...state };
              if (serverRecords) {
                const typedRecords: Record<string, DailyRecord> = {};
                for (const [date, r] of Object.entries(serverRecords)) {
                  typedRecords[date] = {
                    date: r.date,
                    orders: r.orders,
                    income: r.income,
                    workHours: r.workHours,
                    weather: (r.weather || "sunny") as Weather,
                    note: r.note || "",
                  };
                }
                merged.records = { ...state.records, ...typedRecords };
              }
              if (serverSettings) {
                merged.settings = {
                  ...state.settings,
                  ...serverSettings,
                  currentShift: (serverSettings.currentShift || "early_mid") as ShiftType,
                };
              }
              saveStorageImmediate(toStorageData(merged));
              set({ syncStatus: "synced" });
              return merged;
            });
          } else {
            set({ syncStatus: "synced" });
          }
        }).catch(() => {
          set({ syncStatus: "offline" });
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
        saveStorage(toStorageData(newState));

        // 优先同步到 Supabase 云端
        if (isSupabaseConfigured()) {
          scheduleSync(newRecords, newState.settings);
        }

        // 同时尝试同步到 API 服务器（如果可用）
        scheduleApiSync(newState);

        return { records: newRecords };
      });
      get().checkAchievements();
    },

    deleteRecord: (date: string) => {
      set((state) => {
        const newRecords = { ...state.records };
        delete newRecords[date];

        // Delete from API server (if available)
        const userId = getDeviceId();
        apiDeleteRecord(userId, date);

        const newState = { ...state, records: newRecords };
        saveStorage(toStorageData(newState));

        // 优先同步到 Supabase 云端
        if (isSupabaseConfigured()) {
          deleteRecordFromCloud(date);
          scheduleSync(newRecords, newState.settings);
        }

        return { records: newRecords };
      });
    },

    updateSettings: (settings: Partial<UserSettings>) => {
      set((state) => {
        const newSettings = { ...state.settings, ...settings };
        const newState = { ...state, settings: newSettings };
        saveStorage(toStorageData(newState));

        // 优先同步到 Supabase 云端
        if (isSupabaseConfigured()) {
          scheduleSync(newState.records, newSettings);
        }

        // 同时尝试同步到 API 服务器（如果可用）
        scheduleApiSync(newState);

        return { settings: newSettings };
      });
      get().checkAchievements();
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
          saveStorage(toStorageData(newState));
          return { achievements: newAchievements };
        });
      }
    },

    loadDemoData: () => {
      const data = generateDemoData();
      // Zustand v5: use spread to merge instead of replace
      set((s) => ({ ...s, ...data }));
      saveStorage(toStorageData({ ...get(), ...data }));
      get().checkAchievements();
    },

    resetData: () => {
      const data = loadStorage();
      const empty = {
        ...data,
        records: {},
        achievements: data.achievements.map((a) => ({ ...a, unlocked: false, unlockedAt: null })),
      };
      // Zustand v5: use spread to merge instead of replace
      set((s) => ({ ...s, ...empty }));
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
      return (Object.values(get().records) as DailyRecord[])
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
      return (Object.values(get().records) as DailyRecord[]).reduce((s, r) => s + r.orders, 0);
    },

    getTotalIncome: () => {
      return (Object.values(get().records) as DailyRecord[]).reduce((s, r) => s + r.income, 0);
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