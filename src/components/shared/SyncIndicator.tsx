import { useState, useEffect } from "react";
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { getSyncStatus, onSyncChange, isSupabaseConfigured } from "@/services/supabase";
import type { SyncStatus } from "@/services/supabase";

const STATUS_CONFIG: Record<SyncStatus, { icon: typeof Cloud; color: string; label: string }> = {
  idle: { icon: Cloud, color: "text-white/30", label: "等待同步" },
  syncing: { icon: RefreshCw, color: "text-[#00D2FF] animate-spin", label: "同步中" },
  synced: { icon: CheckCircle2, color: "text-emerald-400", label: "已同步" },
  error: { icon: AlertCircle, color: "text-red-400", label: "同步失败" },
  offline: { icon: CloudOff, color: "text-white/30", label: "离线模式" },
};

export default function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => {
    const unsub = onSyncChange(setStatus);
    return unsub;
  }, []);

  if (!isSupabaseConfigured()) return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-subtle">
      <Icon size={12} className={config.color} />
      <span className={`text-[10px] ${config.color}`}>{config.label}</span>
    </div>
  );
}