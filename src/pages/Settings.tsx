import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Cloud, CloudOff, CheckCircle2, AlertCircle, RefreshCw, Save, Trash2, Shield, ExternalLink } from "lucide-react";
import useStore from "@/store/useStore";
import { showToast } from "@/components/shared/Toast";
import {
  isSupabaseConfigured,
  getSyncUserId,
  setSyncUserId,
  setSupabaseConfig,
  clearSupabaseConfig,
  getSyncStatus,
  onSyncChange,
  syncFromCloud,
  type SyncStatus,
} from "@/services/supabase";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.005 } },
};

const item = {
  hidden: { opacity: 0, y: 2 },
  show: { opacity: 1, y: 0, transition: { duration: 0.08, ease: [0.25, 0.1, 0.25, 1] } },
};

const STATUS_CONFIG: Record<SyncStatus, { icon: typeof Cloud; color: string; label: string }> = {
  idle: { icon: Cloud, color: "text-[#E0E0E0]/25", label: "就绪" },
  syncing: { icon: RefreshCw, color: "text-[#00E5FF] animate-spin", label: "同步中" },
  synced: { icon: CheckCircle2, color: "text-[#00E676]", label: "已同步" },
  error: { icon: AlertCircle, color: "text-[#FF1744]", label: "错误" },
  offline: { icon: CloudOff, color: "text-[#E0E0E0]/25", label: "离线" },
};

export default function Settings() {
  const loadData = useStore((s) => s.loadData);
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setUserId(getSyncUserId());
    const unsub = onSyncChange(setStatus);
    return unsub;
  }, []);

  const handleSave = useCallback(() => {
    if (!url.trim() || !anonKey.trim()) {
      showToast("请填写 Supabase URL 和 Anon Key", "error");
      return;
    }
    if (!url.startsWith("https://")) {
      showToast("URL 必须以 https:// 开头", "error");
      return;
    }
    setSupabaseConfig(url, anonKey);
    if (userId.trim()) {
      setSyncUserId(userId.trim());
    }
    showToast("云端配置已保存，正在测试连接...", "success");
    setTesting(true);
    syncFromCloud(getSyncUserId())
      .then(() => {
        loadData();
        showToast("连接成功，数据已同步", "success");
      })
      .catch(() => {
        showToast("连接失败，请检查配置", "error");
      })
      .finally(() => setTesting(false));
  }, [url, anonKey, userId, loadData]);

  const handleClear = useCallback(() => {
    clearSupabaseConfig();
    setUrl("");
    setAnonKey("");
    showToast("云端配置已清除", "info");
  }, []);

  const configured = isSupabaseConfigured();
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <motion.div className="px-4 pt-6 pb-24 space-y-5" variants={container} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={item} className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-[#E0E0E0] neon-cyan tracking-[-0.01em]">云端同步设置</h1>
        <p className="terminal-text text-xs tracking-tight">配置 Supabase 数据库，实现全平台实时同步</p>
      </motion.div>

      {/* Current Status */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets">
        <h3 className="cyber-section-title text-sm font-medium mb-4 tracking-tight">
          <Cloud size={16} className="icon-glow-cyan" />
          当前状态
        </h3>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#E0E0E0]/4 border border-[#E0E0E0]/5">
          <Icon size={28} className={config.color} />
          <div>
            <p className={`text-lg font-bold ${config.color}`}>{config.label}</p>
            <p className="text-[#E0E0E0]/40 text-xs">
              {configured ? "已配置云端数据库" : "未配置云端数据库，数据仅保存在本地"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Config Form */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets space-y-4">
        <h3 className="cyber-section-title text-sm font-medium tracking-tight">
          <Shield size={16} className="icon-glow-gold" />
          数据库配置
        </h3>

        <div>
          <label className="block terminal-text text-xs mb-2 tracking-tight">Supabase URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-project-id.supabase.co"
            className="input-cyber w-full text-sm"
          />
        </div>

        <div>
          <label className="block terminal-text text-xs mb-2 tracking-tight">Supabase Anon Key</label>
          <input
            type="password"
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIs..."
            className="input-cyber w-full text-sm"
          />
        </div>

        <div>
          <label className="block terminal-text text-xs mb-2 tracking-tight">同步用户 ID（可选）</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="留空使用默认共享账号"
            className="input-cyber w-full text-sm"
          />
          <p className="text-[#E0E0E0]/30 text-[10px] mt-1.5 leading-relaxed">
            不同设备使用相同的用户 ID 才能同步数据。建议用手机号/邮箱作为 ID。
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={testing}
            className="btn-cyber-primary flex-[2] py-3.5 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            {testing ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{testing ? "测试中..." : "保存并连接"}</span>
          </button>
          {configured && (
            <button
              onClick={handleClear}
              className="btn-cyber-danger flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              <span>清除</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Guide */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets">
        <h3 className="cyber-section-title text-sm font-medium mb-3 tracking-tight">
          <ExternalLink size={16} className="icon-glow-magenta" />
          如何获取配置
        </h3>
        <ol className="space-y-2 text-[#E0E0E0]/60 text-xs leading-relaxed list-decimal list-inside">
          <li>访问 <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-[#00E5FF] underline">supabase.com</a> 注册/登录</li>
          <li>创建一个新项目（免费额度足够使用）</li>
          <li>在 Project Settings → API 中复制 URL 和 anon public API key</li>
          <li>在 SQL Editor 中执行下方建表语句</li>
          <li>将 URL 和 Key 填入上方表单保存</li>
        </ol>
        <pre className="mt-3 p-3 rounded-lg bg-[#020408] border border-[#00E5FF]/10 text-[10px] text-[#00E5FF]/80 overflow-x-auto leading-relaxed">
{`CREATE TABLE daily_records (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  orders INTEGER DEFAULT 0,
  income INTEGER DEFAULT 0,
  work_hours REAL DEFAULT 0,
  weather TEXT DEFAULT 'sunny',
  note TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  rider_name TEXT DEFAULT '',
  monthly_goal INTEGER DEFAULT 3000,
  daily_goal INTEGER DEFAULT 100,
  base_price REAL DEFAULT 5,
  bonus_price REAL DEFAULT 6,
  bonus_threshold INTEGER DEFAULT 40,
  work_days_per_week INTEGER DEFAULT 6,
  current_shift TEXT DEFAULT 'early_mid',
  shift_start_date TEXT,
  weekly_shifts TEXT,
  updated_at TIMESTAMP DEFAULT now()
);`}
        </pre>
      </motion.div>
    </motion.div>
  );
}
