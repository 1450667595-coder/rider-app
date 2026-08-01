// API service for communicating with the backend server
const API_BASE = import.meta.env.VITE_API_URL || "/api";

// Generate persistent device ID
export function getDeviceId(): string {
  const key = "rider-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
    localStorage.setItem(key, id);
  }
  return id;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      // 静默处理API不可用（GitHub Pages无后端是正常情况）
      return null;
    }
    return await res.json() as T;
  } catch {
    // 网络错误也静默处理
    return null;
  }
}

// ── Records API ──

export interface ApiRecord {
  date: string;
  orders: number;
  income: number;
  workHours: number;
  weather: string;
  note: string;
}

export async function fetchRecords(userId: string): Promise<Record<string, ApiRecord> | null> {
  const data = await apiFetch<{ records: Record<string, ApiRecord>; count: number }>(
    `/records?user_id=${encodeURIComponent(userId)}`
  );
  return data?.records ?? null;
}

export async function saveRecord(userId: string, record: ApiRecord): Promise<boolean> {
  const data = await apiFetch<{ success: boolean }>("/records", {
    method: "PUT",
    body: JSON.stringify({
      user_id: userId,
      date: record.date,
      orders: record.orders,
      income: record.income,
      workHours: record.workHours,
      weather: record.weather,
      note: record.note,
    }),
  });
  return data?.success ?? false;
}

export async function deleteRecord(userId: string, date: string): Promise<boolean> {
  const data = await apiFetch<{ success: boolean }>(
    `/records/${date}?user_id=${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
  return data?.success ?? false;
}

export async function batchSaveRecords(
  userId: string,
  records: ApiRecord[]
): Promise<{ success: number; failed: number } | null> {
  return apiFetch<{ success: number; failed: number }>("/records/batch", {
    method: "PUT",
    body: JSON.stringify({ user_id: userId, records }),
  });
}

// ── Settings API ──

export interface ApiSettings {
  riderName: string;
  monthlyGoal: number;
  dailyGoal: number;
  basePrice: number;
  bonusPrice: number;
  bonusThreshold: number;
  workDaysPerWeek: number;
  currentShift: string;
}

export async function fetchSettings(userId: string): Promise<ApiSettings | null> {
  return apiFetch<ApiSettings>(`/settings?user_id=${encodeURIComponent(userId)}`);
}

export async function saveSettings(userId: string, settings: ApiSettings): Promise<boolean> {
  const data = await apiFetch<{ success: boolean }>("/settings", {
    method: "PUT",
    body: JSON.stringify({
      user_id: userId,
      riderName: settings.riderName,
      monthlyGoal: settings.monthlyGoal,
      dailyGoal: settings.dailyGoal,
      basePrice: settings.basePrice,
      bonusPrice: settings.bonusPrice,
      bonusThreshold: settings.bonusThreshold,
      workDaysPerWeek: settings.workDaysPerWeek,
      currentShift: settings.currentShift,
    }),
  });
  return data?.success ?? false;
}

// ── Stats API ──

export interface ApiStats {
  totalDays: number;
  totalOrders: number;
  totalIncome: number;
  avgOrders: number;
  maxOrders: number;
}

export async function fetchStats(userId: string): Promise<ApiStats | null> {
  return apiFetch<ApiStats>(`/stats?user_id=${encodeURIComponent(userId)}`);
}

// ── Health Check ──

export async function checkServerHealth(): Promise<boolean> {
  try {
    const data = await apiFetch<{ status: string }>("/health");
    return data?.status === "ok";
  } catch {
    return false;
  }
}