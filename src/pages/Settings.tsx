import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Cloud, CloudOff, CheckCircle2, AlertCircle, RefreshCw, Save, Trash2,
  ExternalLink, User, Target, Coins, Gift, Calendar, Briefcase, Database,
  Upload, Download, Info, RotateCcw, Beaker, MapPin, Navigation, Search,
  Palette, Smartphone, Zap,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import useStore from "@/store/useStore";
import { showToast } from "@/components/shared/Toast";
import { exportBackup, importBackup } from "@/utils/storage";
import { today } from "@/utils/date";
import { SHIFT_DEFINITIONS } from "@/types";
import { searchCities, getUserLocation } from "@/services/weather";
import { useTheme } from "@/hooks/useTheme";
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
  const settings = useStore(useShallow((s) => s.settings));
  const updateSettings = useStore((s) => s.updateSettings);
  const loadDemoData = useStore((s) => s.loadDemoData);
  const resetData = useStore((s) => s.resetData);
  const records = useStore(useShallow((s) => s.records));
  const achievements = useStore(useShallow((s) => s.achievements));

  // 云端同步表单
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [testing, setTesting] = useState(false);

  // 城市定位
  const [cityInput, setCityInput] = useState(settings.city || "");
  const [cityResults, setCityResults] = useState<Array<{ name: string; lat: number; lon: number; admin1?: string }>>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setUserId(getSyncUserId());
    const unsub = onSyncChange(setStatus);
    return unsub;
  }, []);

  const handleSaveCloud = useCallback(() => {
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

  const handleClearCloud = useCallback(() => {
    clearSupabaseConfig();
    setUrl("");
    setAnonKey("");
    showToast("云端配置已清除", "info");
  }, []);

  // 本地设置便捷更新
  const updateSetting = useCallback(
    (patch: Parameters<typeof updateSettings>[0]) => {
      updateSettings(patch);
    },
    [updateSettings]
  );

  // 城市搜索与定位
  const handleSearchCity = useCallback(async () => {
    if (!cityInput.trim()) return;
    setCityLoading(true);
    setCityResults([]);
    try {
      const results = await searchCities(cityInput.trim());
      if (results.length === 0) {
        showToast("未找到该城市，请尝试其他关键词", "error");
      } else {
        setCityResults(results);
      }
    } finally {
      setCityLoading(false);
    }
  }, [cityInput]);

  const handleSelectCity = useCallback((result: typeof cityResults[number]) => {
    updateSetting({ city: result.name, cityCoords: { lat: result.lat, lon: result.lon } });
    setCityInput(result.name);
    setCityResults([]);
    showToast(`天气定位已设置为 ${result.name}`, "success");
  }, [updateSetting]);

  const handleDetectLocation = useCallback(async () => {
    setLocating(true);
    try {
      const loc = await getUserLocation();
      if (loc) {
        updateSetting({ city: undefined, cityCoords: { lat: loc.lat, lon: loc.lon } });
        setCityInput("");
        setCityResults([]);
        showToast("已切换到自动 GPS 定位", "success");
      } else {
        showToast("无法获取当前位置，请检查定位权限", "error");
      }
    } finally {
      setLocating(false);
    }
  }, [updateSetting]);

  // 数据管理
  const handleExportJSON = () => {
    const json = exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlObj;
    a.download = `Power数据备份_${today()}.json`;
    a.click();
    URL.revokeObjectURL(urlObj);
    showToast("数据备份成功", "success");
  };

  const handleImportJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (importBackup(text)) {
          window.location.reload();
          showToast("数据恢复成功", "success");
        } else {
          showToast("备份文件格式无效", "error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleLoadDemo = () => {
    if (window.confirm("加载演示数据会覆盖当前所有记录，确定继续？")) {
      loadDemoData();
      showToast("演示数据已加载", "success");
    }
  };

  const handleReset = () => {
    if (
      window.confirm(
        "警告：重置将清空所有记录和成就，但保留设置。此操作不可恢复，确定继续？"
      )
    ) {
      resetData();
      window.location.reload();
    }
  };

  const configured = isSupabaseConfigured();
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const { isIOS } = useTheme(settings.theme);

  const stats = useMemo(() => {
    const recordCount = Object.keys(records).length;
    const unlockedCount = achievements.filter((a) => a.unlocked).length;
    return { recordCount, unlockedCount };
  }, [records, achievements]);

  return (
    <motion.div className="px-4 pt-6 pb-24 space-y-5" variants={container} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={item} className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-[#E0E0E0] neon-cyan tracking-[-0.01em]">系统设置中心</h1>
        <p className="terminal-text text-xs tracking-tight">个人资料 · 目标 · 班次 · 云端 · 数据</p>
      </motion.div>

      {/* 界面主题 */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets space-y-4">
        <h3 className="cyber-section-title text-sm font-medium tracking-tight">
          <Palette size={16} className="icon-glow-cyan" />
          界面主题
        </h3>
        <div className="theme-selector" data-active-theme={settings.theme}>
          <button
            onClick={() => updateSetting({ theme: "cyber" })}
            data-active={settings.theme === "cyber"}
            className="flex flex-col items-center gap-1 p-3 transition-all tap-cyber"
          >
            <Zap size={20} strokeWidth={1.8} />
            <span className="text-xs font-medium">赛博朋克</span>
            <span className="text-[9px] terminal-text">霓虹 · 全息</span>
          </button>
          <button
            onClick={() => updateSetting({ theme: "ios" })}
            data-active={settings.theme === "ios"}
            className="flex flex-col items-center gap-1 p-3 transition-all tap-cyber"
          >
            <Smartphone size={20} strokeWidth={1.8} />
            <span className="text-xs font-medium">iOS 苹果风</span>
            <span className="text-[9px] terminal-text">原生 · 简洁</span>
          </button>
        </div>
      </motion.div>

      {/* 个人资料 */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets space-y-4">
        <h3 className="cyber-section-title text-sm font-medium tracking-tight">
          <User size={16} className="icon-glow-cyan" />
          个人资料
        </h3>
        <div>
          <label className="block terminal-text text-xs mb-2 tracking-tight">骑手昵称</label>
          <input
            type="text"
            value={settings.riderName}
            onChange={(e) => updateSetting({ riderName: e.target.value })}
            placeholder="你的称呼"
            className="input-cyber w-full text-sm"
          />
        </div>
      </motion.div>

      {/* 目标与奖励 */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets space-y-4">
        <h3 className="cyber-section-title text-sm font-medium tracking-tight">
          <Target size={16} className="icon-glow-magenta" />
          目标与奖励
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block terminal-text text-xs mb-2 tracking-tight">月度目标（单）</label>
            <input
              type="number"
              min={1}
              value={settings.monthlyGoal}
              onChange={(e) => updateSetting({ monthlyGoal: Math.max(1, parseInt(e.target.value) || 0) })}
              className="input-cyber w-full text-sm"
            />
          </div>
          <div>
            <label className="block terminal-text text-xs mb-2 tracking-tight">每日目标（单）</label>
            <input
              type="number"
              min={1}
              value={settings.dailyGoal}
              onChange={(e) => updateSetting({ dailyGoal: Math.max(1, parseInt(e.target.value) || 0) })}
              className="input-cyber w-full text-sm"
            />
          </div>
          <div>
            <label className="block terminal-text text-xs mb-2 tracking-tight flex items-center gap-1">
              <Coins size={12} /> 基础单价（¥）
            </label>
            <input
              type="number"
              step="0.1"
              min={0}
              value={settings.basePrice}
              onChange={(e) => updateSetting({ basePrice: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="input-cyber w-full text-sm"
            />
          </div>
          <div>
            <label className="block terminal-text text-xs mb-2 tracking-tight flex items-center gap-1">
              <Gift size={12} /> 奖励单价（¥）
            </label>
            <input
              type="number"
              step="0.1"
              min={0}
              value={settings.bonusPrice}
              onChange={(e) => updateSetting({ bonusPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="input-cyber w-full text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block terminal-text text-xs mb-2 tracking-tight">奖励门槛（单/月）</label>
          <input
            type="number"
            min={1}
            value={settings.bonusThreshold}
            onChange={(e) => updateSetting({ bonusThreshold: Math.max(1, parseInt(e.target.value) || 0) })}
            className="input-cyber w-full text-sm"
          />
          <p className="text-[#E0E0E0]/30 text-[10px] mt-1.5 leading-relaxed">
            当月单量达到门槛后，系统会自动按奖励单价重新计算收入。
          </p>
        </div>
      </motion.div>

      {/* 班次偏好 */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets space-y-4">
        <h3 className="cyber-section-title text-sm font-medium tracking-tight">
          <Briefcase size={16} className="icon-glow-gold" />
          班次偏好
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block terminal-text text-xs mb-2 tracking-tight">当前班次</label>
            <select
              value={settings.currentShift}
              onChange={(e) => updateSetting({ currentShift: e.target.value as typeof settings.currentShift })}
              className="input-cyber w-full text-sm appearance-none"
              style={{ backgroundImage: "none" }}
            >
              {SHIFT_DEFINITIONS.map((s) => (
                <option key={s.type} value={s.type}>
                  {s.emoji} {s.name} · {s.timeRange}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block terminal-text text-xs mb-2 tracking-tight">每周工作天数</label>
            <input
              type="number"
              min={1}
              max={7}
              value={settings.workDaysPerWeek}
              onChange={(e) =>
                updateSetting({ workDaysPerWeek: Math.min(7, Math.max(1, parseInt(e.target.value) || 1)) })
              }
              className="input-cyber w-full text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block terminal-text text-xs mb-2 tracking-tight flex items-center gap-1">
            <Calendar size={12} /> 班次起始周一
          </label>
          <input
            type="date"
            value={settings.shiftStartDate || ""}
            onChange={(e) => updateSetting({ shiftStartDate: e.target.value })}
            className="input-cyber w-full text-sm"
          />
          <p className="text-[#E0E0E0]/30 text-[10px] mt-1.5 leading-relaxed">
            系统从该周一开始按 5 种班次自动轮换，您可在周报页面单独覆盖某周班次。
          </p>
        </div>
      </motion.div>

      {/* 天气定位 */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets space-y-4">
        <h3 className="cyber-section-title text-sm font-medium tracking-tight">
          <MapPin size={16} className="icon-glow-cyan" />
          天气定位
        </h3>
        <div className="flex items-center gap-2 text-xs text-[#E0E0E0]/50">
          <Navigation size={12} />
          <span>
            {settings.city
              ? `当前定位：${settings.city}`
              : settings.cityCoords
              ? "当前定位：自动 GPS 位置"
              : "当前定位：未设置，将自动使用 GPS"}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchCity()}
            placeholder="输入城市名，如：北京"
            className="input-cyber flex-1 text-sm"
          />
          <button
            onClick={handleSearchCity}
            disabled={cityLoading || !cityInput.trim()}
            className="btn-cyber px-3 rounded-xl flex items-center justify-center"
          >
            {cityLoading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
          </button>
          <button
            onClick={handleDetectLocation}
            disabled={locating}
            className="btn-cyber px-3 rounded-xl flex items-center justify-center"
            title="使用当前 GPS 位置"
          >
            {locating ? <RefreshCw size={16} className="animate-spin" /> : <Navigation size={16} />}
          </button>
        </div>
        {cityResults.length > 0 && (
          <div className="space-y-2">
            <p className="terminal-text text-xs text-[#E0E0E0]/40">请选择匹配的城市：</p>
            <div className="grid gap-2">
              {cityResults.map((r) => (
                <button
                  key={`${r.lat}-${r.lon}`}
                  onClick={() => handleSelectCity(r)}
                  className="text-left px-3 py-2 rounded-xl bg-[#00E5FF]/5 border border-[#00E5FF]/10 text-sm text-[#E0E0E0]/80 hover:bg-[#00E5FF]/10 transition-colors"
                >
                  {r.name} {r.admin1 ? `· ${r.admin1}` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-[#E0E0E0]/30 text-[10px] leading-relaxed">
          设置城市后，系统会优先按该城市获取天气，记录单量时自动绑定当天天气。留空则使用 GPS 定位。
        </p>
      </motion.div>

      {/* 云端同步 */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets space-y-4">
        <h3 className="cyber-section-title text-sm font-medium mb-2 tracking-tight">
          <Cloud size={16} className="icon-glow-cyan" />
          云端同步
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
            onClick={handleSaveCloud}
            disabled={testing}
            className="btn-cyber-primary flex-[2] py-3.5 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            {testing ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{testing ? "测试中..." : "保存并连接"}</span>
          </button>
          {configured && (
            <button
              onClick={handleClearCloud}
              className="btn-cyber-danger flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              <span>清除</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* 数据管理 */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets space-y-4">
        <h3 className="cyber-section-title text-sm font-medium tracking-tight">
          <Database size={16} className="icon-glow-green" />
          数据管理
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-2 py-3 rounded-xl tap-cyber"
            style={{ background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.12)" }}
          >
            <Download size={16} className="text-[#00E5FF]" />
            <span className="text-sm font-medium text-[#E0E0E0]/80">备份数据</span>
          </button>
          <button
            onClick={handleImportJSON}
            className="flex items-center justify-center gap-2 py-3 rounded-xl tap-cyber"
            style={{ background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.12)" }}
          >
            <Upload size={16} className="text-[#00E5FF]" />
            <span className="text-sm font-medium text-[#E0E0E0]/80">恢复数据</span>
          </button>
          <button
            onClick={handleLoadDemo}
            className="flex items-center justify-center gap-2 py-3 rounded-xl tap-cyber"
            style={{ background: "rgba(255,215,64,0.05)", border: "1px solid rgba(255,215,64,0.12)" }}
          >
            <Beaker size={16} className="text-[#FFD740]" />
            <span className="text-sm font-medium text-[#E0E0E0]/80">加载演示</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 py-3 rounded-xl tap-cyber"
            style={{ background: "rgba(255,23,68,0.05)", border: "1px solid rgba(255,23,68,0.12)" }}
          >
            <RotateCcw size={16} className="text-[#FF1744]" />
            <span className="text-sm font-medium text-[#E0E0E0]/80">重置数据</span>
          </button>
        </div>
      </motion.div>

      {/* 关于 */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets space-y-3">
        <h3 className="cyber-section-title text-sm font-medium tracking-tight">
          <Info size={16} className="icon-glow-magenta" />
          关于
        </h3>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold"
            style={{
              background: "linear-gradient(135deg, rgba(0,229,255,0.12), rgba(224,64,251,0.08))",
              border: "1px solid rgba(0,229,255,0.2)",
            }}
          >
            P
          </div>
          <div>
            <p className="text-[#E0E0E0] font-bold text-sm">RIDER POWER</p>
            <p className="terminal-text text-[10px] text-[#E0E0E0]/40">骑手工作台 · 智能预测系统 v7.1</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 rounded-xl bg-[#00E5FF]/3 border border-[#00E5FF]/8">
            <p className="text-xl font-bold text-[#00E5FF]">{stats.recordCount}</p>
            <p className="terminal-text text-[9px] text-[#E0E0E0]/40">记录总数</p>
          </div>
          <div className="p-3 rounded-xl bg-[#FFD740]/3 border border-[#FFD740]/8">
            <p className="text-xl font-bold text-[#FFD740]">{stats.unlockedCount}</p>
            <p className="terminal-text text-[9px] text-[#E0E0E0]/40">已解锁成就</p>
          </div>
        </div>
      </motion.div>

      {/* 配置指南 */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-5 corner-brackets">
        <h3 className="cyber-section-title text-sm font-medium mb-3 tracking-tight">
          <ExternalLink size={16} className="icon-glow-magenta" />
          如何获取云端配置
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
