import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = (): boolean => {
  return supabaseUrl !== "" && supabaseAnonKey !== "";
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
  updated_at?: string;
}

// Sync functions
export async function syncRecordsToCloud(
  userId: string,
  records: Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }>
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

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

export async function syncSettingsToCloud(
  userId: string,
  settings: {
    riderName: string;
    monthlyGoal: number;
    dailyGoal: number;
    basePrice: number;
    bonusPrice: number;
    bonusThreshold: number;
    workDaysPerWeek: number;
  }
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

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
      },
      { onConflict: "user_id" }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function pullRecordsFromCloud(userId: string): Promise<Record<string, { date: string; orders: number; income: number; workHours: number; weather: string; note: string }> | null> {
  if (!isSupabaseConfigured()) return null;

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

export async function pullSettingsFromCloud(userId: string): Promise<{
  riderName: string;
  monthlyGoal: number;
  dailyGoal: number;
  basePrice: number;
  bonusPrice: number;
  bonusThreshold: number;
  workDaysPerWeek: number;
} | null> {
  if (!isSupabaseConfigured()) return null;

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
    };
  } catch {
    return null;
  }
}