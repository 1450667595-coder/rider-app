import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Cloud, CloudOff, CheckCircle2, AlertCircle, RefreshCw, Save,
  Upload, Download, Info, RotateCcw, Beaker,
  Palette, Smartphone, Zap,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import useStore from "@/store/useStore";
import { showToast } from "@/components/shared/Toast";
import { exportBackup, importBackup } from "@/utils/storage";
import { today } from "@/utils/date";
import { SHIFT_DEFINITIONS } from "@/types";
import { searchCities, getUserLocation } from "@/services/weather";
import {
  getSyncUserId,
  setSyncUserId,
  setSupabaseConfig,
  clearSupabaseConfig,
  getSyncStatus,
  onSyncChange,
  syncFromCloud,
  type SyncStatus,
} from "@/services/supabase";
import { IOSList, IOSListItem, IOSListSection } from "./IOSList";
import IOSCard from "./IOSCard";

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
};

const STATUS_CONFIG: Record<SyncStatus, { icon: typeof Cloud; color: string; label: string }> = {
  idle: { icon: Cloud, color: "#8E8E93", label: "就绪" },
  syncing: { icon: RefreshCw, color: "#007AFF", label: "同步中" },
  synced: { icon: CheckCircle2, color: "#34C759", label: "已同步" },
  error: { icon: AlertCircle, color: "#FF3B30", label: "错误" },
  offline: { icon: CloudOff, color: "#8E8E93", label: "离线" },
};

export default function IOSSettings() {
  const loadData = useStore((s) => s.loadData);
  const settings = useStore(useShallow((s) => s.settings));
  const updateSettings = useStore((s) => s.updateSettings);
  const loadDemoData = useStore((s) => s.loadDemoData);
  const resetData = useStore((s) => s.resetData);

  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [testing, setTesting] = useState(false);

  const [cityInput, setCityInput] = useState(settings.city || "");
  const [cityResults, setCityResults] = useState<Array<{ name: string; lat: number; lon: number; admin1?: string }>>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setUserId(getSyncUserId());
    const unsub = onSyncChange(setStatus);
    return unsub;
  }, []);

  const updateSetting = useCallback(
    (patch: Parameters<typeof updateSettings>[0]) => updateSettings(patch),
    [updateSettings]
  );

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
    if (userId.trim()) setSyncUserId(userId.trim());
    showToast("云端配置已保存，正在测试连接...", "success");
    setTesting(true);
    syncFromCloud(getSyncUserId())
      .then(() => {
        loadData();
        showToast("连接成功，数据已同步", "success");
      })
      .catch(() => showToast("连接失败，请检查配置", "error"))
      .finally(() => setTesting(false));
  }, [url, anonKey, userId, loadData]);

  const handleClearCloud = useCallback(() => {
    clearSupabaseConfig();
    setUrl("");
    setAnonKey("");
    showToast("云端配置已清除", "info");
  }, []);

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
    if (window.confirm("警告：重置将清空所有记录和成就，但保留设置。此操作不可恢复，确定继续？")) {
      resetData();
      window.location.reload();
    }
  };

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <motion.div
      className="px-4 pt-4 pb-8 space-y-2"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.04 } } }}
    >
      <motion.div variants={item} className="mb-6">
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--ios-label)", letterSpacing: "-0.03em" }}
        >
          设置
        </h1>
      </motion.div>

      {/* 界面主题 */}
      <motion.div variants={item}>
        <IOSListSection title="外观">
          <IOSCard padding="none">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Palette size={16} style={{ color: "var(--ios-system-blue)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--ios-label)" }}>
                  界面主题
                </span>
              </div>
              <div
                className="grid grid-cols-2 gap-1 p-1 rounded-xl"
                style={{ background: "var(--ios-fill)" }}
              >
                <button
                  onClick={() => updateSetting({ theme: "cyber" })}
                  className="flex flex-col items-center gap-1 py-3 rounded-lg transition-all"
                  style={{
                    background: settings.theme === "cyber" ? "var(--ios-grouped-secondary)" : "transparent",
                    color: settings.theme === "cyber" ? "var(--ios-system-blue)" : "var(--ios-label-secondary)",
                    boxShadow: settings.theme === "cyber" ? "var(--ios-shadow-xs)" : "none",
                  }}
                >
                  <Zap size={20} strokeWidth={1.8} />
                  <span className="text-xs font-medium">赛博朋克</span>
                  <span className="text-[9px]">霓虹 · 全息</span>
                </button>
                <button
                  onClick={() => updateSetting({ theme: "ios" })}
                  className="flex flex-col items-center gap-1 py-3 rounded-lg transition-all"
                  style={{
                    background: settings.theme === "ios" ? "var(--ios-grouped-secondary)" : "transparent",
                    color: settings.theme === "ios" ? "var(--ios-system-blue)" : "var(--ios-label-secondary)",
                    boxShadow: settings.theme === "ios" ? "var(--ios-shadow-xs)" : "none",
                  }}
                >
                  <Smartphone size={20} strokeWidth={1.8} />
                  <span className="text-xs font-medium">iOS 苹果风</span>
                  <span className="text-[9px]">原生 · 简洁</span>
                </button>
              </div>
            </div>
          </IOSCard>
        </IOSListSection>
      </motion.div>

      {/* 个人资料 */}
      <motion.div variants={item}>
        <IOSListSection title="个人资料">
          <IOSCard padding="md">
            <label className="block text-xs mb-2" style={{ color: "var(--ios-label-secondary)" }}>
              骑手昵称
            </label>
            <input
              type="text"
              value={settings.riderName}
              onChange={(e) => updateSetting({ riderName: e.target.value })}
              placeholder="你的称呼"
              className="w-full ios-input"
            />
          </IOSCard>
        </IOSListSection>
      </motion.div>

      {/* 目标与奖励 */}
      <motion.div variants={item}>
        <IOSListSection title="目标与奖励">
          <IOSCard padding="none">
            <div className="ios-list-item" style={{ borderBottom: "0.5px solid var(--ios-separator)" }}>
              <span style={{ color: "var(--ios-label)" }}>月度目标（单）</span>
              <input
                type="number"
                min={1}
                value={settings.monthlyGoal}
                onChange={(e) => updateSetting({ monthlyGoal: Math.max(1, parseInt(e.target.value) || 0) })}
                className="ios-input w-24 text-right"
              />
            </div>
            <div className="ios-list-item" style={{ borderBottom: "0.5px solid var(--ios-separator)" }}>
              <span style={{ color: "var(--ios-label)" }}>每日目标（单）</span>
              <input
                type="number"
                min={1}
                value={settings.dailyGoal}
                onChange={(e) => updateSetting({ dailyGoal: Math.max(1, parseInt(e.target.value) || 0) })}
                className="ios-input w-24 text-right"
              />
            </div>
            <div className="ios-list-item" style={{ borderBottom: "0.5px solid var(--ios-separator)" }}>
              <span style={{ color: "var(--ios-label)" }}>基础单价（¥）</span>
              <input
                type="number"
                step="0.1"
                min={0}
                value={settings.basePrice}
                onChange={(e) => updateSetting({ basePrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="ios-input w-24 text-right"
              />
            </div>
            <div className="ios-list-item" style={{ borderBottom: "0.5px solid var(--ios-separator)" }}>
              <span style={{ color: "var(--ios-label)" }}>奖励单价（¥）</span>
              <input
                type="number"
                step="0.1"
                min={0}
                value={settings.bonusPrice}
                onChange={(e) => updateSetting({ bonusPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="ios-input w-24 text-right"
              />
            </div>
            <div className="ios-list-item">
              <span style={{ color: "var(--ios-label)" }}>奖励门槛（单/月）</span>
              <input
                type="number"
                min={1}
                value={settings.bonusThreshold}
                onChange={(e) => updateSetting({ bonusThreshold: Math.max(1, parseInt(e.target.value) || 0) })}
                className="ios-input w-24 text-right"
              />
            </div>
          </IOSCard>
          <p className="text-xs mt-2 px-1" style={{ color: "var(--ios-label-secondary)" }}>
            当月单量达到门槛后，系统会自动按奖励单价重新计算收入。
          </p>
        </IOSListSection>
      </motion.div>

      {/* 班次偏好 */}
      <motion.div variants={item}>
        <IOSListSection title="班次偏好">
          <IOSCard padding="none">
            <div className="ios-list-item" style={{ borderBottom: "0.5px solid var(--ios-separator)" }}>
              <span style={{ color: "var(--ios-label)" }}>当前班次</span>
              <select
                value={settings.currentShift}
                onChange={(e) => updateSetting({ currentShift: e.target.value as typeof settings.currentShift })}
                className="ios-input appearance-none text-right"
                style={{ backgroundImage: "none" }}
              >
                {SHIFT_DEFINITIONS.map((s) => (
                  <option key={s.type} value={s.type}>
                    {s.emoji} {s.name} · {s.timeRange}
                  </option>
                ))}
              </select>
            </div>
            <div className="ios-list-item">
              <span style={{ color: "var(--ios-label)" }}>每周工作天数</span>
              <input
                type="number"
                min={1}
                max={7}
                value={settings.workDaysPerWeek}
                onChange={(e) => updateSetting({ workDaysPerWeek: Math.min(7, Math.max(1, parseInt(e.target.value) || 1)) })}
                className="ios-input w-24 text-right"
              />
            </div>
          </IOSCard>
        </IOSListSection>
      </motion.div>

      {/* 天气定位 */}
      <motion.div variants={item}>
        <IOSListSection title="天气定位" footer={settings.cityCoords ? `已设置：${settings.city || "GPS 自动定位"}` : "使用 GPS 自动定位或手动搜索城市"}>
          <IOSCard padding="md">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="搜索城市"
                className="ios-input flex-1"
              />
              <button
                onClick={handleSearchCity}
                disabled={cityLoading}
                className="ios-btn px-4"
              >
                {cityLoading ? "搜索中" : "搜索"}
              </button>
            </div>
            {cityResults.length > 0 && (
              <div className="space-y-1">
                {cityResults.slice(0, 5).map((r) => (
                  <button
                    key={`${r.name}-${r.lat}`}
                    onClick={() => handleSelectCity(r)}
                    className="w-full text-left px-3 py-2.5 rounded-lg active:opacity-70"
                    style={{ background: "var(--ios-fill-secondary)" }}
                  >
                    <span className="text-sm" style={{ color: "var(--ios-label)" }}>{r.name}</span>
                    {r.admin1 && (
                      <span className="text-xs ml-2" style={{ color: "var(--ios-label-secondary)" }}>{r.admin1}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={handleDetectLocation}
              disabled={locating}
              className="w-full mt-3 py-2.5 rounded-lg text-sm font-medium active:opacity-70"
              style={{ background: "var(--ios-fill-secondary)", color: "var(--ios-system-blue)" }}
            >
              {locating ? "定位中..." : "使用当前位置"}
            </button>
          </IOSCard>
        </IOSListSection>
      </motion.div>

      {/* 云端同步 */}
      <motion.div variants={item}>
        <IOSListSection title="云端同步">
          <IOSCard padding="md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cloud size={16} style={{ color: "var(--ios-system-blue)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--ios-label)" }}>
                  Supabase 同步
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: "var(--ios-fill-secondary)" }}>
                <Icon size={12} style={{ color: config.color }} />
                <span className="text-[11px]" style={{ color: config.color }}>{config.label}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>Project URL</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://xxx.supabase.co"
                  className="ios-input w-full mt-1"
                />
              </div>
              <div>
                <label className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>Anon Key</label>
                <input
                  type="password"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJ..."
                  className="ios-input w-full mt-1"
                />
              </div>
              <div>
                <label className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>用户 ID（可选）</label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="用于多设备同步"
                  className="ios-input w-full mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={handleSaveCloud}
                disabled={testing}
                className="ios-btn flex items-center justify-center gap-1"
              >
                <Save size={14} />
                {testing ? "测试中" : "保存并同步"}
              </button>
              <button
                onClick={handleClearCloud}
                className="py-3 rounded-lg text-sm font-semibold active:opacity-70"
                style={{ background: "var(--ios-fill-secondary)", color: "var(--ios-system-red)" }}
              >
                清除配置
              </button>
            </div>
          </IOSCard>
        </IOSListSection>
      </motion.div>

      {/* 数据管理 */}
      <motion.div variants={item}>
        <IOSListSection title="数据管理">
          <IOSList>
            <IOSListItem
              label="备份数据到 JSON"
              icon={<Download size={16} style={{ color: "var(--ios-system-blue)" }} />}
              chevron
              onClick={handleExportJSON}
            />
            <IOSListItem
              label="从 JSON 恢复"
              icon={<Upload size={16} style={{ color: "var(--ios-system-green)" }} />}
              chevron
              onClick={handleImportJSON}
            />
            <IOSListItem
              label="加载演示数据"
              icon={<Beaker size={16} style={{ color: "var(--ios-system-orange)" }} />}
              chevron
              onClick={handleLoadDemo}
            />
            <IOSListItem
              label="重置所有数据"
              icon={<RotateCcw size={16} style={{ color: "var(--ios-system-red)" }} />}
              chevron
              onClick={handleReset}
            />
          </IOSList>
        </IOSListSection>
      </motion.div>

      {/* 关于 */}
      <motion.div variants={item}>
        <IOSListSection title="关于">
          <IOSCard padding="md">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--ios-fill-secondary)" }}
              >
                <Info size={20} style={{ color: "var(--ios-system-blue)" }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--ios-label)" }}>Rider Power</p>
                <p className="text-xs" style={{ color: "var(--ios-label-secondary)" }}>智能骑手工作台 v7.0</p>
              </div>
            </div>
          </IOSCard>
        </IOSListSection>
      </motion.div>
    </motion.div>
  );
}
