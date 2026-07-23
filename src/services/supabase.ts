import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = (): boolean => {
  return supabaseUrl !== "" && supabaseAnonKey !== "" && !supabaseUrl.includes("your-project");
};

// Database types
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

// Generate persistent device ID
export function getDeviceId(): string {
  const key = "rider-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// Push records to cloud
export async function pushRecordsToCloud(
  records: Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }>
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const userId = getDeviceId();

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

    const { error } = await supabase.from("daily_records").upsert(dbRecords, {
      onConflict: "user_id,date",
    });
    return !error;
  } catch {
    return false;
  }
}

// Push single record to cloud
export async function pushSingleRecordToCloud(
  record: { date: string; orders: number; income: number; workHours: number; weather: string; note: string }
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const userId = getDeviceId();

  try {
    const { error } = await supabase.from("daily_records").upsert(
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

// Delete record from cloud
export async function deleteRecordFromCloud(date: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const userId = getDeviceId();

  try {
    const { error } = await supabase
      .from("daily_records")
      .delete()
      .eq("user_id", userId)
      .eq("date", date);
    return !error;
  } catch {
    return false;
  }
}

// Push settings to cloud
export async function pushSettingsToCloud(settings: {
  riderName: string;
  monthlyGoal: number;
  dailyGoal: number;
  basePrice: number;
  bonusPrice: number;
  bonusThreshold: number;
  workDaysPerWeek: number;
  currentShift: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const userId = getDeviceId();

  try {
    const { error } = await supabase.from("user_settings").upsert(
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
      },
      { onConflict: "user_id" }
    );
    return !error;
  } catch {
    return false;
  }
}

// ── Pull from Cloud ──

export async function pullRecordsFromCloud(): Promise<Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }> | null> {
  if (!isSupabaseConfigured()) return null;
  const userId = getDeviceId();

  try {
    const { data, error } = await supabase
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

export async function pullSettingsFromCloud(): Promise<{
  riderName: string;
  monthlyGoal: number;
  dailyGoal: number;
  basePrice: number;
  bonusPrice: number;
  bonusThreshold: number;
  workDaysPerWeek: number;
  currentShift: string;
} | null> {
  if (!isSupabaseConfigured()) return null;
  const userId = getDeviceId();

  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) return null;

    const s = data as DbSettings;
    return {
      riderName: s.rider_name,
      monthlyGoal: s.monthly_goal,
      dailyGoal: s.daily_goal,
      basePrice: s.base_price,
      bonusPrice: s.bonus_price,
      bonusThreshold: s.bonus_threshold,
      workDaysPerWeek: s.work_days_per_week,
      currentShift: s.current_shift || "early_mid",
    };
  } catch {
    return null;
  }
}

// ── Full Sync (pull + merge) ──

export async function syncFromCloud(): Promise<{
  records: Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }> | null;
  settings: {
    riderName: string;
    monthlyGoal: number;
    dailyGoal: number;
    basePrice: number;
    bonusPrice: number;
    bonusThreshold: number;
    workDaysPerWeek: number;
    currentShift: string;
  } | null;
}> {
  if (!isSupabaseConfigured()) {
    setSyncStatus("offline");
    return { records: null, settings: null };
  }

  setSyncStatus("syncing");
  try {
    const [records, settings] = await Promise.all([
      pullRecordsFromCloud(),
      pullSettingsFromCloud(),
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
  records: Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }>,
  settings: {
    riderName: string;
    monthlyGoal: number;
    dailyGoal: number;
    basePrice: number;
    bonusPrice: number;
    bonusThreshold: number;
    workDaysPerWeek: number;
    currentShift: string;
  }
) {
  if (!isSupabaseConfigured()) return;

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    setSyncStatus("syncing");
    try {
      const [recordsOk, settingsOk] = await Promise.all([
        pushRecordsToCloud(records),
        pushSettingsToCloud(settings),
      ]);
      setSyncStatus(recordsOk && settingsOk ? "synced" : "error");
    } catch {
      setSyncStatus("error");
    }
  }, 500);
}