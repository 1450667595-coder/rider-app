import { create } from "zustand";
import {
  AppStorage,
  DailyRecord,
  UserSettings,
  ShiftType,
} from "@/types";
import { loadStorage, saveStorage, saveStorageImmediate, generateDemoData, validateAndRepair, startDataHeartbeat } from "@/utils/storage";
import { today, getCurrentMonth } from "@/utils/date";
import { getUserLocation, fetchWeatherByCoords, weatherCodeToOurWeather } from "@/services/weather";
import {
  isSupabaseConfigured,
  SHARED_USER_ID,
  getSyncUserId,
  setSyncUserId,
  syncFromCloud,
  pushSingleRecordToCloud,
  pushRecordsToCloud,
  pushSettingsToCloud,
  deleteRecordFromCloud,
  clearAllCloudData,
  scheduleSync,
} from "@/services/supabase";

// 带超时的 Promise 包装器
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function ensureUserId(): string {
  let userId = getSyncUserId();
  if (!userId) {
    userId = SHARED_USER_ID;
    setSyncUserId(userId);
  }
  return userId;
}
import {
  getDeviceId,
  fetchRecords,
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
  lockShift: (weekStart: string, shiftType: ShiftType) => Promise<void>;
  unlockShift: (weekStart: string) => Promise<void>;
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

// 确保今天有一条空记录，避免首页把昨天的数据当成今天
function ensureTodayRecord(records: Record<string, DailyRecord>): boolean {
  const todayStr = today();
  if (!records[todayStr]) {
    records[todayStr] = {
      date: todayStr, orders: 0, income: 0, workHours: 0,
      weather: "sunny", note: "",
    };
    return true;
  }
  return false;
}

const WEATHER_CACHE_DATE_KEY = "rider_last_weather_date";

/** 自动获取今日天气并绑定到当日记录（含0单休息日） */
async function fetchTodayWeather(): Promise<import("@/types").Weather | null> {
  const loc = await getUserLocation();
  if (!loc) return null;
  try {
    const data = await fetchWeatherByCoords(loc.lat, loc.lon);
    if (!data) return null;
    return weatherCodeToOurWeather(data.weatherCode);
  } catch {
    return null;
  }
}

function bindTodayWeather(getState: () => AppState) {
  const todayStr = today();
  // 同一天只自动获取一次，避免重复请求
  if (localStorage.getItem(WEATHER_CACHE_DATE_KEY) === todayStr) return;

  fetchTodayWeather().then((weather) => {
    if (!weather) return;
    const state = getState();
    const rec = state.records[todayStr];
    if (!rec) return;
    // 如果用户已手动修改过天气（非默认 sunny），不覆盖
    if (rec.weather !== "sunny") {
      localStorage.setItem(WEATHER_CACHE_DATE_KEY, todayStr);
      return;
    }
    const newRecord: DailyRecord = { ...rec, weather };
    const newRecords = { ...state.records, [todayStr]: newRecord };
    const newState = { ...state, records: newRecords };
    saveStorage(toStorageData(newState));

    // 同步到云端
    if (isSupabaseConfigured()) {
      const userId = ensureUserId();
      pushSingleRecordToCloud(userId, {
        date: newRecord.date,
        orders: newRecord.orders,
        income: newRecord.income,
        workHours: newRecord.workHours,
        weather: newRecord.weather,
        note: newRecord.note,
      });
    }

    useStore.setState({ records: newRecords });
    localStorage.setItem(WEATHER_CACHE_DATE_KEY, todayStr);
  });
}

// 云端数据同步配置（必须包含班次相关字段，否则自定义覆盖会丢失）
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
    shiftStartDate: s.shiftStartDate,
    weeklyShifts: s.weeklyShifts,
    weeklyShiftsUpdatedAt: s.weeklyShiftsUpdatedAt,
  };
}

// 将云端数据合并到本地
function mergeCloudData(
  state: AppState,
  cloudRecords: Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }> | null,
  cloudSettings: {
    riderName: string; monthlyGoal: number; dailyGoal: number; basePrice: number;
    bonusPrice: number; bonusThreshold: number; workDaysPerWeek: number;
    currentShift: string; shiftStartDate?: string; weeklyShifts?: Record<string, string>;
  } | null
): AppState {
  const merged = { ...state };
  if (cloudRecords) {
    const typedRecords: Record<string, DailyRecord> = {};
    for (const [date, r] of Object.entries(cloudRecords)) {
      typedRecords[date] = {
        date: r.date, orders: r.orders, income: r.income,
        workHours: r.workHours, weather: (r.weather || "sunny") as import("@/types").Weather,
        note: r.note || "",
      };
    }
    merged.records = { ...state.records, ...typedRecords };
  }
  if (cloudSettings) {
    // 以时间戳为准决定保留本地还是云端班次覆盖，避免刷新/换设备后已保存的班次被旧数据覆盖
    const localAt = state.settings.weeklyShiftsUpdatedAt || 0;
    const cloudAt = (cloudSettings as { weeklyShiftsUpdatedAt?: number }).weeklyShiftsUpdatedAt || 0;
    const hasCloudShifts = Object.keys(cloudSettings.weeklyShifts || {}).length > 0;
    const hasLocalShifts = Object.keys(state.settings.weeklyShifts || {}).length > 0;
    // 云端时间戳更新时优先用云端；都没时间戳但云端有班次而本地没有时，也采用云端
    const useCloudShifts = cloudAt > localAt || (cloudAt === localAt && !hasLocalShifts && hasCloudShifts);

    merged.settings = {
      ...state.settings, ...cloudSettings,
      currentShift: (cloudSettings.currentShift || state.settings.currentShift || "early_mid") as ShiftType,
      shiftStartDate: cloudSettings.shiftStartDate || state.settings.shiftStartDate,
      weeklyShifts: useCloudShifts
        ? Object.fromEntries(
            Object.entries(cloudSettings.weeklyShifts || {}).map(([k, v]) => [k, v as ShiftType])
          )
        : state.settings.weeklyShifts,
      weeklyShiftsUpdatedAt: Math.max(localAt, cloudAt) || state.settings.weeklyShiftsUpdatedAt,
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
          shiftStartDate: s.settings.shiftStartDate,
          weeklyShifts: s.settings.weeklyShifts,
          weeklyShiftsUpdatedAt: s.settings.weeklyShiftsUpdatedAt,
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

let heartbeatStarted = false;

const useStore = create<AppState>((set, get) => {
  const initialData = loadStorage();
  // 应用启动时立即补 today's record，避免首屏渲染到昨天的数据
  const createdToday = ensureTodayRecord(initialData.records);
  if (createdToday) {
    saveStorageImmediate(initialData);
  }

  return {
    ...initialData,
    syncStatus: "idle",

    loadData: () => {
      const data = loadStorage();
      const { issues } = validateAndRepair(data);
      if (issues.length > 0) {
        console.warn("数据修复:", issues);
      }
      // 凌晨/新的一天自动创建今日空记录，避免首页显示昨日数据
      const createdToday = ensureTodayRecord(data.records);
      set((s) => ({ ...s, ...data }));
      if (createdToday) {
        saveStorageImmediate(data);
      }

      // 数据加载后立即检查成就
      get().checkAchievements();

      // 自动获取今日天气并绑定到当日记录（含0单休息日）
      bindTodayWeather(get);

      // 防止重复启动 heartbeat
      if (!heartbeatStarted) {
        heartbeatStarted = true;
        startDataHeartbeat(() => {
          const state = get();
          return { version: state.version, records: state.records, settings: state.settings, achievements: state.achievements };
        });
      }

      // 从 Supabase 云端拉取数据（使用共享用户ID，自动同步）
      if (isSupabaseConfigured()) {
        const userId = ensureUserId();

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
              // 合并后立即检查成就（云端数据可能包含新的历史记录）
              get().checkAchievements();
              // 合并后把本地多余的数据也推上云端
              set((state) => {
                const localOnly: Record<string, DailyRecord> = {};
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
              const merged = mergeCloudData(state, serverRecords as Parameters<typeof mergeCloudData>[1], serverSettings as Parameters<typeof mergeCloudData>[2]);
              saveStorageImmediate(toStorageData(merged));
              set({ syncStatus: "synced" });
              return merged;
            });
            // 服务器数据合并后检查成就
            get().checkAchievements();
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
          const userId = ensureUserId();
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
      get().checkAchievements();
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
          const authUserId = ensureUserId();
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
          const userId = ensureUserId();
          scheduleSync(userId, newState.records, toSyncSettings(newSettings));
        }

        scheduleApiSync(newState);
        return { settings: newSettings };
      });
      get().checkAchievements();
    },

    lockShift: async (weekStart: string, shiftType: ShiftType) => {
      set((state) => {
        const weeklyShifts = { ...(state.settings.weeklyShifts || {}), [weekStart]: shiftType };
        const newSettings = { ...state.settings, weeklyShifts, weeklyShiftsUpdatedAt: Date.now() };
        const newState = { ...state, settings: newSettings };
        saveStorage(toStorageData(newState));

        if (isSupabaseConfigured()) {
          const userId = ensureUserId();
          scheduleSync(userId, newState.records, toSyncSettings(newSettings));
        }

        scheduleApiSync(newState);
        return { settings: newSettings };
      });

      // 立即同步到云端，确保换浏览器也不丢失
      const state = get();
      if (isSupabaseConfigured()) {
        const userId = ensureUserId();
        await pushSettingsToCloud(userId, toSyncSettings(state.settings));
      }
      await apiSaveSettings(getDeviceId(), {
        riderName: state.settings.riderName,
        monthlyGoal: state.settings.monthlyGoal,
        dailyGoal: state.settings.dailyGoal,
        basePrice: state.settings.basePrice,
        bonusPrice: state.settings.bonusPrice,
        bonusThreshold: state.settings.bonusThreshold,
        workDaysPerWeek: state.settings.workDaysPerWeek,
        currentShift: state.settings.currentShift,
        shiftStartDate: state.settings.shiftStartDate,
      weeklyShifts: state.settings.weeklyShifts,
      weeklyShiftsUpdatedAt: state.settings.weeklyShiftsUpdatedAt,
    });
    get().checkAchievements();
    },

    unlockShift: async (weekStart: string) => {
      set((state) => {
        const weeklyShifts = { ...(state.settings.weeklyShifts || {}) };
        delete weeklyShifts[weekStart];
        const newSettings = { ...state.settings, weeklyShifts, weeklyShiftsUpdatedAt: Date.now() };
        const newState = { ...state, settings: newSettings };
        saveStorage(toStorageData(newState));

        if (isSupabaseConfigured()) {
          const userId = ensureUserId();
          scheduleSync(userId, newState.records, toSyncSettings(newSettings));
        }

        scheduleApiSync(newState);
        return { settings: newSettings };
      });

      const state = get();
      if (isSupabaseConfigured()) {
        const userId = ensureUserId();
        await pushSettingsToCloud(userId, toSyncSettings(state.settings));
      }
      await apiSaveSettings(getDeviceId(), {
        riderName: state.settings.riderName,
        monthlyGoal: state.settings.monthlyGoal,
        dailyGoal: state.settings.dailyGoal,
        basePrice: state.settings.basePrice,
        bonusPrice: state.settings.bonusPrice,
        bonusThreshold: state.settings.bonusThreshold,
        workDaysPerWeek: state.settings.workDaysPerWeek,
        currentShift: state.settings.currentShift,
        shiftStartDate: state.settings.shiftStartDate,
      weeklyShifts: state.settings.weeklyShifts,
      weeklyShiftsUpdatedAt: state.settings.weeklyShiftsUpdatedAt,
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

      let streak = 0;
      const todayStr = today();
      const todayDate = new Date(todayStr);
      for (let i = 0; i < 365; i++) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const ds = `${y}-${m}-${dd}`;
        if (state.records[ds] && state.records[ds].orders > 0) {
          streak++;
        } else if (streak > 0) {
          break;
        }
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
      // 同时清理云端数据，避免下次加载时恢复旧数据
      if (isSupabaseConfigured()) {
        clearAllCloudData(ensureUserId()).catch(() => {});
      }
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
      const records = get().records;
      const todayDate = new Date(today());
      for (let i = 0; i < 365; i++) {
        const d = new Date(todayDate); d.setDate(d.getDate() - i);
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
    getLastNDaysRecords: (n: number) => {
      const records = get().records;
      const result: DailyRecord[] = [];
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const ds = `${y}-${m}-${dd}`;
        if (records[ds]) result.push(records[ds]);
      }
      return result;
    },
  };
});

export default useStore;