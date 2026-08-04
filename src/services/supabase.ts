import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// 共享用户ID - 所有设备共用同一个ID，实现零登录自动同步
export const SHARED_USER_ID = "00000000-0000-0000-0000-000000000001";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

export const isSupabaseConfigured = (): boolean => {
  return supabaseUrl !== "" && supabaseAnonKey !== "" && !supabaseUrl.includes("your-project");
};

// ── Database types ──

export interface DbRecord {
  id?: string;
  user_id: string;
  date: string;
  orders: number;
  income: number;
  work_hours: number;
  weather: string;
  note: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbSettings {
  id?: string;
  user_id: string;
  rider_name: string;
  monthly_goal: number;
  daily_goal: number;
  base_price: number;
  bonus_price: number;
  bonus_threshold: number;
  work_days_per_week: number;
  current_shift: string;
  shift_start_date?: string;
  weekly_shifts?: string;
  updated_at?: string;
}

// ── Cloud Sync ──

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

let syncStatus: SyncStatus = "idle";
let syncListeners: Array<(s: SyncStatus) => void> = [];

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function onSyncChange(cb: (s: SyncStatus) => void) {
  syncListeners.push(cb);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== cb);
  };
}

function setSyncStatus(s: SyncStatus) {
  syncStatus = s;
  syncListeners.forEach((cb) => cb(s));
}

export interface SyncSettings {
  riderName: string;
  monthlyGoal: number;
  dailyGoal: number;
  basePrice: number;
  bonusPrice: number;
  bonusThreshold: number;
  workDaysPerWeek: number;
  currentShift: string;
  shiftStartDate?: string;
  weeklyShifts?: Record<string, string>;
}

// ── Push to Cloud ──

export async function pushRecordsToCloud(
  userId: string,
  records: Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }>,
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;

  try {
    const dbRecords: DbRecord[] = Object.values(records).map((r) => ({
      user_id: userId,
      date: r.date,
      orders: r.orders,
      income: r.income,
      work_hours: r.workHours,
      weather: r.weather,
      note: r.note || "",
    }));

    const client = getSupabase();
    if (!client) return false;
    const { error } = await client.from("daily_records").upsert(dbRecords, {
      onConflict: "user_id,date",
    });
    return !error;
  } catch {
    return false;
  }
}

export async function pushSingleRecordToCloud(
  userId: string,
  record: { date: string; orders: number; income: number; workHours: number; weather: string; note: string },
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;

  try {
    const client = getSupabase();
    if (!client) return false;
    const { error } = await client.from("daily_records").upsert(
      {
        user_id: userId,
        date: record.date,
        orders: record.orders,
        income: record.income,
        work_hours: record.workHours,
        weather: record.weather,
        note: record.note || "",
      },
      { onConflict: "user_id,date" }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function deleteRecordFromCloud(userId: string, date: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;

  try {
    const client = getSupabase();
    if (!client) return false;
    const { error } = await client
      .from("daily_records")
      .delete()
      .eq("user_id", userId)
      .eq("date", date);
    return !error;
  } catch {
    return false;
  }
}

// 清空用户所有云端数据（用于 resetData）
export async function clearAllCloudData(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;

  try {
    const client = getSupabase();
    if (!client) return false;
    const [{ error: rErr }, { error: sErr }] = await Promise.all([
      client.from("daily_records").delete().eq("user_id", userId),
      client.from("user_settings").delete().eq("user_id", userId),
    ]);
    return !rErr && !sErr;
  } catch {
    return false;
  }
}

export async function pushSettingsToCloud(userId: string, settings: SyncSettings): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;

  try {
    const client = getSupabase();
    if (!client) return false;
    const { error } = await client.from("user_settings").upsert(
      {
        user_id: userId,
        rider_name: settings.riderName,
        monthly_goal: settings.monthlyGoal,
        daily_goal: settings.dailyGoal,
        base_price: settings.basePrice,
        bonus_price: settings.bonusPrice,
        bonus_threshold: settings.bonusThreshold,
        work_days_per_week: settings.workDaysPerWeek,
        current_shift: settings.currentShift,
        shift_start_date: settings.shiftStartDate,
        weekly_shifts: settings.weeklyShifts ? JSON.stringify(settings.weeklyShifts) : undefined,
      },
      { onConflict: "user_id" }
    );
    return !error;
  } catch {
    return false;
  }
}

// ── Pull from Cloud ──

export async function pullRecordsFromCloud(userId: string): Promise<Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }> | null> {
  if (!isSupabaseConfigured() || !userId) return null;

  try {
    const client = getSupabase();
    if (!client) return null;
    const { data, error } = await client
      .from("daily_records")
      .select("*")
      .eq("user_id", userId);

    if (error || !data) return null;

    const records: Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }> = {};
    (data as DbRecord[]).forEach((r) => {
      records[r.date] = {
        date: r.date,
        orders: r.orders,
        income: r.income,
        workHours: r.work_hours,
        weather: r.weather,
        note: r.note || "",
      };
    });
    return records;
  } catch {
    return null;
  }
}

export async function pullSettingsFromCloud(userId: string): Promise<SyncSettings | null> {
  if (!isSupabaseConfigured() || !userId) return null;

  try {
    const client = getSupabase();
    if (!client) return null;
    const { data, error } = await client
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) return null;

    const s = data as DbSettings;
    let weeklyShifts: Record<string, string> | undefined;
    if (s.weekly_shifts) {
      try {
        const parsed = JSON.parse(s.weekly_shifts);
        if (parsed && typeof parsed === "object") weeklyShifts = parsed;
      } catch { /* ignore */ }
    }
    return {
      riderName: s.rider_name,
      monthlyGoal: s.monthly_goal,
      dailyGoal: s.daily_goal,
      basePrice: s.base_price,
      bonusPrice: s.bonus_price,
      bonusThreshold: s.bonus_threshold,
      workDaysPerWeek: s.work_days_per_week,
      currentShift: s.current_shift || "early_mid",
      shiftStartDate: s.shift_start_date,
      weeklyShifts,
    };
  } catch {
    return null;
  }
}

// ── Full Sync (pull + merge) ──

export async function syncFromCloud(userId: string): Promise<{
  records: Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }> | null;
  settings: SyncSettings | null;
}> {
  if (!isSupabaseConfigured() || !userId) {
    setSyncStatus("offline");
    return { records: null, settings: null };
  }

  setSyncStatus("syncing");
  try {
    const [records, settings] = await Promise.all([
      pullRecordsFromCloud(userId),
      pullSettingsFromCloud(userId),
    ]);
    setSyncStatus("synced");
    return { records, settings };
  } catch {
    setSyncStatus("error");
    return { records: null, settings: null };
  }
}

// ── Auto-sync on data change ──

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSync(
  userId: string,
  records: Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }>,
  settings: SyncSettings
) {
  if (!isSupabaseConfigured() || !userId) return;

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    setSyncStatus("syncing");
    try {
      const [recordsOk, settingsOk] = await Promise.all([
        pushRecordsToCloud(userId, records),
        pushSettingsToCloud(userId, settings),
      ]);
      setSyncStatus(recordsOk && settingsOk ? "synced" : "error");
    } catch {
      setSyncStatus("error");
    }
  }, 500);
}