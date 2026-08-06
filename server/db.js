import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "data", "rider-workbench.db");

// Ensure data directory exists
import fs from "fs";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    orders INTEGER NOT NULL DEFAULT 0,
    income INTEGER NOT NULL DEFAULT 0,
    work_hours REAL NOT NULL DEFAULT 0,
    weather TEXT NOT NULL DEFAULT 'sunny',
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, date)
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    rider_name TEXT NOT NULL DEFAULT 'Power',
    monthly_goal INTEGER NOT NULL DEFAULT 1000,
    daily_goal INTEGER NOT NULL DEFAULT 40,
    base_price REAL NOT NULL DEFAULT 4.2,
    bonus_price REAL NOT NULL DEFAULT 4.5,
    bonus_threshold INTEGER NOT NULL DEFAULT 1500,
    work_days_per_week INTEGER NOT NULL DEFAULT 6,
    current_shift TEXT NOT NULL DEFAULT 'early_mid',
    weekly_shifts TEXT,
    shift_start_date TEXT,
    weekly_shifts_updated_at INTEGER,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_records_user_date ON daily_records(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_records_date ON daily_records(date);
`);

// 兼容旧数据库：补充班次相关字段
const shiftColumns = [
  "weekly_shifts TEXT",
  "shift_start_date TEXT",
  "weekly_shifts_updated_at INTEGER",
];
for (const colDef of shiftColumns) {
  try {
    db.exec(`ALTER TABLE user_settings ADD COLUMN ${colDef}`);
  } catch {
    // 字段已存在时忽略
  }
}

// Prepare statements for better performance
const stmts = {
  upsertRecord: db.prepare(`
    INSERT INTO daily_records (user_id, date, orders, income, work_hours, weather, note, updated_at)
    VALUES (@user_id, @date, @orders, @income, @work_hours, @weather, @note, datetime('now'))
    ON CONFLICT(user_id, date) DO UPDATE SET
      orders = excluded.orders,
      income = excluded.income,
      work_hours = excluded.work_hours,
      weather = excluded.weather,
      note = excluded.note,
      updated_at = datetime('now')
  `),

  getRecords: db.prepare(`
    SELECT date, orders, income, work_hours, weather, note, created_at, updated_at
    FROM daily_records
    WHERE user_id = ?
    ORDER BY date ASC
  `),

  getRecord: db.prepare(`
    SELECT date, orders, income, work_hours, weather, note, created_at, updated_at
    FROM daily_records
    WHERE user_id = ? AND date = ?
  `),

  deleteRecord: db.prepare(`
    DELETE FROM daily_records
    WHERE user_id = ? AND date = ?
  `),

  getSettings: db.prepare(`
    SELECT rider_name, monthly_goal, daily_goal, base_price, bonus_price,
           bonus_threshold, work_days_per_week, current_shift,
           weekly_shifts, shift_start_date, weekly_shifts_updated_at, updated_at
    FROM user_settings
    WHERE user_id = ?
  `),

  upsertSettings: db.prepare(`
    INSERT INTO user_settings (user_id, rider_name, monthly_goal, daily_goal, base_price,
      bonus_price, bonus_threshold, work_days_per_week, current_shift,
      weekly_shifts, shift_start_date, weekly_shifts_updated_at, updated_at)
    VALUES (@user_id, @rider_name, @monthly_goal, @daily_goal, @base_price,
      @bonus_price, @bonus_threshold, @work_days_per_week, @current_shift,
      @weekly_shifts, @shift_start_date, @weekly_shifts_updated_at, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      rider_name = excluded.rider_name,
      monthly_goal = excluded.monthly_goal,
      daily_goal = excluded.daily_goal,
      base_price = excluded.base_price,
      bonus_price = excluded.bonus_price,
      bonus_threshold = excluded.bonus_threshold,
      work_days_per_week = excluded.work_days_per_week,
      current_shift = excluded.current_shift,
      weekly_shifts = excluded.weekly_shifts,
      shift_start_date = excluded.shift_start_date,
      weekly_shifts_updated_at = excluded.weekly_shifts_updated_at,
      updated_at = datetime('now')
  `),

  getStats: db.prepare(`
    SELECT
      COUNT(*) as total_days,
      SUM(orders) as total_orders,
      SUM(income) as total_income,
      AVG(orders) as avg_orders,
      MAX(orders) as max_orders
    FROM daily_records
    WHERE user_id = ?
  `),
};

export { db, stmts };