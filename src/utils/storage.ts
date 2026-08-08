import { AppStorage, UserSettings, Achievement } from "@/types";

const STORAGE_KEY = "rider-workbench-data";
const DB_NAME = "rider-workbench-db";
const DB_VERSION = 3;
const STORE_NAME = "app-data";
const BACKUP_KEY = "rider-workbench-backup";
const SAVE_COUNT_KEY = "rider-save-count";
const LAST_SAVE_KEY = "rider-last-save";

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

// 获取本周一（班次周起始）
function getThisMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const DEFAULT_SETTINGS: UserSettings = {
  riderName: "Power",
  monthlyGoal: 1300,
  dailyGoal: 40,
  basePrice: 4.2,
  bonusPrice: 4.5,
  bonusThreshold: 1500,
  workDaysPerWeek: 6,
  currentShift: "early_mid",
  shiftStartDate: getThisMonday(),
  weeklyShifts: {},
  theme: "cyber",
};

function getDefaultStorage(): AppStorage {
  return {
    version: 1,
    records: {},
    settings: { ...DEFAULT_SETTINGS },
    achievements: DEFAULT_ACHIEVEMENTS.map((a) => ({ ...a })),
  };
}

// ═══════════════════════════════════════════════
// IndexedDB 持久化层（三重保障第一层）
// ═══════════════════════════════════════════════

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToIndexedDB(data: AppStorage): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(JSON.stringify(data), STORAGE_KEY);
    // 等待事务完成
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (e) {
    console.error("IndexedDB 保存失败:", e);
  }
}

async function loadFromIndexedDB(): Promise<AppStorage | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(STORAGE_KEY);
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const raw = request.result;
        db.close();
        if (raw && typeof raw === "string") {
          try {
            const data = JSON.parse(raw) as AppStorage;
            if (data.version === 1) {
              // 迁移旧默认值
              if (data.settings?.riderName === "骑手") {
                data.settings.riderName = "Power";
              }
              resolve({
                ...getDefaultStorage(),
                ...data,
                settings: { ...DEFAULT_SETTINGS, ...data.settings },
                achievements: data.achievements || DEFAULT_ACHIEVEMENTS.map(a => ({ ...a })),
              });
              return;
            }
          } catch { /* fall through */ }
        }
        resolve(null);
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════
// localStorage 层（三重保障第二层）
// ═══════════════════════════════════════════════

function loadFromLocalStorage(): AppStorage | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AppStorage;
    if (data.version !== 1) return null;
    // 迁移旧默认值
    if (data.settings?.riderName === "骑手") {
      data.settings.riderName = "Power";
    }
    return {
      ...getDefaultStorage(),
      ...data,
      settings: { ...DEFAULT_SETTINGS, ...data.settings },
      achievements: data.achievements || DEFAULT_ACHIEVEMENTS.map(a => ({ ...a })),
    };
  } catch {
    return null;
  }
}

function saveToLocalStorage(data: AppStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("localStorage 保存失败:", e);
  }
}

// ═══════════════════════════════════════════════
// 自动备份层（三重保障第三层）
// ═══════════════════════════════════════════════

function saveAutoBackup(data: AppStorage): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(data));
  } catch { /* 静默失败 */ }
}

function loadAutoBackup(): AppStorage | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AppStorage;
    if (data.version === 1) return data;
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════
// 统一加载：三重保障，确保数据永不丢失
// localStorage → IndexedDB → 自动备份 → 默认数据
// ═══════════════════════════════════════════════

/** 合并两份本地存储数据：records 取并集，settings 按 weeklyShiftsUpdatedAt 取最新 */
function mergeStorageData(local: AppStorage, remote: AppStorage): AppStorage {
  // records：以本地为主，远程补充本地缺失的日期
  const mergedRecords = { ...remote.records, ...local.records };

  // settings：以班次覆盖时间戳为准，避免旧设置覆盖新锁定的班次
  const localAt = local.settings.weeklyShiftsUpdatedAt || 0;
  const remoteAt = remote.settings.weeklyShiftsUpdatedAt || 0;
  const useRemoteSettings = remoteAt > localAt;

  const mergedSettings = useRemoteSettings
    ? {
        ...local.settings,
        ...remote.settings,
        weeklyShifts: remote.settings.weeklyShifts,
        weeklyShiftsUpdatedAt: remoteAt,
      }
    : { ...local.settings };

  return {
    ...local,
    records: mergedRecords,
    settings: mergedSettings,
  };
}

export function loadStorage(): AppStorage {
  // 1. 先尝试 localStorage（最快）
  const localData = loadFromLocalStorage();
  if (localData) {
    // 异步从 IndexedDB 加载，按时间戳/记录数合并，避免旧设置覆盖新锁定的班次
    loadFromIndexedDB().then((idbData) => {
      if (!idbData) return;
      const localCount = Object.keys(localData.records).length;
      const idbCount = Object.keys(idbData.records).length;
      const localAt = localData.settings.weeklyShiftsUpdatedAt || 0;
      const idbAt = idbData.settings.weeklyShiftsUpdatedAt || 0;
      // 只有 IndexedDB 确实更新（记录更多 或 班次时间戳更新）时才重写 localStorage
      if (idbCount > localCount || idbAt > localAt) {
        const merged = mergeStorageData(localData, idbData);
        saveToLocalStorage(merged);
      }
    });
    return localData;
  }

  // 2. 尝试从自动备份恢复
  const backup = loadAutoBackup();
  if (backup) {
    // 迁移旧默认值
    if (backup.settings?.riderName === "骑手") {
      backup.settings.riderName = "Power";
    }
    const merged = {
      ...getDefaultStorage(),
      ...backup,
      settings: { ...DEFAULT_SETTINGS, ...backup.settings },
      achievements: backup.achievements || DEFAULT_ACHIEVEMENTS.map(a => ({ ...a })),
    };
    saveToLocalStorage(merged);
    saveToIndexedDB(merged);
    console.log("已从自动备份恢复数据");
    return merged;
  }

  // 3. 返回默认数据
  return getDefaultStorage();
}

// ═══════════════════════════════════════════════
// 统一保存：三重写入 + 自动备份 + 时间戳
// ═══════════════════════════════════════════════

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveStorage(data: AppStorage): void {
  // 立即写入 localStorage（最快）
  saveToLocalStorage(data);
  
  // 防抖写入 IndexedDB（300ms 内多次调用只写一次）
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveToIndexedDB(data);
    saveTimer = null;
  }, 300);

  // 每保存5次做一次自动备份（通过计数器）
  const saveCount = parseInt(localStorage.getItem(SAVE_COUNT_KEY) || "0") + 1;
  localStorage.setItem(SAVE_COUNT_KEY, String(saveCount));
  if (saveCount % 5 === 0) {
    saveAutoBackup(data);
  }

  // 记录最后保存时间
  localStorage.setItem(LAST_SAVE_KEY, new Date().toISOString());
}

// ═══════════════════════════════════════════════
// 立即保存（不防抖，用于关键操作）
// ═══════════════════════════════════════════════

export function saveStorageImmediate(data: AppStorage): void {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  saveToLocalStorage(data);
  saveToIndexedDB(data);
  const saveCount = parseInt(localStorage.getItem(SAVE_COUNT_KEY) || "0") + 1;
  localStorage.setItem(SAVE_COUNT_KEY, String(saveCount));
  if (saveCount % 5 === 0) {
    saveAutoBackup(data);
  }
  localStorage.setItem(LAST_SAVE_KEY, new Date().toISOString());
}

// ═══════════════════════════════════════════════
// 数据持久化心跳：定期验证数据完整性
// ═══════════════════════════════════════════════

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function startDataHeartbeat(getData: () => AppStorage): void {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    try {
      const data = getData();
      const recordCount = Object.keys(data.records).length;
      const stored = loadFromLocalStorage();
      if (stored) {
        const storedCount = Object.keys(stored.records).length;
        if (recordCount > storedCount) {
          saveStorageImmediate(data);
        }
      }
    } catch {
      // 静默处理
    }
  }, 120000); // 每2分钟检查一次（原30秒）
}

export function stopDataHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ═══════════════════════════════════════════════
// 数据完整性检查与修复
// ═══════════════════════════════════════════════

export function validateAndRepair(data: AppStorage): { valid: boolean; repaired: boolean; issues: string[] } {
  const issues: string[] = [];
  let repaired = false;

  // 检查 records 结构
  if (!data.records || typeof data.records !== "object") {
    issues.push("records 数据损坏，已重置");
    data.records = {};
    repaired = true;
  }

  // 检查每条记录
  for (const [date, record] of Object.entries(data.records)) {
    if (!record || typeof record !== "object") {
      delete data.records[date];
      issues.push(`删除无效记录: ${date}`);
      repaired = true;
      continue;
    }
    if (typeof record.orders !== "number" || isNaN(record.orders)) {
      record.orders = 0;
      issues.push(`修复记录 ${date} 的单量`);
      repaired = true;
    }
    if (typeof record.income !== "number" || isNaN(record.income)) {
      record.income = 0;
      issues.push(`修复记录 ${date} 的收入`);
      repaired = true;
    }
    if (typeof record.workHours !== "number" || isNaN(record.workHours)) {
      record.workHours = 8;
      issues.push(`修复记录 ${date} 的工时`);
      repaired = true;
    }
    const validWeather = ["sunny", "cloudy", "rainy", "snowy", "windy"];
    if (!validWeather.includes(record.weather)) {
      record.weather = "sunny";
      issues.push(`修复记录 ${date} 的天气`);
      repaired = true;
    }
  }

  // 检查 settings
  if (!data.settings || typeof data.settings !== "object") {
    data.settings = { ...DEFAULT_SETTINGS };
    issues.push("settings 数据损坏，已重置");
    repaired = true;
  }

  // 检查 achievements
  if (!Array.isArray(data.achievements)) {
    data.achievements = DEFAULT_ACHIEVEMENTS.map(a => ({ ...a }));
    issues.push("achievements 数据损坏，已重置");
    repaired = true;
  }

  if (repaired) {
    saveStorage(data);
  }

  return { valid: issues.length === 0 || !repaired, repaired, issues };
}

// ═══════════════════════════════════════════════
// 数据备份（导出完整JSON）
// ═══════════════════════════════════════════════

export function exportBackup(): string {
  const data = loadFromLocalStorage();
  return JSON.stringify(data || getDefaultStorage(), null, 2);
}

// ═══════════════════════════════════════════════
// 数据恢复（从JSON导入）
// ═══════════════════════════════════════════════

export function importBackup(json: string): AppStorage | null {
  try {
    const data = JSON.parse(json) as AppStorage;
    if (data.version !== 1) return null;
    // 迁移旧默认值
    if (data.settings?.riderName === "骑手") {
      data.settings.riderName = "Power";
    }
    const merged = {
      ...getDefaultStorage(),
      ...data,
      settings: { ...DEFAULT_SETTINGS, ...data.settings },
      achievements: data.achievements || DEFAULT_ACHIEVEMENTS.map(a => ({ ...a })),
    };
    // 验证并修复导入的数据
    validateAndRepair(merged);
    saveStorage(merged);
    return merged;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════
// 演示数据生成
// ═══════════════════════════════════════════════

export function generateDemoData(): AppStorage {
  const storage = getDefaultStorage();
  const today = new Date();
  const records: AppStorage["records"] = {};

  for (let i = 60; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;

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