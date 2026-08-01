-- 在 Supabase SQL Editor 中执行以下 SQL 创建数据表
-- 注意：本应用使用设备 ID 而非 Supabase Auth，因此不启用 RLS

-- 每日记录表
CREATE TABLE IF NOT EXISTS daily_records (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  orders INTEGER NOT NULL DEFAULT 0,
  income INTEGER NOT NULL DEFAULT 0,
  work_hours NUMERIC(4,1) NOT NULL DEFAULT 0,
  weather TEXT NOT NULL DEFAULT 'sunny',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  rider_name TEXT NOT NULL DEFAULT 'Power',
  monthly_goal INTEGER NOT NULL DEFAULT 1000,
  daily_goal INTEGER NOT NULL DEFAULT 40,
  base_price NUMERIC(5,2) NOT NULL DEFAULT 4.2,
  bonus_price NUMERIC(5,2) NOT NULL DEFAULT 4.5,
  bonus_threshold INTEGER NOT NULL DEFAULT 1500,
  work_days_per_week INTEGER NOT NULL DEFAULT 6,
  current_shift TEXT NOT NULL DEFAULT 'early_mid',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_daily_records_user_id ON daily_records(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records(date);

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_daily_records_updated_at
  BEFORE UPDATE ON daily_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();