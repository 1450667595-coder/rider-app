-- ═══════════════════════════════════════════════════════
-- 骑手工作台 Supabase 数据库修复脚本
-- 请在 Supabase SQL Editor 中完整执行此脚本
-- ═══════════════════════════════════════════════════════

-- 1. 禁用 RLS（本应用使用 anon key + syncKey 隔离，不需要 RLS）
ALTER TABLE IF EXISTS daily_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_settings DISABLE ROW LEVEL SECURITY;

-- 2. 确保表结构正确
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
  sync_key TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 添加 sync_key 列（兼容旧表）
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS sync_key TEXT NOT NULL DEFAULT '';

-- 4. 授予 anon 角色完整权限
GRANT ALL ON daily_records TO anon;
GRANT ALL ON user_settings TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 5. 索引优化
CREATE INDEX IF NOT EXISTS idx_daily_records_user_id ON daily_records(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records(date);
CREATE INDEX IF NOT EXISTS idx_daily_records_user_date ON daily_records(user_id, date);

-- 6. 自动更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_daily_records_updated_at ON daily_records;
CREATE TRIGGER update_daily_records_updated_at
  BEFORE UPDATE ON daily_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();