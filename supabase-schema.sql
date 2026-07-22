-- 骑手工作台 Supabase 数据库 Schema
-- 在 Supabase SQL Editor 中执行以下 SQL 创建表

-- 每日记录表
CREATE TABLE IF NOT EXISTS daily_records (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  orders INTEGER NOT NULL DEFAULT 0,
  income INTEGER NOT NULL DEFAULT 0,
  work_hours REAL NOT NULL DEFAULT 8,
  weather TEXT NOT NULL DEFAULT 'sunny',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  rider_name TEXT NOT NULL DEFAULT '骑手小哥',
  monthly_goal INTEGER NOT NULL DEFAULT 1000,
  daily_goal INTEGER NOT NULL DEFAULT 40,
  base_price REAL NOT NULL DEFAULT 4.2,
  bonus_price REAL NOT NULL DEFAULT 4.5,
  bonus_threshold INTEGER NOT NULL DEFAULT 1500,
  work_days_per_week INTEGER NOT NULL DEFAULT 6,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_daily_records_user_date ON daily_records(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records(date);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- 启用 RLS
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS 策略：允许所有操作（因为是个人应用，基于 user_id 隔离即可）
CREATE POLICY "Allow all on daily_records" ON daily_records
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on user_settings" ON user_settings
  FOR ALL USING (true) WITH CHECK (true);

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_records_updated_at
  BEFORE UPDATE ON daily_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();